document.addEventListener("DOMContentLoaded", () => {
    // Add event listener for logout button
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("username");
        window.location.href = "login.html"; // Redirect to your login page
    });

    fetchBusinessListings();
    document.getElementById("searchBar").addEventListener("input", filterListings);
});

let allListings = [];

// Helper function to show loading overlay
function showLoading() {
    document.getElementById("loadingOverlay").style.display = "flex";
}

// Helper function to hide loading overlay
function hideLoading() {
    document.getElementById("loadingOverlay").style.display = "none";
}

// Helper function to display error messages
function displayError(message) {
    const errorDisplay = document.getElementById("errorDisplay");
    errorDisplay.textContent = message;
    errorDisplay.style.display = "block"; // Make sure it's visible
}

// Helper function to clear error messages
function clearError() {
    const errorDisplay = document.getElementById("errorDisplay");
    errorDisplay.textContent = "";
    errorDisplay.style.display = "none"; // Hide it
}

async function fetchBusinessListings() {
    const username = localStorage.getItem("username");
    if (!username) {
        // Consider redirecting to login here.
        alert("User not logged in. Redirecting to login page.");
        window.location.href = "login.html";  // Redirect to login
        return;
    }
    showLoading(); // Show loading overlay
    clearError(); // Clear any previous errors

    try {
        const accessToken = localStorage.getItem("access_token");
        const userResponse = await fetch(`http://localhost:5000/users/${username}`, { // Replace with your actual API endpoint
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!userResponse.ok) {
            console.error(`Failed to fetch user data: ${userResponse.status} - ${userResponse.statusText}`);
            throw new Error(`Failed to fetch user data.  Status: ${userResponse.status}`); // Detailed error
        }

        let userData;
        try {
            userData = await userResponse.json();
        } catch (jsonError) {
            console.error("Error parsing user data JSON:", jsonError);
            throw new Error("Error parsing user data.");
        }

        if (userData.user_type !== "business" || !userData.raw_materials) {
            alert("Invalid business profile or missing raw materials preference.");
            return;
        }

        const rawMaterials = userData.raw_materials;
        const response = await fetch(`http://localhost:5000/listings/filter?waste_types=${rawMaterials.join(",")}`, { // Replace with your actual API endpoint
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            console.error(`Failed to fetch listings: ${response.status} - ${response.statusText}`);
            throw new Error(`Failed to fetch listings. Status: ${response.status}`);
        }

        let fetchedListings;
        try {
            fetchedListings = await response.json();
        } catch (jsonError) {
            console.error("Error parsing listings JSON:", jsonError);
            throw new Error("Error parsing listings data.");
        }
        allListings = fetchedListings;
        displayListings(allListings, username);

    } catch (error) {
        console.error("Failed to fetch business listings:", error);
        displayError(`Failed to load listings: ${error.message}`); // More descriptive error
    } finally {
        hideLoading(); // Hide loading overlay regardless of success or failure
    }
}

function createListingCard(listing, businessUsername) {
    const card = document.createElement("div");
    card.classList.add("listing-card");

    let imageElement = ''; // Initialize an empty string for the image element

    if (listing.image_urls && listing.image_urls.length > 0) {
        // If there are image URLs, create an image tag
        imageElement = `<img src="${listing.image_urls[0]}" alt="Waste Image" class="listing-image">`;
    } else {
        //If you want to add a default image when no images are available, uncomment below and add path to default image.
        //imageElement = `<img src="images/wastedefault.png" alt="Default Waste Image" class="listing-image">`;
        imageElement = ''; //No image if no listing images found.
    }

    const isClaimedByCurrentUser = listing.claimed_by === businessUsername;

    card.innerHTML = `
        <div class="card-content">
            ${imageElement}
            <div class="listing-details">
                <h3>${listing.waste_type}</h3>
                <p>${listing.description}</p>
                <p><strong>Condition:</strong> ${listing.condition}</p>
                <p><strong>Location:</strong> ${listing.location_name}</p>
                <p><strong>Posted by:</strong> ${listing.created_by}</p>
                ${listing.status === 'claimed' ?
                    `<p class="claimed-text">
                         Claimed by: ${listing.claimed_by}
                         ${isClaimedByCurrentUser ? ' (You)' : ''}
                     </p>` :
                    `<button class="claim-btn" data-id="${listing.id}">Claim</button>`}
            </div>
        </div>
    `;

    if (listing.status !== 'claimed') { // Only add listener if not claimed.
        const claimButton = card.querySelector(".claim-btn");
        if (claimButton) {
            claimButton.addEventListener("click", async (event) => {
                const listingId = event.target.dataset.id;
                await claimListing(listingId, businessUsername);
            });
        }
    }
    return card;
}

function displayListings(listings, businessUsername) {
    const listingsContainer = document.getElementById("listingsContainer");
    listingsContainer.innerHTML = "";

    if (listings.length === 0) {
        listingsContainer.innerHTML = "<p>No relevant waste listings found.</p>";
        return;
    }

    listings.forEach(listing => {
        const card = createListingCard(listing, businessUsername);
        listingsContainer.appendChild(card);
    });

}

function filterListings() {
    // Sanitize input (example)
    let searchQuery = document.getElementById("searchBar").value;
    searchQuery = searchQuery.replace(/[^a-zA-Z0-9\s]/g, ""); // Remove special characters for example
    searchQuery = searchQuery.toLowerCase();

    const filteredListings = allListings.filter(listing => {
        // If the search query is empty, show all listings
        if (!searchQuery) {
            return true; // Show this listing
        }
        // Otherwise, filter based on waste_type or description
        return (
            listing.waste_type.toLowerCase().includes(searchQuery) ||
            listing.description.toLowerCase().includes(searchQuery)
        );
    });

    displayListings(filteredListings, localStorage.getItem("username"));
}

async function claimListing(listingId, businessUsername) {
    showLoading();
    clearError();
    try {
        const accessToken = localStorage.getItem("access_token");
        const response = await fetch(`http://localhost:5000/listings/claim/${listingId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                status: "claimed",
                claimed_by: businessUsername
            })
        });

        if (!response.ok) {
            console.error(`Failed to claim listing: ${response.status} - ${response.statusText}`);
            throw new Error("Failed to claim listing.");
        }

        alert("Listing successfully claimed!");
        fetchBusinessListings();
    } catch (error) {
        console.error("Error claiming listing:", error);
        displayError(`Error claiming listing: ${error.message}`);
    } finally {
        hideLoading();
    }
}