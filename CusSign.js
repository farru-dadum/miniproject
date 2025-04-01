document.getElementById("signupForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    let isValid = true;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirm_password").value.trim();
    const aadhaar = document.getElementById("aadhaar").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const address = document.getElementById("address").value.trim();

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

    if (!validateAadhaarVerhoeff(aadhaar)) {
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

    if (!isValidEmail(email)) {
        document.getElementById("emailError").style.display = "block";
        isValid = false;
    } else {
        document.getElementById("emailError").style.display = "none";
    }

    if (address === "") {
        document.getElementById("addressError").style.display = "block";
        isValid = false;
    } else {
        document.getElementById("addressError").style.display = "none";
    }

    if (!isValid) return;

    const formData = {
        type: "customer",
        username,
        password,
        confirm_password: confirmPassword,
        aadhaar,
        phone,
        email,
        address
    };

    try {
        const response = await fetch("http://localhost:5000/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        const result = await response.json();
        if (response.ok) {
            alert("User registered successfully!");
            window.location.href = "MainLogin.html"; // Redirect to login page
        } else {
            alert("❌ Registration failed: ${result.error}");
        }
    } catch (error) {
        console.error("❌ Error:", error);
        alert("❌ Something went wrong. Please try again.");
    }
});

/* ---------------------- Aadhaar Validation using Verhoeff Algorithm ---------------------- */
const verhoeffTableD = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0]
];

const verhoeffTableP = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8]
];

const verhoeffTableInv = [0,4,3,2,1,5,6,7,8,9];

function validateAadhaarVerhoeff(aadhaar) {
    if (!/^\d{12}$/.test(aadhaar)) return false; // Format check

    let c = 0;
    let reversedArray = aadhaar.split("").reverse().map(Number);

    for (let i = 0; i < reversedArray.length; i++) {
        c = verhoeffTableD[c][verhoeffTableP[i % 8][reversedArray[i]]];
    }

    return c === 0;
}

/* ---------------------- Email Domain Validation ---------------------- */
function isValidEmail(email) {
    const allowedDomains = ["gmail.com", "yahoo.com", "rajagiri.edu.in"];
    const emailParts = email.split("@");

    if (emailParts.length !== 2) {
        return false;
    }

    const domain = emailParts[1].toLowerCase();
    return allowedDomains.includes(domain);
}