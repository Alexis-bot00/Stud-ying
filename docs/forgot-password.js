(() => {
    const API = "https://stud-ying-production.up.railway.app";

    function createForgotPasswordUI() {
        if (document.getElementById("studyanteForgotPasswordModal")) {
            return;
        }

        const loginButton = document.getElementById("loginButton");

        if (loginButton) {
            const forgot = document.createElement("button");

            forgot.type = "button";
            forgot.id = "studyanteForgotPasswordButton";
            forgot.className = "studyante-forgot-link";
            forgot.textContent = "Forgot Password?";

            loginButton.insertAdjacentElement("afterend", forgot);
        }

        const modal = document.createElement("div");

        modal.id = "studyanteForgotPasswordModal";
        modal.className = "studyante-reset-overlay";
        modal.hidden = true;

        modal.innerHTML = `
<div class="studyante-reset-card">
    <button
        type="button"
        class="studyante-reset-close"
        id="studyanteResetClose"
    >
        &times;
    </button>

    <div id="studyanteResetRequestView">
        <h2>Forgot Password?</h2>

        <p class="studyante-reset-description">
            Enter your STUDYante account email.
            We will send you a 6-digit reset code.
        </p>

        <label for="studyanteResetEmail">Email</label>

        <input
            type="email"
            id="studyanteResetEmail"
            placeholder="Enter your email"
            autocomplete="email"
        >

        <button
            type="button"
            class="studyante-reset-primary"
            id="studyanteSendResetCode"
        >
            Send Reset Code
        </button>

        <div
            id="studyanteForgotMessage"
            class="studyante-reset-message"
        ></div>
    </div>

    <div
        id="studyanteResetPasswordView"
        hidden
    >
        <h2>Reset Password</h2>

        <p class="studyante-reset-description">
            Enter the code sent to your email,
            then create a new password.
        </p>

        <label for="studyanteResetCode">Reset Code</label>

        <input
            type="text"
            id="studyanteResetCode"
            maxlength="6"
            inputmode="numeric"
            placeholder="6-digit code"
        >

        <label for="studyanteNewPassword">New Password</label>

        <input
            type="password"
            id="studyanteNewPassword"
            placeholder="New password"
            autocomplete="new-password"
        >

        <label for="studyanteConfirmPassword">Confirm Password</label>

        <input
            type="password"
            id="studyanteConfirmPassword"
            placeholder="Confirm new password"
            autocomplete="new-password"
        >

        <button
            type="button"
            class="studyante-reset-primary"
            id="studyanteResetPasswordButton"
        >
            Change Password
        </button>

        <button
            type="button"
            class="studyante-reset-secondary"
            id="studyanteResendResetCode"
        >
            Send New Code
        </button>

        <div
            id="studyanteResetMessage"
            class="studyante-reset-message"
        ></div>
    </div>
</div>
`;

        document.body.appendChild(modal);

        const style = document.createElement("style");

        style.textContent = `
.studyante-forgot-link {
    width: 100%;
    margin-top: 12px;
    border: 0;
    background: transparent;
    color: #2563eb;
    cursor: pointer;
    font-weight: 600;
}

.studyante-reset-overlay {
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: rgba(0,0,0,.60);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.studyante-reset-overlay[hidden] {
    display: none !important;
}

.studyante-reset-card {
    position: relative;
    width: min(440px, 100%);
    background: white;
    color: #111827;
    border-radius: 18px;
    padding: 30px;
    box-sizing: border-box;
}

.studyante-reset-card label {
    display: block;
    margin-top: 15px;
    margin-bottom: 6px;
    font-weight: 600;
}

.studyante-reset-card input {
    width: 100%;
    height: 46px;
    padding: 0 12px;
    box-sizing: border-box;
    border: 1px solid #d1d5db;
    border-radius: 10px;
}

.studyante-reset-primary {
    width: 100%;
    height: 46px;
    margin-top: 20px;
    border: 0;
    border-radius: 10px;
    background: #2563eb;
    color: white;
    font-weight: 700;
    cursor: pointer;
}

.studyante-reset-secondary {
    width: 100%;
    margin-top: 12px;
    border: 0;
    background: transparent;
    color: #2563eb;
    font-weight: 600;
    cursor: pointer;
}

.studyante-reset-close {
    position: absolute;
    top: 12px;
    right: 16px;
    border: 0;
    background: transparent;
    font-size: 30px;
    cursor: pointer;
}

.studyante-reset-description {
    color: #6b7280;
    line-height: 1.5;
}

.studyante-reset-message {
    margin-top: 14px;
    text-align: center;
    font-size: 14px;
}

.studyante-reset-message.success {
    color: #16a34a;
}

.studyante-reset-message.error {
    color: #dc2626;
}
`;

        document.head.appendChild(style);

        installEvents();
    }

    function showMessage(element, text, success) {
        if (!element) return;

        element.textContent = text || "";
        element.className =
            "studyante-reset-message " +
            (success ? "success" : "error");
    }

    function installEvents() {
        const modal =
            document.getElementById("studyanteForgotPasswordModal");

        const forgotButton =
            document.getElementById("studyanteForgotPasswordButton");

        const close =
            document.getElementById("studyanteResetClose");

        const email =
            document.getElementById("studyanteResetEmail");

        const loginEmail =
            document.getElementById("loginEmail");

        const requestView =
            document.getElementById("studyanteResetRequestView");

        const resetView =
            document.getElementById("studyanteResetPasswordView");

        const send =
            document.getElementById("studyanteSendResetCode");

        const reset =
            document.getElementById("studyanteResetPasswordButton");

        const forgotMessage =
            document.getElementById("studyanteForgotMessage");

        const resetMessage =
            document.getElementById("studyanteResetMessage");

        forgotButton?.addEventListener("click", () => {
            if (loginEmail?.value) {
                email.value = loginEmail.value;
            }

            requestView.hidden = false;
            resetView.hidden = true;
            modal.hidden = false;
        });

        close?.addEventListener("click", () => {
            modal.hidden = true;
        });

        send?.addEventListener("click", async () => {
            const address = email.value.trim().toLowerCase();

            if (!address) {
                showMessage(
                    forgotMessage,
                    "Please enter your email.",
                    false
                );
                return;
            }

            send.disabled = true;
            send.textContent = "Sending...";

            try {
                const response = await fetch(
                    API + "/api/auth/forgot-password",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email: address
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Could not send reset code."
                    );
                }

                showMessage(
                    forgotMessage,
                    data.message,
                    true
                );

                setTimeout(() => {
                    requestView.hidden = true;
                    resetView.hidden = false;
                }, 600);

            } catch (error) {
                showMessage(
                    forgotMessage,
                    error.message,
                    false
                );
            } finally {
                send.disabled = false;
                send.textContent = "Send Reset Code";
            }
        });

        reset?.addEventListener("click", async () => {
            const code =
                document
                    .getElementById("studyanteResetCode")
                    .value
                    .trim();

            const password =
                document
                    .getElementById("studyanteNewPassword")
                    .value;

            const confirm =
                document
                    .getElementById("studyanteConfirmPassword")
                    .value;

            if (!/^\d{6}$/.test(code)) {
                showMessage(
                    resetMessage,
                    "Enter the 6-digit code.",
                    false
                );
                return;
            }

            if (password.length < 6) {
                showMessage(
                    resetMessage,
                    "Password must be at least 6 characters.",
                    false
                );
                return;
            }

            if (password !== confirm) {
                showMessage(
                    resetMessage,
                    "Passwords do not match.",
                    false
                );
                return;
            }

            try {
                const response = await fetch(
                    API + "/api/auth/reset-password",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email: email.value.trim().toLowerCase(),
                            code: code,
                            newPassword: password
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Could not reset password."
                    );
                }

                showMessage(
                    resetMessage,
                    "Password changed successfully.",
                    true
                );

                setTimeout(() => {
                    modal.hidden = true;
                }, 1200);

            } catch (error) {
                showMessage(
                    resetMessage,
                    error.message,
                    false
                );
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            createForgotPasswordUI,
            { once: true }
        );
    } else {
        createForgotPasswordUI();
    }
})();