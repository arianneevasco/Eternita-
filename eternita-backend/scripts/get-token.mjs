import "dotenv/config";

const apiKey = process.env.FIREBASE_WEB_API_KEY;

if (!apiKey) {
  console.error("Missing FIREBASE_WEB_API_KEY in .env");
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log("Usage:");
  console.log("node scripts/get-token.mjs your@example.com yourpassword");
  process.exit(1);
}

const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password,
    returnSecureToken: true,
  }),
});

const data = await response.json();

if (!response.ok) {
  console.error("Sign-in failed:");
  console.error(data);
  process.exit(1);
}

console.log("\nFirebase ID token:");
console.log(data.idToken);

console.log("\nFirebase UID:");
console.log(data.localId);

console.log("\nUse this in Postman:");
console.log(`Authorization: Bearer ${data.idToken}`);
