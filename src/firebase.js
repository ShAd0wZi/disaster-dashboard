import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA4Wsd4HwfpvCwqTx407sqnBjjCi4kgRJY",
  authDomain: "relief-ops-sl.firebaseapp.com",
  projectId: "relief-ops-sl",
  storageBucket: "relief-ops-sl.firebasestorage.app",
  messagingSenderId: "253690457690",
  appId: "1:253690457690:web:fd5ccf5578089460b7f263"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);