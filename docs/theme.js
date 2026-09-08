(function () {
    "use strict";

    var STORAGE_KEY = "studyanteTheme";

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || "light";
        }
        catch (error) {
            return "light";
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        }
        catch (error) {
        }
    }

    function applyTheme(theme) {
        var dark = theme === "dark";

        document.body.classList.toggle(
            "studyante-dark",
            dark
        );

        var button =
            document.getElementById("studyanteThemeToggle");

        if (button) {
            button.textContent =
                dark
                    ? "Light Mode"
                    : "Dark Mode";

            button.setAttribute(
                "aria-label",
                dark
                    ? "Switch to Light Mode"
                    : "Switch to Dark Mode"
            );
        }

        saveTheme(
            dark ? "dark" : "light"
        );
    }

    function initializeTheme() {
        var button =
            document.getElementById("studyanteThemeToggle");

        applyTheme(getSavedTheme());

        if (button) {
            button.addEventListener(
                "click",
                function () {
                    var dark =
                        document.body.classList.contains(
                            "studyante-dark"
                        );

                    applyTheme(
                        dark ? "light" : "dark"
                    );
                }
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeTheme
        );
    }
    else {
        initializeTheme();
    }
})();