export const STANDARD_SHIPPING_AMOUNT = 7;
export const SHOE_SHIPPING_AMOUNT = 17;

export function calculateShippingAmount(fulfillmentMethod, items = []) {
  if (fulfillmentMethod !== "flat_rate") return 0;

  return items.some((item) => item.category === "Shoes")
    ? SHOE_SHIPPING_AMOUNT
    : STANDARD_SHIPPING_AMOUNT;
}
