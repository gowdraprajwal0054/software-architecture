// Polyfill for Node 25+ compatibility with old jsonwebtoken/jwa dependencies
const bufferModule = require("buffer");
if (!bufferModule.SlowBuffer) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}

const express = require("express");
const dotenv = require("dotenv");

const publicKeyRoute = require("./routes/auth/publicKeyRoute");
const loginRoute = require("./routes/auth/loginRoute");
const {correlationIdMiddleware} = require("../correlationId");
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 60 * 1000, // 60 seconds
  max: 10, // limit each IP to 10 requests per windowMs 
  message: "Too many requests from this IP, please try again after 60 seconds",
  headers: true,
});

dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(limiter);

// Public Key
app.use("/.well-known/jwks.json", publicKeyRoute);

// Routes
app.use("/api/login", loginRoute);

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Auth Server running on port ${PORT}`);
});
