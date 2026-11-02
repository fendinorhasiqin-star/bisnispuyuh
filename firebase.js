// Konfigurasi Firebase PuyuhKu — isi nilai di bawah dari Firebase Console
// (Project settings → Your apps → Web app → firebaseConfig).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEL9Av_OrHW1zt-0REnZoymXM-Qeg5zfQ",
  authDomain: "bisnis-puyuh.firebaseapp.com",
  projectId: "bisnis-puyuh",
  storageBucket: "bisnis-puyuh.firebasestorage.app",
  messagingSenderId: "226784274230",
  appId: "1:226784274230:web:2474888a57facb56117597",
  measurementId: "G-CZ694MG0DX"
};

export const configured = !firebaseConfig.apiKey.startsWith("ISI");
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Cache lokal: aplikasi tetap bisa dipakai saat sinyal lemah, data terkirim otomatis saat online.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
export { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, collection, doc, onSnapshot, writeBatch };