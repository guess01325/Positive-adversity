import { useEffect, useMemo, useState } from "react";
import { createOrder, fetchProducts } from "../lib/firestore";
import { storeProducts } from "../lib/products";

const initialCheckoutForm = {
  fullName: "",
  email: "",
  phone: "",
  streetAddress: "",
  apartment: "",
  city: "",
  state: "",
  zip: "",
  paymentOption: "",
  paymentReferenceId: "",
};

export default function Store() {
  const [products, setProducts] = useState(storeProducts);
  const [cartItems, setCartItems] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState(initialCheckoutForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      try {
        const data = await fetchProducts();

        if (!isCancelled && data.length > 0) {
          setProducts(data);
        }
      } catch (productError) {
        console.error("Failed to load store products:", productError);
      }
    }

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  const cartTotal = useMemo(
    () =>
      cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );

  function handleAddToCart(product) {
    setMessage("");
    setError("");

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.name === product.name,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.name === product.name
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          name: product.name,
          quantity: 1,
          price: product.price,
        },
      ];
    });
  }

  function handleUpdateQuantity(itemName, change) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.name === itemName
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function handleCheckoutChange(event) {
    const { name, value } = event.target;

    setCheckoutForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmitOrder(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (cartItems.length === 0) {
      setError("Add at least one item to your cart before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const orderId = await createOrder({
        customer: {
          fullName: checkoutForm.fullName.trim(),
          email: checkoutForm.email.trim().toLowerCase(),
          phone: checkoutForm.phone.trim(),
        },
        shippingAddress: {
          streetAddress: checkoutForm.streetAddress.trim(),
          apartment: checkoutForm.apartment.trim(),
          city: checkoutForm.city.trim(),
          state: checkoutForm.state.trim(),
          zip: checkoutForm.zip.trim(),
        },
        payment: {
          option: checkoutForm.paymentOption,
          referenceId: checkoutForm.paymentReferenceId.trim(),
        },
        items: cartItems,
        total: cartTotal,
      });

      setCheckoutForm(initialCheckoutForm);
      setCartItems([]);
      setMessage(`Order submitted. Order ID: ${orderId}`);
    } catch (orderError) {
      console.error("Failed to submit order:", orderError);
      setError(orderError?.message || "Failed to submit order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
          <h1 className="text-3xl font-bold">Positive Adversity Store</h1>
          <p className="mt-2 text-sm text-slate-300">
            Support the mission by purchasing Positive Adversity gear.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6 md:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.id || product.name}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="flex h-48 items-center justify-center rounded-xl bg-slate-200">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="max-h-40 object-contain"
                  />
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-500">
                    {product.category}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">
                    {product.name}
                  </h2>
                  <p className="mt-1 text-slate-700">${product.price}</p>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    disabled={!product.inStock}
                    className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-2xl font-bold text-slate-900">Your Cart</h2>

              <p className="mt-1 text-sm text-slate-500">
                Review your selected items.
              </p>
            </div>

            {/* CART ITEMS */}
            <div className="mt-4 space-y-4">
              {cartItems.length === 0 ? (
                <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-500">
                  Your cart is empty.
                </p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.name} className="rounded-xl bg-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.name}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.name, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-slate-900 shadow-sm hover:bg-slate-50"
                            aria-label={`Remove one ${item.name}`}
                          >
                            -
                          </button>

                          <span className="min-w-8 text-center text-sm font-semibold text-slate-700">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.name, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-slate-900 shadow-sm hover:bg-slate-50"
                            aria-label={`Add one ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <p className="font-bold text-slate-900">
                        ${item.price * item.quantity}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TOTAL */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-900">Total</p>

                <p className="text-2xl font-bold text-slate-900">
                  ${cartTotal}
                </p>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <h3 className="text-lg font-bold text-slate-900">
                  Checkout Form
                </h3>

                <form className="mt-4 space-y-4" onSubmit={handleSubmitOrder}>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={checkoutForm.fullName}
                      onChange={handleCheckoutChange}
                      placeholder="Otis Owens"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={checkoutForm.email}
                      onChange={handleCheckoutChange}
                      placeholder="owens@example.com"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={checkoutForm.phone}
                      onChange={handleCheckoutChange}
                      placeholder="800-303-0127"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Street Address
                    </label>
                    <input
                      type="text"
                      name="streetAddress"
                      value={checkoutForm.streetAddress}
                      onChange={handleCheckoutChange}
                      placeholder="303 Main St"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Apt/Unit
                      </label>
                      <input
                        type="text"
                        name="apartment"
                        value={checkoutForm.apartment}
                        onChange={handleCheckoutChange}
                        placeholder="303"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        City
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={checkoutForm.city}
                        onChange={handleCheckoutChange}
                        placeholder="Worcester"
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        State
                      </label>
                      <input
                        type="text"
                        name="state"
                        value={checkoutForm.state}
                        onChange={handleCheckoutChange}
                        placeholder="MA"
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Zip
                      </label>
                      <input
                        type="text"
                        name="zip"
                        value={checkoutForm.zip}
                        onChange={handleCheckoutChange}
                        placeholder="01604"
                        required
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Payment Option
                    </label>
                    <select
                      name="paymentOption"
                      value={checkoutForm.paymentOption}
                      onChange={handleCheckoutChange}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select payment method</option>
                      <option value="paypal">PayPal</option>
                      <option value="venmo">Venmo</option>
                      <option value="cashapp">Cash App</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Payment Reference ID
                    </label>
                    <input
                      type="text"
                      name="paymentReferenceId"
                      value={checkoutForm.paymentReferenceId}
                      onChange={handleCheckoutChange}
                      placeholder="Optional"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  {error ? (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </p>
                  ) : null}

                  {message ? (
                    <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                      {message}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting || cartItems.length === 0}
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit Order"}
                  </button> 
                </form>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
