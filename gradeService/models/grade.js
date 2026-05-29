const mongoose = require("mongoose");

// Define the Grade Schema
const gradeSchema = new mongoose.Schema({
  student: {
    type: String, // String representation of Student ObjectId
    required: true,
  },
  course: {
    type: String, // String representation of Course ObjectId
    required: true,
  },
  professor: {
    type: String, // String representation of Professor ObjectId
    required: true,
  },
  grade: {
    type: String,
    required: true,
    trim: true,
  },
  remarks: {
    type: String,
    trim: true,
  },
  gradedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add compound unique index to prevent duplicate grades for the same student/course
gradeSchema.index({ student: 1, course: 1 }, { unique: true });

const Grade = mongoose.model("Grade", gradeSchema);

module.exports = Grade;
