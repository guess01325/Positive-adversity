import test from "node:test";
import assert from "node:assert/strict";

import {
  MONTHLY_FEE_OPTIONS,
  SERVICE_OPTIONS,
  SERVICE_RATES,
  getMonthlyFeeOption,
  getMonthlyFeeOptionsForService,
} from "../src/lib/constants.js";

test("adds supervised visitation services with stable identifiers", () => {
  const serviceValues = SERVICE_OPTIONS.map((option) => option.value);

  assert.ok(serviceValues.includes("dcf_supervised_visitation"));
  assert.ok(serviceValues.includes("mashantucket_supervised_visitation"));
  assert.deepEqual(SERVICE_RATES.dcf_supervised_visitation, {
    client: 25,
    internal: 45,
  });
  assert.deepEqual(SERVICE_RATES.mashantucket_supervised_visitation, {
    client: 25,
    internal: 50,
  });
});

test("keeps the existing supervision fee configuration unchanged", () => {
  const existingFee = getMonthlyFeeOption("dcf_supervision");

  assert.equal(existingFee.label, "Supervision Fee");
  assert.equal(existingFee.amount, 11.25);
  assert.deepEqual(existingFee.eligibleServiceTypes, ["DCF"]);
});

test("exposes DCF supervised visitation fee only for DCF supervised visitation", () => {
  const dcfFees = getMonthlyFeeOptionsForService("dcf_supervised_visitation");
  const mashantucketFees = getMonthlyFeeOptionsForService(
    "mashantucket_supervised_visitation",
  );

  assert.equal(
    dcfFees.some((fee) => fee.value === "dcf_supervised_visitation_fee"),
    true,
  );
  assert.equal(
    mashantucketFees.some(
      (fee) => fee.value === "dcf_supervised_visitation_fee",
    ),
    false,
  );
  assert.equal(MONTHLY_FEE_OPTIONS.length, 2);
});
