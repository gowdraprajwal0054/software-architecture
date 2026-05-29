const mongoose = require("mongoose");

// Define the Enrollment Schema
const enrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  enrollmentDate: {
    type: Date,
    default: Date.now,
  },
});

// Add a unique compound index for student and course
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

module.exports = Enrollment;
