// ============================
//  Modal Elements & Listeners (Add Listing)
// ============================
const modal = document.getElementById("addModal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.getElementById("closeModal"); // Close button for ADD modal
const getLocationBtn = document.getElementById("getLocation");
const wasteForm = document.getElementById("wasteForm");
const locationNameInput = document.getElementById("locationName");
const mapDiv = document.getElementById("map");
const listingsContainer = document.querySelector(".listings-container");

if (openModalBtn) {
    openModalBtn.addEventListener("click", () => {
        modal.style.display = "flex";
        // Optional: Reset add form fields if needed
        wasteForm.reset();
        // Reset map to default or last known good location if needed
        map.setView([defaultLat, defaultLng], 12);
        marker.setLatLng([defaultLat, defaultLng]);
        updateLocation(defaultLat, defaultLng); // Update form data attributes
        // Ensure map is visible and sized correctly
        setTimeout(() => map.invalidateSize(), 100);
    });
} else {
    console.warn("Add modal open button ('openModal') not found.");
}

if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => modal.style.display = "none");
} else {
    console.warn("Add modal close button ('closeModal') not found.");
}

// Close modal if clicking outside of it
window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
});

// ============================
// Leaflet Map Initialization (Add Listing)
// ============================
const defaultLat = 28.7041; // Default (e.g., Delhi)
const defaultLng = 77.1025;
let map; // Declare map variable
let marker; // Declare marker variable

// Check if map container exists before initializing
if (document.getElementById("map")) {
    map = L.map("map").setView([defaultLat, defaultLng], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(map);

    marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);

    // Update Latitude & Longitude on Marker Drag (Add Map)
    marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        updateLocation(lat, lng);
    });
} else {
    console.warn("Map container ('map') for add modal not found.");
}

// Function to Update Form and Map with Coordinates (Add Map)
function updateLocation(latitude, longitude) {
    // Use reverse geocoding (optional, requires a service/API) or just coords
    locationNameInput.value = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`; // Update input field
    wasteForm.dataset.lat = latitude.toFixed(6); // Store in dataset
    wasteForm.dataset.lng = longitude.toFixed(6); // Store in dataset
    if (map && marker) { // Check if map/marker initialized
        map.setView([latitude, longitude], 15);
        marker.setLatLng([latitude, longitude]);
        map.invalidateSize(); // Refresh map size
    }
}

// "Use My Location" Button (Add Map)
if (getLocationBtn) {
    getLocationBtn.addEventListener("click", () => {
        if (navigator.geolocation) {
            if (mapDiv) mapDiv.style.display = "block"; // Ensure map is visible
            const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    updateLocation(latitude, longitude);
                },
                error => {
                    console.error("Geolocation error:", error);
                    handleGeolocationError(error, locationNameInput);
                },
                options
            );
        } else {
            alert("Geolocation is not supported by this browser.");
            if (locationNameInput) locationNameInput.focus();
        }
    });
} else {
    console.warn("Get Location button ('getLocation') not found.");
}

// ============================
// Form Submission (Add Listing)
// ============================
if (wasteForm) {
    wasteForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append("waste_type", document.getElementById("wasteType").value);
        formData.append("description", document.getElementById("description").value);
        formData.append("condition", document.getElementById("condition").value);
        formData.append("location_name", locationNameInput.value); // Use the input's value

        // Get Latitude & Longitude from Form Dataset
        const lat = wasteForm.dataset.lat;
        const lng = wasteForm.dataset.lng;

        if (!lat || !lng) {
            alert("Location is required. Please use the map or 'Use My Location'.");
            return;
        }
        formData.append("latitude", lat);
        formData.append("longitude", lng);

        // Append Images
        const files = document.getElementById("wasteImages").files;
        if (files.length > 5) {
             alert("You can upload a maximum of 5 images.");
             return;
        }
        for (const file of files) {
            formData.append("images", file);
        }

        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) {
            alert("You must be logged in to add a listing.");
            // Optional: Redirect to login page
            // window.location.href = '/login.html';
            return;
        }

        try {
            // Show loading indicator if you have one
            console.log(" M Submitting new listing...");

            const response = await fetch("http://localhost:5000/listings", {
                method: "POST",
                body: formData, // FormData handles multipart/form-data automatically
                headers: {
                    'Authorization': `Bearer ${accessToken}` // Send JWT token
                    // 'Content-Type' is set automatically by browser for FormData
                }
            });

            const data = await response.json();

            // Hide loading indicator

            if (response.ok) {
                alert("✅ Waste listing added successfully!");
                modal.style.display = "none"; // Close modal
                wasteForm.reset(); // Reset the form
                fetchCustomerListings(); // Reload listings
            } else {
                console.error("❌ Add Listing Error:", data.error || response.statusText);
                alert(`❌ Error adding listing: ${data.error || 'Please check your input and try again.'}`);
            }
        } catch (error) {
            // Hide loading indicator
            console.error("❌ Network/Fetch Error:", error);
            alert("A network error occurred. Please check your connection and try again.");
        }
    });
} else {
    console.warn("Add listing form ('wasteForm') not found.");
}


// ============================
// Modal Elements & Listeners (Edit Listing)
// ============================
const editmodal = document.getElementById("editListingModal");
const closeEditModalBtn = document.getElementById("closeEditModalBtn"); // Close button for EDIT modal
const editListingForm = document.getElementById("editListingForm");
const editlocationNameInput = document.getElementById("editlocationName");
const editgetLocationBtn = document.getElementById("editgetLocation");
const editmapDiv = document.getElementById("editmap");
const saveEditBtn = document.getElementById("saveEditListingBtn"); // Save button in EDIT modal

let currentEditingListingImages = []; // Global scope (or scoped differently if preferred) to hold existing images during edit

if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener("click", closeEditModal);
} else {
    console.warn("Edit modal close button ('closeEditModalBtn') not found.");
}

// Close edit modal if clicking outside of it
window.addEventListener("click", (e) => {
    if (e.target === editmodal) closeEditModal();
});

// ============================
// Leaflet Map Initialization (Edit Listing)
// ============================
let editmap;
let editmarker;

// Initialize edit map only if the container exists
if (document.getElementById("editmap")) {
    editmap = L.map("editmap").setView([defaultLat, defaultLng], 12); // Start with default view

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(editmap);

    editmarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(editmap);

    // Update Latitude & Longitude on Marker Drag (Edit Map)
    editmarker.on("dragend", () => {
        const { lat, lng } = editmarker.getLatLng();
        edit_updateLocation(lat, lng);
    });
} else {
    console.warn("Map container ('editmap') for edit modal not found.");
}

// Function to Update Form and Map with Coordinates (Edit Map)
function edit_updateLocation(latitude, longitude) {
    if (editlocationNameInput && editListingForm) { // Check if elements exist
        editlocationNameInput.value = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`; // Update input field
        editListingForm.dataset.lat = latitude.toFixed(6); // Store in dataset
        editListingForm.dataset.lng = longitude.toFixed(6); // Store in dataset
    }
     if (editmap && editmarker) { // Check if map/marker initialized
        editmap.setView([latitude, longitude], 15);
        editmarker.setLatLng([latitude, longitude]);
        editmap.invalidateSize(); // Refresh map size
     }
}

// "Use My Location" Button (Edit Map)
if (editgetLocationBtn) {
    editgetLocationBtn.addEventListener("click", () => {
        if (navigator.geolocation) {
            if (editmapDiv) editmapDiv.style.display = "block";
            const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    edit_updateLocation(latitude, longitude); // Update edit form/map
                },
                error => {
                    console.error("Geolocation error (edit):", error);
                    handleGeolocationError(error, editlocationNameInput);
                },
                options
            );
        } else {
            alert("Geolocation is not supported by this browser.");
            if (editlocationNameInput) editlocationNameInput.focus();
        }
    });
} else {
    console.warn("Edit Get Location button ('editgetLocation') not found.");
}

// ============================
// Edit Listing Functions
// ============================

// Function called when Edit button on a card is clicked
function editListing(listing) {
    if (!editmodal || !editListingForm) {
        console.error("Edit modal or form not found. Cannot open edit view.");
        return;
    }
    if (!listing || !listing._id) {
         console.error("Invalid listing data passed to editListing:", listing);
         alert("Could not load listing data for editing.");
         return;
    }

    console.log(" M Opening edit for listing:", listing);

    // Populate Modal Fields with Current Values from the listing object
    document.getElementById("editListingId").value = listing._id;
    document.getElementById("editWasteType").value = listing.waste_type || '';
    document.getElementById("editDescription").value = listing.description || '';
    document.getElementById("editCondition").value = listing.condition || '';
    document.getElementById("editlocationName").value = listing.location_name || ''; // Use location_name

    // Store existing image URLs globally for this edit session
    currentEditingListingImages = listing.image_urls || [];
    console.log(" M Stored existing images:", currentEditingListingImages);
    // Optional: Display current images preview in the modal here

    // Clear the file input for new images
    const editImageInput = document.getElementById("editImage");
    if (editImageInput) editImageInput.value = "";

    // --- Initialize Edit Map ---
    const lat = listing.latitude || defaultLat;
    const lng = listing.longitude || defaultLng;

    if (editmap && editmarker) { // Ensure map elements exist
        editmap.setView([lat, lng], 15);
        editmarker.setLatLng([lat, lng]);
        // Update the form's dataset and location input immediately
        edit_updateLocation(lat, lng);
    } else {
        console.warn("Edit map or marker not initialized. Cannot set location.");
         // Still populate dataset if form exists
        if(editListingForm) {
            editListingForm.dataset.lat = lat.toFixed(6);
            editListingForm.dataset.lng = lng.toFixed(6);
        }
    }

    // Show the Modal
    editmodal.style.display = "flex";

    // Invalidate map size after modal is definitely visible
    if (editmap) {
        setTimeout(() => {
            editmap.invalidateSize();
            console.log(" M Invalidated edit map size.");
        }, 150); // Slightly longer delay might be safer
    }
}

// Function to close the Edit Modal
function closeEditModal() {
    if (editmodal) {
        editmodal.style.display = "none";
    }
    // Clear stored images when modal closes
    currentEditingListingImages = [];
     // Optional: reset edit form fields
    if (editListingForm) editListingForm.reset();
}

// Function called when Save button in Edit Modal is clicked
async function saveEditListing() {
    if (!editListingForm) {
        console.error("Edit form not found. Cannot save.");
        return;
    }

    // ✅ Extract form values
    const listingId = document.getElementById("editListingId").value;
    const wasteType = document.getElementById("editWasteType").value;
    const description = document.getElementById("editDescription").value;
    const condition = document.getElementById("editCondition").value;
    const locationName = document.getElementById("editlocationName").value; // Use the input field value
    const latitude = editListingForm.dataset.lat; // Get from form dataset
    const longitude = editListingForm.dataset.lng; // Get from form dataset
    const newImageFiles = document.getElementById("editImage")?.files; // New image files
    const accessToken = localStorage.getItem("access_token");

    if (!listingId) {
        alert("Error: Listing ID is missing.");
        return;
    }
    if (!latitude || !longitude) {
        alert("Location is required. Please use the map or 'Use My Location'.");
        return;
    }
     if (!accessToken) {
        alert("You must be logged in to update a listing.");
        return;
    }
     if (newImageFiles && newImageFiles.length > 5) {
         alert("You can upload a maximum of 5 new images.");
         return;
    }

    let uploadedImageUrls = [];
    let imagesWereUploaded = false; // Flag

    // 🟢 Upload NEW images to the backend (if any were selected)
    if (newImageFiles && newImageFiles.length > 0) {
        imagesWereUploaded = true;
        let imageFormData = new FormData();
        for (const file of newImageFiles) {
            imageFormData.append("images", file); // Key must match backend ('images')
        }

        try {
            console.log(` M Uploading ${newImageFiles.length} new images...`);
            // Use backend endpoint for uploading images
            const uploadResponse = await fetch("http://localhost:5000/upload-images", {
                method: "POST",
                body: imageFormData,
                // Authorization might not be needed here if endpoint is public/different auth
                 headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const uploadData = await uploadResponse.json();

            if (!uploadResponse.ok) {
                console.error("❌ Image upload failed:", uploadData.error || uploadResponse.statusText);
                alert(`Image upload failed: ${uploadData.error || 'Server error'}`);
                return; // Stop if upload fails
            }

            uploadedImageUrls = uploadData.image_urls || []; // Ensure it's an array
            console.log("✅ New images uploaded successfully:", uploadedImageUrls);

        } catch (error) {
            console.error("❌ Image upload fetch error:", error);
            alert("Error connecting to image upload service. Please check console and try again.");
            return; // Stop if upload fails
        }
    } else {
        console.log(" M No new images were selected for upload.");
    }

    // 🟢 Prepare Data for Updating Listing
    const updateData = {
        _id: listingId,
        waste_type: wasteType,
        description: description,
        condition: condition,
        location_name: locationName,
        latitude: parseFloat(latitude), // Ensure numbers
        longitude: parseFloat(longitude), // Ensure numbers
        // ** CRITICAL **: Only include image_urls if new images were uploaded.
        // If included, it should contain ONLY the URLs of the NEWLY uploaded images.
        // The backend will REPLACE the old array with this new one.
        ...(imagesWereUploaded && { image_urls: uploadedImageUrls })
    };

    console.log(" M Sending update data to backend:", updateData);

    // 🟢 Send Update Request to backend
    try {
        // Show loading indicator

        const response = await fetch("http://localhost:5000/update-waste-listing", {
            method: "POST", // Or PATCH, match your backend route
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` // Auth needed for update
            },
            body: JSON.stringify(updateData),
        });

        const data = await response.json();
        // Hide loading indicator

        if (response.ok) {
            alert("✅ Listing updated successfully!");
            closeEditModal(); // Close the modal
            fetchCustomerListings(); // Refresh the listings on the page
        } else {
            console.error("❌ Listing update failed:", data.error || response.statusText);
            alert(`❌ Update failed: ${data.error || 'Server error'}`);
        }
    } catch (error) {
         // Hide loading indicator
        console.error("❌ Update request network/fetch error:", error);
        alert("Server error during update. Please check your connection and try again.");
    }
}

// Attach event listener to the Save button in the Edit modal
if (saveEditBtn) {
    saveEditBtn.addEventListener("click", saveEditListing); // Trigger save function on click
} else {
    console.warn("Save button for edit modal ('saveEditListingBtn') not found.");
    // Fallback: Listen to form submission if no button ID
    if (editListingForm) {
        editListingForm.addEventListener('submit', async (e) => {
             e.preventDefault(); // Prevent default form submission
             console.log(" M Edit form submitted, calling saveEditListing...");
             await saveEditListing();
        });
    }
}


// ============================
// Delete Listing Function
// ============================
async function deleteListing(listingId, cardElement) {
    if (!confirm(`Are you sure you want to permanently delete this listing? This cannot be undone.`)) {
        return; // User cancelled
    }

    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        alert("You must be logged in to delete listings.");
        return;
    }

    if (!listingId) {
        alert("Error: Cannot delete listing without an ID.");
        return;
    }

    console.log(` M Attempting to delete listing: ${listingId}`);

    try {
        // Show loading indicator

        const response = await fetch(`http://localhost:5000/listings/${listingId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                // No Content-Type needed for DELETE with no body usually
            }
        });

        // Hide loading indicator

        if (response.ok) {
            // Try parsing JSON, but handle cases where backend might send empty response on success
            let data = {};
            try {
                data = await response.json();
            } catch (e) {
                 console.log(" M Delete successful, no JSON body returned (status 200 or 204).")
            }

            alert(data.message || "✅ Listing deleted successfully!");
            if (cardElement) {
                cardElement.remove(); // Remove the card from the UI
            } else {
                fetchCustomerListings(); // Fallback: Refresh all listings if card element wasn't passed
            }
        } else {
             let errorData = {};
             try {
                 errorData = await response.json();
             } catch(e) {
                 // Handle cases where error response isn't JSON
                 errorData.error = `Server error (Status: ${response.status})`
             }
            console.error("❌ Delete failed:", errorData.error || response.statusText);
            alert(`❌ Error deleting listing: ${errorData.error || 'Please try again.'}`);
        }
    } catch (error) {
         // Hide loading indicator
        console.error("❌ Delete request network/fetch error:", error);
        alert("Network error during delete. Please check connection and try again.");
    }
}

// ============================
// Fetch & Display Listings
// ============================

// Function to Fetch Customer-Specific Listings
async function fetchCustomerListings() {
    const username = localStorage.getItem("username"); // Assuming username is stored
    const accessToken = localStorage.getItem("access_token");

    if (!username) {
        console.warn("Username not found in localStorage. Cannot fetch listings.");
        // listingsContainer.innerHTML = "<p>Please log in to see your listings.</p>";
        // Maybe redirect to login?
        return;
    }
     if (!accessToken) {
        console.warn("Access token not found. Cannot fetch listings.");
        listingsContainer.innerHTML = "<p>Authentication error. Please log in again.</p>";
        // Maybe redirect to login?
        return;
    }

    console.log(` M Fetching listings for user: ${username}`);
     if (!listingsContainer) {
         console.error("Listings container not found. Cannot display listings.");
         return;
     }
     listingsContainer.innerHTML = "<p>Loading your listings...</p>"; // Loading indicator


    try {
        const response = await fetch(`http://localhost:5000/listings/customer/${username}`, {
            method: 'GET', // Explicitly state method
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json' // Indicate expected response type
            }
        });

        if (!response.ok) {
            // Handle specific errors like 401 Unauthorized, 403 Forbidden, etc.
             if (response.status === 401 || response.status === 403) {
                 console.error("Authentication/Authorization error fetching listings.");
                 listingsContainer.innerHTML = "<p>Could not authenticate. Please log in again.</p>";
                 // Optional: Clear token, redirect to login
                 // localStorage.removeItem("access_token");
                 // localStorage.removeItem("username");
                 // window.location.href = '/MainLogin.html';
             } else {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
             }
             return; // Stop execution if not OK
        }

        const listings = await response.json();
        console.log(" M Received listings:", listings);
        displayListings(listings);

    } catch (error) {
        console.error("❌ Failed to fetch listings:", error);
        listingsContainer.innerHTML = `<p>Error loading listings: ${error.message}. Please try refreshing.</p>`;
    }
}

// Function to Render Listings into the DOM
function displayListings(listings) {
     if (!listingsContainer) {
         console.error("Listings container not found when trying to display.");
         return;
     }
    listingsContainer.innerHTML = ""; // Clear previous listings or loading message

    if (!Array.isArray(listings)) {
        console.error("Received non-array data for listings:", listings);
        listingsContainer.innerHTML = "<p>Error: Invalid data received from server.</p>";
        return;
    }

    if (listings.length === 0) {
        listingsContainer.innerHTML = "<p>You haven't added any waste listings yet. Click 'Add Waste Listing' to start!</p>";
        return;
    }

    listings.forEach(listing => {
        const card = document.createElement("div");
        card.classList.add("listing-card");
        // Store the full listing object data directly on the element for easy access
        card.dataset.listingData = JSON.stringify(listing);

        let imageUrl = "images/wastedefault.png"; // Default image
        if (listing.image_urls && listing.image_urls.length > 0 && listing.image_urls[0]) {
             // Basic check to ensure the first URL is somewhat valid (starts with http)
             if (listing.image_urls[0].startsWith('http')) {
                imageUrl = listing.image_urls[0];
             } else {
                 console.warn(`Listing ${listing._id} has invalid first image URL: ${listing.image_urls[0]}`);
             }
        }

        // Sanitize potential HTML in user-generated content if needed (using a library or manual escaping)
        const safeDesc = listing.description ? listing.description.replace(/</g, "<").replace(/>/g, ">") : 'No description';
        const safeWasteType = listing.waste_type ? listing.waste_type.replace(/</g, "<").replace(/>/g, ">") : 'N/A';
        const safeCondition = listing.condition ? listing.condition.replace(/</g, "<").replace(/>/g, ">") : 'N/A';
        const safeLocation = listing.location_name ? listing.location_name.replace(/</g, "<").replace(/>/g, ">") : 'N/A';
        const safeClaimedBy = listing.claimed_by ? listing.claimed_by.replace(/</g, "<").replace(/>/g, ">") : 'Unknown';


        card.innerHTML = `
            <div class="card-content">
                <img src="${imageUrl}" alt="${safeWasteType} Image" class="listing-image" onerror="this.onerror=null; this.src='images/wastedefault.png';">
                <div class="listing-details">
                    <h3>${safeWasteType}</h3>
                    <p>${safeDesc}</p>
                    <p><strong>Condition:</strong> ${safeCondition}</p>
                    <p><strong>Location:</strong> ${safeLocation}</p>
                    <p><strong>Status:</strong> <span class="status-${listing.status || 'unknown'}">${listing.status || 'Unknown'}</span></p>
                    ${listing.status === 'claimed' ? `<p class="claimed-text">Claimed by: ${safeClaimedBy}</p>` : ''}
                    ${listing.status !== 'claimed' ? `
                    <div class="card-actions">
                       <button class="edit-btn">Edit</button>
                       <button class="delete-btn">Delete</button>
                    </div>
                    ` : '<div class="card-actions"></div>' /* Placeholder or empty div */}
                </div>
            </div>
        `;

        listingsContainer.appendChild(card);

        // Attach Event Listeners using the data stored on the card
        const editBtn = card.querySelector(".edit-btn");
        if (editBtn) {
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent triggering other listeners if needed
                 // Retrieve the stored data string and parse it
                const listingDataString = e.target.closest('.listing-card').dataset.listingData;
                try {
                    const listingData = JSON.parse(listingDataString);
                    editListing(listingData); // Pass the full object
                } catch (parseError) {
                    console.error("Error parsing listing data from card:", parseError);
                    alert("Error loading listing details for editing.");
                }
            });
        }

        const deleteBtn = card.querySelector(".delete-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const listingId = listing._id; // Get ID from the loop variable
                const cardElement = e.target.closest('.listing-card'); // Get the card element itself
                deleteListing(listingId, cardElement);
            });
        }
    });
}

// ============================
// Helper Functions
// ============================
function handleGeolocationError(error, inputElement) {
     let errorMessage = "Failed to get location. Please enter manually or try again.";
     switch (error.code) {
         case error.PERMISSION_DENIED: errorMessage = "Location access denied. Please allow access in browser settings."; break;
         case error.POSITION_UNAVAILABLE: errorMessage = "Location information is unavailable. Try again later."; break;
         case error.TIMEOUT: errorMessage = "Getting location timed out. Please try again."; break;
         case error.UNKNOWN_ERROR: errorMessage = "An unknown error occurred while getting location."; break;
     }
     alert(errorMessage);
     if (inputElement) inputElement.focus(); // Focus the manual input field
 }


// ============================
// Initial Load
// ============================
document.addEventListener("DOMContentLoaded", () => {
    console.log(" M DOM fully loaded and parsed.");
    // Check login status (basic check)
    const token = localStorage.getItem("access_token");
    if (token) {
        console.log(" M User appears logged in. Fetching listings...");
        fetchCustomerListings();
    } else {
        console.log(" M User not logged in. No listings will be fetched.");
        if (listingsContainer) {
            listingsContainer.innerHTML = "<p>Please log in to manage your waste listings.</p>";
        }
         // Optional: Redirect to login page if not logged in
         // window.location.href = '/MainLogin.html';
    }
});