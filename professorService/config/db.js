const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI
      //   , {
      //   useNewUrlParser: true, //supports modern connection strings.
      //   useUnifiedTopology: true, // reliable and consistent connection behavior.
      // }
    );
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
