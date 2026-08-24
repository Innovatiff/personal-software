import { db, auth } from './firebase-config.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

// Sort docs by createdAt descending in JS to avoid needing composite indexes
function sortByCreatedAt(docs) {
  return docs.sort((a, b) => {
    const aTime = a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.seconds ?? 0;
    return bTime - aTime;
  });
}

// ─── Assets ──────────────────────────────────────────────────

export async function getAssets() {
  const q = query(
    collection(db, 'assets'),
    where('userId', '==', auth.currentUser.uid)
  );
  const snap = await getDocs(q);
  return sortByCreatedAt(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

export async function getAsset(id) {
  const snap = await getDoc(doc(db, 'assets', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addAsset(data) {
  return await addDoc(collection(db, 'assets'), {
    ...data,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateAsset(id, data) {
  await updateDoc(doc(db, 'assets', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteAsset(id) {
  await deleteDoc(doc(db, 'assets', id));
}

// ─── Platforms ───────────────────────────────────────────────

export async function getPlatforms() {
  const q = query(
    collection(db, 'platforms'),
    where('userId', '==', auth.currentUser.uid)
  );
  const snap = await getDocs(q);
  return sortByCreatedAt(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

export async function getPlatform(id) {
  const snap = await getDoc(doc(db, 'platforms', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addPlatform(data) {
  return await addDoc(collection(db, 'platforms'), {
    ...data,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updatePlatform(id, data) {
  await updateDoc(doc(db, 'platforms', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deletePlatform(id) {
  await deleteDoc(doc(db, 'platforms', id));
}

// ─── Businesses (clients) ────────────────────────────────────

export async function getBusinesses() {
  const q = query(
    collection(db, 'businesses'),
    where('userId', '==', auth.currentUser.uid)
  );
  const snap = await getDocs(q);
  return sortByCreatedAt(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

export async function getBusiness(id) {
  const snap = await getDoc(doc(db, 'businesses', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addBusiness(data) {
  return await addDoc(collection(db, 'businesses'), {
    ...data,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateBusiness(id, data) {
  await updateDoc(doc(db, 'businesses', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteBusiness(id) {
  await deleteDoc(doc(db, 'businesses', id));
}

// ─── Invoices ────────────────────────────────────────────────

export async function getInvoices() {
  const q = query(
    collection(db, 'invoices'),
    where('userId', '==', auth.currentUser.uid)
  );
  const snap = await getDocs(q);
  return sortByCreatedAt(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

export async function getInvoice(id) {
  const snap = await getDoc(doc(db, 'invoices', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addInvoice(data) {
  return await addDoc(collection(db, 'invoices'), {
    ...data,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function deleteInvoice(id) {
  await deleteDoc(doc(db, 'invoices', id));
}
