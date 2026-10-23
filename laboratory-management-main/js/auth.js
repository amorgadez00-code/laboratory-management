document.addEventListener("DOMContentLoaded", async () => {
    // Check if user is already logged in
    const cachedUser = getCurrentUser();
    if (cachedUser) {
        window.location.href = "index.html";
        return;
    }

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (signupForm) {
        signupForm.addEventListener("submit", handleSignup);
    }
});

function getCurrentUser() {
    try {
        const raw = sessionStorage.getItem("lab_user") || localStorage.getItem("lab_user");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

async function handleLogin(event) {
    if (event) event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const messageEl = document.getElementById("loginMessage");

    if (messageEl) {
        messageEl.className = "alert alert-info";
        messageEl.textContent = "Verifying credentials...";
        messageEl.classList.remove("hidden");
    }

    try {
        console.log("Attempting login for email:", email);

        // Authenticate against users table
        const { data: users, error } = await supabaseClient
            .from("users")
            .select("*")
            .eq("email", email)
            .limit(1);

        console.log("User lookup result:", { users, error });

        if (error) {
            console.error("Database error during login:", error);
            throw new Error("Database error: " + error.message);
        }

        if (!users || users.length === 0) {
            console.log("User not found in database");

            // Also check profiles fallback
            const { data: profiles } = await supabaseClient
                .from("profiles")
                .select("*")
                .eq("email", email)
                .limit(1);

            if (profiles && profiles.length > 0) {
                const profile = profiles[0];
                const sessionUser = {
                    id: profile.id,
                    name: profile.full_name,
                    email: profile.email,
                    role: profile.role || "requester"
                };
                sessionStorage.setItem("lab_user", JSON.stringify(sessionUser));
                localStorage.setItem("lab_user", JSON.stringify(sessionUser));
                window.location.href = "index.html";
                return;
            }

            throw new Error("User not found. Please register an account first.");
        }

        const user = users[0];
        console.log("User found:", { id: user.id, name: user.name, email: user.email, role: user.role });

        // Check password
        if (user.password !== password) {
            console.log("Password mismatch");
            console.log("Expected password:", user.password);
            console.log("Provided password:", password);
            throw new Error("Incorrect password. Please try again.");
        }

        // Save session
        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role || "requester"
        };

        sessionStorage.setItem("lab_user", JSON.stringify(sessionUser));
        localStorage.setItem("lab_user", JSON.stringify(sessionUser));

        console.log("Session saved:", sessionUser);

        // Audit sensitive action (BR-A4-10)
        try {
            await supabaseClient.from("audit_logs").insert({
                user_id: user.id,
                action: "LOGIN",
                module: "Auth",
                record_id: user.id,
                description: `User ${user.name} (${user.role}) logged in successfully.`
            });
        } catch (auditErr) {
            console.warn("Audit log notice:", auditErr);
        }

        if (messageEl) {
            messageEl.className = "alert alert-success";
            messageEl.textContent = "Login successful! Redirecting...";
        }

        window.location.href = "index.html";

    } catch (err) {
        console.error("Login error:", err);
        if (messageEl) {
            messageEl.className = "alert alert-danger";
            messageEl.textContent = err.message || "Login failed. Please check your credentials.";
            messageEl.classList.remove("hidden");
        }
    }
}

// Quick 1-click Demo Login Helper
async function quickLogin(email, password) {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    if (emailInput && passwordInput) {
        emailInput.value = email;
        passwordInput.value = password;
        await handleLogin();
    }
}

async function handleSignup(event) {
    if (event) event.preventDefault();

    const fullName = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const messageEl = document.getElementById("signupMessage");

    if (messageEl) {
        messageEl.className = "alert alert-info";
        messageEl.textContent = "Creating account...";
        messageEl.classList.remove("hidden");
    }

    try {
        // Check if user email already exists
        const { data: existing } = await supabaseClient
            .from("users")
            .select("id")
            .eq("email", email)
            .limit(1);

        if (existing && existing.length > 0) {
            throw new Error("An account with this email already exists.");
        }

        const roleSelect = document.getElementById("signupRole");
        const assignedRole = roleSelect ? roleSelect.value : "requester";

        // Insert new user with selected role
        const { data: newUser, error } = await supabaseClient
            .from("users")
            .insert({
                name: fullName,
                email: email,
                password: password,
                role: assignedRole
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Log sensitive operation
        try {
            await supabaseClient.from("audit_logs").insert({
                user_id: newUser.id,
                action: "REGISTER",
                module: "Auth",
                record_id: newUser.id,
                description: `New ${assignedRole} account created for ${fullName} (${email}).`
            });
        } catch (auditErr) {
            console.warn("Audit log notice:", auditErr);
        }

        if (messageEl) {
            messageEl.className = "alert alert-success";
            messageEl.textContent = "Account registered successfully! You can now log in.";
        }

        document.getElementById("signupForm").reset();

        // Prefill login email
        const emailInput = document.getElementById("email");
        if (emailInput) emailInput.value = email;

        setTimeout(() => {
            hideSignup();
        }, 1500);

    } catch (err) {
        if (messageEl) {
            messageEl.className = "alert alert-danger";
            messageEl.textContent = err.message || "Registration failed.";
            messageEl.classList.remove("hidden");
        }
    }
}

function showSignup() {
    const signupBox = document.getElementById("signupBox");
    const loginBox = document.getElementById("loginBox");
    if (signupBox) signupBox.classList.remove("hidden");
    if (loginBox) loginBox.classList.add("hidden");
}

function hideSignup() {
    const signupBox = document.getElementById("signupBox");
    const loginBox = document.getElementById("loginBox");
    if (signupBox) signupBox.classList.add("hidden");
    if (loginBox) loginBox.classList.remove("hidden");
}

// Helper function to update password (for debugging/reset purposes)
async function updateUserPassword(email, newPassword) {
    try {
        const { error } = await supabaseClient
            .from("users")
            .update({ password: newPassword })
            .eq("email", email);

        if (error) {
            console.error("Failed to update password:", error);
            return false;
        }
        console.log("Password updated successfully for:", email);
        return true;
    } catch (err) {
        console.error("Error updating password:", err);
        return false;
    }
}
