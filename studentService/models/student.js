const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define the Student Schema
const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,// Remove whitespace
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
});

studentSchema.pre("save", async function (next) {
    // only hash the password if it has been modified (or is new)   
    if (!this.isModified("password")) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password =  await bcrypt.hash(this.password, salt);
        next();
    }catch (error) {
        next(error);
}
});

// Create the Student model
const Student = mongoose.model("Student", studentSchema);

module.exports = Student;
