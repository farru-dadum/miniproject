require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { MongoClient, ObjectId } = require("mongodb");  // Import ObjectId
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { URL } = require('url'); // Built-in Node.js module for URL parsing

const app = express();
const port = process.env.PORT || 5000;

// ✅ Supabase Initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseApiKey = process.env.SUPABASE_API;

if (!supabaseUrl || !supabaseApiKey) {
    console.error("❌ Missing Supabase URL or API Key in .env file!");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseApiKey);

if (supabase) {
  console.log("✅ Supabase connection initialized!");
} else {
  // This case might not be reachable if createClient throws an error on invalid creds,
  // but good to have a conceptual check. The check above for missing env vars is more practical.
  console.error("❌ Failed to initialize Supabase. Check your SUPABASE_URL and SUPABASE_API.");
}

// ✅ MongoDB Connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    console.error("❌ Missing MONGO_URI in .env file!");
    process.exit(1);
}
const client = new MongoClient(mongoUri);
let db, usersCollection, listingsCollection; // Store listingsCollection

async function connectToDB() {
  try {
    await client.connect();
    db = client.db("EcoSwapDB"); // Use your database name
    console.log(`✅ Connected to MongoDB database: ${db.databaseName}`);

    // Ensure 'users' collection exists
    usersCollection = db.collection("users");
    const userCollections = await db.listCollections({ name: "users" }).toArray();
    if (userCollections.length === 0) {
      await db.createCollection("users");
      console.log("✅ Created 'users' collection in MongoDB.");
    } else {
      console.log("✅ Found 'users' collection in MongoDB.");
    }

    // Ensure 'listings' collection exists
    listingsCollection = db.collection("listings");
    const listingCollections = await db.listCollections({ name: "listings" }).toArray();
    if (listingCollections.length === 0) {
      await db.createCollection("listings");
      console.log("✅ Created 'listings' collection in MongoDB.");
    } else {
      console.log("✅ Found 'listings' collection in MongoDB.");
    }

    // You might want indexes for performance, e.g., on username, status
    await usersCollection.createIndex({ username: 1, type: 1 }, { unique: true });
    await listingsCollection.createIndex({ username: 1 });
    await listingsCollection.createIndex({ status: 1 });
    console.log("✅ Ensured necessary indexes exist in MongoDB.");

    console.log("✅ Connected to MongoDB successfully and collections verified.");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

connectToDB(); // Initialize DB connection on startup

// CORS Configuration
const corsOptions = {
  origin: "*", // Allow all origins - adjust for production!
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// ========================
// ✅ Helper Functions
// ========================

// ✅ Determine coupon category based on score
function getCategory(userPoints) {
  if (userPoints >= 20 && userPoints <= 50) return "basic";
  if (userPoints > 50 && userPoints <= 150) return "standard";
  if (userPoints > 150) return "premium";
  return null;
}

// ✅ Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1]; // Bearer <token>
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error(" M JWT Verification Error:", err.message); // Log specific error
        // Differentiate between expired and invalid tokens
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Unauthorized: Token has expired!" });
        }
        return res.status(403).json({ error: "Forbidden: Invalid token!" });
      }
      req.user = user; // Attach user info { username, type } to the request object
      console.log(` M Token verified for user: ${req.user.username}, Type: ${req.user.type}`);
      next(); // Proceed to the next middleware or route handler
    });
  } else {
     console.warn(" M Auth header missing or not Bearer");
    return res.status(401).json({ error: "Unauthorized: Token is missing or invalid format!" });
  }
};


// ✅ Multer setup for handling file uploads in memory
const storage = multer.memoryStorage();
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
        cb(null, true); // Accept file
    } else {
        console.warn(` M Multer rejected file type: ${file.mimetype} for ${file.originalname}`);
        cb(new Error(`Invalid file type: ${file.originalname}. Only JPEG, PNG, GIF, WebP allowed.`), false); // Reject file
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: fileFilter
});

