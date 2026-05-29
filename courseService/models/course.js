const mongoose = require("mongoose");

// Define the Course Schema
const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true, // Each course should have a unique code
  },
  description: {
    type: String,
    required: true,
  },
  schedule: {
    days: [String], // Days of the week the class meets, e.g. ['Monday', 'Wednesday']
    time: String, // Class time, e.g. '10:00 AM - 12:00 PM'
  },
  createdBy: {
    type: String,
    required: true,
  },
});

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
