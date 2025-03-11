document.addEventListener("DOMContentLoaded", function () {
    const fetchScoreButton = document.getElementById("fetchScore");
    const userInput = document.getElementById("username");
    const earnedPointsElement = document.getElementById("earnedPoints");
    const rewardImageElement = document.getElementById("rewardImage");
    const rewardMessageElement = document.getElementById("rewardMessage");

    if (!fetchScoreButton || !userInput || !earnedPointsElement || !rewardImageElement || !rewardMessageElement) {
        console.error("❌ Some HTML elements are missing!");
        return;
    }

    fetchScoreButton.addEventListener("click", async function () {
        const username = userInput.value.trim();

        //reset
        rewardMessageElement.style.display = "none";
        rewardImageElement.style.display = "none";

        if (!username) {
            alert("⚠ Please enter your username.");
            return;
        }

        try {
            console.log(`🔍 Fetching rewards for: ${username}`);
            const response = await fetch(`http://localhost:5000/get-user-score/${username}`);

            if (!response.ok) {
                throw new Error(`⚠ Failed to fetch user data: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            earnedPointsElement.innerText = result.score || 0;

            if (result.message) {
                rewardMessageElement.innerText = result.message;
                rewardMessageElement.style.display = "block";
            } else if (result.couponImage) {
                rewardImageElement.src = result.couponImage;
                rewardImageElement.style.display = "block";
            } else {
                rewardImageElement.style.display = "none";
            }

            console.log("✅ Rewards fetched successfully!", result);

        } catch (error) {
            console.error("❌ Error fetching rewards:", error);
            earnedPointsElement.innerText = "Error retrieving data.";
            rewardMessageElement.innerText = error.message;
            rewardMessageElement.style.display = "block";
        }
    });
});
