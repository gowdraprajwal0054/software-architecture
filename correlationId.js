const { v4: uuidv4 } = require("uuid");
const cls = require("cls-hooked");

// Create a namespace for storing correlation IDs
const namespace = cls.createNamespace("app-namespace");

// Middleware to generate or retrieve correlation IDs
const correlationIdMiddleware = (req, res, next) => {
  namespace.run(() => {
    const correlationId = req.headers["x-correlation-id"] || uuidv4(); // Use incoming ID or create a new one
    namespace.set("correlationId", correlationId);
    res.setHeader("x-correlation-id", correlationId); // Add it to the response headers
    next();
  });
};

// Function to retrieve the correlation ID
const getCorrelationId = () => namespace.get("correlationId") || "N/A";

module.exports = { correlationIdMiddleware, getCorrelationId };
