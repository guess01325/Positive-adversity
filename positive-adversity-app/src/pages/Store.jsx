import { useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";
import { DONATE_URL } from "../lib/constants";
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
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedSizes, setSelectedSizes] = useState({});
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

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      activeCategory === "All"
        ? products
        : products.filter((product) => product.category === activeCategory),
    [activeCategory, products],
  );

  const featuredProduct =
    products.find((product) => product.featured) || products[0];

  const cartTotal = useMemo(
    () =>
      cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  function getProductKey(product) {
    return product.id || product.name;
  }

  function getProductSizes(product) {
    return Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];
  }

  function getSelectedSize(product) {
    const productKey = getProductKey(product);
    const sizes = getProductSizes(product);

    return selectedSizes[productKey] || sizes[0] || "";
  }

  function handleSizeChange(product, size) {
    setSelectedSizes((currentSizes) => ({
      ...currentSizes,
      [getProductKey(product)]: size,
    }));
  }

  function handleAddToCart(product) {
    setMessage("");
    setError("");

    const size = getSelectedSize(product);
    const sizes = getProductSizes(product);

    if (sizes.length > 0 && !size) {
      setError(`Select a size for ${product.name} before adding it.`);
      return;
    }

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) => item.name === product.name && (item.size || "") === size,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.name === product.name && (item.size || "") === size
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          name: product.name,
          size,
          quantity: 1,
          price: product.price,
        },
      ];
    });
  }

  function handleUpdateQuantity(itemName, itemSize, change) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.name === itemName && (item.size || "") === (itemSize || "")
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
    <main className="space-y-8 pb-10">
      <section className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] shadow-2xl shadow-black/40 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[420px] flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f6b332]">
              Positive Adversity Store
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-none text-white sm:text-6xl">
              Gear that carries the mission.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300">
              Shop apparel and merchandise built around Positive Adversity's
              community work. Every order helps keep the brand visible and the
              mission moving.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#products"
              className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 hover:bg-slate-200"
            >
              Browse Products
            </a>
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#f6b332] px-6 py-3 text-sm font-black text-slate-950 hover:bg-[#ffd166]"
            >
              Donate
            </a>
            <div className="rounded-full border border-white/10 px-5 py-3 text-sm font-black text-slate-200">
              {cartCount} item{cartCount === 1 ? "" : "s"} in cart
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-white p-8">
          <div className="w-full max-w-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <img
                src={logo}
                alt="Positive Adversity"
                className="h-14 w-auto object-contain"
              />
              <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#f6b332]">
                Featured
              </span>
            </div>

            {featuredProduct ? (
              <div className="rounded-[1.5rem] bg-slate-100 p-5">
                <div className="flex aspect-square items-center justify-center rounded-[1.25rem] bg-white">
                  <img
                    src={featuredProduct.image}
                    alt={featuredProduct.name}
                    className="max-h-[78%] object-contain"
                  />
                </div>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                      {featuredProduct.category}
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      {featuredProduct.name}
                    </h2>
                  </div>
                  <p className="text-3xl font-black text-slate-950">
                    ${featuredProduct.price}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section id="products" className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#f6b332]">
                Featured Drops
              </p>
              <h2 className="mt-2 text-3xl font-black text-white">
                Shop the collection
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-black ${
                    activeCategory === category
                      ? "bg-white text-slate-950"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const productSizes = getProductSizes(product);
              const selectedSize = getSelectedSize(product);

              return (
                <article
                  key={product.id || product.name}
                  className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.06] shadow-xl shadow-black/20"
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-white p-6">
                    {product.featured ? (
                      <span className="absolute left-4 top-4 z-10 rounded-full bg-[#f6b332] px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
                        Featured
                      </span>
                    ) : null}
                    {!product.inStock ? (
                      <span className="absolute right-4 top-4 z-10 rounded-full bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                        Sold Out
                      </span>
                    ) : null}
                    <img
                      src={product.image || logo}
                      alt={product.name}
                      className="max-h-[78%] object-contain transition duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f6b332]">
                      {product.category}
                    </p>
                    <h3 className="mt-2 min-h-14 text-xl font-black leading-7 text-white">
                      {product.name}
                    </h3>

                    {productSizes.length > 0 ? (
                      <div className="mt-4">
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                          Size
                        </label>
                        <select
                          value={selectedSize}
                          onChange={(event) =>
                            handleSizeChange(product, event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#f6b332] focus:ring-2 focus:ring-[#f6b332]/20"
                        >
                          {productSizes.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="mt-5 flex items-center justify-between gap-4">
                      <p className="text-2xl font-black text-white">
                        ${product.price}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={!product.inStock}
                        className="rounded-full bg-[#f6b332] px-5 py-3 text-sm font-black text-slate-950 hover:bg-[#ffd166] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="h-fit rounded-[1.5rem] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl shadow-black/30 lg:sticky lg:top-28">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Checkout
                </p>
                <h2 className="mt-1 text-2xl font-black">Your Cart</h2>
              </div>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-black text-white">
                {cartCount}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {cartItems.length === 0 ? (
              <p className="rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-500">
                Your cart is empty.
              </p>
            ) : (
              cartItems.map((item) => (
                <div
                  key={`${item.name}-${item.size || "no-size"}`}
                  className="rounded-2xl bg-slate-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{item.name}</p>
                      {item.size ? (
                        <p className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">
                          Size: {item.size}
                        </p>
                      ) : null}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuantity(item.name, item.size, -1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-black text-slate-950 shadow-sm hover:bg-slate-50"
                          aria-label={`Remove one ${item.name}`}
                        >
                          -
                        </button>

                        <span className="min-w-8 text-center text-sm font-black text-slate-700">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuantity(item.name, item.size, 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-black text-slate-950 shadow-sm hover:bg-slate-50"
                          aria-label={`Add one ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <p className="font-black text-slate-950">
                      ${item.price * item.quantity}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-black">Total</p>
              <p className="text-3xl font-black">${cartTotal}</p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmitOrder}>
              <div>
                <label>Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={checkoutForm.fullName}
                  onChange={handleCheckoutChange}
                  placeholder="Full name"
                  required
                />
              </div>

              <div>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={checkoutForm.email}
                  onChange={handleCheckoutChange}
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={checkoutForm.phone}
                  onChange={handleCheckoutChange}
                  placeholder="800-303-0127"
                  required
                />
              </div>

              <div>
                <label>Street Address</label>
                <input
                  type="text"
                  name="streetAddress"
                  value={checkoutForm.streetAddress}
                  onChange={handleCheckoutChange}
                  placeholder="Street address"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>Apt/Unit</label>
                  <input
                    type="text"
                    name="apartment"
                    value={checkoutForm.apartment}
                    onChange={handleCheckoutChange}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label>City</label>
                  <input
                    type="text"
                    name="city"
                    value={checkoutForm.city}
                    onChange={handleCheckoutChange}
                    placeholder="City"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>State</label>
                  <input
                    type="text"
                    name="state"
                    value={checkoutForm.state}
                    onChange={handleCheckoutChange}
                    placeholder="CT"
                    required
                  />
                </div>

                <div>
                  <label>Zip</label>
                  <input
                    type="text"
                    name="zip"
                    value={checkoutForm.zip}
                    onChange={handleCheckoutChange}
                    placeholder="06320"
                    required
                  />
                </div>
              </div>

              <div>
                <label>Payment Option</label>
                <select
                  name="paymentOption"
                  value={checkoutForm.paymentOption}
                  onChange={handleCheckoutChange}
                  required
                >
                  <option value="">Select payment method</option>
                  <option value="paypal">PayPal</option>
                  <option value="venmo">Venmo</option>
                  <option value="cashapp">Cash App</option>
                </select>
              </div>

              <div>
                <label>Payment Reference ID</label>
                <input
                  type="text"
                  name="paymentReferenceId"
                  value={checkoutForm.paymentReferenceId}
                  onChange={handleCheckoutChange}
                  placeholder="Optional"
                />
              </div>

              {error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {error}
                </p>
              ) : null}

              {message ? (
                <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                  {message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting || cartItems.length === 0}
                className="w-full rounded-full bg-slate-950 px-4 py-3 font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Order"}
              </button>
            </form>
          </div>
        </aside>
      </section>
    </main>
  );
}
