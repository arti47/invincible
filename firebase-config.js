// firebase-config.js — placeholder configuration.
// The app runs fully in local-only mode with FIREBASE_ENABLED = false and needs no keys.
// To turn on multiplayer: create a Firebase project, enable Realtime Database, Storage and
// anonymous auth, paste the web config below, set FIREBASE_ENABLED to true, and deploy
// database.rules.json as your Realtime Database rules.
// NEVER commit real keys to a public repository.

export const FIREBASE_ENABLED = false;

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  databaseURL: "https://REPLACE_ME-default-rtdb.firebaseio.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};
