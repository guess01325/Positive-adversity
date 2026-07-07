import { Link, useSearchParams } from "react-router-dom";

export default function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <section className="mx-auto max-w-2xl text-slate-950">
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xl shadow-black/20">
        <div className="border-b border-slate-200 bg-gradient-to-br from-amber-50 to-white px-5 py-8 text-center sm:px-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500 text-4xl font-black leading-none text-white shadow-lg shadow-amber-900/20">
            <span aria-hidden="true">!</span>
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.22em] text-amber-700">
            Checkout Canceled
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
            Payment was not completed.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
            Your card was not charged. You can return to the store to review
            your cart and try checkout again when you are ready.
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-8">
          {orderId ? (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Order ID
              </p>
              <p className="mt-1 break-all text-sm font-bold text-slate-900">
                {orderId}
              </p>
            </div>
          ) : null}

          <Link
            to="/store"
            className="inline-flex w-full justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 sm:w-auto"
          >
            Return to Store
          </Link>
        </div>
      </div>
    </section>
  );
}
