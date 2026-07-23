const { HttpsError } = require("firebase-functions/v2/https");
const { cleanString } = require("../utils/strings");

const PAYMENT_OPTIONS = new Set(["cashapp", "venmo", "paypal", "stripe"]);
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

module.exports = {
  requireString,
  parseQuantity,
  normalizeCheckout,
};
