importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// ⚠️ À REMPLACER PAR VOTRE CONFIGURATION FIREBASE
firebase.initializeApp({
  apiKey: "AIzaSyChQfZeEQkUaN6cnWTH94gsz1K_SObMdFg",
  authDomain: "mtc-cda71.firebaseapp.com",
  projectId: "mtc-cda71",
  storageBucket: "mtc-cda71.firebasestorage.app",
  messagingSenderId: "374572897705",
  appId: "1:374572897705:web:e68850486d26f5936f20b8",
  measurementId: "G-308XY3VP59"
});

const messaging = firebase.messaging();
