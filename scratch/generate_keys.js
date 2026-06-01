const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const keysDir = path.join(__dirname, "../gradeService/routes/auth/keys");
fs.mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

fs.writeFileSync(path.join(keysDir, "private.key"), privateKey);
fs.writeFileSync(path.join(keysDir, "public.key"), publicKey);

console.log("Keys generated successfully!");
