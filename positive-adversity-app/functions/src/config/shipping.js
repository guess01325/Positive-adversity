const STANDARD_SHIPPING_AMOUNT = 7;
const SHOE_SHIPPING_AMOUNT = 17;

function calculateShippingAmount(fulfillmentMethod, items = []) {
  if (fulfillmentMethod !== "flat_rate") return 0;

  return items.some((item) => item.category === "Shoes")
    ? SHOE_SHIPPING_AMOUNT
    : STANDARD_SHIPPING_AMOUNT;
}

function isValidShippingAmount(fulfillmentMethod, items, shippingAmount) {
  return (
    Number(shippingAmount) ===
    calculateShippingAmount(fulfillmentMethod, items)
  );
}

module.exports = {
  STANDARD_SHIPPING_AMOUNT,
  SHOE_SHIPPING_AMOUNT,
  calculateShippingAmount,
  isValidShippingAmount,
};
