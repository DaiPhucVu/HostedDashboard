import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyALnaaEeoPWJWdFtFH8m3YWDxQppRRe9LE",
  authDomain: "handymanapplicationcos40006.firebaseapp.com",
  databaseURL: "https://handymanapplicationcos40006-default-rtdb.firebaseio.com",
  projectId: "handymanapplicationcos40006",
  storageBucket: "handymanapplicationcos40006.appspot.com",
  messagingSenderId: "91812569770",
  appId: "1:91812569770:web:fb3b9a906d9836f92566d3",
  measurementId: "G-06G8JXQGLG",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { database, storage, db, auth };
