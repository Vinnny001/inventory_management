const form = document.getElementById("signupForm");
const messageDiv = document.getElementById("message");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
        username: form.username.value,
        email: form.email.value,
        phone_number: form.phone_number.value,
        password: form.password.value
    };

    try {
        const res = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (res.ok) {
            messageDiv.style.color = "green";
            messageDiv.innerText = result.message;
            form.reset();
        } else {
            messageDiv.style.color = "red";
            messageDiv.innerText = result.error || result.message;
        }
    } catch (err) {
        messageDiv.style.color = "red";
        messageDiv.innerText = "Error connecting to server";
    }
});
