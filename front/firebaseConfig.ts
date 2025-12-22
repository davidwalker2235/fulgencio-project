// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getMessaging, onMessage } from "firebase/messaging";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDr61gnqvK8C0QV76M7bA-q0DltMiqpHG0",
  authDomain: "fulgencio-db.firebaseapp.com",
  databaseURL: "https://fulgencio-db-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fulgencio-db",
  storageBucket: "fulgencio-db.firebasestorage.app",
  messagingSenderId: "926935150095",
  appId: "1:926935150095:web:ee66f4bae895126a1d3d7a",
  measurementId: "G-JXD0HP9L1Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, onMessage, database };
