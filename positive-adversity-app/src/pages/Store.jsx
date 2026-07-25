import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import acGoldLogo from "../assets/ac-gold-logo.png";
import logoFull from "../assets/logo-full.png";
import { DONATE_URL, TEAM_DONATE_URL } from "../lib/constants";
import {
  createOrder,
  createStripeCheckoutSession,
  fetchProducts,
} from "../lib/firestore";
import { getProductStore, storeProducts } from "../lib/products";
import {
  clearStoreCheckoutDraft,
  createCheckoutAttemptId,
  getCartFingerprint,
  loadStoreCheckoutDraft,
  saveStoreCheckoutDraft,
} from "../lib/storeCheckoutDraft";

const shopTiles = [
  {
    label: "Positive Adversity Gear",
    collection: "positive-adversity-gear",
    logo: logoFull,
  },
  {
    label: "AC Gear",
    collection: "ac-gear",
    logo: acGoldLogo,
  },
];

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
};

function formatUsPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const paymentMethods = [
  {
    value: "stripe",
    label: "Card, Apple Pay, or Google Pay",
  },
];

export default function Store() {
  const [products, setProducts] = useState(storeProducts);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeCollection, setActiveCollection] = useState("All");
  const [selectedSizes, setSelectedSizes] = useState({});
  const [cartItems, setCartItems] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState(initialCheckoutForm);
  const [pendingStripeOrderId, setPendingStripeOrderId] = useState("");
  const [checkoutAttemptId, setCheckoutAttemptId] = useState("");
  const [pendingCartFingerprint, setPendingCartFingerprint] = useState("");
  const [checkoutDraftLoaded, setCheckoutDraftLoaded] = useState(false);
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

  useEffect(() => {
    try {
      const draft = loadStoreCheckoutDraft();

      if (!draft) {
        setCheckoutDraftLoaded(true);
        return;
      }

      if (Array.isArray(draft.cartItems)) {
        setCartItems(draft.cartItems);
      }

      if (draft.selectedSizes && typeof draft.selectedSizes === "object") {
        setSelectedSizes(draft.selectedSizes);
      }

      if (draft.checkoutForm && typeof draft.checkoutForm === "object") {
        setCheckoutForm({
          ...initialCheckoutForm,
          ...draft.checkoutForm,
          paymentOption:
            draft.checkoutForm.paymentOption === "stripe" ? "stripe" : "",
        });
      }

      setPendingStripeOrderId(draft.pendingStripeOrderId || "");
      setCheckoutAttemptId(draft.checkoutAttemptId || "");
      setPendingCartFingerprint(draft.cartFingerprint || "");
    } catch (draftError) {
      console.error("Failed to load checkout draft:", draftError);
    } finally {
      setCheckoutDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!checkoutDraftLoaded) return;

    saveCheckoutDraft();
  }, [
    cartItems,
    checkoutForm,
    pendingStripeOrderId,
    checkoutAttemptId,
    pendingCartFingerprint,
    selectedSizes,
    checkoutDraftLoaded,
  ]);

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const filteredProducts = useMemo(
    () => {
      const categoryProducts =
        activeCategory === "All"
          ? products
          : products.filter((product) => product.category === activeCategory);
      const activeTile = shopTiles.find(
        (tile) => tile.collection === activeCollection,
      );

      if (!activeTile) {
        return categoryProducts;
      }

      return categoryProducts.filter(
        (product) => getProductStore(product) === activeTile.collection,
      );
    },
    [activeCategory, activeCollection, products],
  );

  const featuredProductsByStore = useMemo(
    () =>
      shopTiles.map((tile) => {
        const storeProductsForTile = products.filter(
          (product) => getProductStore(product) === tile.collection,
        );
        const product =
          storeProductsForTile.find((storeProduct) => storeProduct.featured) ||
          storeProductsForTile[0];

        return {
          ...tile,
          product,
        };
      }),
    [products],
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find(
        (method) => method.value === checkoutForm.paymentOption,
      ),
    [checkoutForm.paymentOption],
  );

  const hasRequiredCheckoutFields = useMemo(
    () =>
      [
        checkoutForm.fullName,
        checkoutForm.email,
        checkoutForm.phone,
        checkoutForm.streetAddress,
        checkoutForm.city,
        checkoutForm.state,
        checkoutForm.zip,
      ].every((value) => value.trim().length > 0),
    [
      checkoutForm.city,
      checkoutForm.email,
      checkoutForm.fullName,
      checkoutForm.phone,
      checkoutForm.state,
      checkoutForm.streetAddress,
      checkoutForm.zip,
    ],
  );

  const isStripeCheckout = checkoutForm.paymentOption === "stripe";

  const canSubmitOrder =
    cartItems.length > 0 &&
    hasRequiredCheckoutFields &&
    selectedPaymentMethod &&
    isStripeCheckout;

  function saveCheckoutDraft(
    draftCartItems = cartItems,
    draftCheckoutForm = checkoutForm,
    draftPendingStripeOrderId = pendingStripeOrderId,
    draftCheckoutAttemptId = checkoutAttemptId,
    draftCartFingerprint = pendingCartFingerprint,
  ) {
    try {
      saveStoreCheckoutDraft({
        cartItems: draftCartItems,
        checkoutForm: draftCheckoutForm,
        pendingStripeOrderId: draftPendingStripeOrderId,
        checkoutAttemptId: draftCheckoutAttemptId,
        cartFingerprint: draftCartFingerprint || getCartFingerprint(draftCartItems),
        selectedSizes,
      });
    } catch (draftError) {
      console.error("Failed to save checkout draft:", draftError);
    }
  }

  function clearPendingStripeAttempt() {
    setPendingStripeOrderId("");
    setCheckoutAttemptId("");
    setPendingCartFingerprint("");
  }

  function getProductKey(product) {
    return product.id || product.name;
  }

  function getProductSizes(product) {
    return Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];
  }

  function hasTrackedInventory(product, size) {
    return Object.prototype.hasOwnProperty.call(product.inventory || {}, size);
  }

  function getSizeQuantity(product, size) {
    if (!size || !hasTrackedInventory(product, size)) {
      return Infinity;
    }

    return Math.max(0, Number(product.inventory?.[size] || 0));
  }

  function isSizeSoldOut(product, size) {
    return product.inStock === false || getSizeQuantity(product, size) <= 0;
  }

  function isProductSoldOut(product) {
    const sizes = getProductSizes(product);

    if (product.inStock === false) return true;
    if (sizes.length === 0) return false;

    return sizes.every((size) => isSizeSoldOut(product, size));
  }

  function getCartQuantity(product, size, items = cartItems) {
    return items.reduce((total, item) => {
      const sameProduct =
        (item.productId && item.productId === product.id) ||
        item.name === product.name;
      const sameSize = (item.size || "") === (size || "");

      return sameProduct && sameSize ? total + item.quantity : total;
    }, 0);
  }

  function getSelectedSize(product) {
    const productKey = getProductKey(product);
    const sizes = getProductSizes(product);
    const savedSize = selectedSizes[productKey];

    if (savedSize && sizes.includes(savedSize) && !isSizeSoldOut(product, savedSize)) {
      return savedSize;
    }

    return sizes.find((size) => !isSizeSoldOut(product, size)) || sizes[0] || "";
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
    clearPendingStripeAttempt();

    const size = getSelectedSize(product);
    const sizes = getProductSizes(product);

    if (sizes.length > 0 && !size) {
      setError(`Select a size for ${product.name} before adding it.`);
      return;
    }

    if (isProductSoldOut(product) || isSizeSoldOut(product, size)) {
      setError(`${product.name}${size ? ` in size ${size}` : ""} is sold out.`);
      return;
    }

    const availableQuantity = getSizeQuantity(product, size);
    const quantityInCart = getCartQuantity(product, size);

    if (quantityInCart >= availableQuantity) {
      setError(
        `Only ${availableQuantity} ${product.name}${size ? ` in size ${size}` : ""} available.`,
      );
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
          productId: product.id || "",
          name: product.name,
          size,
          quantity: 1,
          price: product.price,
        },
      ];
    });
  }

  function handleShopTileClick(collection) {
    setActiveCollection(collection);
    setActiveCategory("All");
    scrollToProducts();
  }

  function scrollToProducts() {
    requestAnimationFrame(() => {
      document
        .getElementById("products")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleUpdateQuantity(itemName, itemSize, change) {
    setError("");
    clearPendingStripeAttempt();

    setCartItems((currentItems) => {
      const cartItem = currentItems.find(
        (item) => item.name === itemName && (item.size || "") === (itemSize || ""),
      );
      const product = products.find(
        (currentProduct) =>
          (cartItem?.productId && currentProduct.id === cartItem.productId) ||
          currentProduct.name === itemName,
      );

      if (change > 0 && product) {
        const availableQuantity = getSizeQuantity(product, itemSize || "");
        const quantityInCart = getCartQuantity(product, itemSize || "", currentItems);

        if (quantityInCart >= availableQuantity) {
          setError(
            `Only ${availableQuantity} ${itemName}${itemSize ? ` in size ${itemSize}` : ""} available.`,
          );
          return currentItems;
        }
      }

      return currentItems
        .map((item) =>
          item.name === itemName && (item.size || "") === (itemSize || "")
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
  }

  function handleCheckoutChange(event) {
    const { name, value } = event.target;
    const nextValue = name === "phone" ? formatUsPhoneNumber(value) : value;

    setCheckoutForm((currentForm) => ({
      ...currentForm,
      [name]: nextValue,
    }));
  }

  function getCheckoutErrorMessage(error, step, orderId = "") {
    if (error?.code === "deadline-exceeded") {
      return step === "createCheckoutSession"
        ? `The order was created${orderId ? ` (${orderId})` : ""}, but secure checkout took too long to open. Please try again or contact us with your order ID.`
        : "The order request took too long. Please check your connection and try again.";
    }

    if (error?.code === "failed-precondition" || error?.code === "invalid-argument") {
      return error.message || "Please review your checkout details and try again.";
    }

    if (step === "createCheckoutSession") {
      return `The order was created${orderId ? ` (${orderId})` : ""}, but secure checkout could not open. Please try again or contact us with your order ID.`;
    }

    return error?.message || "Failed to submit order.";
  }

  async function handleSubmitOrder(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (cartItems.length === 0) {
      setError("Add at least one item to your cart before submitting.");
      return;
    }

    if (!canSubmitOrder) {
      setError(
        isStripeCheckout
          ? "Fill out the required contact and shipping fields before continuing to Stripe."
          : "Complete payment and enter your payment username or confirmation ID before submitting.",
      );
      return;
    }

    const unavailableItem = cartItems.find((item) => {
      const product = products.find(
        (currentProduct) =>
          (item.productId && currentProduct.id === item.productId) ||
          currentProduct.name === item.name,
      );

      return (
        product &&
        getSizeQuantity(product, item.size || "") < item.quantity
      );
    });

    if (unavailableItem) {
      setError(
        `Only ${getSizeQuantity(
          products.find(
            (product) =>
              (unavailableItem.productId && product.id === unavailableItem.productId) ||
              product.name === unavailableItem.name,
          ),
          unavailableItem.size || "",
        )} ${unavailableItem.name}${
          unavailableItem.size ? ` in size ${unavailableItem.size}` : ""
        } available.`,
      );
      return;
    }

    let submitStep = "submitStoreOrder";
    let createdOrderId = "";

    try {
      setSubmitting(true);
      const currentCartFingerprint = getCartFingerprint(cartItems);
      const canReusePendingStripeOrder =
        isStripeCheckout &&
        pendingStripeOrderId &&
        checkoutAttemptId &&
        pendingCartFingerprint === currentCartFingerprint;
      const nextCheckoutAttemptId =
        canReusePendingStripeOrder && checkoutAttemptId
          ? checkoutAttemptId
          : createCheckoutAttemptId();

      console.info("[store checkout] submit:start", {
        paymentOption: checkoutForm.paymentOption,
        itemCount: cartItems.length,
        isStripeCheckout,
        canReusePendingStripeOrder: Boolean(canReusePendingStripeOrder),
      });

      createdOrderId = await createOrder({
        pendingOrderId: canReusePendingStripeOrder ? pendingStripeOrderId : "",
        checkoutAttemptId: isStripeCheckout ? nextCheckoutAttemptId : "",
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
          referenceId: "",
        },
        items: cartItems,
        total: cartTotal,
      });

      if (checkoutForm.paymentOption === "stripe") {
        setPendingStripeOrderId(createdOrderId);
        setCheckoutAttemptId(nextCheckoutAttemptId);
        setPendingCartFingerprint(currentCartFingerprint);
        saveCheckoutDraft(
          cartItems,
          checkoutForm,
          createdOrderId,
          nextCheckoutAttemptId,
          currentCartFingerprint,
        );
        submitStep = "createCheckoutSession";
        setMessage("Redirecting to secure Stripe checkout...");
        const checkoutSession = await createStripeCheckoutSession(createdOrderId, {
          items: cartItems,
          total: cartTotal,
        });
        submitStep = "redirect";
        console.info("[store checkout] redirect:start", {
          orderId: createdOrderId,
          hasCheckoutUrl: Boolean(checkoutSession.url),
        });
        window.location.assign(checkoutSession.url);
        return;
      }

      clearStoreCheckoutDraft();
      setCheckoutForm(initialCheckoutForm);
      setCartItems([]);
      clearPendingStripeAttempt();
      setMessage(`Order submitted. Order ID: ${createdOrderId}`);
    } catch (orderError) {
      console.error("[store checkout] submit:failed", {
        step: submitStep,
        orderId: createdOrderId,
        code: orderError?.code,
        message: orderError?.message,
        details: orderError?.details,
        name: orderError?.name,
      });
      if (isStripeCheckout && submitStep === "submitStoreOrder") {
        clearPendingStripeAttempt();
        saveCheckoutDraft(cartItems, checkoutForm, "", "", "");
      }
      setError(getCheckoutErrorMessage(orderError, submitStep, createdOrderId));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="space-y-8 pb-10">
      <section className="relative grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0f17] shadow-2xl shadow-black/40 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(0,168,255,0.06)_1px,transparent_1px)] bg-[size:78px_78px]" />
        <div className="relative flex min-h-[460px] flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-[#1ed760]">
              PA Store + Team Store
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-none text-white sm:text-6xl">
              Positive Adversity and AC Elite gear.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300">
              Shop Positive Adversity apparel and AC Gear. 15% of sales supports
              Positive Adversity Youth Services.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {shopTiles.map((tile) => (
                <button
                  key={tile.collection}
                  type="button"
                  onClick={() => handleShopTileClick(tile.collection)}
                  className="group relative min-h-24 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-left shadow-[0_18px_50px_rgba(202,162,77,0.12)] hover:border-[#caa24d]/70 hover:bg-white/[0.1] hover:shadow-[0_20px_60px_rgba(202,162,77,0.2)]"
                >
                  <img
                    src={tile.logo}
                    alt=""
                    className="absolute -right-8 -top-8 h-24 w-24 object-contain opacity-10 transition group-hover:opacity-20"
                    aria-hidden="true"
                  />
                  <span className="relative block text-xs font-black uppercase tracking-[0.18em] text-[#caa24d]">
                    Shop
                  </span>
                  <span className="relative mt-2 block text-lg font-black text-white">
                    {tile.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={scrollToProducts}
              className="rounded-full bg-[#1ed760] px-6 py-3 text-sm font-black text-slate-950 hover:bg-[#42f07f]"
            >
              Browse Products
            </button>
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#caa24d]/60 bg-[#caa24d] px-6 py-3 text-sm font-black text-slate-950 hover:bg-[#e0bd68]"
            >
              Donate
            </a>
            <a
              href={TEAM_DONATE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#00a8ff]/60 bg-[#00a8ff] px-6 py-3 text-sm font-black text-slate-950 hover:bg-[#35bcff]"
            >
              Donate to Team
            </a>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200">
              {cartCount} item{cartCount === 1 ? "" : "s"} in cart
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[460px] items-center justify-center overflow-hidden bg-[#071629] p-8">
          <div className="absolute inset-x-8 top-1/2 h-px bg-[#00a8ff]/30" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00a8ff]/25" />
          <img
            src={acGoldLogo}
            alt=""
            className="absolute -right-20 -top-16 h-64 w-64 rotate-12 object-contain opacity-10"
            aria-hidden="true"
          />
          <img
            src={logoFull}
            alt=""
            className="absolute -bottom-20 -left-20 h-72 w-72 -rotate-6 object-contain opacity-10"
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md">
            <div className="mb-4 flex items-center justify-end gap-3">
              <span className="rounded-full bg-[#00a8ff] px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-950">
                Store Drop
              </span>
            </div>

            {featuredProductsByStore.some((tile) => tile.product) ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/30">
                <div className="relative -mx-2 grid aspect-square grid-cols-2 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#050b12] p-6 shadow-inner shadow-[#caa24d]/10 sm:mx-0">
                  <img
                    src={logoFull}
                    alt=""
                    className="absolute -left-12 bottom-0 h-48 w-48 object-contain opacity-10"
                    aria-hidden="true"
                  />
                  <img
                    src={acGoldLogo}
                    alt=""
                    className="absolute -right-12 top-0 h-48 w-48 object-contain opacity-10"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex h-full min-w-0 items-center justify-center">
                    <img
                      src={logoFull}
                      alt="Positive Adversity full logo"
                      className="h-[82%] w-full object-contain drop-shadow-[0_20px_42px_rgba(30,215,96,0.16)]"
                    />
                  </div>
                  <div className="relative z-10 flex h-full min-w-0 items-center justify-center">
                    <img
                      src={acGoldLogo}
                      alt="Gold AC logo"
                      className="h-[82%] w-full object-contain drop-shadow-[0_20px_42px_rgba(202,162,77,0.18)]"
                    />
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {featuredProductsByStore.map((tile) =>
                    tile.product ? (
                      <button
                        key={tile.collection}
                        type="button"
                        onClick={() => handleShopTileClick(tile.collection)}
                        className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-left hover:border-[#caa24d]/60 hover:bg-white/[0.1]"
                      >
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#caa24d]">
                          Featured
                        </p>
                        <p className="mt-1 text-sm font-black text-white">
                          {tile.label}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-300">
                          {tile.product.name}
                        </p>
                      </button>
                    ) : null,
                  )}
                </div>
                <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Featured Stores
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      PA Store + AC Gear
                    </h2>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 self-end sm:self-auto">
                    <img
                      src={logoFull}
                      alt="Positive Adversity full logo"
                      className="h-16 w-48 object-contain drop-shadow-[0_10px_20px_rgba(30,215,96,0.16)] sm:h-14 sm:w-36"
                    />
                    <p className="text-right text-sm font-black uppercase leading-5 tracking-wide text-[#caa24d]">
                      15% supports PAYS
                    </p>
                  </div>
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
                Shop the stores
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setActiveCategory(category);
                    setActiveCollection("All");
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-black ${
                    activeCollection === "All" && activeCategory === category
                      ? "bg-[#1ed760] text-slate-950"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {activeCollection !== "All" ? (
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#caa24d]/50 bg-[#caa24d]/15 px-4 py-2 text-sm font-black text-[#f6d787]">
                {shopTiles.find((tile) => tile.collection === activeCollection)
                  ?.label || activeCollection}
              </span>
              <button
                type="button"
                onClick={() => setActiveCollection("All")}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/15"
              >
                Show All
              </button>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.length === 0 ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-6 text-sm font-semibold text-slate-300 sm:col-span-2 xl:col-span-3">
                No products match this filter yet.
              </div>
            ) : null}

            {filteredProducts.map((product) => {
              const productSizes = getProductSizes(product);
              const selectedSize = getSelectedSize(product);
              const selectedSizeSoldOut =
                productSizes.length > 0 && isSizeSoldOut(product, selectedSize);
              const productSoldOut = isProductSoldOut(product);
              const productStore = getProductStore(product);
              const productStoreTile = shopTiles.find(
                (tile) => tile.collection === productStore,
              );

              return (
                <article
                  key={product.id || product.name}
                  className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.06] shadow-xl shadow-black/20 hover:border-[#00a8ff]/60"
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-white p-6">
                    <img
                      src={productStoreTile?.logo || logoFull}
                      alt=""
                      className="absolute -right-10 -top-10 h-28 w-28 object-contain opacity-10"
                      aria-hidden="true"
                    />
                    {product.featured ? (
                      <span className="absolute left-4 top-4 z-10 rounded-full bg-[#f6b332] px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
                        Featured
                      </span>
                    ) : null}
                    {productSoldOut ? (
                      <span className="absolute right-4 top-4 z-10 rounded-full bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                        Sold Out
                      </span>
                    ) : null}
                    <img
                      src={product.image || logoFull}
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
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#00a8ff] focus:ring-2 focus:ring-[#00a8ff]/20"
                        >
                          {productSizes.map((size) => (
                            <option
                              key={size}
                              value={size}
                              disabled={isSizeSoldOut(product, size)}
                            >
                              {size}
                              {isSizeSoldOut(product, size) ? " - Sold Out" : ""}
                            </option>
                          ))}
                        </select>
                        {selectedSizeSoldOut ? (
                          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#f6b332]">
                            Sold out in {selectedSize}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-5 flex items-center justify-between gap-4">
                      <p className="text-2xl font-black text-white">
                        ${product.price}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={productSoldOut || selectedSizeSoldOut}
                        className="rounded-full bg-[#1ed760] px-5 py-3 text-sm font-black text-slate-950 hover:bg-[#42f07f] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {productSoldOut || selectedSizeSoldOut ? "Sold Out" : "Add"}
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
            <Link
              to="/store/order-lookup"
              className="mt-4 inline-flex text-sm font-black text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
            >
              Look up an order
            </Link>
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
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
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
                disabled={submitting || !canSubmitOrder}
                className="w-full rounded-full bg-slate-950 px-4 py-3 font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Submitting..."
                  : isStripeCheckout
                    ? "Continue to Secure Checkout"
                    : "Submit Order"}
              </button>
            </form>
          </div>
        </aside>
      </section>
    </main>
  );
}
