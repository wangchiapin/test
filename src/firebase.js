import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Paste the NEW Firebase project's config here.
// Firebase Console → Project settings → General → "Your apps" → SDK setup and configuration
//
// This project must have:
//   1) Authentication → Sign-in method → Email/Password enabled
//   2) Firestore Database created (any region)
//   3) The security rules from firestore.rules applied
//
// Because this points at a brand-new, empty Firestore project, the app will
// start with zero data the moment it's deployed — no expenses, incomes,
// categories, or settings carry over from the old project.
const firebaseConfig = {
  apiKey: "貼上新專案的 apiKey",
  authDomain: "貼上新專案的 authDomain",
  projectId: "貼上新專案的 projectId",
  storageBucket: "貼上新專案的 storageBucket",
  messagingSenderId: "貼上新專案的 messagingSenderId",
  appId: "貼上新專案的 appId",
  // measurementId is optional — only present if you enabled Google Analytics
  // measurementId: "貼上新專案的 measurementId",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
