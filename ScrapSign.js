document.getElementById("signupForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const fullname = document.getElementById("fullname").value.trim();
    const address = document.getElementById("address").value.trim();
    const city = document.getElementById("city").value.trim();
    const pincode = document.getElementById("pincode").value.trim();
    const scrapType = document.getElementById("scrap_type").value;
    const vehicle = document.querySelector('input[name="vehicle"]:checked')?.value;
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirm_password").value.trim();
    const aadhaar = document.getElementById("aadhaar").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    const userData = {
        type: "scrap_collector",  // Added type field
        fullname,
        address,
        city,
        pincode,
        scrap_type: scrapType,
        vehicle,
        username,
        password,
        confirm_password: confirmPassword,
        aadhaar,
        phone
    };

    try {
        const response = await fetch("http://localhost:5000/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            alert("Signup successful! Redirecting...");
            window.location.href = "MainLogin.html";
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Something went wrong. Please try again.");
    }
});
