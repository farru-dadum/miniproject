document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("loginForm");
    const registrationMessage = document.getElementById("registrationMessage");

    form.addEventListener("submit", async function (event) {
        event.preventDefault(); // Prevent default form submission

        let isValid = true;

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        const confirmPassword = document.getElementById("confirm_password").value.trim();
        const aadhaar = document.getElementById("aadhaar").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const email = document.getElementById("email").value.trim();
        const address = document.getElementById("address").value.trim();

        // Validation logic
        if (username === "") {
            document.getElementById("usernameError").style.display = "block";
            isValid = false;
        } else {
            document.getElementById("usernameError").style.display = "none";
        }

        if (password.length < 6) {
            document.getElementById("passwordError").style.display = "block";
            isValid = false;
        } else {
            document.getElementById("passwordError").style.display = "none";
        }

        if (confirmPassword !== password) {
            document.getElementById("confirmPasswordError").style.display = "block";
            isValid = false;
        } else {
            document.getElementById("confirmPasswordError").style.display = "none";
        }

        if (!/^\d{12}$/.test(aadhaar)) {
            document.getElementById("aadhaarError").style.display = "block";
            isValid = false;
        } else {
            document.getElementById("aadhaarError").style.display = "none";
        }

        if (!/^[6-9]\d{9}$/.test(phone)) {
            document.getElementById("phoneError").style.display = "block";
            isValid = false;
        } else {
            document.getElementById("phoneError").style.display = "none";
        }

        // ✅ Accept all emails, but identify student & .edu emails
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // General email validation
        const studentEmailRegex = /^[a-zA-Z0-9._%+-]+@student\.[a-zA-Z0-9.-]+$/; // Student domain
        const eduEmailRegex = /^[a-zA-Z0-9._%+-]+@.+\.edu(\.[a-zA-Z]+)*$/; // Any .edu email (e.g., rajagiri.edu.in)

        if (!emailRegex.test(email)) {
            document.getElementById("emailError").textContent = "Enter a valid email address.";
            document.getElementById("emailError").style.display = "block";
            isValid = false;
        } else {
            document.getElementById("emailError").style.display = "none";
        }

        // ✅ Check if it's an educational email
        let isEduEmail = eduEmailRegex.test(email) || studentEmailRegex.test(email);
        if (isEduEmail) {
            console.log("🎓 Student / EDU email detected:", email);
        }

        if (address === "") {
            document.getElementById("addressError").style.display = "block";
            isValid = false;
        } else {
            document.getElementById("addressError").style.display = "none";
        }

        if (isValid) {
            try {
                const response = await fetch("http://localhost:5000/create-user", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ 
                        username: username, 
                        email: email,
                        isEduEmail: isEduEmail // ✅ Sending EDU status to the backend
                    }),
                });

                if (response.ok) {
                    console.log("✅ User registration successful!");
                    form.reset();
                    registrationMessage.style.display = "block"; // Show success message
                    setTimeout(() => {
                        registrationMessage.style.display = "none";
                    }, 3000); // Hide message after 3 seconds
                } else {
                    console.error("❌ User registration failed:", response.statusText);
                    alert("Registration failed. Please try again."); // Simple alert
                }
            } catch (error) {
                console.error("❌ Error during registration:", error);
                alert("Registration failed. Please check your internet connection."); // Alert for network errors
            }
        }
    });
});
