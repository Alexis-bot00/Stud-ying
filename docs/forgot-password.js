(() => {
    const API = "https://stud-ying-production.up.railway.app";

    function createUI() {
        if (document.getElementById("studyanteForgotPasswordModal")) {
            return;
        }

        const loginButton = document.getElementById("loginButton");

        if (!loginButton) {
            return;
        }

        const forgot = document.createElement("button");
        forgot.type = "button";
        forgot.id = "studyanteForgotPasswordButton";
        forgot.className = "studyante-forgot-link";
        forgot.textContent = "Forgot Password?";

        loginButton.insertAdjacentElement("afterend", forgot);

        const modal = document.createElement("div");
        modal.id = "studyanteForgotPasswordModal";
        modal.className = "studyante-reset-overlay";
        modal.hidden = true;

        modal.innerHTML = `
            <div class="studyante-reset-card">
                <button
                    type="button"
                    id="studyanteResetClose"
                    class="studyante-reset-close"
                >
                    &times;
                </button>

                <div id="studyanteResetRequestView">
                    <h2>Forgot Password?</h2>

                    <p>
                        Enter your STUDYante email.
                        We will send you a 6-digit reset code.
                    </p>

                    <input
                        id="studyanteResetEmail"
                        type="email"
                        placeholder="Enter your email"
                        autocomplete="email"
                    >

                    <button
                        type="button"
                        id="studyanteSendResetCode"
                        class="studyante-reset-primary"
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

                    <input
                        id="studyanteResetCode"
                        type="text"
                        maxlength="6"
                        inputmode="numeric"
                        placeholder="6-digit code"
                    >

                    <input
                        id="studyanteNewPassword"
                        type="password"
                        placeholder="New password"
                    >

                    <input
                        id="studyanteConfirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                    >

                    <button
                        type="button"
                        id="studyanteResetPasswordButton"
                        class="studyante-reset-primary"
                    >
                        Change Password
                    </button>

                    <button
                        type="button"
                        id="studyanteResendResetCode"
                        class="studyante-reset-secondary"
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
                background: rgba(0,0,0,.6);
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
                background: #fff;
                color: #111827;
                border-radius: 18px;
                padding: 30px;
                box-sizing: border-box;
            }

            .studyante-reset-card input {
                width: 100%;
                height: 46px;
                margin-top: 12px;
                padding: 0 12px;
                box-sizing: border-box;
                border: 1px solid #d1d5db;
                border-radius: 10px;
            }

            .studyante-reset-primary {
                width: 100%;
                height: 46px;
                margin-top: 18px;
                border: 0;
                border-radius: 10px;
                background: #2563eb;
                color: white;
                font-weight: 700;
                cursor: pointer;
            }

            .studyante-reset-primary:disabled {
                opacity: .6;
                cursor: not-allowed;
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

        const requestView =
            document.getElementById("studyanteResetRequestView");

        const resetView =
            document.getElementById("studyanteResetPasswordView");

        const emailInput =
            document.getElementById("studyanteResetEmail");

        const sendButton =
            document.getElementById("studyanteSendResetCode");

        const forgotMessage =
            document.getElementById("studyanteForgotMessage");

        function setMessage(element, text, success) {
            element.textContent = text || "";
            element.className =
                "studyante-reset-message " +
                (success ? "success" : "error");
        }

        async function sendResetCode() {
            const email =
                emailInput.value.trim().toLowerCase();

            if (!email) {
                setMessage(
                    forgotMessage,
                    "Please enter your email.",
                    false
                );
                return;
            }

            sendButton.disabled = true;
            sendButton.textContent = "Sending...";

            setMessage(
                forgotMessage,
                "",
                true
            );

            try {
                const response = await fetch(
                    API + "/api/auth/forgot-password",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email
                        })
                    }
                );

                const text = await response.text();

                let data;

                try {
                    data = JSON.parse(text);
                } catch {
                    throw new Error(
                        "Server returned an invalid response."
                    );
                }

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Could not send reset code."
                    );
                }

                setMessage(
                    forgotMessage,
                    data.message ||
                    "Reset code sent.",
                    true
                );

                requestView.hidden = true;
                resetView.hidden = false;

            } catch (error) {
                console.error(
                    "Forgot password request failed:",
                    error
                );

                setMessage(
                    forgotMessage,
                    error.message ||
                    "Could not send reset code.",
                    false
                );
            } finally {
                sendButton.disabled = false;
                sendButton.textContent = "Send Reset Code";
            }
        }

        forgot.addEventListener("click", () => {
            const loginEmail =
                document.getElementById("loginEmail");

            if (loginEmail?.value) {
                emailInput.value =
                    loginEmail.value;
            }

            requestView.hidden = false;
            resetView.hidden = true;
            modal.hidden = false;
        });

        document
            .getElementById("studyanteResetClose")
            .addEventListener("click", () => {
                modal.hidden = true;
            });

        sendButton.addEventListener(
            "click",
            sendResetCode
        );

        document
            .getElementById("studyanteResendResetCode")
            .addEventListener("click", async () => {
                requestView.hidden = false;
                resetView.hidden = true;
                await sendResetCode();
            });

        document
            .getElementById("studyanteResetPasswordButton")
            .addEventListener(
                "click",
                async () => {
                    const code =
                        document
                            .getElementById("studyanteResetCode")
                            .value
                            .trim();

                    const newPassword =
                        document
                            .getElementById("studyanteNewPassword")
                            .value;

                    const confirmPassword =
                        document
                            .getElementById("studyanteConfirmPassword")
                            .value;

                    const message =
                        document.getElementById(
                            "studyanteResetMessage"
                        );

                    if (!/^\d{6}$/.test(code)) {
                        setMessage(
                            message,
                            "Enter the 6-digit code.",
                            false
                        );
                        return;
                    }

                    if (newPassword.length < 6) {
                        setMessage(
                            message,
                            "Password must be at least 6 characters.",
                            false
                        );
                        return;
                    }

                    if (
                        newPassword !==
                        confirmPassword
                    ) {
                        setMessage(
                            message,
                            "Passwords do not match.",
                            false
                        );
                        return;
                    }

                    try {
                        const response =
                            await fetch(
                                API +
                                "/api/auth/reset-password",
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },
                                    body: JSON.stringify({
                                        email:
                                            emailInput
                                                .value
                                                .trim()
                                                .toLowerCase(),
                                        code,
                                        newPassword
                                    })
                                }
                            );

                        const text =
                            await response.text();

                        let data;

                        try {
                            data =
                                JSON.parse(text);
                        } catch {
                            throw new Error(
                                "Server returned an invalid response."
                            );
                        }

                        if (!response.ok) {
                            throw new Error(
                                data.message ||
                                "Could not reset password."
                            );
                        }

                        setMessage(
                            message,
                            "Password changed successfully.",
                            true
                        );

                        setTimeout(() => {
                            modal.hidden = true;

                            const loginEmail =
                                document.getElementById(
                                    "loginEmail"
                                );

                            if (loginEmail) {
                                loginEmail.value =
                                    emailInput.value;
                            }

                            document
                                .getElementById("loginPassword")
                                ?.focus();

                        }, 1000);

                    } catch (error) {
                        setMessage(
                            message,
                            error.message ||
                            "Could not reset password.",
                            false
                        );
                    }
                }
            );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            createUI,
            { once: true }
        );
    } else {
        createUI();
    }
})();