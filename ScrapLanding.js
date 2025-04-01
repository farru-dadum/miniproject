document.addEventListener("DOMContentLoaded", () => {
    // Logout button functionality
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("username");
        window.location.href = "login.html";
    });

    // Fetch and display listings
    fetchScrapListings(); // ✅ Fetch all available listings
});

// Show and hide loading overlay
function showLoading() {
    document.getElementById("loadingOverlay").style.display = "flex";
}

function hideLoading() {
    document.getElementById("loadingOverlay").style.display = "none";
}

// Display and clear error messages
function displayError(message) {
    const errorDisplay = document.getElementById("errorDisplay");
    errorDisplay.textContent = message;
    errorDisplay.style.display = "block";
}

function clearError() {
    const errorDisplay = document.getElementById("errorDisplay");
    errorDisplay.textContent = "";
    errorDisplay.style.display = "none";
}

// ✅ Fetch all available scrap listings
async function fetchScrapListings() {
    showLoading();
    try {
        const accessToken = localStorage.getItem("access_token");

        const response = await fetch(`http://localhost:5000/listings/scrap`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const listings = await response.json();
        displayListings(listings); // ✅ Display all available listings
    } catch (error) {
        console.error("❌ Failed to fetch listings:", error);
        alert("Failed to load listings.");
    } finally {
        hideLoading();
    }
}

// ✅ Create listing card (with Claim button)
function createListingCard(listing) {
    const card = document.createElement("div");
    card.classList.add("listing-card");

    let imageElement = listing.image_urls && listing.image_urls.length > 0
        ? `<img src="${listing.image_urls[0]}" alt="Waste Image" class="listing-image">`
        : ""; // No image if empty

    card.innerHTML = `
        <div class="card-content">
            ${imageElement}
            <div class="listing-details">
                <h3>${listing.waste_type}</h3>
                <p>${listing.description}</p>
                <p><strong>Condition:</strong> ${listing.condition}</p>
                <p><strong>Location:</strong> ${listing.location_name}</p>
                <p><strong>Posted by:</strong> ${listing.username || "Unknown"}</p> <!-- ✅ Handle null username -->
                <button class="claim-btn" data-listing-id="${listing._id}">Claim</button> <!-- Claim Button -->
            </div>
        </div>
    `;

    // Add event listener to handle the claim action
    const claimButton = card.querySelector(".claim-btn");
    claimButton.addEventListener("click", () => handleClaimClick(listing._id, listing.username));

    return card;
}

// ✅ Function to display listings on the page
function displayListings(listings) {
    const listingsContainer = document.getElementById("listingsContainer"); // Make sure you have an element with id="listingsContainer"

    // Clear the existing listings
    listingsContainer.innerHTML = "";

    // Loop through listings and create cards
    listings.forEach(listing => {
        const card = createListingCard(listing);
        listingsContainer.appendChild(card); // Append each card to the listings container
    });
}

// ✅ Handle the claim button click (dynamically fetching username from localStorage)
const handleClaimClick = async (listingId, username) => { 
    // Fetch the logged-in username dynamically from localStorage
    if (!username) {
        alert("You must be logged in to claim a listing.");
        return;
    }

    const claimDetails = {
        claimed_by:  localStorage.getItem("username"),  // Dynamically set the user who is claiming
        status: "claimed",     // The new status for the listing
    };

    try {
        // Make PATCH request to backend (only MongoDB update)
        const response = await fetch(`http://localhost:5000/listings/claim/${listingId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(claimDetails), // Send the claim details (only MongoDB update)
        });

        const result = await response.json();

        if (response.ok) {
            console.log("Claim successful:", result);
          

            // After successful claim, update the user's score in Supabase
            await updateUserScore(username);
            window.location.reload();
        } else {
            console.error("Failed to claim:", result.error);
        }
    } catch (error) {
        console.error("Error while claiming:", error);
    }
};

// Function to update the user's score in Supabase
async function updateUserScore(username) {
    try {
        const response = await fetch(`http://localhost:5000/update-score`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username }) // Pass the username to identify the user
        });

        const result = await response.json();

        if (response.ok) {
            console.log("Score updated successfully:", result);
        } else {
            console.error("Failed to update score:", result.error);
        }
    } catch (error) {
        console.error("Error while updating score:", error);
    }
}
