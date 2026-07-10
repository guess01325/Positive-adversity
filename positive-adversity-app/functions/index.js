const {
  onCall,
  onRequest,
  HttpsError,
} = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");
const Stripe = require("stripe");

initializeApp();

const db = getFirestore();
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const siteUrl = defineString("SITE_URL", {
  default: "https://www.positiveadversity.org",
});

const PAYMENT_OPTIONS = new Set(["cashapp", "venmo", "paypal", "stripe"]);
const MAX_ITEMS_PER_ORDER = 30;
const MAX_QUANTITY_PER_ITEM = 20;
const CURRENCY = "usd";
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

let stripeClient;

function cleanString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function requireString(value, label, maxLength) {
  const cleanValue = cleanString(value, maxLength);

  if (!cleanValue) {
    throw new HttpsError("invalid-argument", `${label} is required.`);
  }

  return cleanValue;
}

function requireEmail(value) {
  const email = requireString(value, "Email", 120).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  return email;
}

function normalizeEmail(value) {
  return cleanString(value, 120).toLowerCase();
}

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

function parseQuantity(value) {
  const quantity = Number(value);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY_PER_ITEM
  ) {
    throw new HttpsError("invalid-argument", "Invalid item quantity.");
  }

  return quantity;
}

function getStripeClient() {
  const secretKey = stripeSecretKey.value();

  if (!secretKey) {
    throw new HttpsError(
      "failed-precondition",
      "Stripe is not configured for checkout.",
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

function getCheckoutSiteUrl() {
  const configuredUrl = cleanString(siteUrl.value(), 240);

  if (!configuredUrl) {
    throw new HttpsError(
      "failed-precondition",
      "Site URL is not configured for Stripe checkout.",
    );
  }

  return configuredUrl.replace(/\/+$/, "");
}

function getOrderStatusForPayment(paymentOption) {
  return paymentOption === "stripe" ? STRIPE_PENDING_STATUS : "pending";
}

function dollarsToCents(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpsError("failed-precondition", "One item has an invalid price.");
  }

  return Math.round(amount * 100);
}

function getInventoryQuantity(product, size) {
  const inventory = product.inventory || {};

  if (!Object.prototype.hasOwnProperty.call(inventory, size)) {
    throw new HttpsError(
      "failed-precondition",
      `${product.name || "This item"} is not available in that size.`,
    );
  }

  return Math.max(0, Number(inventory[size] || 0));
}

function getStripeIdentifierList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hashLookupKey(orderId, email) {
  return crypto
    .createHash("sha256")
    .update(`${orderId}:${email}`)
    .digest("hex");
}

function maskEmail(email) {
  const [name = "", domain = ""] = normalizeEmail(email).split("@");

  if (!name || !domain) return "";

  const visibleName =
    name.length <= 2 ? `${name[0] || ""}***` : `${name.slice(0, 2)}***`;
  const domainParts = domain.split(".");
  const domainName = domainParts[0] || "";
  const domainSuffix = domainParts.slice(1).join(".");
  const visibleDomain =
    domainName.length <= 1
      ? `${domainName}***`
      : `${domainName[0]}***`;

  return `${visibleName}@${visibleDomain}${domainSuffix ? `.${domainSuffix}` : ""}`;
}

function serializeTimestamp(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function getTimestampOrServerTimestamp(value) {
  return value || FieldValue.serverTimestamp();
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

async function buildOrderItemsFromCheckout(transaction, checkout) {
  const orderItems = [];
  let total = 0;

  for (const item of getGroupedOrderItems(checkout.items).values()) {
    const productRef = db.collection("products").doc(item.productId);
    const productSnap = await transaction.get(productRef);

    if (!productSnap.exists) {
      throw new HttpsError("not-found", "One item in your cart is no longer available.");
    }

    const product = productSnap.data() || {};

    if (product.inStock === false) {
      throw new HttpsError(
        "failed-precondition",
        `${product.name || "This item"} is no longer in stock.`,
      );
    }

    const availableQuantity = getInventoryQuantity(product, item.size);

    if (item.quantity > availableQuantity) {
      throw new HttpsError(
        "failed-precondition",
        `Only ${availableQuantity} ${product.name}${item.size ? ` in size ${item.size}` : ""} available.`,
      );
    }

    const price = Number(product.price || 0);

    if (!Number.isFinite(price) || price < 0) {
      throw new HttpsError("failed-precondition", "One item has an invalid price.");
    }

    total += price * item.quantity;
    orderItems.push({
      productId: item.productId,
      name: cleanString(product.name, 160),
      size: item.size,
      quantity: item.quantity,
      price,
    });
  }

  return {
    items: orderItems,
    total,
    cartFingerprint: getCartFingerprint(orderItems, total),
  };
}

async function reduceInventoryForOrder(transaction, orderItems) {
  const productUpdates = new Map();

  for (const item of getGroupedOrderItems(orderItems).values()) {
    const productRef = db.collection("products").doc(item.productId);
    const productSnap = await transaction.get(productRef);

    if (!productSnap.exists) {
      return {
        available: false,
        reason: "One item in this paid order is no longer available.",
      };
    }

    const product = productSnap.data() || {};

    if (product.inStock === false) {
      return {
        available: false,
        reason: `${product.name || "This item"} is no longer in stock.`,
      };
    }

    if (!Object.prototype.hasOwnProperty.call(product.inventory || {}, item.size)) {
      return {
        available: false,
        reason: `${product.name || "This item"} is not available in that size.`,
      };
    }

    const availableQuantity = getInventoryQuantity(product, item.size);

    if (item.quantity > availableQuantity) {
      return {
        available: false,
        reason: `Only ${availableQuantity} ${product.name}${item.size ? ` in size ${item.size}` : ""} available.`,
      };
    }

    const inventory = {
      ...(productUpdates.get(item.productId)?.inventory || product.inventory || {}),
    };
    inventory[item.size] = availableQuantity - item.quantity;

    productUpdates.set(item.productId, {
      productRef,
      inventory,
    });
  }

  productUpdates.forEach(({ productRef, inventory }) => {
    transaction.update(productRef, {
      inventory,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    available: true,
  };
}

function logFunctionError(step, error, extra = {}) {
  console.error(`[store checkout] ${step} failed`, {
    code: error?.code,
    message: error?.message,
    type: error?.type,
    stripeCode: error?.raw?.code,
    stripeParam: error?.raw?.param,
    stripeRequestId: error?.requestId || error?.raw?.requestId,
    ...extra,
  });
}

function normalizeCheckout(data) {
  const customer = data.customer || {};
  const shippingAddress = data.shippingAddress || {};
  const payment = data.payment || {};
  const items = Array.isArray(data.items) ? data.items : [];

  if (items.length === 0) {
    throw new HttpsError("invalid-argument", "Add at least one item to your cart.");
  }

  if (items.length > MAX_ITEMS_PER_ORDER) {
    throw new HttpsError("invalid-argument", "Too many items in this order.");
  }

  const paymentOption = cleanString(payment.option, 40).toLowerCase();

  if (!PAYMENT_OPTIONS.has(paymentOption)) {
    throw new HttpsError("invalid-argument", "Select a valid payment option.");
  }

  return {
    customer: {
      fullName: requireString(customer.fullName, "Full name", 120),
      email: requireEmail(customer.email),
      phone: requireString(customer.phone, "Phone number", 40),
    },
    shippingAddress: {
      streetAddress: requireString(
        shippingAddress.streetAddress,
        "Street address",
        160,
      ),
      apartment: cleanString(shippingAddress.apartment, 80),
      city: requireString(shippingAddress.city, "City", 80),
      state: requireString(shippingAddress.state, "State", 40).toUpperCase(),
      zip: requireString(shippingAddress.zip, "Zip", 20),
    },
    payment: {
      option: paymentOption,
      referenceId: cleanString(payment.referenceId, 160),
    },
    items: items.map((item) => ({
      productId: requireString(item.productId, "Product", 120),
      size: cleanString(item.size, 80),
      quantity: parseQuantity(item.quantity),
    })),
  };
}

exports.submitStoreOrder = onCall(async (request) => {
  let checkout;
  let orderRef;

  try {
    checkout = normalizeCheckout(request.data || {});
    const requestedOrderId = cleanString(request.data?.pendingOrderId, 120);
    const checkoutAttemptId = cleanString(request.data?.checkoutAttemptId, 120);
    orderRef = requestedOrderId
      ? db.collection("orders").doc(requestedOrderId)
      : db.collection("orders").doc();

    console.log("[store checkout] submitStoreOrder:start", {
      orderId: orderRef.id,
      itemCount: checkout.items.length,
      paymentOption: checkout.payment.option,
      hasPendingOrderId: Boolean(requestedOrderId),
    });

    const order = await db.runTransaction(async (transaction) => {
      const existingOrderSnap = requestedOrderId
        ? await transaction.get(orderRef)
        : null;
      const existingOrder = existingOrderSnap?.exists
        ? existingOrderSnap.data() || {}
        : null;
      const calculatedOrder = await buildOrderItemsFromCheckout(transaction, checkout);

      if (existingOrder) {
        if (checkout.payment.option !== "stripe") {
          throw new HttpsError(
            "failed-precondition",
            "Only Stripe pending orders can be retried.",
          );
        }

        if (
          existingOrder.payment?.option !== "stripe" &&
          existingOrder.paymentMethod !== "stripe"
        ) {
          throw new HttpsError(
            "failed-precondition",
            "This pending order was not created for Stripe checkout.",
          );
        }

        if (
          existingOrder.status !== STRIPE_PENDING_STATUS ||
          existingOrder.paymentConfirmed === true
        ) {
          throw new HttpsError(
            "failed-precondition",
            "This checkout attempt can no longer be retried.",
          );
        }

        if (
          !checkoutAttemptId ||
          existingOrder.checkoutAttemptId !== checkoutAttemptId ||
          existingOrder.cartFingerprint !== calculatedOrder.cartFingerprint
        ) {
          throw new HttpsError(
            "failed-precondition",
            "This saved checkout no longer matches your cart. Please start checkout again.",
          );
        }
      }

      const orderData = {
        orderNumber: orderRef.id,
        customer: checkout.customer,
        customerEmailNormalized: normalizeEmail(checkout.customer.email),
        shippingAddress: checkout.shippingAddress,
        payment: checkout.payment,
        paymentMethod: checkout.payment.option,
        items: calculatedOrder.items,
        total: calculatedOrder.total,
        status: getOrderStatusForPayment(checkout.payment.option),
        fulfillmentStatus:
          checkout.payment.option === "stripe" ? "pending_payment" : "processing",
        paymentConfirmed: false,
        paymentStatus: checkout.payment.option === "stripe" ? "unpaid" : "pending",
        cartFingerprint: calculatedOrder.cartFingerprint,
        updatedAt: FieldValue.serverTimestamp(),
        ...(checkoutAttemptId ? { checkoutAttemptId } : {}),
        ...(existingOrder ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (checkout.payment.option === "stripe") {
        transaction.set(orderRef, {
          ...orderData,
          inventoryFinalized: false,
        }, { merge: true });
      } else {
        const inventoryResult = await reduceInventoryForOrder(
          transaction,
          calculatedOrder.items,
        );

        if (!inventoryResult.available) {
          throw new HttpsError(
            "failed-precondition",
            inventoryResult.reason || "One item in your cart is no longer available.",
          );
        }

        transaction.set(orderRef, {
          ...orderData,
          inventoryFinalized: true,
          inventoryFinalizedAt: FieldValue.serverTimestamp(),
        });
      }

      return orderData;
    });

    console.log("[store checkout] submitStoreOrder:success", {
      orderId: orderRef.id,
      total: order.total,
      itemCount: order.items.length,
      status: order.status,
    });

    return {
      orderId: orderRef.id,
      total: order.total,
    };
  } catch (error) {
    logFunctionError("submitStoreOrder", error, {
      orderId: orderRef?.id || "",
      paymentOption: checkout?.payment?.option || "",
    });

    throw error;
  }
});

exports.lookupCustomerOrder = onCall(async (request) => {
  const orderId = cleanString(request.data?.orderId, 120);
  const email = normalizeEmail(request.data?.email);

  if (!email) {
    throw new HttpsError("not-found", ORDER_LOOKUP_GENERIC_ERROR);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("not-found", ORDER_LOOKUP_GENERIC_ERROR);
  }

  try {
    await assertOrderLookupAllowed(orderId || "email-only", email);

    if (!orderId) {
      const matchedOrders = await fetchOrdersByEmail(email);
      const orders = matchedOrders
        .map(({ id, order }) => ({
          id,
          ...toCustomerOrderSummaryResponse(id, order),
        }))
        .sort((a, b) => {
          const dateA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
          const dateB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, ORDER_LOOKUP_EMAIL_LIST_LIMIT);

      if (orders.length === 0) {
        console.warn("[store checkout] order email lookup empty");
        throw new HttpsError("not-found", ORDER_LOOKUP_GENERIC_ERROR);
      }

      return {
        orders,
      };
    }

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const order = orderSnap.exists ? orderSnap.data() || {} : null;

    if (!order || !orderEmailMatches(order, email)) {
      console.warn("[store checkout] order lookup mismatch", {
        orderId,
        hasOrder: Boolean(order),
      });
      throw new HttpsError("not-found", ORDER_LOOKUP_GENERIC_ERROR);
    }

    return {
      order: toCustomerOrderResponse(orderSnap.id, order),
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    console.error("[store checkout] lookupCustomerOrder failed", {
      orderId,
      code: error?.code,
      message: error?.message,
    });

    throw new HttpsError(
      "internal",
      ORDER_LOOKUP_TEMPORARY_ERROR,
    );
  }
});

exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    let orderId = "";

    try {
      orderId = requireString(request.data?.orderId, "Order ID", 120);
      console.log("[store checkout] createCheckoutSession:start", { orderId });

      const orderSnap = await db.collection("orders").doc(orderId).get();

      if (!orderSnap.exists) {
        throw new HttpsError("not-found", "Order not found.");
      }

      const order = orderSnap.data() || {};

      if (order.payment?.option !== "stripe" && order.paymentMethod !== "stripe") {
        throw new HttpsError(
          "failed-precondition",
          "This order was not created for Stripe checkout.",
        );
      }

      if (order.status !== STRIPE_PENDING_STATUS) {
        throw new HttpsError(
          "failed-precondition",
          "This checkout is no longer pending.",
        );
      }

      if (order.status === "paid" || order.paymentConfirmed === true) {
        throw new HttpsError("failed-precondition", "This order is already paid.");
      }

      const items = Array.isArray(order.items) ? order.items : [];

      if (items.length === 0) {
        throw new HttpsError("failed-precondition", "This order has no items.");
      }

      const lineItems = items.map((item) => {
        const quantity = parseQuantity(item.quantity);
        const unitAmount = dollarsToCents(item.price);

        if (unitAmount < 1) {
          throw new HttpsError(
            "failed-precondition",
            "Stripe checkout requires every item to have a positive price.",
          );
        }

        return {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: cleanString(
                `${item.name || "Store item"}${item.size ? ` - ${item.size}` : ""}`,
                200,
              ),
            },
            unit_amount: unitAmount,
          },
          quantity,
        };
      });

      const baseUrl = getCheckoutSiteUrl();
      console.log("[store checkout] createCheckoutSession:stripeRequest", {
        orderId,
        itemCount: lineItems.length,
        baseUrl,
      });
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        customer_email: order.customer?.email || undefined,
        success_url: `${baseUrl}/store/checkout/success?orderId=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/store/checkout/cancel?orderId=${encodeURIComponent(orderId)}`,
        client_reference_id: orderId,
        metadata: {
          orderId,
          checkoutAttemptId: cleanString(order.checkoutAttemptId, 120),
        },
        payment_intent_data: {
          metadata: {
            orderId,
            checkoutAttemptId: cleanString(order.checkoutAttemptId, 120),
          },
        },
      });

      await orderSnap.ref.update({
        stripeSessionId: session.id,
        stripeSessionIds: FieldValue.arrayUnion(session.id),
        paymentStatus: "checkout_started",
        checkoutSessionCreatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log("[store checkout] createCheckoutSession:success", {
        orderId,
        sessionId: session.id,
        hasUrl: Boolean(session.url),
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      logFunctionError("createCheckoutSession", error, { orderId });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Secure checkout could not be started. Please try again.",
      );
    }
  },
);

exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const signature = request.headers["stripe-signature"];
    const webhookSecret = stripeWebhookSecret.value();

    if (!signature || !webhookSecret) {
      response.status(400).send("Stripe webhook is not configured.");
      return;
    }

    let event;

    try {
      event = getStripeClient().webhooks.constructEvent(
        request.rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      response.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = cleanString(session.metadata?.orderId, 120);

      if (!orderId) {
        response.status(400).send("Missing orderId metadata.");
        return;
      }

      if (session.payment_status !== "paid") {
        response.json({ received: true });
        return;
      }

      const stripePaymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || "";
      const orderRef = db.collection("orders").doc(orderId);

      await db.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists) {
          throw new Error(`Order ${orderId} was not found for Stripe webhook.`);
        }

        const order = orderSnap.data() || {};
        const processedEventIds = getStripeIdentifierList(order.processedStripeEventIds);
        const processedSessionIds = getStripeIdentifierList(order.processedStripeSessionIds);
        const processedPaymentIntentIds = getStripeIdentifierList(
          order.processedStripePaymentIntentIds,
        );
        const alreadyProcessed =
          processedEventIds.includes(event.id) ||
          processedSessionIds.includes(session.id) ||
          (stripePaymentIntentId &&
            processedPaymentIntentIds.includes(stripePaymentIntentId));
        const alreadyFinalized =
          order.paymentConfirmed === true &&
          (order.status === STRIPE_PAID_STATUS ||
            order.status === STRIPE_INVENTORY_REVIEW_STATUS);

        const stripeTrackingUpdate = {
          latestStripeSessionId: session.id,
          stripeSessionIds: FieldValue.arrayUnion(session.id),
          processedStripeEventIds: FieldValue.arrayUnion(event.id),
          processedStripeSessionIds: FieldValue.arrayUnion(session.id),
          updatedAt: FieldValue.serverTimestamp(),
          ...(stripePaymentIntentId
            ? {
                latestStripePaymentIntentId: stripePaymentIntentId,
                processedStripePaymentIntentIds: FieldValue.arrayUnion(
                  stripePaymentIntentId,
                ),
              }
            : {}),
        };
        const stripeFinalizationUpdate = {
          ...stripeTrackingUpdate,
          stripeSessionId: session.id,
          ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
        };

        if (alreadyProcessed || alreadyFinalized) {
          transaction.set(orderRef, stripeTrackingUpdate, { merge: true });
          return;
        }

        if (
          order.payment?.option !== "stripe" &&
          order.paymentMethod !== "stripe"
        ) {
          throw new Error(`Order ${orderId} is not a Stripe order.`);
        }

        const items = Array.isArray(order.items) ? order.items : [];

        if (items.length === 0) {
          transaction.set(
            orderRef,
            {
              ...stripeFinalizationUpdate,
              status: STRIPE_INVENTORY_REVIEW_STATUS,
              fulfillmentStatus: "inventory_review",
              paymentConfirmed: true,
              paymentStatus: "paid",
              inventoryFinalized: false,
              inventoryReviewReason: "Paid Stripe order has no items.",
              paidAt: getTimestampOrServerTimestamp(order.paidAt),
            },
            { merge: true },
          );
          return;
        }

        const inventoryResult = await reduceInventoryForOrder(transaction, items);

        if (!inventoryResult.available) {
          transaction.set(
            orderRef,
            {
              ...stripeFinalizationUpdate,
              status: STRIPE_INVENTORY_REVIEW_STATUS,
              fulfillmentStatus: "inventory_review",
              paymentConfirmed: true,
              paymentStatus: "paid",
              inventoryFinalized: false,
              inventoryReviewReason:
                inventoryResult.reason ||
                "Payment succeeded, but inventory needs manual review.",
              paidAt: getTimestampOrServerTimestamp(order.paidAt),
            },
            { merge: true },
          );
          return;
        }

        transaction.set(
          orderRef,
          {
            ...stripeFinalizationUpdate,
            status: STRIPE_PAID_STATUS,
            fulfillmentStatus: "processing",
            paymentConfirmed: true,
            paymentStatus: "paid",
            inventoryFinalized: true,
            inventoryFinalizedAt: FieldValue.serverTimestamp(),
            paidAt: getTimestampOrServerTimestamp(order.paidAt),
          },
          { merge: true },
        );
      });
    }

    response.json({ received: true });
  },
);
