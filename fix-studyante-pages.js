const fs = require("fs");

const htmlFile = "./docs/index.html";
const scriptFile = "./docs/script.js";

let html = fs
    .readFileSync(htmlFile, "utf8")
    .replace(/\r\n/g, "\n");

let script = fs
    .readFileSync(scriptFile, "utf8")
    .replace(/\r\n/g, "\n");


/* =========================================================
   1. CREATE REAL DASHBOARD SECTION
========================================================= */

if (!html.includes('id="dashboard"')) {

    const mainIndex =
        html.indexOf("<main>");

    const uploadIndex =
        html.indexOf(
            '<section\n      id="upload"'
        );

    if (mainIndex === -1) {
        throw new Error(
            "<main> was not found."
        );
    }

    if (uploadIndex === -1) {
        throw new Error(
            "Upload section was not found."
        );
    }

    const dashboardStart =
        mainIndex +
        "<main>".length;

    const dashboardContent =
        html.substring(
            dashboardStart,
            uploadIndex
        );

    html =
        html.substring(
            0,
            dashboardStart
        ) +
        `

    <section
      id="dashboard"
      class="studyante-page"
    >
${dashboardContent}
    </section>

    ` +
        html.substring(
            uploadIndex
        );
}


/* =========================================================
   2. MARK UPLOAD / LIBRARY / AI AS APP PAGES
========================================================= */

html = html.replace(
    /id="upload"\s*\n\s*class="panel"/,
    'id="upload"\n      class="panel studyante-page"'
);

html = html.replace(
    /id="library"\s*\n\s*class="panel"/,
    'id="library"\n      class="panel studyante-page"'
);

html = html.replace(
    /id="ai"\s*\n\s*class="panel"/,
    'id="ai"\n      class="panel studyante-page"'
);


/* =========================================================
   3. ADD NAV DATA-PAGE TARGETS
========================================================= */

html = html.replace(
    '<a href="#dashboard">',
    '<a href="#dashboard" data-page="dashboard">'
);

html = html.replace(
    '<a href="#upload">',
    '<a href="#upload" data-page="upload">'
);

html = html.replace(
    '<a href="#library">',
    '<a href="#library" data-page="library">'
);

html = html.replace(
    '<a href="#ai">',
    '<a href="#ai" data-page="ai">'
);

fs.writeFileSync(
    htmlFile,
    html,
    "utf8"
);


/* =========================================================
   4. REPLACE OLD APP NAVIGATION
========================================================= */

const navigationComment =
    "/* =========================================================\n   STUDYante APP-STYLE PAGE NAVIGATION";

const navigationStart =
    script.indexOf(
        navigationComment
    );

if (navigationStart === -1) {
    throw new Error(
        "Existing STUDYante navigation block was not found."
    );
}

const newNavigation = `/* =========================================================
   STUDYante SINGLE-PAGE NAVIGATION
========================================================= */

(function () {

    const STUDYANTE_PAGES = [
        "dashboard",
        "upload",
        "library",
        "ai"
    ];


    function showStudyantePage(
        pageId,
        updateHash = true
    ) {
        if (
            !STUDYANTE_PAGES.includes(
                pageId
            )
        ) {
            pageId =
                "dashboard";
        }

        const selectedPage =
            document.getElementById(
                pageId
            );

        if (!selectedPage) {
            console.warn(
                "STUDYante page not found:",
                pageId
            );

            return;
        }


        STUDYANTE_PAGES.forEach(
            id => {
                const page =
                    document.getElementById(
                        id
                    );

                if (!page) {
                    return;
                }

                const active =
                    id === pageId;

                page.hidden =
                    !active;

                page.style.display =
                    active
                        ? ""
                        : "none";

                page.classList.toggle(
                    "studyante-page-active",
                    active
                );
            }
        );


        document
            .querySelectorAll(
                ".sidebar nav a"
            )
            .forEach(link => {

                const target =
                    (
                        link.dataset.page ||
                        link
                            .getAttribute(
                                "href"
                            ) ||
                        ""
                    )
                        .replace(
                            "#",
                            ""
                        )
                        .trim();

                const active =
                    target ===
                    pageId;

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


        if (
            updateHash &&
            window.location.hash !==
                "#" + pageId
        ) {
            history.pushState(
                null,
                "",
                "#" + pageId
            );
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });


        if (
            pageId ===
            "library" &&
            typeof loadLibrary ===
            "function"
        ) {
            loadLibrary();
        }


        if (
            pageId ===
            "ai" &&
            typeof loadChatHistory ===
            "function"
        ) {
            loadChatHistory();
        }
    }


    document.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    ".sidebar nav a"
                );

            if (!link) {
                return;
            }

            const pageId =
                (
                    link.dataset.page ||
                    link
                        .getAttribute(
                            "href"
                        ) ||
                    ""
                )
                    .replace(
                        "#",
                        ""
                    )
                    .trim();


            if (
                !STUDYANTE_PAGES.includes(
                    pageId
                )
            ) {
                return;
            }


            event.preventDefault();

            showStudyantePage(
                pageId
            );
        },
        true
    );


    function openInitialPage() {

        let pageId =
            window.location.hash
                .replace(
                    "#",
                    ""
                )
                .trim();


        if (
            !STUDYANTE_PAGES.includes(
                pageId
            )
        ) {
            pageId =
                "dashboard";
        }


        showStudyantePage(
            pageId,
            false
        );
    }


    window.addEventListener(
        "popstate",
        () => {

            let pageId =
                window.location.hash
                    .replace(
                        "#",
                        ""
                    )
                    .trim();


            if (
                !STUDYANTE_PAGES.includes(
                    pageId
                )
            ) {
                pageId =
                    "dashboard";
            }


            showStudyantePage(
                pageId,
                false
            );
        }
    );


    window.showStudyantePage =
        showStudyantePage;


    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            openInitialPage
        );
    } else {
        openInitialPage();
    }

})();
`;

script =
    script.substring(
        0,
        navigationStart
    ) +
    newNavigation;

fs.writeFileSync(
    scriptFile,
    script,
    "utf8"
);

console.log("");
console.log(
    "STUDYante page navigation updated."
);
console.log("");
