(() => {

    function cleanText(element) {
        return String(
            element?.textContent || ""
        )
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function createLogo(type) {

        const img =
            document.createElement("img");

        img.src =
            "assets/studyante-logo.png";

        img.alt =
            "STUDYante";

        img.className =
            type === "login"
                ? "studyante-logo studyante-login-logo"
                : "studyante-logo studyante-sidebar-logo";

        return img;
    }

    function replaceElement(
        element,
        type
    ) {

        if (!element) {
            return false;
        }

        element.innerHTML = "";

        element.appendChild(
            createLogo(type)
        );

        element.classList.add(
            "studyante-logo-container"
        );

        return true;
    }

    function findBrand(
        root,
        type
    ) {

        if (!root) {
            return false;
        }

        const selectors = [
            ".brand",
            ".logo",
            ".brand-name",
            ".sidebar-brand",
            ".sidebar-logo",
            ".auth-brand",
            ".login-brand",
            ".app-brand",
            ".navbar-brand",
            "h1",
            "h2",
            "a",
            "div",
            "span"
        ];

        const elements =
            root.querySelectorAll(
                selectors.join(",")
            );

        for (
            const element
            of elements
        ) {

            const text =
                cleanText(element);

            if (
                text === "studying" ||
                text === "study ing"
            ) {

                return replaceElement(
                    element,
                    type
                );
            }
        }

        return false;
    }

    function updateLoginLogo() {

        const loginArea =
            document.querySelector(
                [
                    ".auth-left",
                    ".login-left",
                    ".login-info",
                    ".auth-info",
                    ".left-panel",
                    ".welcome-panel",
                    ".login-hero",
                    ".auth-hero"
                ].join(",")
            );

        if (
            loginArea &&
            findBrand(
                loginArea,
                "login"
            )
        ) {
            return;
        }

        const elements =
            document.querySelectorAll(
                "h1,h2,a,div,span"
            );

        for (
            const element
            of elements
        ) {

            const text =
                cleanText(element);

            if (
                text !== "studying" &&
                text !== "study ing"
            ) {
                continue;
            }

            const rect =
                element.getBoundingClientRect();

            if (
                rect.top < 180 &&
                rect.left <
                    window.innerWidth * 0.60
            ) {

                replaceElement(
                    element,
                    "login"
                );

                return;
            }
        }
    }

    function updateSidebarLogo() {

        const sidebar =
            document.querySelector(
                [
                    ".sidebar",
                    ".app-sidebar",
                    ".side-nav",
                    ".dashboard-sidebar",
                    "aside"
                ].join(",")
            );

        if (
            sidebar &&
            findBrand(
                sidebar,
                "sidebar"
            )
        ) {
            return;
        }

        const elements =
            document.querySelectorAll(
                "h1,h2,a,div,span"
            );

        for (
            const element
            of elements
        ) {

            const text =
                cleanText(element);

            if (
                text !== "studying" &&
                text !== "study ing"
            ) {
                continue;
            }

            const rect =
                element.getBoundingClientRect();

            if (
                rect.top < 150 &&
                rect.left < 350
            ) {

                replaceElement(
                    element,
                    "sidebar"
                );

                return;
            }
        }
    }

    function updateTextBranding() {

        const walker =
            document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT
            );

        const textNodes = [];

        while (
            walker.nextNode()
        ) {

            textNodes.push(
                walker.currentNode
            );
        }

        for (
            const node
            of textNodes
        ) {

            if (
                !node.parentElement
            ) {
                continue;
            }

            if (
                node.parentElement.closest(
                    ".studyante-logo-container"
                )
            ) {
                continue;
            }

            let text =
                node.nodeValue;

            text =
                text.replace(
                    /©\s*2026\s+Studying\b/gi,
                    "© 2026 STUDYante"
                );

            text =
                text.replace(
                    /your Studying account/gi,
                    "your STUDYante account"
                );

            node.nodeValue =
                text;
        }

        document.title =
            document.title.replace(
                /\bStudying\b/gi,
                "STUDYante"
            );
    }

    function initializeBrand() {

        const isLogin =
            location.pathname
                .toLowerCase()
                .includes("login") ||
            Boolean(
                document.querySelector(
                    'input[type="password"]'
                )
            );

        if (isLogin) {

            updateLoginLogo();

        } else {

            updateSidebarLogo();
        }

        updateTextBranding();
    }

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeBrand
        );

    } else {

        initializeBrand();
    }

})();
