const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../config/firebase");
const { reduceInventoryForOrder, buildOrderItemsFromCheckout } = require("../inventory/inventoryService");
const { cleanString, normalizeEmail } = require("../utils/strings");
const { logFunctionError } = require("../utils/logging");
const { calculateShippingAmount } = require("../config/shipping");
const { normalizeCheckout } = require("./orderValidation");
const {
  STRIPE_PENDING_STATUS,
  getOrderStatusForPayment,
} = require("./orderHelpers");

const submitStoreOrder = onCall(async (request) => {
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
      const shippingAmount = calculateShippingAmount(
        checkout.fulfillment.method,
        calculatedOrder.items,
      );
      const fulfillment = {
        ...checkout.fulfillment,
        label:
          checkout.fulfillment.method === "pickup"
            ? "Local Pickup"
            : `$${shippingAmount} Shipping`,
        shippingAmount,
      };

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
        fulfillment,
        payment: checkout.payment,
        paymentMethod: checkout.payment.option,
        items: calculatedOrder.items,
        subtotal: calculatedOrder.total,
        shippingAmount,
        total: calculatedOrder.total + shippingAmount,
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

module.exports = {
  submitStoreOrder,
};
