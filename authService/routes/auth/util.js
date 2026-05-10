const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");
const {
  STUDENT_SERVICE,
  PROFESSOR__SERVICE,
  ROLES,
} = require("../../../consts");

dotenv.config();

// Path to your private and public keys
const privateKey = fs.readFileSync(
  path.join(__dirname, "../auth/keys/private.key"),
  "utf8"
);
const publicKey = fs.readFileSync(
  path.join(__dirname, "../auth/keys/public.key"),
  "utf8"
);

const kid = "1";
const jku = `http://localhost:${process.env.PORT}/.well-known/jwks.json`;

// Define additional headers
const customHeaders = {
  kid, // Replace with the actual Key ID
  jku, // Replace with your JWKS URL
};

// Generate a JWT using the private key
function generateJWTWithPrivateKey(payload) {
  const token = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1h",
    header: customHeaders,
  });
  return token;
}

// JWT verification function
function verifyJWTWithPublicKey(token) {}

async function fetchStudents() {
  const response = await axios.get(STUDENT_SERVICE);
  return response.data;
}

async function fetchProfessors() {
  const response = await axios.get(PROFESSOR__SERVICE);
  return response.data;
}
module.exports = {
  kid,
  generateJWTWithPrivateKey,
  fetchStudents,
  fetchProfessors,
};
