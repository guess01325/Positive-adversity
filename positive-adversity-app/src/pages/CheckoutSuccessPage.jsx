import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOrder } from "../lib/firestore";

const ORDER_RETRY_COUNT = 4;
const ORDER_RETRY_DELAY_MS = 1200;

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatStatus(value, fallback = "Processing") {
  return String(value || fallback)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [detailsUnavailable, setDetailsUnavailable] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadOrder() {
      if (!orderId) {
        setLoading(false);
        setDetailsUnavailable(true);
        return;
      }

      setLoading(true);
      setDetailsUnavailable(false);

      for (let attempt = 0; attempt < ORDER_RETRY_COUNT; attempt += 1) {
        try {
          const orderData = await fetchOrder(orderId);

          if (isCancelled) return;

          if (orderData) {
            setOrder(orderData);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Unable to load checkout order:", error);

          if (isCancelled) return;

          setLoading(false);
          setDetailsUnavailable(true);
          return;
        }

        if (attempt < ORDER_RETRY_COUNT - 1) {
          await sleep(ORDER_RETRY_DELAY_MS);
        }
      }

      if (!isCancelled) {
        setLoading(false);
        setDetailsUnavailable(true);
      }
    }

    loadOrder();

    return () => {
      isCancelled = true;
    };
  }, [orderId]);

  const items = useMemo(
    () => (Array.isArray(order?.items) ? order.items : []),
    [order],
  );

  const paymentStatus = order?.paymentConfirmed ? "Paid" : "Payment received";

  return (
    <section className="mx-auto max-w-4xl text-slate-950">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-black/20">
        <div className="border-b border-slate-200 bg-gradient-to-br from-emerald-50 to-white px-5 py-8 text-center sm:px-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-5xl font-black leading-none text-white shadow-lg shadow-emerald-900/20">
            <span aria-hidden="true">✓</span>
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.22em] text-emerald-700">
            Payment Successful
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
            Thanks for your order.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
            Your payment was received. We are preparing your order details now,
            and your receipt information will appear here when available.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="space-y-3 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Order ID
              </p>
              <p className="mt-1 break-all text-sm font-bold text-slate-900">
                {orderId || "Not available"}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Payment Status
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-700">
                {paymentStatus}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Order Status
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatStatus(order?.status)}
              </p>
            </div>

            {order ? (
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Total
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {formatCurrency(order.total)}
                </p>
              </div>
            ) : null}
          </aside>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">
                  Items Purchased
                </h2>
                {loading ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                    Loading
                  </span>
                ) : null}
              </div>

              {loading ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  We are pulling in your order details. This can take a moment
                  right after payment.
                </p>
              ) : null}

              {!loading && detailsUnavailable ? (
                <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
                  Your payment was successful. Order details are not available
                  here yet, but your payment has been received.
                </p>
              ) : null}

              {!loading && order && items.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  No item details are available for this order yet.
                </p>
              ) : null}

              {items.length > 0 ? (
                <div className="mt-4 divide-y divide-slate-200">
                  {items.map((item, index) => (
                    <div
                      key={`${item.productId || item.name || "item"}-${item.size || "size"}-${index}`}
                      className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="font-bold text-slate-950">
                          {item.name || "Store item"}
                        </p>
                        {item.size ? (
                          <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                            Size: {item.size}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-bold text-slate-700">
                          Qty {Number(item.quantity || 0)}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {formatCurrency(
                            Number(item.price || 0) * Number(item.quantity || 0),
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/store"
                className="inline-flex justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
