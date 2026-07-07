const {
  onCall,
  onRequest,
  HttpsError,
} = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
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
  return paymentOption === "stripe" ? "pending_payment" : "pending";
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
    orderRef = db.collection("orders").doc();

    console.log("[store checkout] submitStoreOrder:start", {
      orderId: orderRef.id,
      itemCount: checkout.items.length,
      paymentOption: checkout.payment.option,
    });

    const order = await db.runTransaction(async (transaction) => {
      const productGroups = checkout.items.reduce((groups, item) => {
        const key = `${item.productId}::${item.size}`;
        const existingItem = groups.get(key);

        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          groups.set(key, { ...item });
        }

        return groups;
      }, new Map());

      const orderItems = [];
      const productUpdates = new Map();
      let total = 0;

      for (const item of productGroups.values()) {
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

        const inventory = { ...(productUpdates.get(item.productId)?.inventory || product.inventory || {}) };
        inventory[item.size] = availableQuantity - item.quantity;

        productUpdates.set(item.productId, {
          productRef,
          inventory,
        });

        total += price * item.quantity;
        orderItems.push({
          productId: item.productId,
          name: cleanString(product.name, 160),
          size: item.size,
          quantity: item.quantity,
          price,
        });
      }

      productUpdates.forEach(({ productRef, inventory }) => {
        transaction.update(productRef, {
          inventory,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      const orderData = {
        customer: checkout.customer,
        shippingAddress: checkout.shippingAddress,
        payment: checkout.payment,
        paymentMethod: checkout.payment.option,
        items: orderItems,
        total,
        status: getOrderStatusForPayment(checkout.payment.option),
        paymentConfirmed: false,
        createdAt: FieldValue.serverTimestamp(),
      };

      transaction.set(orderRef, orderData);

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
        success_url: `${baseUrl}/store/checkout/success?orderId=${encodeURIComponent(orderId)}`,
        cancel_url: `${baseUrl}/store/checkout/cancel?orderId=${encodeURIComponent(orderId)}`,
        metadata: {
          orderId,
        },
        payment_intent_data: {
          metadata: {
            orderId,
          },
        },
      });

      await orderSnap.ref.update({
        stripeSessionId: session.id,
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

      await db.collection("orders").doc(orderId).set(
        {
          status: "paid",
          paymentConfirmed: true,
          paidAt: FieldValue.serverTimestamp(),
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || "",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    response.json({ received: true });
  },
);
