const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const axios = require("axios");

const { ROLES, AUTH_SERVICE, ENROLLMENT_SERVICE, GRADE_SERVICE } = require("../../../consts");
const rateLimit = require("express-rate-limit");

dotenv.config();

// const trustedDomain = [AUTH_SERVICE.split("api")[0]];
const trustedDomain = [
  AUTH_SERVICE.split("api")[0],
  ENROLLMENT_SERVICE.split("api")[0],
  GRADE_SERVICE.split("api")[0],
];
/**
 * Fetch the JWKS from a given URI.
 * @param {string} jku - The JWKS URI from the JWT header.
 * @returns {Promise<Array>} - A promise that resolves to the JWKS keys.
 */
async function fetchJWKS(jku) {
  const response = await axios.get(jku);
  return response.data.keys;
}

/**
 * Get the public key from JWKS.
 * @param {string} kid - The key ID from the JWT header.
 * @param {Array} keys - The JWKS keys.
 * @returns {string} - The corresponding public key in PEM format.
 */
function getPublicKeyFromJWKS(kid, keys) {
  const key = keys.find((k) => k.kid === kid);

  if (!key) {
    throw new Error("Unable to find a signing key that matches the 'kid'");
  }

  return `-----BEGIN PUBLIC KEY-----\n${key.n}\n-----END PUBLIC KEY-----`;
}

/**
 * Verify a JWT token using the JWKS URI in the `jku` header.
 * @param {string} token - The JWT token to verify.
 * @returns {Promise<object>} - A promise that resolves to the decoded JWT payload.
 */
async function verifyJWTWithJWKS(token) {
  const decodedHeader = jwt.decode(token, { complete: true }).header;
  const { kid, alg, jku } = decodedHeader;

  if (!kid || !jku) {
    throw new Error("JWT header is missing 'kid' or 'jku'");
  }

    if (!trustedDomain.includes(jku.split(".well")[0])) {
    throw new Error("Domain not supported");
  }

  if (alg !== "RS256") {
    throw new Error(`Unsupported algorithm: ${alg}`);
  }

  const keys = await fetchJWKS(jku);
  const publicKey = getPublicKeyFromJWKS(kid, keys);

  return jwt.verify(token, publicKey, { algorithms: ["RS256"] });
}

// Role-based Access Control Middleware
function verifyRole(requiredRoles) {
  return async (req, res, next) => {
    const token =
      req.headers.authorization && req.headers.authorization.split(" ")[1]; // Extract token from 'Bearer <token>'

    if (!token) {
      return res
        .status(401)
        .json({ message: "Authorization token is missing" });
    }

    try {
      // Step 1: Verify the JWT token using JWKS
      const decoded = await verifyJWTWithJWKS(token); // Decode the token and get the payload
      req.user = decoded; // Attach the decoded payload (user data) to the request object

      // Step 2: Check if the user has any of the required roles
      // The some() method of Array instances tests whether at least one element in the array passes the test implemented by the provided function.
      const userRoles = req.user.roles || [];
      const hasRequiredRole = userRoles.some((role) =>
        requiredRoles.includes(role)
      );
      if (hasRequiredRole) {
        return next(); // User has at least one of the required roles, so proceed
      } else {
        return res
          .status(403)
          .json({ message: "Access forbidden: Insufficient role" });
      }
    } catch (error) {
      console.error(error);
      return res
        .status(403)
        .json({ message: "Invalid or expired token", error: error.message });
    }
  };
}
const jwtRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many requests from this IP, please try again after a minute",
  headers: true,
    keyGenerator: (req, res) => req?.user?.id, // Use user ID from decoded JWT as the key, fallback to IP if no user ID
  handler : (req, res) => {res.status(429).json({ message: "Too many requests from this user, please try again after a minute" });}
});

function restrictStudentToOwnData(req, res, next) {
  if (req.user.roles.includes(ROLES.STUDENT) && req.user.id !== req.params.id) {
    return res.status(403).json({
      message: "Access forbidden: You can only access your own data",
    });
  }
  next();
}

module.exports = {
  verifyRole,
  restrictStudentToOwnData,
  jwtRateLimiter,
};
 