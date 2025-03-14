const modal = document.getElementById("addModal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.getElementById("closeModal");
const getLocationBtn = document.getElementById("getLocation");
const wasteForm = document.getElementById("wasteForm");

openModalBtn.addEventListener("click", () => modal.style.display = "flex");
closeModalBtn.addEventListener("click", () => modal.style.display = "none");

window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
});

// ✅ Initialize Leaflet Map
const map = L.map("map").setView([28.7041, 77.1025], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
}).addTo(map);

// ✅ Add Draggable Marker
const marker = L.marker([28.7041, 77.1025], { draggable: true }).addTo(map);

// ✅ Update Latitude & Longitude on Marker Drag
marker.on("dragend", () => {
    const { lat, lng } = marker.getLatLng();
    wasteForm.dataset.lat = lat.toFixed(6);
    wasteForm.dataset.lng = lng.toFixed(6);
});

// ✅ "Use My Location" Button
getLocationBtn.addEventListener("click", () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);
            marker.setLatLng([latitude, longitude]);

            // ✅ Store coordinates in form dataset (hidden)
            wasteForm.dataset.lat = latitude.toFixed(6);
            wasteForm.dataset.lng = longitude.toFixed(6);
        }, () => alert("❌ Location access denied!"));
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
