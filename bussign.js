document.getElementById("businessSignUpForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirm_password");
    const phoneInput = document.getElementById("business_phone");
    const emailInput = document.getElementById("business_email");
    const businessNameInput = document.getElementById("business_name");
    const registrationNumberInput = document.getElementById("registration_number");
    const gstNumberInput = document.getElementById("gst_number");
    const businessAddressInput = document.getElementById("business_address");
    const rawMaterialInput = document.getElementById("raw_material");
    const repNameInput = document.getElementById("rep_name");
    const repRoleInput = document.getElementById("rep_role");
    const repPhoneInput = document.getElementById("rep_phone");

    if (passwordInput.value.trim() !== confirmPasswordInput.value.trim()) {
        alert("Passwords do not match.");
        return;
    }

    const businessData = {
        type: "business",
        username: usernameInput.value.trim(),
        password: passwordInput.value.trim(),
        confirm_password: confirmPasswordInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        business_name: businessNameInput.value.trim(),
        registration_number: registrationNumberInput.value.trim(),
        gst_number: gstNumberInput.value.trim(),
        business_address: businessAddressInput.value.trim(),
        raw_material: rawMaterialInput.value.trim(),
        rep_name: repNameInput.value.trim(),
        rep_role: repRoleInput.value.trim(),
        rep_phone: repPhoneInput.value.trim()
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
            window.location.href = "MainLogin.html";
        } else {
            console.error("Signup failed:", data.error);
            alert("Signup failed: " + data.error);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while signing up.");
    }
});
