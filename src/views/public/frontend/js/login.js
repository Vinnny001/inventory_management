document.getElementById("login-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");

    const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        redirect: "follow"  // let fetch follow redirects
    });

    if (response.redirected) {
        window.location.href = response.url; // go to dashboard
    } else if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        errorMessage.textContent = result.message || "Invalid username or password";
    }
});
