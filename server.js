require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { MongoClient, ObjectId } = require("mongodb");  // Import ObjectId
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
  console.error("❌ Failed to initialize Supabase. Check your SUPABASE_URL and SUPABASE_API.");
}

// ✅ MongoDB Connection
const client = new MongoClient(process.env.MONGO_URI);
let db, usersCollection, listingsCollection; // Store listingsCollection

async function connectToDB() {
  try {
    await client.connect();
    db = client.db("EcoSwapDB");
    usersCollection = db.collection("users");

    // ✅ Create or access the listings collection
    listingsCollection = db.collection("listings");

    // Check if collection exists, if not create it.
    if (!(await db.listCollections({name: "listings"}).next())) {
      await db.createCollection("listings");
      console.log("Created 'listings' collection");
    }

    const collections = await db.listCollections({ name: "users" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("users");
      console.log("Created 'users' collection");
    }

    console.log("✅ Connected to MongoDB successfully");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

connectToDB();

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    const {
      type,
      fullname,
      address,
      city,
      pincode,
      scrap_type,
      vehicle,
      username,
      password,
      confirm_password,
      aadhaar,
      phone,
      email,
      business_name,
      business_category,
      image_url,
      raw_material,
      rep_name,
      rep_role,
      rep_phone,
      gst_number,
      registration_number,
    } = req.body;

    if (!type || !["customer", "scrap_collector", "business"].includes(type)) {
      return res.status(400).json({ error: "Invalid user type" });
    }

    if (
      !username ||
      !password ||
      !confirm_password ||
      //!aadhaar ||
      !phone
    ) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    // Check if user exists
    const existingUser = await usersCollection.findOne({ username, type });

    if (existingUser) {
      return res.status(409).json({
        error:
          "User with this username already exists for the same user type. Please use a different username.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare user data
    const userData = {
      type,
      username,
      hashed_password: hashedPassword,
      aadhaar,
      phone,
      email: email ? email.toLowerCase() : "",
    };

    if (type === "customer") {
      userData.address = address || "";
    } else if (type === "scrap_collector") {
      Object.assign(userData, {
        fullname,
        address,
        city,
        pincode,
        scrap_type,
        vehicle,
        image_url,
      });
    } else if (type === "business") {
      Object.assign(userData, {
        business_name,
        business_category,
        raw_material,
        representative: {
          name: rep_name,
          role: rep_role,
          phone: rep_phone,
        },
        gst_number,
        registration_number,
      });
    }

    // Insert into MongoDB
    await usersCollection.insertOne(userData);

    if (type === "scrap_collector") {
      await supabase.from("scrap_collectors").insert([{ username, image_url }]);
    }

    // ✅ Create an entry in Supabase rewards table
    await supabase
      .from("reward")
      .insert([{ username: username, score: 0, redeemed_points: 0 }]);

    if (type === "scrap_collector") {
      return res
        .status(201)
        .json({ message: "Scrap Collector registered successfully!", image_url });
    } else {
      return res.status(201).json({ message: "User registered successfully!" });
    }
  } catch (err) {
    console.error("❌ Internal Server Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Login Route
app.post("/login", async (req, res) => {
  try {
    const { username, password, userType } = req.body;
    console.log("🟢 Incoming Request:", req.body); // Log incoming request data

    // Ensure userType matches stored values
    const validUserTypes = ["customer", "scrap_collector", "business"];
    if (!userType || !validUserTypes.includes(userType)) {
      console.log("❌ Invalid user type:", userType);
      return res.status(400).json({ error: "Invalid user type" });
    }

    const user = await usersCollection.findOne({ username, type: userType });
    console.log("🔍 User Found:", user); // Log user data from DB

    if (!user) {
      console.log("❌ No matching user found");
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
    if (!isPasswordValid) {
      console.log("❌ Invalid password");
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Ensure JWT_SECRET is defined
    console.log("🔑 JWT_SECRET:", process.env.JWT_SECRET); 
    if (!process.env.JWT_SECRET) {
      console.error("🚨 JWT_SECRET is missing! Set it in your .env file.");
      return res.status(500).json({ error: "Internal server error" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { username: user.username, type: user.type },  // Include user type
      process.env.JWT_SECRET,  // Secret key stored in environment variable
      { expiresIn: "1h" }  // Token expiration time
    );

    console.log("✅ Generated Token:", token); // Log generated token

    res.status(200).json({
      message: "Login successful!",
      type: userType,
      token: token
    });

  } catch (err) {
    console.error("❌ Internal Server Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// ✅ Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==========================
// ✅ IMAGE UPLOAD & SAVE TO LISTING TABLE
// ==========================

// ✅ Upload image and update listing
app.post("/upload-photo", upload.single("photo"), async (req, res) => {
  try {
    const file = req.file;
    const username = req.body.username;

    if (!file || !username) {
      return res.status(400).json({ error: "Username and photo are required!" });
    }

    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileExt = file.originalname.split(".").pop();
    const fileName =
      "scrapcollector-photos/" + safeUsername + "-" + Date.now() + "." + fileExt;

    const { data, error } = await supabase.storage
      .from("scrapcollector-photos")
      .upload(fileName, file.buffer, { contentType: file.mimetype });

    if (error) {
      console.error("Image Upload Error:", error);
      return res.status(500).json({ error: "Failed to upload image" });
    }
    const { data: urlData } = supabase.storage
      .from("scrapcollector-photos")
      .getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    res
      .status(200)
      .json({ message: "Image uploaded successfully!", image_url: publicUrl });
  } catch (err) {
    console.error("Internal Server Error:", err);
    res.status(500).json({ error: "Internal server error" });
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
    const { data: reward, error: rewardError } = await supabase
      .from("reward")
      .select("score, redeemed_points")
      .ilike("username", username)
      .single();

    if (rewardError || !reward) {
      return res
        .status(404)
        .json({ error: "User not found or no rewards available" });
    }

    const userPoints = reward.score;
    const redeemedPoints = reward.redeemed_points;

    if (redeemedPoints >= userPoints) {
      return res.json({
        score: userPoints,
        message: "Coupon already redeemed for this score.",
      });
    }

    const category = getCategory(userPoints);
    if (!category) {
      return res.json({ score: userPoints, couponImage: null });
    }

    const { data: coupons, error: couponError } = await supabase
      .from("coupons")
      .select("image_url")
      .ilike("category", category);

    if (couponError) {
      return res.status(500).json({ error: "Error fetching coupons" });
    }

    let couponImage = "";
    if (coupons && coupons.length > 0) {
      couponImage =
        coupons[Math.floor(Math.random() * coupons.length)].image_url;
      await supabase
        .from("reward")
        .update({ redeemed_points: userPoints })
        .ilike("username", username);
    } else {
      return res.json({
        score: userPoints,
        message: "No coupons available for your category.",
      });
    }

    res.json({ score: userPoints, couponImage });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================
// ✅ WASTE LISTING ROUTES
// ==========================

// ✅ Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];  // Bearer <token>
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token!" });
      }
      req.user = user;  // Attach user info to the request object
      next();
    });
  } else {
    return res.status(401).json({ error: "Token is missing!" });
  }
};

// ✅ Fetch all waste listings for a specific user
app.get("/listings/customer/:username",async (req, res) => {
  try {
    const { username } = req.params;

    const listings = await listingsCollection.find({
      username: username,
      status: { $ne: "deleted" }, // Exclude deleted listings
    }).toArray();

    res.status(200).json(listings);
  } catch (error) {
    console.error("❌ Error fetching listings:", error);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

// ✅ Create a new waste listing
app.post("/listings", verifyToken, upload.array("images"), async (req, res) => {
  try {
    const { waste_type, description, condition, location_name, latitude, longitude } = req.body;
    const username = req.user.username;  // Get username from JWT

    if (!username || !waste_type || !description || !condition || !location_name || !latitude || !longitude) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const newListing = {
      username,
      waste_type,
      description,
      condition,
      location_name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      createdAt: new Date(),
      updatedAt: new Date(),   // Set initial updated at time
      status: "available",      // Default status
      claimed_by: null,       // Not claimed initially
      image_urls: [],
    };

    // ✅ Upload images to Supabase and collect URLs
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `waste-images/${Date.now()}_${file.originalname}`;
    
        // Upload image to Supabase
        const { data, error } = await supabase.storage
          .from("waste-images")
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
          });
    
        if (error) {
          console.error("❌ Supabase Upload Error:", error);
          return res.status(500).json({ error: "Failed to upload images to Supabase." });
        }
    
        // Get public URL of uploaded image
        const { data: publicUrlData } = supabase.storage
          .from("waste-images")
          .getPublicUrl(fileName);
    
        if (publicUrlData) {
          newListing.image_urls.push(publicUrlData.publicUrl);
        }
      }
    }
    
    // ✅ Insert the new listing into MongoDB
    const result = await listingsCollection.insertOne(newListing);
    const insertedId = result.insertedId;  // Get the ID of the inserted document
    const insertedListing = await listingsCollection.findOne({_id: insertedId})

    res.status(201).json({ message: "Listing created successfully!", listing: insertedListing });

  } catch (error) {
    console.error("❌ Error creating listing:", error);
    res.status(500).json({ error: "Failed to create listing", details: error.message });
  }
});

// ✅ Update a listing to be claimed
app.patch("/listings/:id/claim", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const claimingUsername = req.user.username; // Get business's username from JWT

    const listing = await listingsCollection.findOne({ _id: new ObjectId(id) }); // Convert id string to ObjectId

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.status !== "available") {
      return res.status(400).json({ error: "Listing is not available to claim" });
    }

    const result = await listingsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "claimed",
          claimed_by: claimingUsername,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ error: "Failed to update listing" });
    }

    res.json({ message: "Listing claimed successfully" });
  } catch (error) {
    console.error("❌ Error claiming listing:", error);
    res.status(500).json({ error: "Failed to claim listing" });
  }
});

// ✅ Soft delete a listing
app.delete("/listings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUsername = req.user.username; // Get username from JWT

    const listing = await listingsCollection.findOne({ _id: new ObjectId(id) });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Check if the user owns the listing
    if (listing.username !== requestingUsername) {
      return res.status(403).json({ error: "Unauthorized: You are not the owner of this listing" });
    }

    // Permanently delete the listing
    const result = await listingsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(500).json({ error: "Failed to delete listing" });
    }

    res.json({ message: "Listing deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting listing:", error);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

// ✅ Start Server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});