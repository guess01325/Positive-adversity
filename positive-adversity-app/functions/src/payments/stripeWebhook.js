const { onRequest } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../config/firebase");
const {
  stripeSecretKey,
  stripeWebhookSecret,
  getStripeClient,
} = require("../config/stripe");
const { reduceInventoryForOrder } = require("../inventory/inventoryService");
const { cleanString } = require("../utils/strings");
const {
  STRIPE_PAID_STATUS,
  STRIPE_INVENTORY_REVIEW_STATUS,
  getTimestampOrServerTimestamp,
  getStripeIdentifierList,
} = require("../orders/orderHelpers");

const stripeWebhook = onRequest(
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

module.exports = {
  stripeWebhook,
};
