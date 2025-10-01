import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBsXU4UkVhjoE1nOLkJUUpszj8FlOKzAhA",
  authDomain: "baykilit-73ad8.firebaseapp.com",
  projectId: "baykilit-73ad8",
  storageBucket: "baykilit-73ad8.firebasestorage.app",
  messagingSenderId: "684249702631",
  appId: "1:684249702631:web:232a38ce1761afa2ccc242",
  measurementId: "G-3Z5GPK5DXN"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };