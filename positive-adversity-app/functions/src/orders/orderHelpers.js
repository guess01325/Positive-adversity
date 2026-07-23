const crypto = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../config/firebase");
const { cleanString, maskEmail, normalizeEmail } = require("../utils/strings");

const STRIPE_PENDING_STATUS = "pending_payment";
const STRIPE_PAID_STATUS = "paid";
const STRIPE_INVENTORY_REVIEW_STATUS = "paid_inventory_review";
const ORDER_LOOKUP_LIMIT = 8;
const ORDER_LOOKUP_WINDOW_MS = 15 * 60 * 1000;
const ORDER_LOOKUP_EMAIL_LIST_LIMIT = 20;
const ORDER_LOOKUP_GENERIC_ERROR =
  "Order not found or information does not match.";
const ORDER_LOOKUP_TEMPORARY_ERROR =
  "Order lookup is temporarily unavailable. Please try again later.";

function getOrderEmailCandidates(order = {}) {
  return [
    order.customerEmailNormalized,
    order.customer?.email,
    order.customerEmail,
    order.email,
    order.payment?.customerEmail,
  ]
    .map(normalizeEmail)
    .filter(Boolean);
}

function getOrderEmailNormalized(order = {}) {
  return getOrderEmailCandidates(order)[0] || "";
}

function orderEmailMatches(order, email) {
  const normalizedEmail = normalizeEmail(email);
  return getOrderEmailCandidates(order).includes(normalizedEmail);
}

function hashLookupKey(orderId, email) {
  return crypto
    .createHash("sha256")
    .update(`${orderId}:${email}`)
    .digest("hex");
}

function serializeTimestamp(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getTimestampOrServerTimestamp(value) {
  return value || FieldValue.serverTimestamp();
}

function getOrderStatusForPayment(paymentOption) {
  return paymentOption === "stripe" ? STRIPE_PENDING_STATUS : "pending";
}

function getCustomerOrderStatus(order) {
  if (order.status === STRIPE_INVENTORY_REVIEW_STATUS) {
    return "inventory_review";
  }

  if (order.paymentConfirmed === true || order.status === STRIPE_PAID_STATUS) {
    return "processing";
  }

  return "pending_payment";
}

function isCustomerOrderFinalized(order) {
  return (
    order.paymentConfirmed === true ||
    order.status === STRIPE_PAID_STATUS ||
    order.status === STRIPE_INVENTORY_REVIEW_STATUS
  );
}

function toCustomerOrderResponse(orderId, order) {
  const safeItems = Array.isArray(order.items)
    ? order.items.map((item) => ({
        name: cleanString(item.name, 160),
        size: cleanString(item.size, 80),
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        lineTotal:
          Number(item.price || 0) * Number(item.quantity || 0),
      }))
    : [];
  const finalized = isCustomerOrderFinalized(order);

  return {
    orderNumber: order.orderNumber || orderId,
    customerName: cleanString(order.customer?.fullName, 120),
    email: maskEmail(getOrderEmailNormalized(order)),
    items: finalized ? safeItems : [],
    total: finalized ? Number(order.total || 0) : null,
    paymentStatus: order.paymentStatus || (finalized ? "paid" : "pending"),
    fulfillmentStatus: order.fulfillmentStatus || getCustomerOrderStatus(order),
    status: order.status || STRIPE_PENDING_STATUS,
    finalized,
    orderDate: serializeTimestamp(order.createdAt),
    paidDate: serializeTimestamp(order.paidAt),
    shippingAddress: finalized
      ? {
          streetAddress: cleanString(order.shippingAddress?.streetAddress, 160),
          apartment: cleanString(order.shippingAddress?.apartment, 80),
          city: cleanString(order.shippingAddress?.city, 80),
          state: cleanString(order.shippingAddress?.state, 40),
          zip: cleanString(order.shippingAddress?.zip, 20),
        }
      : null,
  };
}

function toCustomerOrderSummaryResponse(orderId, order) {
  const finalized = isCustomerOrderFinalized(order);

  return {
    orderNumber: order.orderNumber || orderId,
    orderDate: serializeTimestamp(order.createdAt),
    total: finalized ? Number(order.total || 0) : null,
    paymentStatus: order.paymentStatus || (finalized ? "paid" : "pending"),
    fulfillmentStatus: order.fulfillmentStatus || getCustomerOrderStatus(order),
  };
}

async function assertOrderLookupAllowed(orderId, email) {
  const now = Date.now();
  const windowStart = now - ORDER_LOOKUP_WINDOW_MS;
  const lookupRef = db
    .collection("orderLookupRateLimits")
    .doc(hashLookupKey(orderId, email));

  await db.runTransaction(async (transaction) => {
    const lookupSnap = await transaction.get(lookupRef);
    const data = lookupSnap.exists ? lookupSnap.data() || {} : {};
    const resetAtMs =
      typeof data.resetAt?.toMillis === "function"
        ? data.resetAt.toMillis()
        : 0;
    const shouldReset = !lookupSnap.exists || resetAtMs <= now;
    const attemptCount = shouldReset ? 0 : Number(data.attemptCount || 0);

    if (!shouldReset && attemptCount >= ORDER_LOOKUP_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many lookup attempts. Please try again later.",
      );
    }

    transaction.set(
      lookupRef,
      {
        attemptCount: attemptCount + 1,
        resetAt: new Date(shouldReset ? now + ORDER_LOOKUP_WINDOW_MS : resetAtMs),
        lastAttemptAt: FieldValue.serverTimestamp(),
        windowStart: new Date(shouldReset ? now : windowStart),
      },
      { merge: true },
    );
  });
}

