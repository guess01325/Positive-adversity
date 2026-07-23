const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../config/firebase");
const { cleanString, normalizeEmail } = require("../utils/strings");
const {
  ORDER_LOOKUP_EMAIL_LIST_LIMIT,
  ORDER_LOOKUP_GENERIC_ERROR,
  ORDER_LOOKUP_TEMPORARY_ERROR,
  assertOrderLookupAllowed,
  fetchOrdersByEmail,
  orderEmailMatches,
  toCustomerOrderResponse,
  toCustomerOrderSummaryResponse,
} = require("./orderHelpers");

const lookupCustomerOrder = onCall(async (request) => {
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

module.exports = {
  lookupCustomerOrder,
};
