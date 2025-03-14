require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
const port = process.env.PORT || 5000;

// ✅ Supabase Initialization
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API);

if (supabase) {
    console.log("✅ Supabase connection was successful!");
} else {
    console.error("❌ Failed to initialize Supabase.");
}

// ✅ MongoDB Connection
const client = new MongoClient(process.env.MONGO_URI);
let db;

async function connectToDB() {
    try {
        await client.connect();
        db = client.db("EcoSwapDB");
        console.log("✅ Connected to MongoDB successfully");
    } catch (err) {
        console.error("❌ Failed to connect to MongoDB:", err);
        process.exit(1);
    }
}

connectToDB();

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Determine coupon category based on score
function getCategory(userPoints) {
    if (userPoints >= 20 && userPoints <= 50) return "basic";
    if (userPoints > 50 && userPoints <= 150) return "standard";
    if (userPoints > 150) return "premium";
    return null;
}

// ========================
// ✅ AUTHENTICATION ROUTES
// ========================

// ✅ Home Route
app.get("/", (req, res) => {
    res.send("EcoSwap Backend Running!");
});

// ✅ Signup Route
app.post("/signup", async (req, res) => {
    try {
        const { type, fullname, address, city, pincode, scrap_type, vehicle, username, password, confirm_password, aadhaar, phone, email, business_name, business_category } = req.body;

        if (!type || !["customer", "scrap_collector", "business"].includes(type)) {
            return res.status(400).json({ error: "Invalid user type" });
        }

        if (!username || !password || !confirm_password || !aadhaar || !phone) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        if (password !== confirm_password) {
            return res.status(400).json({ error: "Passwords do not match" });
        }

        const usersCollection = db.collection("users");

        // Check if user exists
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ error: "User already exists. Please login" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Prepare user data
        const userData = { type, username, hashed_password: hashedPassword, aadhaar, phone, email: email ? email.toLowerCase() : "" };

        if (type === "customer") {
            userData.address = address || "";
        } else if (type === "scrap_collector") {
            Object.assign(userData, { fullname, address, city, pincode, scrap_type, vehicle });
        } else if (type === "business") {
            userData.business_name = business_name;
            userData.business_category = business_category;
        }

        // Insert into MongoDB
        await usersCollection.insertOne(userData);

        // ✅ Create an entry in Supabase rewards table
        await supabase.from("reward").insert([{ username: username, score: 0, redeemed_points: 0 }]);

        res.status(201).json({ message: "User registered successfully!" });

    } catch (err) {
        console.error("❌ Internal Server Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ✅ Login Route
app.post("/login", async (req, res) => {
    try {
        const { username, password, userType } = req.body;

        // Ensure userType matches stored values
        const validUserTypes = ["customer", "scrap_collector", "business"];
        if (!userType || !validUserTypes.includes(userType)) {
            return res.status(400).json({ error: "Invalid user type" });
        }

        const usersCollection = db.collection("users");
        const user = await usersCollection.findOne({ username, type: userType });

        if (!user) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        res.status(200).json({ message: "Login successful!", type: userType });

    } catch (err) {
        console.error("❌ Internal Server Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


// ==========================
// ✅ IMAGE UPLOAD & SAVE TO LISTING TABLE
// ==========================

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Upload image and update listing
// ✅ Upload image and update listing
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const { listing_id } = req.body; // Get the listing ID from request

        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        if (!listing_id) return res.status(400).json({ error: "Missing listing ID" });

        const file = req.file;
        const fileName = `${Date.now()}_${file.originalname}`;

        // ✅ Upload file to Supabase Storage
        const { data, error } = await supabase.storage.from("waste-images").upload(fileName, file.buffer, {
            contentType: file.mimetype
        });

        if (error) throw error;

        // ✅ Generate Public URL
        const imageUrl = `https://${process.env.SUPABASE_URL}/storage/v1/object/public/waste-images/${fileName}`;

        // ✅ Fetch existing listing to get current images
        const { data: existingListing, error: fetchError } = await supabase
            .from("listing")
            .select("image_urls")
            .eq("id", listing_id)
            .single();

        if (fetchError || !existingListing) {
            return res.status(404).json({ error: "Listing not found" });
        }

        // ✅ Append new image URL to existing image URLs
        const updatedImageUrls = existingListing.image_urls ? [...existingListing.image_urls, imageUrl] : [imageUrl];

        // ✅ Update listing with new image URL array
        const { data: updateData, error: updateError } = await supabase
            .from("listing")
            .update({ image_urls: updatedImageUrls })
            .eq("id", listing_id);

        if (updateError) throw updateError;

        res.json({ message: "Image uploaded and added to listing!", imageUrl });

    } catch (error) {
        console.error("❌ Upload Error:", error.message);
        res.status(500).json({ error: "Failed to upload image" });
    }
});


// ==========================
// ✅ REWARDS SYSTEM ROUTES
// ==========================

// ✅ Fetch user score and retrieve coupon
app.get("/get-user-score/:username", async (req, res) => {
    const { username } = req.params;
    console.log(`🔍 Fetching score for username: ${username}`);

    try {
        const { data: reward, error: rewardError } = await supabase.from("reward").select("score, redeemed_points").ilike("username", username).single();

        if (rewardError || !reward) {
            return res.status(404).json({ error: "User not found or no rewards available" });
        }

        const userPoints = reward.score;
        const redeemedPoints = reward.redeemed_points;

        if (redeemedPoints >= userPoints) {
            return res.json({ score: userPoints, message: "Coupon already redeemed for this score." });
        }

        const category = getCategory(userPoints);
        if (!category) {
            return res.json({ score: userPoints, couponImage: null });
        }

        const { data: coupons, error: couponError } = await supabase.from("coupons").select("image_url").ilike("category", category);

        if (couponError) {
            return res.status(500).json({ error: "Error fetching coupons" });
        }

        let couponImage = "";
        if (coupons && coupons.length > 0) {
            couponImage = coupons[Math.floor(Math.random() * coupons.length)].image_url;
            await supabase.from("reward").update({ redeemed_points: userPoints }).ilike("username", username);
        } else {
            return res.json({ score: userPoints, message: "No coupons available for your category." });
        }

        res.json({ score: userPoints, couponImage });

    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==========================
// ✅ WASTE LISTING ROUTES
// ==========================

// ✅ Fetch all waste listings
app.post("/listings", upload.none(), async (req, res) => {
    try {
        const { username, waste_type, description, condition, location_name, latitude, longitude } = req.body;
        const image_urls = req.body.image_urls ? JSON.parse(req.body.image_urls) : [];
        const created_at = new Date().toISOString(); // ✅ Set created_at manually

        if (!username || !waste_type || !description || !location_name || image_urls.length === 0) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { data, error } = await supabase
            .from("listing")
            .insert([{ username, waste_type, description, condition, location_name, latitude, longitude, image_urls, created_at, status: "available" }]);

        if (error) throw error;

        res.status(201).json({ message: "Listing created successfully!" });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// ✅ Fetch all waste listings
app.get("/listings", async (req, res) => {
    try {
        const { data, error } = await supabase.from("listing").select("*");

        if (error) {
            return res.status(500).json({ error: "Failed to fetch listings" });
        }

        res.json(data);

    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// ✅ Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