// Error handler for Multer errors (like file size limit)
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        }
        // Handle other Multer errors if needed
        return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
        // Handle non-Multer errors passed from fileFilter
        return res.status(400).json({ error: err.message });
    }
    next();
};


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
    // Destructure ALL expected fields to handle different user types
    const {
      type, // Common
      username, password, confirm_password, phone, email, // Common
      // Customer specific (or common if needed by others)
      fullname, address, city, pincode, // Fullname/address can be common
      // Scrap Collector specific
      scrap_type, vehicle, image_url, // image_url might be set later or default?
      // Business specific
      business_name, business_category, raw_material,
      rep_name, rep_role, rep_phone,
      gst_number, registration_number,
      // Aadhaar - Consider if really needed/privacy implications
      // aadhaar,
    } = req.body;

    // --- Basic Validation ---
    if (!type || !["customer", "scrap_collector", "business"].includes(type)) {
      return res.status(400).json({ error: "Invalid user type provided." });
    }
    if (!username || !password || !confirm_password || !phone) {
      return res.status(400).json({ error: "Required fields (username, password, confirm password, phone) are missing." });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match." });
    }
    // Add more specific validation (e.g., password strength, phone format, email format)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email format." });
    }
    // Consider phone number format validation


    // Check if user exists (unique combination of username and type)
    const existingUser = await usersCollection.findOne({ username: username.toLowerCase(), type: type });
    if (existingUser) {
      console.warn(` M Signup failed: User '${username}' with type '${type}' already exists.`);
      return res.status(409).json({
        error: `A ${type} user with this username already exists. Please choose a different username.`,
      });
    }

    // Hash password
    const saltRounds = 10; // Recommended salt rounds
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Prepare base user data
    const baseUserData = {
      type,
      username: username.toLowerCase(), // Store username consistently
      hashed_password: hashedPassword,
      phone, // Add validation?
      email: email ? email.toLowerCase() : null, // Store email consistently or null
      createdAt: new Date(),
      // aadhaar: aadhaar || null, // Store if provided
    };

    // Add type-specific data
    let userData = { ...baseUserData };
    if (type === "customer") {
      Object.assign(userData, {
         fullname: fullname || '',
         address: address || '',
         city: city || '',
         pincode: pincode || '',
      });
    } else if (type === "scrap_collector") {
       if (!fullname || !address || !city || !pincode || !scrap_type || !vehicle) {
           return res.status(400).json({ error: "Missing required fields for Scrap Collector profile." });
       }
      Object.assign(userData, {
        fullname,
        address,
        city,
        pincode,
        scrap_type, // Array or string? Validate.
        vehicle,
        image_url: image_url || null, // Handle default/placeholder image?
        // Maybe verification status? 'pending', 'approved'
      });
    } else if (type === "business") {
       if (!business_name || !business_category || !raw_material || !rep_name || !rep_role || !rep_phone) {
            return res.status(400).json({ error: "Missing required fields for Business profile." });
       }
      Object.assign(userData, {
        business_name,
        business_category: business_category || null,
        raw_material, // Array or string? Validate.
        representative: {
          name: rep_name,
          role: rep_role,
          phone: rep_phone, // Validate format?
        },
        gst_number: gst_number || null,
        registration_number: registration_number || null,
        // Maybe verification status?
      });
    }

    // Insert into MongoDB
    const insertResult = await usersCollection.insertOne(userData);
    console.log(` M User registered successfully: ${username} (${type}), ID: ${insertResult.insertedId}`);


    // If Scrap Collector, insert basic info into Supabase table (if still needed)
    // Consider if this Supabase table is redundant now that Mongo has the user data.
    // if (type === "scrap_collector") {
    //   const { error: supabaseError } = await supabase.from("scrap_collectors").insert([{ username: username.toLowerCase(), image_url: userData.image_url }]);
    //   if (supabaseError) {
    //        console.error(`❌ Supabase insert error for scrap collector ${username}:`, supabaseError);
    //        // Decide how to handle: Log and continue? Rollback Mongo insert?
    //   }
    // }

    // Create an entry in Supabase rewards table for all user types
    const { error: rewardError } = await supabase
      .from("reward") // Ensure this table exists in Supabase
      .insert([{ username: username.toLowerCase(), score: 0, redeemed_points: 0 }]);
     if (rewardError) {
        console.error(`❌ Supabase insert error for reward entry for ${username}:`, rewardError);
        // Log and continue, as reward system might be secondary
     }

    res.status(201).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} registered successfully!` });

  } catch (err) {
    console.error("❌ Internal Server Error during signup:", err);
    // Avoid exposing detailed error messages in production
    res.status(500).json({ error: "Internal server error during registration." });
  }
});

// ✅ Login Route
app.post("/login", async (req, res) => {
  try {
    const { username, password, userType } = req.body;
    console.log(" M Incoming login request:", { username, userType }); // Don't log password

    // Validate input
    const validUserTypes = ["customer", "scrap_collector", "business"];
    if (!username || !password || !userType || !validUserTypes.includes(userType)) {
      console.log(" M Login failed: Invalid input data.");
      return res.status(400).json({ error: "Invalid username, password, or user type provided." });
    }

    // Find user by username and type
    const user = await usersCollection.findOne({ username: username.toLowerCase(), type: userType });
    // console.log(" M User found in DB:", user); // Sensitive, disable in prod

    if (!user) {
      console.log(` M Login failed: No matching user found for username '${username}' and type '${userType}'.`);
      return res.status(401).json({ error: "Invalid credentials." }); // Generic error
    }

    // Compare provided password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
    if (!isPasswordValid) {
      console.log(` M Login failed: Invalid password for user '${username}'.`);
      return res.status(401).json({ error: "Invalid credentials." }); // Generic error
    }

    // Ensure JWT_SECRET is defined
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("🚨 JWT_SECRET environment variable is missing!");
      return res.status(500).json({ error: "Internal server error: Authentication configuration missing." });
    }

    // Generate JWT token
    const tokenPayload = {
        username: user.username, // Use consistent case from DB
        type: user.type
        // Add other non-sensitive info if needed (e.g., user._id as string?)
        // userId: user._id.toString()
    };
    const token = jwt.sign(
      tokenPayload,
      jwtSecret,
      { expiresIn: "1h" } // Token expiration time (e.g., 1 hour)
    );

    console.log(` M Login successful for user '${user.username}', generated token.`);

    // Return success response with token and user type
    res.status(200).json({
      message: "Login successful!",
      type: user.type,
      username: user.username, // Send username back for frontend use
      token: token
    });

  } catch (err) {
    console.error("❌ Internal Server Error during login:", err);
    res.status(500).json({ error: "Internal server error during login." });
  }
});

// ==========================
// ✅ IMAGE UPLOAD (Standalone - used by Edit Flow)
// ==========================

// ✅ Upload images (specifically for the edit listing flow, requires auth)
app.post("/upload-images", verifyToken, upload.array("images", 5), handleMulterError, async (req, res) => { // Added max count 5, error handler
  try {
      const username = req.user.username; // Get username from verified token
      console.log(` M Image upload request received from user: ${username}`);

      if (!req.files || req.files.length === 0) {
          // Should be caught by Multer if no files, but double-check
          return res.status(400).json({ error: "No files were uploaded." });
      }
      // Max count validation is handled by multer config `upload.array("images", 5)`

      let uploadedImageUrls = [];

      for (const file of req.files) {
          // Validation for type and size is handled by Multer fileFilter and limits

          const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
          // Organize uploads by username and add timestamp for uniqueness
          const fileName = `waste-images/${username}/${Date.now()}_${safeOriginalName}`;

          console.log(` M Uploading ${fileName} to Supabase bucket 'waste-images'...`);

          // Upload image to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
              .from("waste-images") // Ensure this is your bucket name
              .upload(fileName, file.buffer, {
                  contentType: file.mimetype,
                  upsert: false, // Prevent accidental overwrites for new uploads
              });

          if (uploadError) {
              console.error(`❌ Supabase Upload Error for ${fileName}:`, uploadError);
              // Stop and return error if any upload fails
              return res.status(500).json({ error: `Failed to upload image: ${file.originalname}. ${uploadError.message}` });
          }

          // Get public URL of the uploaded image
          const { data: publicUrlData } = supabase.storage
              .from("waste-images") // Ensure bucket name is correct
              .getPublicUrl(fileName);

          if (publicUrlData && publicUrlData.publicUrl) {
              uploadedImageUrls.push(publicUrlData.publicUrl);
              console.log(` M Successfully uploaded ${fileName}, URL: ${publicUrlData.publicUrl}`);
          } else {
               console.error(`❌ Failed to get public URL for ${fileName} after successful upload.`);
               // Decide handling: stop? log and skip URL?
               // For robustness, maybe log and skip, but inform client?
          }
      }

      console.log(` M Successfully uploaded ${uploadedImageUrls.length} images for user ${username}.`);
      return res.status(200).json({
          message: "Images uploaded successfully!",
          image_urls: uploadedImageUrls, // Send back the array of public URLs
      });

  } catch (error) {
       // Catch any unexpected errors during the process
      console.error("❌ Unexpected Server Error during image upload:", error);
      return res.status(500).json({ error: "Internal server error during image upload." });
  }
});


// ==========================
// ✅ REWARDS SYSTEM ROUTES
// ==========================

// ✅ Fetch user score and retrieve available coupon (Requires Authentication)
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

// ✅ Create a new waste listing (Requires Authentication)
app.post("/listings", verifyToken, upload.array("images", 5), handleMulterError, async (req, res) => { // Max 5 images
  try {
    const { waste_type, description, condition, location_name, latitude, longitude } = req.body;
    const username = req.user.username;  // Get username from verified JWT

    console.log(` M Received request to create listing from user: ${username}`);

    // --- Validation ---
    if (!username || !waste_type || !description || !condition || !location_name || latitude === undefined || longitude === undefined) {
      console.warn(` M Create listing failed: Missing required fields for user ${username}.`);
      return res.status(400).json({ error: "Missing required fields (type, description, condition, location, coordinates)." });
    }
    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
         console.warn(` M Create listing failed: Invalid coordinates for user ${username}. Lat: ${latitude}, Lng: ${longitude}`);
         return res.status(400).json({ error: "Invalid latitude or longitude values provided." });
    }
    // Add more validation? e.g., condition enum check?

    const newListing = {
      username, // From token
      waste_type,
      description,
      condition,
      location_name,
      latitude: parsedLat,
      longitude: parsedLng,
      createdAt: new Date(),
      updatedAt: new Date(),   // Set initial updated at time
      status: "available",      // Default status
      claimed_by: null,       // Not claimed initially
      image_urls: [],         // Initialize empty array for image URLs
    };

    // --- Image Upload to Supabase ---
    if (req.files && req.files.length > 0) {
        console.log(` M Uploading ${req.files.length} images for new listing by ${username}...`);
        // Max count validation is done by multer config
        // Type/size validation is done by multer fileFilter/limits

      for (const file of req.files) {
        const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const fileName = `waste-images/${username}/${Date.now()}_${safeOriginalName}`; // Organize by username

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("waste-images") // Bucket name
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false // Don't overwrite
          });

        if (uploadError) {
          console.error(`❌ Supabase Upload Error during listing creation for ${fileName}:`, uploadError);
          // Decide handling: Stop? Delete already uploaded? For now, stop and report error.
          return res.status(500).json({ error: `Failed to upload image: ${file.originalname}. Listing not created.` });
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("waste-images")
          .getPublicUrl(fileName);

        if (publicUrlData && publicUrlData.publicUrl) {
          newListing.image_urls.push(publicUrlData.publicUrl);
        } else {
             console.error(`❌ Failed to get public URL for ${fileName} after upload.`);
             // Log and continue, but the URL won't be saved for this image
        }
      }
       console.log(` M Finished uploading images for new listing by ${username}.`);
    } else {
        console.log(` M No images provided for new listing by ${username}.`);
    }

    // --- Insert Listing into MongoDB ---
    const result = await listingsCollection.insertOne(newListing);
    const insertedListing = await listingsCollection.findOne({ _id: result.insertedId }); // Fetch the created doc

    console.log(` M Listing created successfully by ${username}, ID: ${result.insertedId}`);
    res.status(201).json({ message: "Listing created successfully!", listing: insertedListing }); // Return the created listing

  } catch (error) {
    // Catch unexpected errors
    console.error("❌ Internal Server Error creating listing:", error);
    res.status(500).json({ error: "Failed to create listing due to a server error.", details: error.message });
  }
});


// ✅ Fetch all waste listings for a specific customer (Requires Authentication)
app.get("/listings/customer/:username", verifyToken, async (req, res) => {
  try {
    const { username: requestedUsername } = req.params;
    const { username: tokenUsername } = req.user; // Username from verified JWT

    // --- Authorization Check ---
    // Ensure the user requesting the listings is the owner of those listings
    if (requestedUsername !== tokenUsername) {
        console.warn(` M Authorization Denied: User ${tokenUsername} attempted to access listings for ${requestedUsername}`);
        return res.status(403).json({ error: "Forbidden: You can only access your own listings." });
    }

    console.log(` M Fetching listings for authorized user: ${tokenUsername}`);

    // Fetch listings from MongoDB for the authenticated user
    const listings = await listingsCollection.find({
      username: tokenUsername, // Fetch based on the authenticated user's username
      // status: { $ne: "deleted" }, // Remove if using permanent delete
    })
    .sort({ createdAt: -1 }) // Sort by newest first
    .toArray();

    console.log(` M Found ${listings.length} listings for user ${tokenUsername}.`);
    res.status(200).json(listings); // Send the array of listings

  } catch (error) {
    console.error(`❌ Error fetching listings for user ${req.user?.username}:`, error);
    res.status(500).json({ error: "Failed to fetch your listings due to a server error." });
  }
});


// ✅ Fetch all *available* waste listings for business/collector view (Requires Authentication)
app.get("/listings/business", verifyToken, async (req, res) => {
  try {
     const { username: requestingUsername, type: userType } = req.user; // Get user info from token

     // Optional: Restrict access by user type
     if (userType !== 'business' && userType !== 'scrap_collector') {
          console.warn(` M User type '${userType}' (${requestingUsername}) tried accessing business/collector listings.`);
          return res.status(403).json({ error: "Forbidden: Access restricted to businesses and scrap collectors." });
     }

     console.log(` M Fetching available listings for ${userType} user: ${requestingUsername}`);

    // Fetch listings that are 'available' and NOT created by the requesting user
    const listings = await listingsCollection
      .find({
          status: "available", // Only show listings that can be claimed
          username: { $ne: requestingUsername } // Exclude the user's own listings
        })
      .sort({ createdAt: -1 }) // Show newest first
      .toArray();

    console.log(` M Found ${listings.length} available listings for ${userType} user ${requestingUsername}.`);
    res.status(200).json(listings); // Send the array

  } catch (error) {
    console.error(`❌ Error fetching available listings for ${req.user?.type} ${req.user?.username}:`, error);
    res.status(500).json({ error: "Failed to fetch available listings due to a server error." });
  }
});


// ✅ Update a listing to be claimed (Requires Authentication)
app.patch("/listings/:id/claim", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { username: claimingUsername, type: claimingUserType } = req.user; // Get user info from JWT

    console.log(` M Received request from ${claimingUsername} (${claimingUserType}) to claim listing ${id}`);

    // --- Validation ---
    if (!ObjectId.isValid(id)) {
        console.warn(` M Claim rejected: Invalid listing ID format: ${id}`);
        return res.status(400).json({ error: "Invalid listing ID format." });
    }
    const listingObjectId = new ObjectId(id);

    // Optional: Check if the user type is allowed to claim
    if (claimingUserType !== 'business' && claimingUserType !== 'scrap_collector') {
        console.warn(` M Claim rejected: User type ${claimingUserType} (${claimingUsername}) not allowed to claim.`);
        return res.status(403).json({ error: "Forbidden: Only businesses or scrap collectors can claim listings." });
    }

    // --- Fetch Listing ---
    // Use findOneAndUpdate for atomicity to prevent race conditions
    const updateResult = await listingsCollection.findOneAndUpdate(
      {
        _id: listingObjectId,
        status: "available", // Only claim if currently available
        username: { $ne: claimingUsername } // Prevent self-claiming
      },
      {
        $set: {
          status: "claimed",
          claimed_by: claimingUsername,
          updatedAt: new Date(),
        },
      },
      {
         returnDocument: "after" // Return the updated document
      }
    );


    // --- Check Result ---
    if (!updateResult.value) {
        // If value is null, the document didn't match the filter criteria
         console.warn(` M Claim failed for listing ${id} by ${claimingUsername}. Could not find available listing or user owns it.`);
         // Check why it failed (was it already claimed, deleted, or owned by user?)
         const currentListing = await listingsCollection.findOne({ _id: listingObjectId });
         if (!currentListing) {
             return res.status(404).json({ error: "Listing not found." });
         } else if (currentListing.username === claimingUsername) {
             return res.status(400).json({ error: "You cannot claim your own listing." });
         } else if (currentListing.status !== 'available') {
             return res.status(409).json({ error: `Cannot claim listing. Current status: ${currentListing.status}.` }); // 409 Conflict
         } else {
             // Should not happen if findOneAndUpdate was used correctly
             return res.status(500).json({ error: "Failed to claim listing due to an unexpected issue." });
         }
    }

    console.log(` M Listing ${id} claimed successfully by ${claimingUsername}`);
    res.status(200).json({ message: "Listing claimed successfully", listing: updateResult.value }); // Return updated doc

  } catch (error) {
    console.error(`❌ Internal Server Error claiming listing ${req.params.id} by ${req.user?.username}:`, error);
    res.status(500).json({ error: "Failed to claim listing due to a server error." });
  }
});


// ✅ Update waste listing details (Requires Authentication & Ownership)
app.post("/update-waste-listing", verifyToken, async (req, res) => { // Using POST to match frontend, could be PATCH/PUT
  try {
      const { _id: listingId, ...updateFields } = req.body; // Separate ID from update data
      const requestingUsername = req.user.username;

      console.log(` M Received update request for listing: ${listingId} by user: ${requestingUsername}`);

      // --- Validation ---
      if (!listingId || !ObjectId.isValid(listingId)) {
          console.warn(" M Update rejected: Invalid or missing listing ID.");
          return res.status(400).json({ error: "Invalid or missing listing ID." });
      }
      const listingObjectId = new ObjectId(listingId);

      // Validate required fields in the update data
      if (!updateFields.waste_type || !updateFields.description || !updateFields.condition || !updateFields.location_name || updateFields.latitude === undefined || updateFields.longitude === undefined) {
           console.warn(` M Update rejected for listing ${listingId}: Missing required fields.`);
           return res.status(400).json({ error: "Missing required fields in update data." });
      }
      // Ensure lat/lng are numbers
      updateFields.latitude = parseFloat(updateFields.latitude);
      updateFields.longitude = parseFloat(updateFields.longitude);
      if (isNaN(updateFields.latitude) || isNaN(updateFields.longitude)) {
          console.warn(` M Update rejected for listing ${listingId}: Invalid coordinates.`);
          return res.status(400).json({ error: "Invalid latitude or longitude values." });
      }

      // --- Fetch Existing Listing for Checks ---
      let existingListing = await listingsCollection.findOne({ _id: listingObjectId });

      if (!existingListing) {
          console.error(`❌ Update failed: Listing ${listingId} not found.`);
          return res.status(404).json({ error: "Listing not found" });
      }

      // --- Authorization Check (Ownership) ---
      if (existingListing.username !== requestingUsername) {
          console.error(`❌ Update rejected: User ${requestingUsername} attempted to update listing ${listingId} owned by ${existingListing.username}`);
          return res.status(403).json({ error: "Forbidden: You are not the owner of this listing" });
      }

      // --- Status Check (Prevent updating claimed/deleted?) ---
       if (existingListing.status === 'claimed') {
            console.warn(` M Update rejected: User ${requestingUsername} attempted to update claimed listing ${listingId}`);
            return res.status(400).json({ error: "Cannot update a listing that has already been claimed." });
       }
       // Add check for 'deleted' status if using soft delete

      // --- Image Handling: Delete Old Images if New Ones Provided ---
      const oldImageUrls = existingListing.image_urls || [];
      const newImageUrlsProvided = updateFields.image_urls; // This field comes from frontend ONLY if new images were uploaded

      if (newImageUrlsProvided && Array.isArray(newImageUrlsProvided)) {
          // If new URLs are present, it implies replacement. Delete old ones from storage.
          console.log(` M New images provided for listing ${listingId}. Deleting ${oldImageUrls.length} old images...`);

          if (oldImageUrls.length > 0) {
              const oldFilePaths = oldImageUrls.map(url => {
                 try {
                    const urlObject = new URL(url);
                    // Path extraction logic might need adjustment based on your exact Supabase URL structure
                    // Example assumes path starts after '/public/' or similar segment
                    const pathSegments = urlObject.pathname.split('/').filter(segment => segment);
                    const bucketIndex = pathSegments.indexOf('waste-images'); // Find bucket name index
                     if (bucketIndex !== -1) {
                          return pathSegments.slice(bucketIndex).join('/'); // Path from bucket onwards
                     }
                     console.warn(` M Could not extract valid path from old URL: ${url}`);
                     return null;
                 } catch (e) {
                     console.warn(` M Error parsing old image URL: ${url}`, e);
                     return null;
                 }
              }).filter(path => path !== null); // Filter out extraction failures

              if (oldFilePaths.length > 0) {
                  const { error: deleteError } = await supabase.storage
                      .from('waste-images')
                      .remove(oldFilePaths);
                  if (deleteError) {
                      console.error(`❌ Supabase deletion error for OLD images of listing ${listingId}:`, deleteError);
                      // Decide: Block update or just log? For now, log and continue update.
                      // Consider adding a warning to the response?
                  } else {
                       console.log(` M Successfully deleted ${oldFilePaths.length} old images from Supabase for listing ${listingId}.`);
                  }
              }
          }
          // The `updateFields` already contains the `image_urls` key with the new URLs from the request body.
          // `$set` below will automatically use these new URLs.
      } else {
            // If `image_urls` is NOT in `updateFields` (frontend didn't send it),
            // delete it from `updateFields` to ensure $set doesn't accidentally set it to null or undefined.
            delete updateFields.image_urls;
            console.log(` M No new images provided for listing ${listingId}. Existing images will be kept.`);
      }

      // --- Perform Update in MongoDB ---
      // Add updatedAt timestamp
      updateFields.updatedAt = new Date();

      console.log(` M Applying update to MongoDB for listing ${listingId}:`, updateFields);

      const result = await listingsCollection.updateOne(
          { _id: listingObjectId }, // Match document by ID and owner (already checked)
          { $set: updateFields }     // Set the fields provided
      );

      // --- Check Update Result ---
      if (result.matchedCount === 0) {
          // Should not happen if findOne succeeded, but handle defensively
          console.error(`❌ Update failed: Listing ${listingId} not found during MongoDB update operation.`);
          return res.status(404).json({ error: "Listing not found during update." });
      }

      if (result.modifiedCount === 1) {
          console.log(`✅ Successfully updated listing ${listingId}`);
          // Fetch the updated document to return the latest state
          const updatedListing = await listingsCollection.findOne({_id: listingObjectId});
          res.status(200).json({ message: "Listing updated successfully!", listing: updatedListing });
      } else {
          console.warn(`⚠️ Listing ${listingId} was matched but not modified. Data likely identical.`);
          // Return the existing document as no changes were needed
          res.status(200).json({ message: "No changes detected. Listing remains the same.", listing: existingListing });
      }
  } catch (error) {
      console.error(`❌ Internal Server Error updating listing ${req.body?._id}:`, error);
      res.status(500).json({ error: "Internal server error while updating listing." });
  }
});


// ✅ Permanently delete a listing (Requires Authentication & Ownership)
app.delete("/listings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUsername = req.user.username; // Get username from JWT

    console.log(` M Received request from user ${requestingUsername} to delete listing ${id}`);

    // --- Validation ---
    if (!ObjectId.isValid(id)) {
        console.warn(` M Delete rejected: Invalid listing ID format: ${id}`);
        return res.status(400).json({ error: "Invalid listing ID format." });
    }
    const listingObjectId = new ObjectId(id);

    // --- Fetch Listing for Checks & Image URLs ---
    const listing = await listingsCollection.findOne({ _id: listingObjectId });

    if (!listing) {
        console.warn(` M Delete failed: Listing ${id} not found.`);
        return res.status(404).json({ error: "Listing not found" });
    }

    // --- Authorization Check (Ownership) ---
    if (listing.username !== requestingUsername) {
        console.warn(` M Delete rejected: User ${requestingUsername} attempted to delete listing ${id} owned by ${listing.username}`);
        return res.status(403).json({ error: "Forbidden: You are not the owner of this listing" });
    }

    // --- Delete Associated Images from Supabase Storage ---
    const imageUrlsToDelete = listing.image_urls || [];
    if (imageUrlsToDelete.length > 0) {
        const filePaths = imageUrlsToDelete.map(url => {
            try {
                const urlObject = new URL(url);
                 const pathSegments = urlObject.pathname.split('/').filter(segment => segment);
                 const bucketIndex = pathSegments.indexOf('waste-images');
                  if (bucketIndex !== -1) {
                       return pathSegments.slice(bucketIndex).join('/');
                  }
                 console.warn(` M Could not extract valid path from URL for deletion: ${url}`);
                 return null;
            } catch (urlError) {
                console.warn(` M Invalid URL format during deletion prep: ${url}`, urlError);
                return null;
            }
        }).filter(path => path !== null);

        if (filePaths.length > 0) {
            console.log(` M Deleting ${filePaths.length} associated images from Supabase for listing ${id}...`);
            const { error: deleteError } = await supabase.storage
                .from('waste-images') // Bucket name
                .remove(filePaths);

            if (deleteError) {
                // Log error but proceed with DB deletion. Storage cleanup might need manual intervention/retry later.
                console.error(`❌ Supabase image deletion error for listing ${id}:`, deleteError);
                // Depending on policy, you might choose to block DB deletion:
                // return res.status(500).json({ error: "Failed to delete associated images. Database record not deleted." });
            } else {
                console.log(` M Successfully deleted associated images from Supabase for listing ${id}.`);
            }
        }
    } else {
         console.log(` M No associated images found in DB record for listing ${id} to delete from storage.`);
    }

    // --- Permanently Delete the Listing from MongoDB ---
    const result = await listingsCollection.deleteOne({ _id: listingObjectId });

    if (result.deletedCount === 0) {
        // Should not happen if findOne succeeded, but good check
        console.warn(` M MongoDB delete failed for listing ${id}. Delete count was 0.`);
        return res.status(404).json({ error: "Failed to delete listing (perhaps already deleted?)" });
    }

    console.log(` M Listing ${id} deleted successfully from MongoDB by ${requestingUsername}`);
    res.status(200).json({ message: "Listing deleted successfully" }); // 200 OK or 204 No Content

  } catch (error) {
    console.error(`❌ Internal Server Error deleting listing ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to delete listing due to a server error." });
  }
});


