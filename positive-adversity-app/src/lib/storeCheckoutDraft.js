export const storeCheckoutDraftStorageKey = "positiveAdversityStoreCheckoutDraft";

const emptyCheckoutForm = {
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

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function createCheckoutAttemptId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getCartFingerprint(cartItems = []) {
  const normalizedItems = cartItems
    .map((item) => ({
      productId: item.productId || "",
      name: item.name || "",
      size: item.size || "",
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
    }))
    .sort((a, b) => {
      const productCompare = a.productId.localeCompare(b.productId);
      if (productCompare !== 0) return productCompare;

      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;

      return a.size.localeCompare(b.size);
    });

  return JSON.stringify(normalizedItems);
}

export function isCheckoutDraftEmpty(
  draftCartItems = [],
  draftCheckoutForm = emptyCheckoutForm,
) {
  return (
    draftCartItems.length === 0 &&
    Object.entries(emptyCheckoutForm).every(
      ([key, value]) => draftCheckoutForm[key] === value,
    )
  );
}

export function loadStoreCheckoutDraft() {
  const storage = getStorage();
  if (!storage) return null;

  const savedDraft = storage.getItem(storeCheckoutDraftStorageKey);
  if (!savedDraft) return null;

  return JSON.parse(savedDraft);
}

export function saveStoreCheckoutDraft(draft) {
  const storage = getStorage();
  if (!storage) return;

  const cartItems = Array.isArray(draft.cartItems) ? draft.cartItems : [];
  const checkoutForm =
    draft.checkoutForm && typeof draft.checkoutForm === "object"
      ? { ...emptyCheckoutForm, ...draft.checkoutForm }
      : emptyCheckoutForm;
  if (isCheckoutDraftEmpty(cartItems, checkoutForm)) {
    storage.removeItem(storeCheckoutDraftStorageKey);
    return;
  }

  storage.setItem(
    storeCheckoutDraftStorageKey,
    JSON.stringify({
      ...draft,
      cartItems,
      checkoutForm,
      cartFingerprint: draft.cartFingerprint || getCartFingerprint(cartItems),
    }),
  );
}

export function clearStoreCheckoutDraft() {
  const storage = getStorage();
  storage?.removeItem(storeCheckoutDraftStorageKey);
}
