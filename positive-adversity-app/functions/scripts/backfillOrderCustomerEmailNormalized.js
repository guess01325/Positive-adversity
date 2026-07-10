const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { FieldPath, getFirestore } = require("firebase-admin/firestore");

const DEFAULT_BATCH_SIZE = 450;

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getEmailCandidates(order = {}) {
  return [
    order.customerEmailNormalized,
    order.customer?.email,
    order.customerEmail,
    order.email,
    order.payment?.customerEmail,
  ]
    .map(normalizeEmail)
    .filter(Boolean);
}

function getUsableEmail(order) {
  return getEmailCandidates(order).find((email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  ) || "";
}

async function main() {
  const projectId =
    getArg("project") ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;
  const dryRun = hasFlag("dry-run") || !hasFlag("commit");
  const batchSize = Number(getArg("batch-size") || DEFAULT_BATCH_SIZE);

  if (!projectId) {
    throw new Error(
      "Missing project ID. Pass --project=positive-adveristy-app or set GOOGLE_CLOUD_PROJECT.",
    );
  }

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("Batch size must be an integer between 1 and 500.");
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

  const db = getFirestore();
  let lastDoc = null;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let missingEmail = 0;

  console.log(
    `[backfill] Starting order customerEmailNormalized backfill for ${projectId}. dryRun=${dryRun}`,
  );

  while (true) {
    let query = db
      .collection("orders")
      .orderBy(FieldPath.documentId())
      .limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    let writesInBatch = 0;

    snapshot.docs.forEach((orderDoc) => {
      scanned += 1;
      const order = orderDoc.data() || {};
      const normalizedEmail = getUsableEmail(order);

      if (!normalizedEmail) {
        missingEmail += 1;
        return;
      }

      if (order.customerEmailNormalized === normalizedEmail) {
        skipped += 1;
        return;
      }

      updated += 1;
      writesInBatch += 1;

      if (!dryRun) {
        batch.update(orderDoc.ref, {
          customerEmailNormalized: normalizedEmail,
        });
      }
    });

    if (!dryRun && writesInBatch > 0) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log("[backfill] Complete", {
    dryRun,
    scanned,
    updated,
    skipped,
    missingEmail,
  });
}

main().catch((error) => {
  console.error("[backfill] Failed", {
    code: error?.code,
    message: error?.message,
  });
  process.exit(1);
});
