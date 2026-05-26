// Polyfill for Node 25+ compatibility with old jsonwebtoken/jwa dependencies
const bufferModule = require("buffer");
if (!bufferModule.SlowBuffer) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}

const express = require("express");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const studentRoutes = require("./routes/studentRoute");
const {correlationIdMiddleware} = require("../correlationId");

//reda the env file
dotenv.config();

//initialize express app
const app = express();

//connect to database
connectDB();

//middleware to parse json
app.use(express.json());
app.use(correlationIdMiddleware);

//Routes
app.use("/api/students", studentRoutes);

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
    console.log("Student Service is running on port" + PORT);
});