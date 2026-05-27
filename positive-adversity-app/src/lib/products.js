export const storeProducts = [
  {
    name: "Positive Adversity T-Shirt",
    price: 25,
    description: "A comfortable Positive Adversity tee for everyday wear.",
    image: "/store/shirt-red.png",
    category: "Shirts",
    sizes: ["S", "M", "L", "XL"],
    featured: true,
    inStock: true,
  },
  {
    name: "Positive Adversity Pants",
    price: 35,
    description: "Casual Positive Adversity pants made for comfort.",
    image: "/store/pants-blue.png",
    category: "Pants",
    sizes: ["S", "M", "L", "XL"],
    featured: false,
    inStock: true,
  },
  {
    name: "Positive Adversity Hoodie",
    price: 45,
    description: "A warm Positive Adversity hoodie for cooler days.",
    image: "/store/hoodie.png",
    category: "Merch",
    sizes: ["S", "M", "L", "XL"],
    featured: true,
    inStock: true,
  },
  {
    name: "Positive Adversity Shoes",
    price: 45,
    description: "Positive Adversity shoes for everyday wear.",
    image: "/store/hoodie.png",
    category: "Shoes",
    sizes: ["S", "M", "L", "XL"],
    featured: true,
    inStock: true,
  },
];

export const initialProductForm = {
  name: "",
  price: "",
  description: "",
  image: "",
  store: "positive-adversity-gear",
  category: "Shirts",
  sizes: [],
  featured: false,
  inStock: true,
};

export const productStores = [
  {
    value: "positive-adversity-gear",
    label: "Positive Adversity Gear",
  },
  {
    value: "ac-gear",
    label: "AC Gear",
  },
];

export const productCategories = [
  "Shirts",
  "Shorts",
  "Pants",
  "Accessories/Merch",
  "Shoes",
];

export const productSizesByCategory = {
  Shirts: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
  Shorts: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
  Pants: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
  "Accessories/Merch": ["One Size"],
  Shoes: [
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
  ],
};

export function getProductStore(product) {
  if (product?.store) return product.store;
  return product?.category === "Accessories/Merch"
    ? "ac-gear"
    : "positive-adversity-gear";
}

export function normalizeProductForm(form) {
  return {
    name: form.name.trim(),
    price: Number(form.price || 0),
    description: form.description.trim(),
    image: form.image.trim(),
    store: form.store || "positive-adversity-gear",
    category: form.category.trim(),
    sizes: Array.isArray(form.sizes) ? form.sizes : [],
    featured: Boolean(form.featured),
    inStock: Boolean(form.inStock),
  };
}

export function productToForm(product) {
  return {
    name: product.name || "",
    price: product.price ?? "",
    description: product.description || "",
    image: product.image || "",
    store: getProductStore(product),
    category: product.category || "Shirts",
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    featured: Boolean(product.featured),
    inStock: product.inStock !== false,
  };
}
