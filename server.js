const express = require("express");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const client = new MongoClient(uri);
let db;

async function connectToDB() {
  try {
    await client.connect();
    db = client.db("EcoSwapDB");
    console.log("Connected to MongoDB successfully");

    // Connect Mongoose
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to MongoDB with Mongoose");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

connectToDB();

// Define Coupon Schema
const couponSchema = new mongoose.Schema({
  code: String,
  minPoints: Number,
  maxPoints: Number,
});

const Coupon = mongoose.model("Coupon", couponSchema);

// Fetch user score and generate a coupon
app.get("/get-user-score/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const reward = await db.collection("rewards").findOne({ userId });
    const userPoints = reward ? reward.score : 0;

    const eligibleCoupons = await Coupon.find({
      minPoints: { $lte: userPoints },
      maxPoints: { $gte: userPoints },
    });

    let couponCode = "No coupons available for your points.";
    if (eligibleCoupons.length > 0) {
      couponCode = eligibleCoupons[Math.floor(Math.random() * eligibleCoupons.length)].code;
    }

    res.json({ score: userPoints, coupon: couponCode });
  } catch (error) {
    console.error("Error fetching user score:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
