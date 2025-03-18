const modal = document.getElementById("addModal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.getElementById("closeModal");
const getLocationBtn = document.getElementById("getLocation");
const wasteForm = document.getElementById("wasteForm");
const locationNameInput = document.getElementById("locationName"); // Get the location input
const mapDiv = document.getElementById("map");

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
    formData.append("username", localStorage.getItem("username"));
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
        const response = await fetch("http://localhost:5000/listings", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            alert("✅ Waste listing added successfully!");
            modal.style.display = "none";
        } else {
            alert("❌ Error: " + data.error);
        }
    } catch (error) {
        console.error("❌ Error:", error);
        alert("Server error, please try again!");
    }
});
