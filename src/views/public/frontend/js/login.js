document.getElementById("login-form").addEventListener("submit", async function(event) {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    
    const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        localStorage.setItem("authToken", result.token);
        window.location.href = "/dashboard.html";
    } else {
        errorMessage.textContent = result.error || "Invalid username or password";
    }
});
