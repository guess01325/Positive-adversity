import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import { cloudFunctions, db } from './firebase';

export const PROTECTED_ADMIN_EMAIL = 'guess01325@gmail.com';

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isProtectedAdminEmail(email) {
  return normalizeEmail(email) === PROTECTED_ADMIN_EMAIL;
}

async function updateUserRolesByEmail(email, role) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return;

  const usersQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
  const snapshot = await getDocs(usersQuery);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((userDoc) => {
    batch.update(userDoc.ref, {
      role,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function upsertUserProfile(user) {
  if (!user?.uid) {
    throw new Error("Missing user uid for profile sync.");
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const existingData = snap.exists() ? snap.data() : {};

  const normalizedEmail = normalizeEmail(user.email);
  const protectedAdmin = isProtectedAdminEmail(normalizedEmail);
  const allowedUserSnap = await getDoc(doc(db, 'allowedUsers', normalizedEmail));
  const allowedUserData = allowedUserSnap.exists() ? allowedUserSnap.data() : null;

  if (!protectedAdmin && allowedUserData?.active === false) {
    throw new Error('This account is not active. Please contact an admin.');
  }

  const shouldUseAllowedAdmin = typeof allowedUserData?.admin === 'boolean';
  const role = protectedAdmin
    ? 'admin'
    : shouldUseAllowedAdmin
      ? allowedUserData.admin
        ? 'admin'
        : 'user'
      : existingData.role || 'user';

  const displayName =
    existingData.displayName || user.displayName || normalizedEmail;

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: normalizedEmail,
      displayName,
      photoURL: existingData.photoURL || user.photoURL || "",
      role,
      createdAt: existingData.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ...existingData,
    uid: user.uid,
    email: normalizedEmail,
    displayName,
    photoURL: existingData.photoURL || user.photoURL || "",
    role,
  };
}

export async function getUserRole(userOrUid) {
  const email = normalizeEmail(
    typeof userOrUid === 'string' ? '' : userOrUid?.email
  );

  if (isProtectedAdminEmail(email)) return 'admin';

  if (email) {
    const allowedUserSnap = await getDoc(doc(db, 'allowedUsers', email));
    const allowedUserData = allowedUserSnap.exists()
      ? allowedUserSnap.data()
      : null;

    if (allowedUserData?.active === false) return 'user';
    if (allowedUserData?.admin === true) return 'admin';
  }

  const uid = typeof userOrUid === 'string' ? userOrUid : userOrUid?.uid;
  if (!uid) return 'user';

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return 'user';

  const data = snap.data();
  if (data?.isAdmin === true) return 'admin';
  return data?.role || 'user';
}

export async function fetchAllowedUsers() {
  const [allowedUsersSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(db, 'allowedUsers')),
    getDocs(collection(db, 'users')),
  ]);

  const userRoleByEmail = new Map();

  usersSnapshot.docs.forEach((userDoc) => {
    const userData = userDoc.data();
    const email = normalizeEmail(userData.email);
    if (!email) return;

    userRoleByEmail.set(email, userData.isAdmin === true || userData.role === 'admin');
  });

  const users = allowedUsersSnapshot.docs.map((doc) => {
    const data = doc.data();
    const email = normalizeEmail(doc.id);
    const protectedAdmin = isProtectedAdminEmail(email);

    return {
      email,
      active: protectedAdmin ? true : Boolean(data?.active),
      admin:
        protectedAdmin ||
        (typeof data?.admin === 'boolean'
          ? data.admin
          : Boolean(userRoleByEmail.get(email))),
      protectedAdmin,
    };
  });

  if (!users.some((user) => user.email === PROTECTED_ADMIN_EMAIL)) {
    users.push({
      email: PROTECTED_ADMIN_EMAIL,
      active: true,
      admin: true,
      protectedAdmin: true,
    });
  }

  return users.sort((a, b) => {
    if (a.admin !== b.admin) return a.admin ? -1 : 1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
}

export async function upsertAllowedUser(email, active = true, admin = false) {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    throw new Error('Email is required.');
  }

  if (isProtectedAdminEmail(cleanEmail)) {
    throw new Error('The protected developer admin cannot be changed here.');
  }

  await setDoc(doc(db, 'allowedUsers', cleanEmail), {
    active: Boolean(active),
    admin: Boolean(admin),
  });

  await updateUserRolesByEmail(cleanEmail, admin ? 'admin' : 'user');
}

export async function updateAllowedUser(originalEmail, updates) {
  const cleanOriginalEmail = normalizeEmail(originalEmail);
  const cleanNextEmail = normalizeEmail(updates.email);

  if (!cleanOriginalEmail || !cleanNextEmail) {
    throw new Error('Email is required.');
  }

  if (
    isProtectedAdminEmail(cleanOriginalEmail) ||
    isProtectedAdminEmail(cleanNextEmail)
  ) {
    throw new Error('The protected developer admin cannot be changed here.');
  }

  const payload = {
    active: Boolean(updates.active),
    admin: Boolean(updates.admin),
  };

  if (cleanOriginalEmail === cleanNextEmail) {
    await setDoc(doc(db, 'allowedUsers', cleanOriginalEmail), payload);
    await updateUserRolesByEmail(cleanNextEmail, payload.admin ? 'admin' : 'user');
    return;
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'allowedUsers', cleanNextEmail), payload);
  batch.delete(doc(db, 'allowedUsers', cleanOriginalEmail));
  await batch.commit();
  await updateUserRolesByEmail(cleanOriginalEmail, 'user');
  await updateUserRolesByEmail(cleanNextEmail, payload.admin ? 'admin' : 'user');
}

export async function deleteAllowedUser(email) {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    throw new Error('Email is required.');
  }

  if (isProtectedAdminEmail(cleanEmail)) {
    throw new Error('The protected developer admin cannot be deleted.');
  }

  await deleteDoc(doc(db, 'allowedUsers', cleanEmail));
  await updateUserRolesByEmail(cleanEmail, 'user');
}

export async function fetchEvents({ includeInactive = false } = {}) {
  const eventsRef = collection(db, 'events');
  const snapshot = await getDocs(
    includeInactive ? eventsRef : query(eventsRef, where('active', '==', true))
  );

  const events = snapshot.docs.map((eventDoc) => ({
    id: eventDoc.id,
    ...eventDoc.data(),
  }));

  return events
    .sort((a, b) => {
      const eventTimeA = Date.parse(`${a.eventDate || ''}T12:00:00`);
      const eventTimeB = Date.parse(`${b.eventDate || ''}T12:00:00`);
      const hasEventDateA = !Number.isNaN(eventTimeA);
      const hasEventDateB = !Number.isNaN(eventTimeB);

      if (hasEventDateA && hasEventDateB && eventTimeA !== eventTimeB) {
        return eventTimeA - eventTimeB;
      }

      if (hasEventDateA !== hasEventDateB) {
        return hasEventDateA ? -1 : 1;
      }

      const createdA =
        a.createdAt?.seconds != null
          ? a.createdAt.seconds * 1000 +
            Math.floor((a.createdAt.nanoseconds || 0) / 1e6)
          : 0;

      const createdB =
        b.createdAt?.seconds != null
          ? b.createdAt.seconds * 1000 +
            Math.floor((b.createdAt.nanoseconds || 0) / 1e6)
          : 0;

      return createdB - createdA;
    });
}

export async function createEvent(eventData) {
  const docRef = await addDoc(collection(db, 'events'), {
    ...eventData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateEvent(eventId, updates) {
  if (!eventId) {
    throw new Error('Missing event id for update.');
  }

  await updateDoc(doc(db, 'events', eventId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(eventId) {
  if (!eventId) {
    throw new Error('Missing event id for delete.');
  }

  await deleteDoc(doc(db, 'events', eventId));
}

export async function fetchProducts({ includeInactive = false } = {}) {
  const productsRef = collection(db, 'products');
  const snapshot = await getDocs(
    includeInactive ? productsRef : query(productsRef, where('inStock', '==', true))
  );

  const products = snapshot.docs.map((productDoc) => ({
    id: productDoc.id,
    ...productDoc.data(),
  }));

  return products.sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) {
      return a.featured ? -1 : 1;
    }

    return (a.name || '').localeCompare(b.name || '');
  });
}

export async function createProduct(productData) {
  const docRef = await addDoc(collection(db, 'products'), {
    ...productData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateProduct(productId, updates) {
  if (!productId) {
    throw new Error('Missing product id for update.');
  }

  await updateDoc(doc(db, 'products', productId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(productId) {
  if (!productId) {
    throw new Error('Missing product id for delete.');
  }

  await deleteDoc(doc(db, 'products', productId));
}

export async function createEntry(entry) {
  if (!entry?.userId) {
    throw new Error('Entry is missing userId.');
  }

  const serviceType = entry.serviceType || '';
  const baseTotalPay = Number(entry.totalPay) || 0;
  const baseInternalTotal = Number(entry.internalTotal) || 0;

  const payload = {
    userId: entry.userId,
    userEmail: entry.userEmail || '',
    userName: entry.userName || '',
    serviceType,
    date: entry.date || '',
    startTime: entry.startTime || '',
    endTime: entry.endTime || '',
    note: entry.note || '',
    student: entry.student || '',
    monthKey: entry.monthKey || '',
    hours: Number(entry.hours) || 0,
    hourlyRate: Number(entry.hourlyRate) || 0,
    totalPay: baseTotalPay,
    internalRate: Number(entry.internalRate) || 0,
    internalTotal: baseInternalTotal,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'entries'), payload);
  return { id: docRef.id };
}

export async function fetchEntryById(entryId) {
  if (!entryId) return null;

  const snap = await getDoc(doc(db, 'entries', entryId));

  if (!snap.exists()) {
    return null;
  }

  return { id: snap.id, ...snap.data() };
}

export async function fetchEntriesByUser(uid) {
  if (!uid) return [];

  const q = query(collection(db, 'entries'), where('userId', '==', uid));
  const snapshot = await getDocs(q);

  const results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  results.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';

    if (dateA !== dateB) {
      return dateA < dateB ? 1 : -1;
    }

    const createdA =
      a.createdAt?.seconds != null
        ? a.createdAt.seconds * 1000 +
          Math.floor((a.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    const createdB =
      b.createdAt?.seconds != null
        ? b.createdAt.seconds * 1000 +
          Math.floor((b.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    return createdB - createdA;
  });

  return results;
}

export async function fetchAllEntries() {
  const q = query(collection(db, 'entries'));
  const snapshot = await getDocs(q);

  const results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  results.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';

    if (dateA !== dateB) {
      return dateA < dateB ? 1 : -1;
    }

    const createdA =
      a.createdAt?.seconds != null
        ? a.createdAt.seconds * 1000 +
          Math.floor((a.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    const createdB =
      b.createdAt?.seconds != null
        ? b.createdAt.seconds * 1000 +
          Math.floor((b.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    return createdB - createdA;
  });

  return results;
}

export async function updateEntry(entryId, updates) {
  if (!entryId) {
    throw new Error('Missing entryId for update.');
  }

  const entryRef = doc(db, 'entries', entryId);
  await updateDoc(entryRef, updates);
}

export async function deleteEntry(entryId) {
  if (!entryId) {
    throw new Error('Missing entryId for delete.');
  }

  const entryRef = doc(db, 'entries', entryId);
  await deleteDoc(entryRef);
}

export async function addDCFAdjustment({ monthKey, student, createdBy }) {
  if (!monthKey || !student?.trim()) {
    throw new Error('Missing month or student for DCF adjustment.');
  }

  const payload = {
    type: 'dcf_supervision',
    serviceType: 'DCF',
    student: student.trim(),
    monthKey,
    amount: 11.25,
    createdBy: createdBy || '',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'invoiceAdjustments'), payload);
  return { id: docRef.id };
}

export async function fetchAdjustments() {
  const snapshot = await getDocs(collection(db, 'invoiceAdjustments'));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function fetchDCFAdjustmentsByMonth(monthKey) {
  if (!monthKey || monthKey === 'all') return [];

  const q = query(
    collection(db, 'invoiceAdjustments'),
    where('type', '==', 'dcf_supervision'),
    where('serviceType', '==', 'DCF'),
    where('monthKey', '==', monthKey)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function findDCFAdjustment(monthKey, student) {
  if (!monthKey || !student?.trim()) return null;

  const normalizedStudent = student.trim().toLowerCase();

  const q = query(
    collection(db, 'invoiceAdjustments'),
    where('type', '==', 'dcf_supervision'),
    where('serviceType', '==', 'DCF'),
    where('monthKey', '==', monthKey)
  );

  const snapshot = await getDocs(q);

  const match = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .find(
      (item) =>
        String(item.student || '').trim().toLowerCase() === normalizedStudent
    );

  return match || null;
}

export async function deleteAdjustment(adjustmentId) {
  if (!adjustmentId) {
    throw new Error('Missing adjustment id for delete.');
  }

  const adjustmentRef = doc(db, 'invoiceAdjustments', adjustmentId);
  await deleteDoc(adjustmentRef);
}

export async function anonymizeEntriesForDeletedUser(uid) {
  if (!uid) {
    throw new Error('Missing uid for entry anonymization.');
  }

  const q = query(collection(db, 'entries'), where('userId', '==', uid));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return 0;
  }

  const docs = snapshot.docs;
  const batchSize = 400;
  let updatedCount = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const batch = writeBatch(db);

    chunk.forEach((entryDoc) => {
      batch.update(entryDoc.ref, {
        userEmail: '',
        userName: 'Deleted User',
        accountDeleted: true,
        deletedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    updatedCount += chunk.length;
  }

  return updatedCount;
}

export async function deleteUserProfile(uid) {
  if (!uid) {
    throw new Error('Missing uid for profile delete.');
  }

  await deleteDoc(doc(db, 'users', uid));
}


export async function updateUserDisplayName(uid, displayName) {
  if (!uid) throw new Error("Missing user id");

  const cleanName = displayName.trim();

  if (!cleanName) {
    throw new Error("Display name cannot be empty");
  }

  await updateDoc(doc(db, "users", uid), {
    displayName: cleanName,
    updatedAt: serverTimestamp(),
  });

  return cleanName;
}

export async function createOrder(orderData) {
  const submitStoreOrder = httpsCallable(cloudFunctions, "submitStoreOrder");
  const result = await submitStoreOrder(orderData);

  return result.data.orderId;
}

export async function createStripeCheckoutSession(orderId, cartDetails = {}) {
  const createCheckoutSession = httpsCallable(
    cloudFunctions,
    "createCheckoutSession",
  );
  const result = await createCheckoutSession({
    orderId,
    ...cartDetails,
  });

  if (!result.data?.url) {
    throw new Error("Stripe checkout did not return a redirect URL.");
  }

  return result.data;
}

export async function fetchOrder(orderId) {
  if (!orderId) {
    throw new Error("Missing order id.");
  }

  const snapshot = await getDoc(doc(db, "orders", orderId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function fetchOrders() {
  const snapshot = await getDocs(collection(db, "orders"));

  const results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  results.sort((a, b) => {
    const createdA =
      a.createdAt?.seconds != null
        ? a.createdAt.seconds * 1000 +
          Math.floor((a.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    const createdB =
      b.createdAt?.seconds != null
        ? b.createdAt.seconds * 1000 +
          Math.floor((b.createdAt.nanoseconds || 0) / 1e6)
        : 0;

    return createdB - createdA;
  });

  return results;
}

export async function updateOrder(orderId, updates) {
  if (!orderId) {
    throw new Error("Missing order id for update.");
  }

  await updateDoc(doc(db, "orders", orderId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteOrder(orderId) {
  if (!orderId) {
    throw new Error("Missing order id for delete.");
  }

  await deleteDoc(doc(db, "orders", orderId));
}
