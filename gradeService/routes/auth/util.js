const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const {
  ROLES,
  STUDENT_SERVICE,
  COURSE_SERVICE,
  ENROLLMENT_SERVICE,
  GRADE_SERVICE,
} = require("../../../consts");
const { getCorrelationId } = require("../../../correlationId");

dotenv.config();

const kid = "1";
const jku = `http://localhost:${process.env.PORT || 5006}/.well-known/jwks.json`;

// Define additional headers
const customHeaders = {
  kid,
  jku,
};

// Path to private and public keys
const privateKey = fs.readFileSync(
  path.join(__dirname, "./keys/private.key"),
  "utf8"
);
const publicKey = fs.readFileSync(
  path.join(__dirname, "./keys/public.key"),
  "utf8"
);

/**
 * Fetch the JWKS from a given URI.
 * @param {string} jku - The JWKS URI from the JWT header.
 * @returns {Promise<Array>} - A promise that resolves to the JWKS keys.
 */
async function fetchJWKS(jku) {
  const response = await axios.get(jku || "", {
    headers: {
      "x-correlation-id": getCorrelationId(),
    },
  });
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

  if (alg !== "RS256") {
    throw new Error(`Unsupported algorithm: ${alg}`);
  }

  const keys = await fetchJWKS(jku);
  const publicKey = getPublicKeyFromJWKS(kid, keys);

  return jwt.verify(token, publicKey, { algorithms: ["RS256"] });
}

// Generate a JWT using the private key
function generateJWTWithPrivateKey(payload) {
  const token = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    header: customHeaders,
    expiresIn: "6h",
  });
  return token;
}

// Role-based Access Control Middleware
function verifyRole(requiredRoles) {
  return async (req, res, next) => {
    const token =
      req.headers.authorization && req.headers.authorization.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ message: "Authorization token is missing" });
    }

    try {
      const decoded = await verifyJWTWithJWKS(token);
      req.user = decoded;

      const userRoles = req.user.roles || [];
      const hasRequiredRole = userRoles.some((role) =>
        requiredRoles.includes(role)
      );
      if (hasRequiredRole) {
        return next();
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

// Restrict students to viewing their own grades
function restrictStudentToOwnData(req, res, next) {
  if (req.user.roles.includes(ROLES.STUDENT) && req.user.id !== req.params.id) {
    return res.status(403).json({
      message: "Access forbidden: You can only access your own data",
    });
  }
  next();
}

// Outbound Service Calls
async function fetchStudent(studentId) {
  const token = generateJWTWithPrivateKey({
    id: ROLES.GRADE_SERVICE,
    roles: [ROLES.GRADE_SERVICE],
  });
  const response = await axios.get(`${STUDENT_SERVICE}/${studentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-correlation-id": getCorrelationId(),
    },
  });
  return response.data;
}

async function fetchCourse(courseId) {
  const token = generateJWTWithPrivateKey({
    id: ROLES.GRADE_SERVICE,
    roles: [ROLES.GRADE_SERVICE],
  });
  const response = await axios.get(`${COURSE_SERVICE}/${courseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-correlation-id": getCorrelationId(),
    },
  });
  return response.data;
}

async function fetchEnrollmentsForStudent(studentId) {
  const token = generateJWTWithPrivateKey({
    id: ROLES.GRADE_SERVICE,
    roles: [ROLES.GRADE_SERVICE],
  });
  const response = await axios.get(`${ENROLLMENT_SERVICE}/student/${studentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-correlation-id": getCorrelationId(),
    },
  });
  return response.data;
}

module.exports = {
  kid,
  verifyRole,
  restrictStudentToOwnData,
  fetchStudent,
  fetchCourse,
  fetchEnrollmentsForStudent,
};
