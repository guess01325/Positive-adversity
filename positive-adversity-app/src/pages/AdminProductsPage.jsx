import { useEffect, useMemo, useState } from "react";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from "../lib/firestore";
import {
  initialProductForm,
  getProductStore,
  normalizeProductForm,
  productCategories,
  productSizesByCategory,
  productStores,
  productToForm,
} from "../lib/products";
import { formatCurrency } from "../lib/utils";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [editingProductId, setEditingProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedStoreLabel =
    productStores.find((store) => store.value === productForm.store)?.label ||
    "Positive Adversity Gear";

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) => getProductStore(product) === productForm.store,
      ),
    [productForm.store, products],
  );

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");
      const data = await fetchProducts({ includeInactive: true });
      setProducts(data || []);
    } catch (loadError) {
      console.error("Failed to load products:", loadError);
      setError(loadError?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function handleFormChange(event) {
    const { name, value, checked, type } = event.target;

    setProductForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "category" ? { sizes: [] } : {}),
    }));
  }

  function handleSizeToggle(size) {
    setProductForm((currentForm) => {
      const currentSizes = Array.isArray(currentForm.sizes)
        ? currentForm.sizes
        : [];

      return {
        ...currentForm,
        sizes: currentSizes.includes(size)
          ? currentSizes.filter((currentSize) => currentSize !== size)
          : [...currentSizes, size],
      };
    });
  }

  function handleEditProduct(product) {
    setMessage("");
    setError("");
    setEditingProductId(product.id);
    setProductForm(productToForm(product));
  }

  function handleCancelEdit() {
    setEditingProductId("");
    setProductForm(initialProductForm);
  }

  async function handleSubmitProduct(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      setSaving(true);
      const payload = normalizeProductForm(productForm);

      if (!payload.name) {
        throw new Error("Product name is required.");
      }

      if (payload.price <= 0) {
        throw new Error("Product price must be greater than 0.");
      }

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        setMessage("Product updated.");
      } else {
        await createProduct(payload);
        setMessage("Product created.");
      }

      await loadProducts();
      handleCancelEdit();
    } catch (saveError) {
      console.error("Failed to save product:", saveError);
      setError(saveError?.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(productId) {
    const confirmed = window.confirm("Delete this product?");
    if (!confirmed) return;

    setMessage("");
    setError("");
    setDeletingProductId(productId);

    try {
      await deleteProduct(productId);
      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productId),
      );
      if (editingProductId === productId) {
        handleCancelEdit();
      }
      setMessage("Product deleted.");
    } catch (deleteError) {
      console.error("Failed to delete product:", deleteError);
      setError(deleteError?.message || "Failed to delete product.");
    } finally {
      setDeletingProductId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Products
        </p>
        <h1 className="mt-2 text-3xl font-bold">Admin Products</h1>
        <p className="mt-2 text-sm text-slate-300">
          Create and manage products that appear in the store.
        </p>
      </section>

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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">
            {editingProductId ? "Edit Product" : "Create Product"}
          </h2>

          {editingProductId ? (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmitProduct}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Product Name
              <input
                type="text"
                name="name"
                value={productForm.name}
                onChange={handleFormChange}
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Product Price
              <input
                type="number"
                name="price"
                value={productForm.price}
                onChange={handleFormChange}
                min="0"
                step="0.01"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Store
              <select
                name="store"
                value={productForm.store}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {productStores.map((store) => (
                  <option key={store.value} value={store.value}>
                    {store.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Category
              <select
                name="category"
                value={productForm.category}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {productCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-sm font-semibold text-slate-700">
              Sizes
              <div className="mt-1 flex flex-wrap gap-2 rounded-xl border border-slate-300 p-2">
                {(productSizesByCategory[productForm.category] || []).map(
                  (size) => {
                    const selected = productForm.sizes.includes(size);

                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleSizeToggle(size)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                          selected
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Product Photo URL
            <input
              type="url"
              name="image"
              value={productForm.image}
              onChange={handleFormChange}
              placeholder="https://example.com/product.png"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          {productForm.image ? (
            <div className="flex h-36 items-center justify-center rounded-xl bg-slate-100 p-3">
              <img
                src={productForm.image}
                alt={productForm.name || "Product preview"}
                className="max-h-28 object-contain"
              />
            </div>
          ) : null}

          <label className="block text-sm font-semibold text-slate-700">
            Description
            <textarea
              name="description"
              value={productForm.description}
              onChange={handleFormChange}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="featured"
                checked={productForm.featured}
                onChange={handleFormChange}
                className="h-4 w-4 rounded border-slate-300"
              />
              Featured in this store
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="inStock"
                checked={productForm.inStock}
                onChange={handleFormChange}
                className="h-4 w-4 rounded border-slate-300"
              />
              In Stock
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : editingProductId
                ? "Save Product"
                : "Create Product"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Product List
            </p>
            <h2 className="text-xl font-bold text-slate-900">
              {selectedStoreLabel} Products
            </h2>
          </div>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
            {visibleProducts.length}
          </span>
        </div>

        {loading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Loading products...
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No products created yet.
          </p>
        ) : visibleProducts.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No products created for {selectedStoreLabel} yet.
          </p>
        ) : (
          visibleProducts.map((product) => (
            <article
              key={product.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 p-2">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-h-20 object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">No photo</span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {productStores.find(
                        (store) => store.value === getProductStore(product),
                      )?.label || "Positive Adversity Gear"}{" "}
                      · {product.inStock === false ? "Out of Stock" : "In Stock"}
                      {product.featured ? " · Featured" : ""}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {product.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {product.category || "No category"} ·{" "}
                      {formatCurrency(product.price)}
                    </p>
                    {product.sizes?.length ? (
                      <p className="mt-1 text-sm text-slate-500">
                        Sizes: {product.sizes.join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-700">
                      {product.description || "No description"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditProduct(product)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(product.id)}
                    disabled={deletingProductId === product.id}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingProductId === product.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
