import test from "node:test";
import assert from "node:assert/strict";

import {
  auditEntryMonthKeys,
  formatLocalCalendarDate,
  getEntryMonthKey,
  isValidEntryDate,
  monthKeyFromEntryDate,
} from "../src/lib/entryMonth.js";

test("validates date-only calendar values without UTC parsing", () => {
  assert.equal(isValidEntryDate("2024-02-29"), true);
  assert.equal(isValidEntryDate("2026-02-29"), false);
  assert.equal(isValidEntryDate("2026-06-31"), false);
  assert.equal(isValidEntryDate("2026-07-01"), true);
});

test("derives first-of-month keys directly from the service date", () => {
  assert.equal(monthKeyFromEntryDate("2026-06-01"), "2026-06");
  assert.equal(monthKeyFromEntryDate("2026-07-01"), "2026-07");
});

test("uses a valid entry date before a conflicting stored month key", () => {
  assert.equal(
    getEntryMonthKey({ date: "2026-07-01", monthKey: "2026-06" }),
    "2026-07",
  );
  assert.equal(getEntryMonthKey({ monthKey: "2026-06" }), "2026-06");
});

test("formats a Date from local calendar components", () => {
  assert.equal(formatLocalCalendarDate(new Date(2026, 6, 1, 23, 30)), "2026-07-01");
});

test("audits mismatches and links DCF adjustments without modifying records", () => {
  const entry = {
    id: "entry-1",
    student: "Example Student",
    date: "2026-07-01",
    monthKey: "2026-06",
  };
  const adjustment = {
    id: "adjustment-1",
    type: "dcf_supervision",
    serviceType: "DCF",
    student: " example student ",
    monthKey: "2026-06",
  };

  const results = auditEntryMonthKeys([entry], [adjustment]);

  assert.equal(results.length, 1);
  assert.equal(results[0].expectedMonthKey, "2026-07");
  assert.equal(results[0].relatedDCFAdjustments[0], adjustment);
  assert.equal(entry.monthKey, "2026-06");
  assert.equal(adjustment.monthKey, "2026-06");
});
