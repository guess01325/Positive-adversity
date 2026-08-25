import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteOrder,
  fetchOrders,
  fetchProducts,
  updateOrder,
} from "../lib/firestore";
import { storeProducts } from "../lib/products";
import { formatCurrency } from "../lib/utils";

const orderStatuses = [
  "pending",
  "pending_payment",
  "paid",
  "paid_inventory_review",
  "processing",
  "shipped",
  "completed",
  "cancelled",
];

const initialEditForm = {
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
  status: "pending",
  paymentConfirmed: false,
  shippingAmount: 0,
  items: [],
};

function formatDate(value) {
  if (!value) return "Not available";

  const date =
    value.seconds != null ? new Date(value.seconds * 1000) : new Date(value);

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

function toEditForm(order) {
  return {
    fullName: order.customer?.fullName || "",
    email: order.customer?.email || "",
    phone: order.customer?.phone || "",
    streetAddress: order.shippingAddress?.streetAddress || "",
    apartment: order.shippingAddress?.apartment || "",
    city: order.shippingAddress?.city || "",
    state: order.shippingAddress?.state || "",
    zip: order.shippingAddress?.zip || "",
    paymentOption: order.payment?.option || "",
    paymentReferenceId: order.payment?.referenceId || "",
    status: order.status || "pending",
    paymentConfirmed: Boolean(order.paymentConfirmed),
    shippingAmount: Number(order.shippingAmount || 0),
    items: (order.items || []).map((item) => ({
      name: item.name || "",
      category: item.category || "",
      size: item.size || "",
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
    })),
  };
}

export default function AdminOrderPage() {
  const editSectionRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState(storeProducts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingOrderId, setEditingOrderId] = useState("");
  const [editForm, setEditForm] = useState(initialEditForm);
  const [selectedProductIndex, setSelectedProductIndex] = useState("0");
  const [selectedCatalogSize, setSelectedCatalogSize] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");
      const data = await fetchOrders();
      setOrders(data || []);
    } catch (loadError) {
      console.error("Failed to load orders:", loadError);
      setError(loadError?.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      try {
        const data = await fetchProducts();

        if (!isCancelled && data.length > 0) {
          setProducts(data);
        }
      } catch (productError) {
        console.error("Failed to load order products:", productError);
      }
    }

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editingOrderId) return;

    window.requestAnimationFrame(() => {
      editSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [editingOrderId]);

  const orderTotal = useMemo(
    () => orders.reduce((total, order) => total + Number(order.total || 0), 0),
    [orders],
  );

  const editOrderTotal = useMemo(
    () =>
      editForm.items.reduce(
        (total, item) =>
          total + Number(item.price || 0) * Number(item.quantity || 0),
        Number(editForm.shippingAmount || 0),
      ),
    [editForm.items, editForm.shippingAmount],
  );

  function handleEditOrder(order) {
    setMessage("");
    setError("");
    setEditingOrderId(order.id);
    setEditForm(toEditForm(order));
  }

  function handleCancelEdit() {
    setEditingOrderId("");
    setEditForm(initialEditForm);
  }

  function handleEditChange(event) {
    const { name, value, checked, type } = event.target;

    setEditForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleItemChange(index, field, value) {
    setEditForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "quantity" || field === "price"
                  ? Number(value)
                  : value,
            }
          : item,
      ),
    }));
  }

  function getProductSizes(product) {
    return Array.isArray(product?.sizes) ? product.sizes.filter(Boolean) : [];
  }

  function handleSelectedProductChange(value) {
    const product = products[Number(value)];
    const sizes = getProductSizes(product);

    setSelectedProductIndex(value);
    setSelectedCatalogSize(sizes[0] || "");
  }

  function handleAddCatalogItem() {
    const product = products[Number(selectedProductIndex)];
    if (!product) return;

    const sizes = getProductSizes(product);
    const size = selectedCatalogSize || sizes[0] || "";

    setEditForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.some(
        (item) => item.name === product.name && (item.size || "") === size,
      )
        ? currentForm.items.map((item) =>
            item.name === product.name && (item.size || "") === size
              ? {
                  ...item,
                  quantity: Number(item.quantity || 0) + 1,
                  price: Number(item.price || product.price),
                }
              : item,
          )
        : [
            ...currentForm.items,
            {
              name: product.name,
              category: product.category || "",
              size,
              quantity: 1,
              price: product.price,
            },
          ],
    }));
  }

  function handleItemQuantityChange(index, change) {
    setEditForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items
        .map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                quantity: Number(item.quantity || 0) + change,
              }
            : item,
        )
        .filter((item) => Number(item.quantity || 0) > 0),
    }));
  }

  function handleRemoveItem(index) {
    setEditForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleSaveOrder(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      setSaving(true);

      const cleanedItems = editForm.items
        .map((item) => ({
          name: item.name.trim(),
          category: (item.category || "").trim(),
          size: (item.size || "").trim(),
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
        }))
        .filter((item) => item.name && item.quantity > 0);

      if (cleanedItems.length === 0) {
        throw new Error("Order must have at least one item.");
      }

      const updatedSubtotal = cleanedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      );
      const updatedTotal = updatedSubtotal + Number(editForm.shippingAmount || 0);

      await updateOrder(editingOrderId, {
        customer: {
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim(),
        },
        shippingAddress: {
          streetAddress: editForm.streetAddress.trim(),
          apartment: editForm.apartment.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          zip: editForm.zip.trim(),
        },
        payment: {
          option: editForm.paymentOption,
          referenceId: editForm.paymentReferenceId.trim(),
        },
        status: editForm.status,
        paymentConfirmed: editForm.paymentConfirmed,
        items: cleanedItems,
        subtotal: updatedSubtotal,
        total: updatedTotal,
      });

      await loadOrders();
      handleCancelEdit();
      setMessage("Order updated.");
    } catch (saveError) {
      console.error("Failed to update order:", saveError);
      setError(saveError?.message || "Failed to update order.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOrder(orderId) {
    const confirmed = window.confirm("Delete this order? This cannot be undone.");
    if (!confirmed) return;

    setMessage("");
    setError("");
    setDeletingOrderId(orderId);

    try {
      await deleteOrder(orderId);
      setOrders((currentOrders) =>
        currentOrders.filter((order) => order.id !== orderId),
      );
      if (editingOrderId === orderId) {
        handleCancelEdit();
      }
      setMessage("Order deleted.");
    } catch (deleteError) {
      console.error("Failed to delete order:", deleteError);
      setError(deleteError?.message || "Failed to delete order.");
    } finally {
      setDeletingOrderId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Store Orders
        </p>
        <h1 className="mt-2 text-3xl font-bold">Admin Order Manager</h1>
        <p className="mt-2 text-sm text-slate-300">
          Review, edit, and remove orders submitted from the store.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Orders</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{orders.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Order Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatCurrency(orderTotal)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {
              orders.filter((order) =>
                ["pending", "pending_payment"].includes(order.status),
              ).length
            }
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}

      {editingOrderId ? (
        <section
          ref={editSectionRef}
          className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Edit Order</h2>
              <p className="text-sm text-slate-500">{editingOrderId}</p>
            </div>

            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSaveOrder}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">
                Full Name
                <input
                  type="text"
                  name="fullName"
                  value={editForm.fullName}
                  onChange={handleEditChange}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Email
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Phone
                <input
                  type="tel"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Street Address
                <input
                  type="text"
                  name="streetAddress"
                  value={editForm.streetAddress}
                  onChange={handleEditChange}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Apt/Unit
                <input
                  type="text"
                  name="apartment"
                  value={editForm.apartment}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                City
                <input
                  type="text"
                  name="city"
                  value={editForm.city}
                  onChange={handleEditChange}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="text-sm font-semibold text-slate-700">
                State
                <input
                  type="text"
                  name="state"
                  value={editForm.state}
                  onChange={handleEditChange}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Zip
                <input
                  type="text"
                  name="zip"
                  value={editForm.zip}
                  onChange={handleEditChange}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Status
                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                >
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="paymentConfirmed"
                  checked={editForm.paymentConfirmed}
                  onChange={handleEditChange}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Payment Confirmed
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Payment Option
                <select
                  name="paymentOption"
                  value={editForm.paymentOption}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                >
                  <option value="">Select payment method</option>
                  <option value="stripe">Stripe</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Payment Reference ID
                <input
                  type="text"
                  name="paymentReferenceId"
                  value={editForm.paymentReferenceId}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Order Items
                  </h3>
                  <p className="text-sm font-semibold text-slate-600">
                    Total: {formatCurrency(editOrderTotal)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedProductIndex}
                    onChange={(event) =>
                      handleSelectedProductChange(event.target.value)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {products.map((product, index) => (
                      <option key={`${product.name}-${index}`} value={index}>
                        {product.name} - {formatCurrency(product.price)}
                      </option>
                    ))}
                  </select>

                  {getProductSizes(products[Number(selectedProductIndex)])
                    .length > 0 ? (
                    <select
                      value={
                        selectedCatalogSize ||
                        getProductSizes(products[Number(selectedProductIndex)])[0]
                      }
                      onChange={(event) =>
                        setSelectedCatalogSize(event.target.value)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {getProductSizes(
                        products[Number(selectedProductIndex)],
                      ).map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleAddCatalogItem}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {editForm.items.map((item, index) => (
                  <div
                    key={`${item.name}-${item.size || "no-size"}-${index}`}
                    className="grid gap-3 rounded-xl bg-white p-3 md:grid-cols-[1fr_120px_130px_130px_120px_auto]"
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Item Name
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) =>
                          handleItemChange(index, "name", event.target.value)
                        }
                        required
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>

                    <label className="text-sm font-semibold text-slate-700">
                      Size
                      <input
                        type="text"
                        value={item.size || ""}
                        onChange={(event) =>
                          handleItemChange(index, "size", event.target.value)
                        }
                        placeholder="Optional"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>

                    <div className="text-sm font-semibold text-slate-700">
                      Quantity
                      <div className="mt-1 flex h-10 items-center rounded-xl border border-slate-300 bg-white">
                        <button
                          type="button"
                          onClick={() => handleItemQuantityChange(index, -1)}
                          className="flex h-full w-10 items-center justify-center rounded-l-xl text-lg font-bold text-slate-700 hover:bg-slate-100"
                          aria-label={`Remove one ${item.name}`}
                        >
                          -
                        </button>

                        <span className="min-w-10 flex-1 text-center text-sm font-bold text-slate-900">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleItemQuantityChange(index, 1)}
                          className="flex h-full w-10 items-center justify-center rounded-r-xl text-lg font-bold text-slate-700 hover:bg-slate-100"
                          aria-label={`Add one ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <label className="text-sm font-semibold text-slate-700">
                      Price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(event) =>
                          handleItemChange(index, "price", event.target.value)
                        }
                        required
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                      />
                    </label>

                    <div className="text-sm font-semibold text-slate-700">
                      Line Total
                      <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">
                        {formatCurrency(
                          Number(item.price || 0) * Number(item.quantity || 0),
                        )}
                      </p>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 md:w-auto"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {editForm.items.length === 0 ? (
                  <p className="rounded-xl bg-white p-3 text-sm text-slate-500">
                    Add at least one item before saving this order.
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Order"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        {loading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Loading orders...
          </p>
        ) : orders.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No store orders yet.
          </p>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {formatDate(order.createdAt)}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {order.customer?.fullName || "No customer name"}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {order.customer?.email || "No email"} ·{" "}
                    {order.customer?.phone || "No phone"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Order ID: {order.id}</p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(order.total)}
                  </p>
                  <p className="text-sm capitalize text-slate-600">
                    {formatStatus(order.status)} ·{" "}
                    {order.paymentConfirmed ? "paid" : "payment pending"}
                  </p>
                  {order.status === "paid_inventory_review" ? (
                    <p className="mt-1 max-w-xs text-sm font-semibold text-amber-700">
                      Payment succeeded, but inventory needs manual review.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">Fulfillment</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {order.fulfillment?.method === "flat_rate"
                      ? `${formatCurrency(order.shippingAmount || 0)} Shipping`
                      : order.fulfillment?.method === "pickup"
                        ? "Local Pickup"
                        : order.fulfillment?.label || "Not specified"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Merchandise: {formatCurrency(
                      order.subtotal ??
                        Number(order.total || 0) - Number(order.shippingAmount || 0),
                    )}
                    <br />
                    Shipping: {formatCurrency(order.shippingAmount || 0)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {order.fulfillment?.method === "pickup" ? (
                      "Hold for local pickup"
                    ) : (
                      <>
                        {order.shippingAddress?.streetAddress || "No street address"}
                        {order.shippingAddress?.apartment
                          ? `, ${order.shippingAddress.apartment}`
                          : ""}
                        <br />
                        {order.shippingAddress?.city || "No city"},{" "}
                        {order.shippingAddress?.state || "No state"}{" "}
                        {order.shippingAddress?.zip || ""}
                      </>
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">Payment</p>
                  <p className="mt-2 text-sm capitalize text-slate-600">
                    {order.payment?.option || "No payment option"}
                  </p>
                  <p className="text-sm text-slate-600">
                    Ref: {order.payment?.referenceId || "None"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">Items</p>
                  <div className="mt-2 space-y-1">
                    {(order.items || []).map((item, index) => (
                      <div
                        key={`${item.name}-${item.size || "no-size"}-${index}`}
                        className="flex items-start justify-between gap-3 text-sm text-slate-600"
                      >
                        <span>
                          {item.name}
                          {item.size ? (
                            <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                              Size: {item.size}
                            </span>
                          ) : null}
                        </span>
                        <span>
                          {item.quantity} x {formatCurrency(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleEditOrder(order)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteOrder(order.id)}
                  disabled={deletingOrderId === order.id}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingOrderId === order.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
