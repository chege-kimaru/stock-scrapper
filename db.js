require("dotenv").config();
const firebase = require("firebase");

const app = firebase.initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
});

const database = firebase.database();

exports.update = async (path, value) => {
  try {
    await database.ref(`companies/${path}`).set(value);
  } catch (e) {
    console.error(e);
  }
};

exports.read = async (path) => {
  try {
    const snapshot = await database.ref(`companies/${path}`).once("value");
    return snapshot.val();
  } catch (e) {
    console.error(e);
  }
};

// (async () => {
//   await this.update("KCB", { current: 30 });
//   const data = await this.read("KCB/current");
//   console.log(data);
// })();
