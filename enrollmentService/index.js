// Polyfill for Node 25+ compatibility with old jsonwebtoken/jwa dependencies
const bufferModule = require("buffer");
if (!bufferModule.SlowBuffer) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}

const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const enrollmentRoutes = require("./routes/enrollmentRoute");

const publicKeyRoute = require("./routes/auth/publicKeyRoute");
const {correlationIdMiddleware} = require("../correlationId");

dotenv.config();

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(correlationIdMiddleware);

app.use("/.well-known/jwks.json", publicKeyRoute);
app.use("/api/enrollments", enrollmentRoutes);

// Start server
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Enrollment running on port ${PORT}`);
});
