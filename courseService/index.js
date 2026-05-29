// Polyfill for Node 25+ compatibility with old jsonwebtoken/jwa dependencies
const bufferModule = require("buffer");
if (!bufferModule.SlowBuffer) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}

const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const courseRoutes = require("./routes/courseRoute");
const {correlationIdMiddleware} = require("../correlationId");

dotenv.config();

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(correlationIdMiddleware);

app.use("/api/courses", courseRoutes);

// Start server
const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  console.log(`Course Server running on port ${PORT}`);
});
