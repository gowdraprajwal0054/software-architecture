const mongoose = require("mongoose");
const bcrypt = require("bcrypt"); // For password hashing

// Define the Professor Schema
const professorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensure each professor has a unique email
  },
  phone: {
    type: String,
    required: true,
    unique: true, // Ensure each professor has a unique phone number
  },
  password: {
    type: String,
    required: true, // Store the hashed password
  },
},{timestamps: true});

// Pre-save hook to hash the password before saving
professorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // Only hash if the password is new/changed

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare provided password with the stored hashed password
professorSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const Professor = mongoose.model("Professor", professorSchema);

module.exports = Professor;
