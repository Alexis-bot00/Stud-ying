(function () {
    "use strict";

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function inlineMarkdown(text) {
        let value = escapeHTML(text);

        value = value.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );

        value = value.replace(
            /\*\*([^*]+)\*\*/g,
            "<strong>$1</strong>"
        );

        value = value.replace(
            /__([^_]+)__/g,
            "<strong>$1</strong>"
        );

        value = value.replace(
            /\*([^*\n]+)\*/g,
            "<em>$1</em>"
        );

        return value;
    }


    function renderMarkdown(markdown) {
        const source = String(markdown ?? "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

        const lines = source.split("\n");

        let html = "";
        let paragraph = [];
        let listType = null;
        let codeBlock = false;
        let codeLanguage = "";
        let codeLines = [];


        function closeParagraph() {
            if (!paragraph.length) {
                return;
            }

            html +=
                "<p>" +
                inlineMarkdown(
                    paragraph.join(" ")
                ) +
                "</p>";

            paragraph = [];
        }


        function closeList() {
            if (!listType) {
                return;
            }

            html +=
                listType === "ol"
                    ? "</ol>"
                    : "</ul>";

            listType = null;
        }


        function closeCodeBlock() {
            if (!codeBlock) {
                return;
            }

            const languageClass =
                codeLanguage
                    ? ' class="language-' +
                      escapeHTML(codeLanguage) +
                      '"'
                    : "";

            html +=
                "<pre><code" +
                languageClass +
                ">" +
                escapeHTML(
                    codeLines.join("\n")
                ) +
                "</code></pre>";

            codeBlock = false;
            codeLanguage = "";
            codeLines = [];
        }


        for (const line of lines) {

            const fence =
                line.match(/^```(.*)$/);

            if (fence) {

                closeParagraph();
                closeList();

                if (codeBlock) {
                    closeCodeBlock();
                } else {
                    codeBlock = true;
                    codeLanguage =
                        fence[1].trim();
                }

                continue;
            }


            if (codeBlock) {
                codeLines.push(line);
                continue;
            }


            if (!line.trim()) {
                closeParagraph();
                closeList();
                continue;
            }


            const heading =
                line.match(
                    /^(#{1,4})\s+(.+)$/
                );

            if (heading) {

                closeParagraph();
                closeList();

                const level =
                    heading[1].length;

                html +=
                    "<h" +
                    level +
                    ">" +
                    inlineMarkdown(
                        heading[2]
                    ) +
                    "</h" +
                    level +
                    ">";

                continue;
            }


            const ordered =
                line.match(
                    /^\s*(\d+)[.)]\s+(.+)$/
                );

            if (ordered) {

                closeParagraph();

                if (listType !== "ol") {

                    closeList();

                    html += "<ol>";
                    listType = "ol";
                }

                html +=
                    "<li>" +
                    inlineMarkdown(
                        ordered[2]
                    ) +
                    "</li>";

                continue;
            }


            const unordered =
                line.match(
                    /^\s*[-*+]\s+(.+)$/
                );

            if (unordered) {

                closeParagraph();

                if (listType !== "ul") {

                    closeList();

                    html += "<ul>";
                    listType = "ul";
                }

                html +=
                    "<li>" +
                    inlineMarkdown(
                        unordered[1]
                    ) +
                    "</li>";

                continue;
            }


            closeList();

            paragraph.push(
                line.trim()
            );
        }


        closeParagraph();
        closeList();

        if (codeBlock) {
            closeCodeBlock();
        }

        return html;
    }


    function renderMessageElement(element) {

        if (!element) {
            return;
        }

        if (
            element.dataset.studyanteMarkdown ===
            "true"
        ) {
            return;
        }

        const text =
            element.textContent || "";

        if (!text.trim()) {
            return;
        }

        element.innerHTML =
            renderMarkdown(text);

        element.dataset.studyanteMarkdown =
            "true";
    }


    function renderExistingMessages() {

        document
            .querySelectorAll(
                "#aiMessages .message.assistant .message-text"
            )
            .forEach(
                renderMessageElement
            );
    }


    function installObserver() {

        const aiMessages =
            document.getElementById(
                "aiMessages"
            );

        if (!aiMessages) {
            return;
        }


        renderExistingMessages();


        const observer =
            new MutationObserver(
                function (mutations) {

                    mutations.forEach(
                        function (mutation) {

                            mutation.addedNodes
                                .forEach(
                                    function (node) {

                                        if (
                                            node.nodeType !== 1
                                        ) {
                                            return;
                                        }


                                        if (
                                            node.matches &&
                                            node.matches(
                                                ".message.assistant .message-text"
                                            )
                                        ) {
                                            renderMessageElement(
                                                node
                                            );
                                        }


                                        if (
                                            node.querySelectorAll
                                        ) {

                                            node
                                                .querySelectorAll(
                                                    ".message.assistant .message-text"
                                                )
                                                .forEach(
                                                    renderMessageElement
                                                );
                                        }
                                    }
                                );


                            if (
                                mutation.type ===
                                "characterData"
                            ) {

                                const parent =
                                    mutation.target
                                        .parentElement;

                                if (
                                    parent &&
                                    parent.matches(
                                        ".message.assistant .message-text"
                                    )
                                ) {

                                    parent.dataset
                                        .studyanteMarkdown =
                                        "";

                                    renderMessageElement(
                                        parent
                                    );
                                }
                            }
                        }
                    );
                }
            );


        observer.observe(
            aiMessages,
            {
                childList: true,
                subtree: true,
                characterData: true
            }
        );
    }


    window.studyanteRenderMarkdown =
        renderMarkdown;


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            installObserver
        );

    } else {

        installObserver();
    }

})();