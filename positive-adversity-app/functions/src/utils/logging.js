function logFunctionError(step, error, extra = {}) {
  console.error(`[store checkout] ${step} failed`, {
    code: error?.code,
    message: error?.message,
    type: error?.type,
    stripeCode: error?.raw?.code,
    stripeParam: error?.raw?.param,
    stripeRequestId: error?.requestId || error?.raw?.requestId,
    ...extra,
  });
}

module.exports = {
  logFunctionError,
};
