const mongoose = require("mongoose");

const connectDB = async () => {
	try {
		const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sms_student";
		const conn = await mongoose.connect(mongoUri);
		console.log(`MongoDB connected: ${conn.connection.host}`);
	} catch (error) {
		console.error(`MongoDB connection error: ${error.message}`);
		throw error;
	}
};

module.exports = connectDB;