const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const axios = require("axios");
const { ROLES } = require("../../../consts");

dotenv.config();

async function fetchJWKS(jku) {}

function getPublicKeyFromJWKS(kid, keys) {
  const key = keys.find((k) => k.kid === kid);

  if (!key) {
    throw new Error("Unable to find a signing key that matches the 'kid'");
  }

  return `-----BEGIN PUBLIC KEY-----\n${key.n}\n-----END PUBLIC KEY-----`;
}

async function verifyJWTWithJWKS(token) {}

// Role-based Access Control Middleware
function verifyRole(requiredRoles) {}

function restrictStudentToOwnData(req, res, next) {}

module.exports = {
  verifyRole,
  restrictStudentToOwnData,
};
