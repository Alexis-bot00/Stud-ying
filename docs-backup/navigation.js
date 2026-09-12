(function () {
    "use strict";

    const pages = [
        "dashboard",
        "upload",
        "library",
        "community",
        "ai"
    ];

    function getPageId(link) {
        if (!link) return "";

        return (
            link.dataset.page ||
            link.getAttribute("href") ||
            ""
        )
        .replace(/^#/, "")
        .trim();
    }


    function showPage(pageId, updateHash) {

        if (!pages.includes(pageId)) {
            pageId = "dashboard";
        }


        pages.forEach(function (id) {

            const page =
                document.getElementById(id);

            if (!page) {
                return;
            }

            const active =
                id === pageId;


            page.hidden = !active;


            if (active) {

                page.removeAttribute("hidden");

                page.style.setProperty(
                    "display",
                    "block",
                    "important"
                );

                page.classList.add(
                    "studyante-page-active"
                );

            } else {

                page.setAttribute(
                    "hidden",
                    ""
                );

                page.style.setProperty(
                    "display",
                    "none",
                    "important"
                );

                page.classList.remove(
                    "studyante-page-active"
                );
            }
        });


        document
            .querySelectorAll(".sidebar nav a")
            .forEach(function (link) {

                const active =
                    getPageId(link) === pageId;

                link.classList.toggle(
                    "active",
                    active
                );

                if (active) {

                    link.setAttribute(
                        "aria-current",
                        "page"
                    );

                } else {

                    link.removeAttribute(
                        "aria-current"
                    );
                }
            });


        if (updateHash) {

            history.replaceState(
                null,
                "",
                "#" + pageId
            );
        }


        if (
            pageId === "library" &&
            typeof window.loadLibrary === "function"
        ) {
            window.loadLibrary();
        }


        if (
            pageId === "community" &&
            typeof window.loadCommunity === "function"
        ) {
            window.loadCommunity();
        }


        if (
            pageId === "ai" &&
            typeof window.loadChatHistory === "function"
        ) {
            window.loadChatHistory();
        }
    }


    function installNavigation() {

        document.addEventListener(
            "click",
            function (event) {

                const target =
                    event.target instanceof Element
                        ? event.target
                        : null;

                if (!target) {
                    return;
                }


                const link =
                    target.closest(
                        ".sidebar nav a"
                    );

                if (!link) {
                    return;
                }


                const pageId =
                    getPageId(link);

                if (!pages.includes(pageId)) {
                    return;
                }


                event.preventDefault();

                event.stopImmediatePropagation();

                showPage(
                    pageId,
                    true
                );

            },
            true
        );


        let initialPage =
            window.location.hash
                .replace(/^#/, "")
                .trim();


        if (!pages.includes(initialPage)) {
            initialPage = "dashboard";
        }


        showPage(
            initialPage,
            false
        );
    }


    window.showStudyantePage =
        function (pageId) {

            showPage(
                pageId,
                true
            );
        };


    window.addEventListener(
        "hashchange",
        function () {

            const pageId =
                window.location.hash
                    .replace(/^#/, "")
                    .trim();

            if (pages.includes(pageId)) {

                showPage(
                    pageId,
                    false
                );
            }
        }
    );


    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            installNavigation
        );

    } else {

        installNavigation();
    }

})();