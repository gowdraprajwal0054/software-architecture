// Polyfill for Node 25+ compatibility with old jsonwebtoken/jwa dependencies
const bufferModule = require("buffer");
if (!bufferModule.SlowBuffer) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}

const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const gradeRoutes = require("./routes/gradeRoute");
const publicKeyRoute = require("./routes/auth/publicKeyRoute");
const { correlationIdMiddleware } = require("../correlationId");

dotenv.config();

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(correlationIdMiddleware);

// JWKS Endpoint
app.use("/.well-known/jwks.json", publicKeyRoute);

// Routes
app.use("/api/grades", gradeRoutes);

// Start server
const PORT = process.env.PORT || 5006;
app.listen(PORT, () => {
  console.log(`Grade Server running on port ${PORT}`);
});
