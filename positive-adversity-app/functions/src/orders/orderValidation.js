const { HttpsError } = require("firebase-functions/v2/https");
const { cleanString } = require("../utils/strings");
const { FLAT_RATE_SHIPPING_AMOUNT } = require("../config/shipping");

const PAYMENT_OPTIONS = new Set(["stripe"]);
const FULFILLMENT_METHODS = new Set(["pickup", "flat_rate"]);
const MAX_ITEMS_PER_ORDER = 30;
const MAX_QUANTITY_PER_ITEM = 20;

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

function normalizeCheckout(data) {
  const customer = data.customer || {};
  const shippingAddress = data.shippingAddress || {};
  const payment = data.payment || {};
  const fulfillment = data.fulfillment || {};
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

  const fulfillmentMethod = cleanString(fulfillment.method, 40).toLowerCase();

  if (!FULFILLMENT_METHODS.has(fulfillmentMethod)) {
    throw new HttpsError("invalid-argument", "Select a valid fulfillment method.");
  }

  const isLocalPickup = fulfillmentMethod === "pickup";

  return {
    customer: {
      fullName: requireString(customer.fullName, "Full name", 120),
      email: requireEmail(customer.email),
      phone: requireString(customer.phone, "Phone number", 40),
    },
    shippingAddress: {
      streetAddress: isLocalPickup
        ? cleanString(shippingAddress.streetAddress, 160)
        : requireString(shippingAddress.streetAddress, "Street address", 160),
      apartment: cleanString(shippingAddress.apartment, 80),
      city: isLocalPickup
        ? cleanString(shippingAddress.city, 80)
        : requireString(shippingAddress.city, "City", 80),
      state: (isLocalPickup
        ? cleanString(shippingAddress.state, 40)
        : requireString(shippingAddress.state, "State", 40)
      ).toUpperCase(),
      zip: isLocalPickup
        ? cleanString(shippingAddress.zip, 20)
        : requireString(shippingAddress.zip, "Zip", 20),
    },
    fulfillment: {
      method: fulfillmentMethod,
      label: isLocalPickup ? "Local Pickup" : "$17 Flat Rate Shipping",
      shippingAmount: isLocalPickup ? 0 : FLAT_RATE_SHIPPING_AMOUNT,
      status: "selected",
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

module.exports = {
  requireString,
  parseQuantity,
  normalizeCheckout,
};
