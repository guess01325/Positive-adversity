const { HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../config/firebase");
const { cleanString } = require("../utils/strings");
const {
  getCartFingerprint,
  getGroupedOrderItems,
} = require("../orders/orderHelpers");

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

module.exports = {
  buildOrderItemsFromCheckout,
  reduceInventoryForOrder,
};
