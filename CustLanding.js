// Get modal elements
const modal = document.getElementById("addModal");
const openModalBtn = document.getElementById("openModal");
const closeModalBtn = document.getElementById("closeModal");

// Open modal when the "Add" button is clicked
openModalBtn.addEventListener("click", () => {
    modal.style.display = "flex";
});

// Close modal when the close button is clicked
closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

// Close modal when clicking outside the modal content
window.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.style.display = "none";
    }
});

// Handle Geolocation
const getLocationBtn = document.getElementById("getLocation");
const geoOutput = document.getElementById("geoOutput");

getLocationBtn.addEventListener("click", () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                geoOutput.textContent = `Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`;
            },
            (error) => {
                geoOutput.textContent = "Geolocation permission denied or unavailable.";
            }
        );
    } else {
        geoOutput.textContent = "Geolocation is not supported by this browser.";
    }
});
