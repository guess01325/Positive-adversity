import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  calculateShippingAmount,
  isValidShippingAmount,
} = require("../functions/src/config/shipping.js");

test("charges $17 shipping for shoes only", () => {
  assert.equal(calculateShippingAmount("flat_rate", [{ category: "Shoes" }]), 17);
});

test("charges $7 shipping for non-shoes only", () => {
  assert.equal(calculateShippingAmount("flat_rate", [{ category: "Shirts" }]), 7);
});

test("charges $17 once for shoes and non-shoes", () => {
  assert.equal(
    calculateShippingAmount("flat_rate", [
      { category: "Shoes" },
      { category: "Shirts" },
    ]),
    17,
  );
});

test("charges $7 once for multiple non-shoe items and quantities", () => {
  assert.equal(
    calculateShippingAmount("flat_rate", [
      { category: "Shirts", quantity: 3 },
      { category: "Socks", quantity: 4 },
    ]),
    7,
  );
});

test("charges $0 for local pickup even when the order contains shoes", () => {
  assert.equal(calculateShippingAmount("pickup", [{ category: "Shoes" }]), 0);
});

test("rejects a shipping amount that does not match the cart hierarchy", () => {
  assert.equal(
    isValidShippingAmount("flat_rate", [{ category: "Shoes" }], 7),
    false,
  );
  assert.equal(
    isValidShippingAmount("flat_rate", [{ category: "Shirts" }], 17),
    false,
  );
  assert.equal(isValidShippingAmount("pickup", [{ category: "Shoes" }], 17), false);
});
