const admin = require("firebase-admin");
const serviceAccount = require("./service-account-key.json"); // Ensure you have this file from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth };
