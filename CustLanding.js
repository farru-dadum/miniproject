const modal = document.getElementById("addModal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.getElementById("closeModal");
const getLocationBtn = document.getElementById("getLocation");
const wasteForm = document.getElementById("wasteForm");
const locationNameInput = document.getElementById("locationName");
const mapDiv = document.getElementById("map");
const listingsContainer = document.querySelector(".listings-container"); // Get the container

openModalBtn.addEventListener("click", () => modal.style.display = "flex");
closeModalBtn.addEventListener("click", () => modal.style.display = "none");

window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
});

// ✅ Initialize Leaflet Map (with default location)
const defaultLat = 28.7041;
const defaultLng = 77.1025;
const map = L.map("map").setView([defaultLat, defaultLng], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
}).addTo(map);

// ✅ Add Draggable Marker (with default location)
const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);

// ✅ Function to Update Form and Map with Coordinates
function updateLocation(latitude, longitude) {
    locationNameInput.value = `Latitude: ${latitude.toFixed(6)}, Longitude: ${longitude.toFixed(6)}`;
    wasteForm.dataset.lat = latitude.toFixed(6);
    wasteForm.dataset.lng = longitude.toFixed(6);
    map.setView([latitude, longitude], 15);
    marker.setLatLng([latitude, longitude]);
    map.invalidateSize(); // ✅ Fix for slow loading issues
}

// ✅ Update Latitude & Longitude on Marker Drag
marker.on("dragend", () => {
    const { lat, lng } = marker.getLatLng();
    updateLocation(lat, lng);
});

// ✅ "Use My Location" Button
getLocationBtn.addEventListener("click", () => {
    if (navigator.geolocation) {
        mapDiv.style.display = "block"; // Ensure map remains visible
        const options = {
            enableHighAccuracy: true,
            timeout: 10000, // Increase timeout to 10s
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                updateLocation(latitude, longitude);
            },
            error => {
                console.error("Geolocation error:", error);
                let errorMessage = "Failed to get your location. Please try again or enter it manually.";

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Location access denied. Please allow location access.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location unavailable. Try again later.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Timeout getting location. Try again.";
                        break;
                    case error.UNKNOWN_ERROR:
                        errorMessage = "An unknown error occurred.";
                        break;
                }
                alert(errorMessage);
                locationNameInput.focus();
            },
            options
        );
    } else {
        alert("Geolocation is not supported by this browser.");
        locationNameInput.focus();
    }
});

// ✅ Form Submission for Waste Listing
wasteForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData();
    //formData.append("username", localStorage.getItem("username"));  // Don't send username; it comes from Auth0
    formData.append("waste_type", document.getElementById("wasteType").value);
    formData.append("description", document.getElementById("description").value);
    formData.append("condition", document.getElementById("condition").value);
    formData.append("location_name", document.getElementById("locationName").value);

    // ✅ Get Latitude & Longitude from Form Dataset
    formData.append("latitude", wasteForm.dataset.lat);
    formData.append("longitude", wasteForm.dataset.lng);

    // ✅ Append Images
    const files = document.getElementById("wasteImages").files;
    for (const file of files) {
        formData.append("images", file);
    }

    try {
        const accessToken = localStorage.getItem("access_token"); // Get JWT token

        const response = await fetch("http://localhost:5000/listings", {
            method: "POST",
            body: formData,
            headers: {
              'Authorization': `Bearer ${accessToken}`  // Send the token
            }
        });

        const data = await response.json();
        if (response.ok) {
            alert("✅ Waste listing added successfully!");
            modal.style.display = "none";
            fetchCustomerListings(); // Reload listings after submission
        } else {
            alert("❌ Error: " + data.error);
        }
    } catch (error) {
        console.error("❌ Error:", error);
        alert("Server error, please try again!");
    }
});

// ✅ Function to Edit a Listing
async function editListing(listingId, card) {
    const newWasteType = prompt("Enter new Waste Type:", card.querySelector("h3").innerText);
    const newDescription = prompt("Enter new Description:", card.querySelector("p").innerText);
    const newCondition = prompt("Enter new Condition:", card.querySelectorAll("p")[1].innerText.split(": ")[1]);
    const newLocation = prompt("Enter new Location:", card.querySelectorAll("p")[2].innerText.split(": ")[1]);

    if (newWasteType && newDescription && newCondition && newLocation) {
        try {
            const accessToken = localStorage.getItem("access_token");
            const response = await fetch(`http://localhost:5000/listings/${listingId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    waste_type: newWasteType,
                    description: newDescription,
                    condition: newCondition,
                    location_name: newLocation
                })
            });

            if (!response.ok) throw new Error("Failed to update listing");

            alert("✅ Listing updated successfully!");
            card.querySelector("h3").innerText = newWasteType;
            card.querySelector("p").innerText = newDescription;
            card.querySelectorAll("p")[1].innerText = `Condition: ${newCondition}`;
            card.querySelectorAll("p")[2].innerText = `Location: ${newLocation}`;
        } catch (error) {
            console.error("Error updating listing:", error);
            alert("❌ Update failed!");
        }
    }
}

// ✅ Function to Delete a Listing
// ✅ Improved Delete Function
async function deleteListing(listingId, card) {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) {
            alert("You are not logged in. Please log in first.");
            return;
        }

        const response = await fetch(`http://localhost:5000/listings/${listingId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (response.ok) {
            alert("✅ Listing deleted successfully!");
            card.remove(); // Remove the card from the UI
        } else {
            alert(`❌ Error: ${data.error || "Failed to delete listing."}`);
        }
    } catch (error) {
        console.error("Error deleting listing:", error);
        alert("❌ Delete failed! Please try again.");
    }
}

// ✅ Function to Fetch and Display Customer Listings
async function fetchCustomerListings() {
    const username = localStorage.getItem("username");
    if (!username) {
        alert("User not logged in.");
        return;
    }

    try {
        const accessToken = localStorage.getItem("access_token");
        const response = await fetch(`http://localhost:5000/listings/customer/${username}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const listings = await response.json();
        displayListings(listings);
    } catch (error) {
        console.error("Failed to fetch listings:", error);
        alert("Failed to load listings.");
    }
}


// ✅ Function to Render Listings Using Card Component
function displayListings(listings) {
    listingsContainer.innerHTML = "";

    if (listings.length === 0) {
        listingsContainer.innerHTML = "<p>No listings found.</p>";
        return;
    }

    listings.forEach(listing => {
        const card = document.createElement("div");
        card.classList.add("listing-card");

        let imageUrl = "images/wastedefault.png";
        if (listing.image_urls && listing.image_urls.length > 0) {
            imageUrl = listing.image_urls[0];
        }

        card.innerHTML = `
            <div class="card-content">
                <img src="${imageUrl}" alt="Waste Image" class="listing-image">
                <div class="listing-details">
                    <h3>${listing.waste_type}</h3>
                    <p>${listing.description}</p>
                    <p><strong>Condition:</strong> ${listing.condition}</p>
                    <p><strong>Location:</strong> ${listing.location_name}</p>
                    ${listing.status === 'claimed' ? `<p class="claimed-text">Claimed by: ${listing.claimed_by}</p>` : ''}
                    ${listing.status === 'deleted' ? `<p class="deleted-text">Deleted</p>` : ''}
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </div>
            </div>
        `;

        listingsContainer.appendChild(card);

        // ✅ Attach Event Listeners to Edit & Delete Buttons
        card.querySelector(".edit-btn").addEventListener("click", () => editListing(listing._id, card));
        card.querySelector(".delete-btn").addEventListener("click", () => deleteListing(listing._id, card));
    });
}

// ✅ Load listings when the page loads
document.addEventListener("DOMContentLoaded", fetchCustomerListings);