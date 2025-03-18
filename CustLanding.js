document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("signupForm").addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData();
        const fileInput = document.getElementById("photo");
        const file = fileInput.files[0];
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm_password").value;
        const aadhaar = document.getElementById("aadhaar").value;
        const phone = document.getElementById("phone").value;
        const vehicleInput = document.querySelector('input[name="vehicle"]:checked');

        if (!file || !username) {
            alert("Username and photo are required!");
            return;
        }
        if (password.length < 6) {
            alert("Password must be at least 6 characters!");
            return;
        }
        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }
        if (!isValidAadhaar(aadhaar)) {
            alert("Invalid Aadhaar number! Please enter a valid 12-digit Aadhaar number.");
            return;
        }
        if (!/^[6-9]\d{9}$/.test(phone)) {
            alert("Enter a valid 10-digit phone number starting with 6-9!");
            return;
        }
        if (!vehicleInput) {
            alert("Please select whether you have a vehicle!");
            return;
        }

        formData.append("photo", file);
        formData.append("username", username);

        try {
            const uploadResponse = await fetch("http://localhost:5000/upload-photo", {
                method: "POST",
                body: formData,
            });
            const uploadResult = await uploadResponse.json();
            if (!uploadResponse.ok || uploadResult.error) {
                alert("Image upload failed: " + (uploadResult.error || "Unknown error"));
                return;
            }

            const userData = {
                type:"scrap_collector",
                username,
                fullname: document.getElementById("fullname").value,
                address: document.getElementById("address").value,
                city: document.getElementById("city").value,
                pincode: document.getElementById("pincode").value,
                scrap_type: document.getElementById("scrap_type").value,
                vehicle: vehicleInput.value,
                password,
                confirm_password: confirmPassword,
                aadhaar,
                phone,
                image_url: uploadResult.image_url,
            };

            const signupResponse = await fetch("http://localhost:5000/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData),
            });

            const signupResult = await signupResponse.json();
            if (!signupResponse.ok || signupResult.error) {
                alert("Signup Failed: " + (signupResult.error || "Unknown error"));
            } else {
                alert("Signup Successful!");
                window.location.href = "MainLogin.html";
            }
        } catch (error) {
            console.error(error);
            alert(`Something went wrong: ${error.message}`);
        }
    });
});

// Aadhaar Validation using Verhoeff Algorithm
function isValidAadhaar(aadhaar) {
    if (!/^\d{12}$/.test(aadhaar)) {
        return false; // Aadhaar must be exactly 12 digits
    }
    return validateVerhoeff(aadhaar);
}

// Verhoeff Algorithm for Aadhaar Validation
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

function validateVerhoeff(num) {
    let c = 0;
    const numArr = num.split("").reverse().map(Number);
    for (let i = 0; i < numArr.length; i++) {
        c = verhoeffTableD[c][verhoeffTableP[i % 8][numArr[i]]];
    }
    return c === 0;
}
