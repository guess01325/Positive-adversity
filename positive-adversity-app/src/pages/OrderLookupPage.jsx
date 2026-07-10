import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { lookupCustomerOrder } from "../lib/firestore";

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(value) {
  return String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function OrderLookupPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    orderId: searchParams.get("orderId") || "",
    email: "",
  });
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo(
    () => (Array.isArray(order?.items) ? order.items : []),
    [order],
  );

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setOrder(null);

    try {
      setLoading(true);
      const result = await lookupCustomerOrder(
        form.orderId.trim(),
        form.email.trim(),
      );
      setOrder(result);
    } catch (lookupError) {
      console.error("Order lookup failed:", {
        code: lookupError?.code,
        message: lookupError?.message,
      });
      setError(
        lookupError?.code === "resource-exhausted"
          ? "Too many lookup attempts. Please try again later."
          : "Order not found or information does not match.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6 text-slate-950">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-black/20">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-8 sm:px-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">
            Order Lookup
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
            Find your store order.
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
            Enter your order number and the email used at checkout.
          </p>
        </div>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[0.85fr_1.15fr]">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-black text-slate-800">
                Order Number
                <input
                  type="text"
                  name="orderId"
                  value={form.orderId}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="Order number"
                />
              </label>
            </div>

            <div>
              <label className="text-sm font-black text-slate-800">
                Checkout Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="email@example.com"
                />
              </label>
            </div>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Looking Up..." : "Look Up Order"}
            </button>

            <Link
              to="/store"
              className="inline-flex w-full justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Return to Store
            </Link>
          </form>

          <div className="rounded-xl border border-slate-200 p-4">
            {!order && !loading ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Your order summary will appear here after we verify the order
                number and checkout email.
              </p>
            ) : null}

            {loading ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Checking your order...
              </p>
            ) : null}

            {order ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Order Number
                  </p>
                  <p className="mt-1 break-all text-sm font-bold text-slate-900">
                    {order.orderNumber}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Payment
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatStatus(order.paymentStatus)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Fulfillment
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatStatus(order.fulfillmentStatus)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Ordered
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatDate(order.orderDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Paid
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatDate(order.paidDate)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Customer
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {order.customerName || "Not available"}
                  </p>
                  <p className="text-sm font-semibold text-slate-600">
                    {order.email || "Email verified"}
                  </p>
                </div>

                {order.shippingAddress ? (
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Shipping
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                      {order.shippingAddress.streetAddress}
                      {order.shippingAddress.apartment
                        ? `, ${order.shippingAddress.apartment}`
                        : ""}
                      <br />
                      {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                      {order.shippingAddress.zip}
                    </p>
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Items
                    </p>
                    <p className="text-lg font-black text-slate-950">
                      {formatCurrency(order.total)}
                    </p>
                  </div>

                  {items.length > 0 ? (
                    <div className="mt-3 divide-y divide-slate-200">
                      {items.map((item, index) => (
                        <div
                          key={`${item.name}-${item.size || "size"}-${index}`}
                          className="grid gap-3 py-3 sm:grid-cols-[1fr_auto]"
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
                              {formatCurrency(item.lineTotal)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                      This payment is still being confirmed. Please check again
                      shortly.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
