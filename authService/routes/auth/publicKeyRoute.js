const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { kid } = require("./util");

// Path to your private and public keys
const publicKey = fs.readFileSync(
  path.join(__dirname, "../auth/keys/public.key"),
  "utf8"
);

// JWKS endpoint (to expose the public key in JWK format)
router.get("/", (req, res) => {
  const publicJWK = {
    keys: [
      {
        kty: "RSA",
        kid, // Key ID, used to identify the key
        use: "sig", // Key use (signature)
        alg: "RS256", // Algorithm
        n: publicKey
          .match(
            /(?:-----BEGIN PUBLIC KEY-----)(.*)(?:-----END PUBLIC KEY-----)/s
          )[1]
          .replace(/\n/g, ""),
        e: "AQAB", // Public exponent (always AQAB for RSA)
      },
    ],
  };
  res.json(publicJWK);
});
module.exports = router;