// ==========================
// ✅ CONFIGURATION ROUTE
// ==========================
// Expose non-sensitive config needed by frontend (if any)
// Avoid sending API keys or secrets here.
app.get("/get-config", (req, res) => {
  res.json({
      // Example: If frontend needed the bucket name (though it usually shouldn't)
      // SUPABASE_BUCKET: "waste-images",
      // Add other public config values if necessary
  });
});

// ✅ Fetch all waste listings for a business user (prioritize matching raw material)
// ✅ Fetch all waste listings for scrap collectors/businesses (available and claimed)
app.get("/listings/scrap", verifyToken, async (req, res) => {
  try {
    const { username: requestingUsername, type: userType } = req.user;

    console.log(` M Fetching listings for ${userType} user: ${requestingUsername}`);

    // Fetch listings with status "available" or "claimed", excluding user's own listings
    const listings = await listingsCollection
      .find({
        status: { $in: ["available", "claimed"] }, // Include both statuses
        username: { $ne: requestingUsername } // Exclude own listings
      })
      .project({
        username: 1,
        waste_type: 1,
        description: 1,
        condition: 1,
        location_name: 1,
        image_urls: 1,
        status: 1,
        claimed_by: 1
      })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(` M Found ${listings.length} listings (available and claimed) for ${userType} user ${requestingUsername}.`);
    res.status(200).json(listings);
  } catch (error) {
    console.error("❌ Error fetching scrap listings:", error);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

// PATCH request to claim a listing in MongoDB
app.patch('/listings/claim/:listingId', async (req, res) => {
  const { listingId } = req.params; // MongoDB listing _id (e.g., '67ea40e51ce3debf27e8a4f8')
  const { claimed_by, status } = req.body; // Get claimed_by and status from request body

  console.log("Incoming request to claim listing:", { listingId, claimed_by, status });

  try {
    // Update MongoDB listing status and claimed_by field
    const result = await listingsCollection.updateOne(
      { _id: new ObjectId(listingId) },  // Find by MongoDB _id
      { $set: { claimed_by, status } }   // Update claimed_by and status
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Listing not found or already claimed" });
    }

    // Retrieve the updated listing from MongoDB
    const updatedListing = await listingsCollection.findOne({ _id: new ObjectId(listingId) });

    // Send back the updated listing
    res.status(200).json(updatedListing);

  } catch (error) {
    console.error("Error claiming listing:", error);
    res.status(500).json({ error: "Failed to claim the listing" });
  }
});

app.patch('/update-score', async (req, res) => {
  const { username } = req.body; // Get the username from the request body

  if (!username) {
      return res.status(400).json({ error: 'Username is required' });
  }

  try {
      // Query Supabase to get the user's current score
      const { data, error } = await supabase
          .from('reward') // Assuming your rewards table is named 'reward'
          .select('score')
          .eq('username', username)
          .single();

      if (error && error.code !== "PGRST116") { // Ignore "No rows found" error
          return res.status(500).json({ error: 'Error fetching user data' });
      }

      if (!data) {
          // If the user doesn't exist, create them with an initial score of 0
          const { error: insertError } = await supabase
              .from('reward')
              .insert([{ username, score: 0 }]);

          if (insertError) {
              return res.status(500).json({ error: 'Error creating new user in rewards table' });
          }

          // Now update their score to 15
          const { error: updateError } = await supabase
              .from('reward')
              .update({ score: 15 })
              .eq('username', username);

          if (updateError) {
              return res.status(500).json({ error: 'Error updating score' });
          }

          return res.status(200).json({ message: 'Score updated (new user created and set to 15)', score: 15 });
      }

      // If the user exists, increment the score by 15
      const { error: updateError } = await supabase
          .from('reward')
          .update({ score: data.score + 15 })
          .eq('username', username);

      if (updateError) {
          return res.status(500).json({ error: 'Error updating score' });
      }

      return res.status(200).json({ message: 'Score updated successfully', score: data.score + 15 });
  } catch (error) {
      console.error("Error updating score:", error);
      return res.status(500).json({ error: 'Failed to update score' });
  }
});

// ✅ New Route: Fetch all business users (Requires Authentication)
app.get("/users/businesses", verifyToken, async (req, res) => {
  try {
    const { username: requestingUsername, type: userType } = req.user;

    console.log(` M Fetching business users for ${userType} user: ${requestingUsername}`);

    // Fetch all users with type "business" from the users collection
    const businesses = await usersCollection
      .find({ type: "business" })
      .project({
        username: 1,
        business_name: 1,
        raw_material: 1,
        representative: 1,
        gst_number: 1,
        registration_number: 1,
        phone: 1,
        email: 1
      }) // Only return relevant fields
      .toArray();

    console.log(` M Found ${businesses.length} business users for ${userType} user ${requestingUsername}.`);
    res.status(200).json(businesses);

  } catch (error) {
    console.error(`❌ Error fetching business users for ${req.user?.username}:`, error);
    res.status(500).json({ error: "Failed to fetch business users due to a server error." });
  }
});

// ✅ Fetch only the requesting scrap collector's claimed listings
app.get("/listings/claimed/mine", verifyToken, async (req, res) => {
  try {
    const { username: requestingUsername, type: userType } = req.user;

    console.log(` M Fetching claimed listings for ${userType} user: ${requestingUsername}`);

    // Restrict to scrap collectors only
    if (userType !== "scrap_collector") {
      console.warn(` M Access denied: User ${requestingUsername} (type: ${userType}) attempted to access scrap collector claimed listings.`);
      return res.status(403).json({ error: "Forbidden: This endpoint is only for scrap collectors." });
    }

    // Fetch listings claimed by the requesting user
    const listings = await listingsCollection
      .find({
        status: "claimed",
        claimed_by: requestingUsername // Only listings claimed by this user
      })
      .project({
        username: 1,
        waste_type: 1,
        description: 1,
        condition: 1,
        location_name: 1,
        image_urls: 1,
        status: 1,
        claimed_by: 1,
        updatedAt: 1
      })
      .sort({ updatedAt: -1 }) // Sort by claim time (most recent first)
      .toArray();

    console.log(` M Found ${listings.length} claimed listings for scrap collector ${requestingUsername}.`);
    res.status(200).json(listings);
  } catch (error) {
    console.error("❌ Error fetching user's claimed listings:", error);
    res.status(500).json({ error: "Failed to fetch your claimed listings" });
  }
});

// ========================
// ✅ Start Server
// ========================
app.listen(port, () => {
  console.log(`🚀 EcoSwap Server listening on port ${port}`);
  console.log(`🔗 Local: http://localhost:${port}`);
  // Add link to production URL if applicable
});

// Graceful shutdown handling (optional but good practice)
process.on('SIGINT', async () => {
    console.log(' M Received SIGINT. Closing connections...');
    try {
        await client.close();
        console.log('✅ MongoDB connection closed.');
        // Close Supabase connection if applicable/possible (usually managed by library)
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
    }
});
