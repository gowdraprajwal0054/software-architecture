const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const professorRoute = require("./routes/professorRoute");

dotenv.config();

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());

app.use("/api/professors", professorRoute);

// Start server
const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Professor Server running on port ${PORT}`);
});
