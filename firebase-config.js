// Konfigurasi Firebase JS SDK
const firebaseConfig = {
  apiKey: "AIzaSyBz-tSJRAdrPKMIN1TSbzyLnNmYmzdRDZQ",
  authDomain: "evavo-dc806.firebaseapp.com",
  projectId: "evavo-dc806",
  storageBucket: "evavo-dc806.firebasestorage.app",
  messagingSenderId: "96634564743",
  appId: "1:96634564743:web:34c2361eedaa429a854822",
  measurementId: "G-102T2GMJ6X"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Inisialisasi Messaging untuk Push Notification PWA
const messaging = firebase.messaging();
