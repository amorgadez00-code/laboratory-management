document.addEventListener("DOMContentLoaded", async () => {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();

    if (session) {
        window.location.href = "index.html";
    }

    const loginForm =
        document.getElementById("loginForm");

    const signupForm =
        document.getElementById("signupForm");

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            login
        );

    }

    if (signupForm) {

        signupForm.addEventListener(
            "submit",
            signup
        );

    }

});


async function login(event) {

    event.preventDefault();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const message =
        document.getElementById("loginMessage");

    message.textContent = "Logging in...";

    const {
        data,
        error
    } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {

        message.textContent =
            "Login failed: " + error.message;

        return;
    }

    window.location.href = "index.html";
}


async function signup(event) {

    event.preventDefault();

    const fullName =
        document.getElementById("signupName").value.trim();

    const email =
        document.getElementById("signupEmail").value.trim();

    const password =
        document.getElementById("signupPassword").value;

    const message =
        document.getElementById("signupMessage");

    message.textContent = "Creating account...";

    const {
        data,
        error
    } = await supabaseClient.auth.signUp({

        email,

        password,

        options: {

            data: {
                full_name: fullName
            }

        }

    });

    if (error) {

        message.textContent =
            "Registration failed: " + error.message;

        return;
    }

    message.textContent =
        "Account created. You may now login.";

    document.getElementById("signupForm").reset();

}


function showSignup() {

    const box =
        document.getElementById("signupBox");

    box.style.display = "block";

}
