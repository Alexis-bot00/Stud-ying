const API_BASE = "http://localhost:5000";

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const loginView =
      document.getElementById("loginView");

    const registerView =
      document.getElementById("registerView");

    const loginForm =
      document.getElementById("loginForm");

    const registerForm =
      document.getElementById("registerForm");

    const loginButton =
      document.getElementById("loginButton");

    const registerButton =
      document.getElementById("registerButton");

    const loginMessage =
      document.getElementById("loginMessage");

    const registerMessage =
      document.getElementById("registerMessage");

    const showRegister =
      document.getElementById("showRegister");

    const showLogin =
      document.getElementById("showLogin");


    function showMessage(
      element,
      message,
      type = "error"
    ) {
      element.textContent = message;

      element.className =
        `form-message ${type}`;
    }


    function clearMessage(element) {
      element.textContent = "";

      element.className =
        "form-message";
    }


    showRegister.addEventListener(
      "click",
      () => {

        loginView.classList.add(
          "hidden"
        );

        registerView.classList.remove(
          "hidden"
        );

        clearMessage(loginMessage);
        clearMessage(registerMessage);
      }
    );


    showLogin.addEventListener(
      "click",
      () => {

        registerView.classList.add(
          "hidden"
        );

        loginView.classList.remove(
          "hidden"
        );

        clearMessage(loginMessage);
        clearMessage(registerMessage);
      }
    );


    document
      .querySelectorAll(
        ".password-toggle"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const input =
              document.getElementById(
                button.dataset.target
              );

            if (
              input.type ===
              "password"
            ) {
              input.type = "text";

              button.textContent =
                "Hide";
            } else {
              input.type =
                "password";

              button.textContent =
                "Show";
            }
          }
        );
      });


    async function readResponse(
      response
    ) {
      const text =
        await response.text();

      if (!text) {
        return {};
      }

      try {
        return JSON.parse(text);
      } catch {
        return {
          message: text
        };
      }
    }


    loginForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const email =
          document
            .getElementById(
              "loginEmail"
            )
            .value
            .trim();

        const password =
          document
            .getElementById(
              "loginPassword"
            )
            .value;


        clearMessage(loginMessage);


        if (
          !email ||
          !password
        ) {
          showMessage(
            loginMessage,
            "Please enter your email and password."
          );

          return;
        }


        loginButton.disabled = true;

        loginButton.textContent =
          "Logging in...";


        try {

          const response =
            await fetch(
              `${API_BASE}/api/auth/login`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    email,
                    password
                  })
              }
            );


          const data =
            await readResponse(
              response
            );


          if (!response.ok) {
            throw new Error(
              data.message ||
              "Incorrect email or password."
            );
          }


          if (!data.token) {
            throw new Error(
              "No login token received."
            );
          }


          localStorage.setItem(
            "studyingToken",
            data.token
          );


          if (data.user) {
            localStorage.setItem(
              "studyingUser",
              JSON.stringify(
                data.user
              )
            );
          }


          showMessage(
            loginMessage,
            "Login successful!",
            "success"
          );


          window.location.replace(
            "index.html"
          );


        } catch (error) {

          console.error(
            "Login error:",
            error
          );


          if (
            error instanceof TypeError
          ) {
            showMessage(
              loginMessage,
              "Cannot connect to backend. Make sure localhost:5000 is running."
            );
          } else {
            showMessage(
              loginMessage,
              error.message
            );
          }

        } finally {

          loginButton.disabled =
            false;

          loginButton.textContent =
            "Login";
        }
      }
    );


    registerForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const name =
          document
            .getElementById(
              "registerName"
            )
            .value
            .trim();


        const email =
          document
            .getElementById(
              "registerEmail"
            )
            .value
            .trim();


        const password =
          document
            .getElementById(
              "registerPassword"
            )
            .value;


        const confirmPassword =
          document
            .getElementById(
              "confirmPassword"
            )
            .value;


        clearMessage(
          registerMessage
        );


        if (
          !name ||
          !email ||
          !password ||
          !confirmPassword
        ) {
          showMessage(
            registerMessage,
            "Please complete all fields."
          );

          return;
        }


        if (!email.includes("@")) {
          showMessage(
            registerMessage,
            "Please enter a valid email."
          );

          return;
        }


        if (password.length < 6) {
          showMessage(
            registerMessage,
            "Password must be at least 6 characters."
          );

          return;
        }


        if (
          password !==
          confirmPassword
        ) {
          showMessage(
            registerMessage,
            "Passwords do not match."
          );

          return;
        }


        registerButton.disabled =
          true;

        registerButton.textContent =
          "Creating account...";


        try {

          const response =
            await fetch(
              `${API_BASE}/api/auth/register`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    name,
                    email,
                    password
                  })
              }
            );


          const data =
            await readResponse(
              response
            );


          if (!response.ok) {
            throw new Error(
              data.message ||
              "Registration failed."
            );
          }


          if (!data.token) {
            throw new Error(
              "No login token received."
            );
          }


          localStorage.setItem(
            "studyingToken",
            data.token
          );


          if (data.user) {
            localStorage.setItem(
              "studyingUser",
              JSON.stringify(
                data.user
              )
            );
          }


          showMessage(
            registerMessage,
            "Account created!",
            "success"
          );


          window.location.replace(
            "index.html"
          );


        } catch (error) {

          console.error(
            "Register error:",
            error
          );


          if (
            error instanceof TypeError
          ) {
            showMessage(
              registerMessage,
              "Cannot connect to backend. Make sure localhost:5000 is running."
            );
          } else {
            showMessage(
              registerMessage,
              error.message
            );
          }

        } finally {

          registerButton.disabled =
            false;

          registerButton.textContent =
            "Create Account";
        }
      }
    );
  }
);