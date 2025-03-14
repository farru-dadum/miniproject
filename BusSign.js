document.getElementById("businessSignUpForm").addEventListener("submit", async function (event) {
    event.preventDefault(); // Stop default form submission

    const businessData = {
        type: "business",
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value.trim(),
        confirm_password: document.getElementById("confirm_password").value.trim(),
        phone: document.getElementById("business_phone").value.trim(),
        email: document.getElementById("business_email").value.trim(),
        business_name: document.getElementById("business_name").value.trim(),
        registration_number: document.getElementById("registration_number").value.trim(),
        gst_number: document.getElementById("gst_number").value.trim(),
        business_address: document.getElementById("business_address").value.trim(),
        business_type: document.getElementById("business_type").value.trim(),
        raw_material: document.getElementById("raw_material").value.trim(),
        rep_name: document.getElementById("rep_name").value.trim(),
        rep_role: document.getElementById("rep_role").value.trim(),
        rep_phone: document.getElementById("rep_phone").value.trim()
    };

    try {
        const response = await fetch("http://localhost:5000/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(businessData)
        });

        const data = await response.json();
        
        if (response.ok) {
            alert("Signup Successful! Redirecting...");
            window.location.href = "MainLogin.html"; // Redirect to login page
        } else {
            console.error("Signup failed:", data.error);
            alert("Signup failed: " + data.error);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while signing up.");
    }
});