async function fetchOrdersByEmail(email) {
  const matchingOrders = new Map();
  const lookupFields = [
    "customerEmailNormalized",
    "customer.email",
    "customerEmail",
    "email",
    "payment.customerEmail",
  ];

  for (const fieldPath of lookupFields) {
    const snapshot = await db
      .collection("orders")
      .where(fieldPath, "==", email)
      .get();

    snapshot.docs.forEach((orderDoc) => {
      const order = orderDoc.data() || {};

      if (orderEmailMatches(order, email)) {
        matchingOrders.set(orderDoc.id, order);
      }
    });
  }

  return Array.from(matchingOrders.entries()).map(([id, order]) => ({
    id,
    order,
  }));
}

function getCartFingerprint(items, total) {
  const normalizedItems = items
    .map((item) => ({
      productId: item.productId,
      size: item.size || "",
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
    }))
    .sort((a, b) => {
      const productCompare = a.productId.localeCompare(b.productId);
      if (productCompare !== 0) return productCompare;
      return a.size.localeCompare(b.size);
    });

  return JSON.stringify({
    items: normalizedItems,
    total: Number(total || 0),
  });
}

function getGroupedOrderItems(items) {
  return items.reduce((groups, item) => {
    const key = `${item.productId}::${item.size || ""}`;
    const existingItem = groups.get(key);

    if (existingItem) {
      existingItem.quantity += Number(item.quantity || 0);
    } else {
      groups.set(key, {
        productId: item.productId,
        size: item.size || "",
        quantity: Number(item.quantity || 0),
      });
    }

    return groups;
  }, new Map());
}

function getStripeIdentifierList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

module.exports = {
  STRIPE_PENDING_STATUS,
  STRIPE_PAID_STATUS,
  STRIPE_INVENTORY_REVIEW_STATUS,
  ORDER_LOOKUP_EMAIL_LIST_LIMIT,
  ORDER_LOOKUP_GENERIC_ERROR,
  ORDER_LOOKUP_TEMPORARY_ERROR,
  getOrderStatusForPayment,
  getTimestampOrServerTimestamp,
  toCustomerOrderResponse,
  toCustomerOrderSummaryResponse,
  assertOrderLookupAllowed,
  fetchOrdersByEmail,
  getCartFingerprint,
  getGroupedOrderItems,
  getStripeIdentifierList,
  orderEmailMatches,
};
