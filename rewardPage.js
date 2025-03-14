document.getElementById("fetchScore").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    if (!username) {
        alert("Please enter a username!");
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/get-user-score/${username}`);
        
        if (!response.ok) {
            throw new Error(`⚠ Failed to fetch user data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ Reward Data:", data);

        // ✅ Update UI with Earned Points
        document.getElementById("earnedPoints").textContent = data.score;

        const rewardImage = document.getElementById("rewardImage");
        const rewardMessage = document.getElementById("rewardMessage");

        // ✅ Check if the coupon is already redeemed
        if (data.message && data.message.includes("Coupon already redeemed")) {
            rewardMessage.textContent = "🎟 Coupon already redeemed!";
            rewardMessage.style.color = "red";
            rewardImage.style.display = "none"; // Hide the image
        } else if (data.couponImage) {
            rewardMessage.textContent = ""; // Clear any previous message
            rewardImage.src = data.couponImage;
            rewardImage.style.display = "block";
        } else {
            rewardMessage.textContent = "No rewards available.";
            rewardMessage.style.color = "gray";
            rewardImage.style.display = "none";
        }

    } catch (error) {
        console.error("❌ Error fetching rewards:", error);
        alert("Error fetching rewards. Please try again later.");
    }
});
