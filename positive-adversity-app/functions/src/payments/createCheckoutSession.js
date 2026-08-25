const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../config/firebase");
const {
  calculateShippingAmount,
  isValidShippingAmount,
} = require("../config/shipping");
const {
  stripeSecretKey,
  getStripeClient,
  getCheckoutSiteUrl,
} = require("../config/stripe");
const { cleanString } = require("../utils/strings");
const { logFunctionError } = require("../utils/logging");
const { requireString, parseQuantity } = require("../orders/orderValidation");
const { STRIPE_PENDING_STATUS } = require("../orders/orderHelpers");

const CURRENCY = "usd";

function dollarsToCents(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpsError("failed-precondition", "One item has an invalid price.");
  }

  return Math.round(amount * 100);
}

const createCheckoutSession = onCall(
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

      const shippingAmount = dollarsToCents(order.shippingAmount || 0);
      const expectedShippingAmount = calculateShippingAmount(
        order.fulfillment?.method,
        items,
      );

      if (order.fulfillment?.method === "flat_rate") {
        if (
          !isValidShippingAmount(
            order.fulfillment.method,
            items,
            order.shippingAmount || 0,
          )
        ) {
          throw new HttpsError(
            "failed-precondition",
            "This order has an invalid flat-rate shipping amount.",
          );
        }

        lineItems.push({
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: `$${expectedShippingAmount} Shipping`,
            },
            unit_amount: shippingAmount,
          },
          quantity: 1,
        });
      } else if (order.fulfillment?.method !== "pickup" || shippingAmount !== 0) {
        throw new HttpsError(
          "failed-precondition",
          "This order has an invalid fulfillment method or shipping amount.",
        );
      }

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

module.exports = {
  createCheckoutSession,
};
