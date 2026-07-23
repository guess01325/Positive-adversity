const { HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const Stripe = require("stripe");
const { cleanString } = require("../utils/strings");

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const siteUrl = defineString("SITE_URL", {
  default: "https://www.positiveadversity.org",
});

let stripeClient;

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

module.exports = {
  stripeSecretKey,
  stripeWebhookSecret,
  siteUrl,
  getStripeClient,
  getCheckoutSiteUrl,
};
