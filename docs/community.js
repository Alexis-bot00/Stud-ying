/* STUDYANTE_SAFE_COMMUNITY_JS */

(function () {

    "use strict";

    var communityLoaded = false;
    var communityIsAdmin = false;
    var communityObserver = null;


    function communityEscape(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    async function communityRead(response) {
        try {
            return await response.json();
        } catch {
            return {};
        }
    }


    function communityButton(text, className) {
        var button = document.createElement("button");

        button.type = "button";
        button.className = className || "secondary-btn";
        button.textContent = text;

        return button;
    }


    function communityStatus(status) {

        status = String(status || "private").toLowerCase();

        if (status === "pending") {
            return {
                text: "\u23F3 Pending",
                className: "community-pending"
            };
        }

        if (status === "approved") {
            return {
                text: "\u2705 Approved",
                className: "community-approved"
            };
        }

        if (status === "rejected") {
            return {
                text: "\u274C Rejected",
                className: "community-rejected"
            };
        }

        return {
            text: "\uD83D\uDD12 Private",
            className: "community-private"
        };
    }


    function showCommunityModal(title, bodyHTML) {

        var overlay =
            document.getElementById("communityModal");

        if (!overlay) {

            overlay = document.createElement("div");
            overlay.id = "communityModal";
            overlay.className = "community-modal-overlay";

            overlay.innerHTML =
                '<div class="community-modal">' +
                    '<div class="community-modal-header">' +
                        '<h2 id="communityModalTitle"></h2>' +
                        '<button type="button" id="communityModalClose" class="secondary-btn">Close</button>' +
                    '</div>' +
                    '<div id="communityModalBody" class="community-modal-body"></div>' +
                '</div>';

            document.body.appendChild(overlay);

            document
                .getElementById("communityModalClose")
                .addEventListener("click", function () {
                    overlay.classList.remove("open");
                    document.body.classList.remove("community-focus-active");
                });

            overlay.addEventListener("click", function (event) {
                if (event.target === overlay) {
                    overlay.classList.remove("open");
                    document.body.classList.remove("community-focus-active");
                }
            });
        }

        document.getElementById("communityModalTitle").textContent =
            title || "Community Notes";

        document.getElementById("communityModalBody").innerHTML =
            bodyHTML;

        overlay.classList.add("open");
    }


    async function submitCommunityItem(type, id, button) {

        if (!confirm("Submit this material for administrator approval?")) {
            return;
        }

        var oldText = button.textContent;

        button.disabled = true;
        button.textContent = "Submitting...";

        try {

            var response = await fetch(
                API_BASE +
                "/api/community/submit/" +
                encodeURIComponent(type) +
                "/" +
                encodeURIComponent(id),
                {
                    method: "POST"
                }
            );

            var data = await communityRead(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not submit material."
                );
            }

            alert("Submitted for approval.");

            if (typeof loadLibrary === "function") {
                await loadLibrary();
            }

            decorateLibrary();

        } catch (error) {

            alert(error.message);

        } finally {

            button.disabled = false;
            button.textContent = oldText;
        }
    }


    async function getOwnLibrary() {

        var response = await fetch(
            API_BASE + "/api/library"
        );

        var data = await communityRead(response);

        if (!response.ok || !data.success) {
            return {
                files: [],
                flashcardSets: []
            };
        }

        return {
            files: Array.isArray(data.files)
                ? data.files
                : [],

            flashcardSets: Array.isArray(data.flashcardSets)
                ? data.flashcardSets
                : []
        };
    }


    function findCardByTitle(title) {

        var cards =
            document.querySelectorAll(
                "#library .library-card"
            );

        for (var i = 0; i < cards.length; i++) {

            var heading =
                cards[i].querySelector("h3");

            if (
                heading &&
                heading.textContent.trim() ===
                    String(title || "").trim()
            ) {
                return cards[i];
            }
        }

        return null;
    }


    function addOwnerControls(card, item, type) {

        if (
            !card ||
            card.querySelector(".community-owner-controls")
        ) {
            return;
        }

        var info =
            communityStatus(item.communityStatus);

        var wrapper =
            document.createElement("div");

        wrapper.className =
            "community-owner-controls";

        var badge =
            document.createElement("span");

        badge.className =
            "community-badge " + info.className;

        badge.textContent =
            info.text;

        wrapper.appendChild(badge);

        var current =
            String(
                item.communityStatus || "private"
            ).toLowerCase();

        if (
            current === "private" ||
            current === "rejected"
        ) {

            var submit =
                communityButton(
                    current === "rejected"
                        ? "Submit Again"
                        : "Submit for Approval",
                    "secondary-btn"
                );

            submit.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();

                    submitCommunityItem(
                        type,
                        item.id,
                        submit
                    );
                }
            );

            wrapper.appendChild(submit);
        }

        card.appendChild(wrapper);
    }


    async function decorateLibrary() {

        var library =
            document.getElementById("library");

        if (!library) {
            return;
        }

        try {

            var data = await getOwnLibrary();

            data.files.forEach(function (item) {

                var card =
                    findCardByTitle(item.name);

                addOwnerControls(
                    card,
                    item,
                    "file"
                );
            });

            data.flashcardSets.forEach(function (item) {

                var card =
                    findCardByTitle(item.name);

                addOwnerControls(
                    card,
                    item,
                    "flashcards"
                );
            });

        } catch (error) {

            console.warn(
                "Community library decoration failed:",
                error
            );
        }
    }


    function watchLibrary() {

        var library =
            document.getElementById("library");

        if (!library || communityObserver) {
            return;
        }

        var timer = null;

        communityObserver =
            new MutationObserver(function () {

                clearTimeout(timer);

                timer = setTimeout(
                    decorateLibrary,
                    100
                );
            });

        communityObserver.observe(
            library,
            {
                childList: true,
                subtree: true
            }
        );

        decorateLibrary();
    }


    function createPublicFileCard(item) {

        var card =
            document.createElement("article");

        card.className =
            "community-card";

        card.innerHTML =
            '<span class="community-badge community-approved">Approved</span>' +
            '<h3>' +
                communityEscape(item.name || "Study Material") +
            '</h3>' +
            '<p>By ' +
                communityEscape(item.author || "STUDYante User") +
            '</p>' +
            '<div class="community-actions"></div>';

        var actions =
            card.querySelector(".community-actions");

        var view =
            communityButton(
                "View Material",
                "primary-btn"
            );

        view.addEventListener(
            "click",
            function () {
                viewCommunityFile(item);
            }
        );

        actions.appendChild(view);

        return card;
    }



    function openCommunityFlashcards(set, cards) {

        if (!Array.isArray(cards) || cards.length === 0) {
            showCommunityModal(
                set.name || "Flashcards",
                "<p>No flashcards available.</p>"
            );
            return;
        }

        var currentIndex = 0;
        var showingAnswer = false;

        showCommunityModal(
            set.name || "Flashcards",
            '<div class="community-study">' +

                '<div class="community-study-progress">' +
                    '<span id="communityCardCounter"></span>' +
                    '<button type="button" id="communityExpandCard" class="community-expand-btn">' +
                        'Expand' +
                    '</button>' +
                '</div>' +

                '<button type="button" id="communityStudyCard" class="community-study-card">' +

                    '<span id="communityCardSide" class="community-card-side">' +
                        'QUESTION' +
                    '</span>' +

                    '<div id="communityCardText" class="community-card-text"></div>' +

                    '<small class="community-flip-hint">' +
                        'Click the card to reveal the answer' +
                    '</small>' +

                '</button>' +

                '<div class="community-study-controls">' +

                    '<button type="button" id="communityPreviousCard" class="secondary-btn">' +
                        'Previous' +
                    '</button>' +

                    '<button type="button" id="communityFlipCard" class="primary-btn">' +
                        'Show Answer' +
                    '</button>' +

                    '<button type="button" id="communityNextCard" class="secondary-btn">' +
                        'Next' +
                    '</button>' +

                '</div>' +

            '</div>'
        );

        var card =
            document.getElementById("communityStudyCard");

        var cardText =
            document.getElementById("communityCardText");

        var cardSide =
            document.getElementById("communityCardSide");

        var counter =
            document.getElementById("communityCardCounter");

        var previous =
            document.getElementById("communityPreviousCard");

        var next =
            document.getElementById("communityNextCard");

        var flip =
            document.getElementById("communityFlipCard");

        var expand =
            document.getElementById("communityExpandCard");

        var studyContainer =
            card.closest(".community-study");


        function setFocusMode(enabled) {

            if (!studyContainer) {
                return;
            }

            if (enabled) {

                studyContainer.classList.add(
                    "community-focus-mode"
                );

                document.body.classList.add(
                    "community-focus-active"
                );

                expand.textContent =
                    "Exit Focus";

            } else {

                studyContainer.classList.remove(
                    "community-focus-mode"
                );

                document.body.classList.remove(
                    "community-focus-active"
                );

                expand.textContent =
                    "Expand";
            }
        }


        expand.addEventListener(
            "click",
            function () {

                var enabled =
                    !studyContainer.classList.contains(
                        "community-focus-mode"
                    );

                setFocusMode(enabled);
            }
        );


        function renderCard() {

            var flashcard =
                cards[currentIndex] || {};

            counter.textContent =
                (currentIndex + 1) +
                " / " +
                cards.length;

            if (showingAnswer) {

                cardSide.textContent =
                    "ANSWER";

                cardText.textContent =
                    flashcard.answer ||
                    "No answer provided.";

                flip.textContent =
                    "Show Question";

                card.classList.add(
                    "showing-answer"
                );

            } else {

                cardSide.textContent =
                    "QUESTION";

                cardText.textContent =
                    flashcard.question ||
                    "No question provided.";

                flip.textContent =
                    "Show Answer";

                card.classList.remove(
                    "showing-answer"
                );
            }

            previous.disabled =
                currentIndex === 0;

            next.disabled =
                currentIndex ===
                cards.length - 1;
        }


        function toggleCard() {

            showingAnswer =
                !showingAnswer;

            renderCard();
        }


        card.addEventListener(
            "click",
            toggleCard
        );

        flip.addEventListener(
            "click",
            toggleCard
        );


        previous.addEventListener(
            "click",
            function () {

                if (currentIndex > 0) {

                    currentIndex--;
                    showingAnswer = false;

                    renderCard();
                }
            }
        );


        next.addEventListener(
            "click",
            function () {

                if (
                    currentIndex <
                    cards.length - 1
                ) {

                    currentIndex++;
                    showingAnswer = false;

                    renderCard();
                }
            }
        );


        document.addEventListener(
            "keydown",
            function communityFlashcardKeys(event) {

                var modal =
                    document.getElementById(
                        "communityModal"
                    );

                if (
                    !modal ||
                    !modal.classList.contains("open")
                ) {

                    document.removeEventListener(
                        "keydown",
                        communityFlashcardKeys
                    );

                    return;
                }


                if (event.key === "Escape") {

                    if (
                        studyContainer &&
                        studyContainer.classList.contains(
                            "community-focus-mode"
                        )
                    ) {

                        event.preventDefault();
                        setFocusMode(false);
                        return;
                    }
                }


                if (
                    event.key === " " ||
                    event.key === "Enter"
                ) {

                    event.preventDefault();
                    toggleCard();
                }


                if (
                    event.key === "ArrowRight" &&
                    currentIndex <
                    cards.length - 1
                ) {

                    currentIndex++;
                    showingAnswer = false;

                    renderCard();
                }


                if (
                    event.key === "ArrowLeft" &&
                    currentIndex > 0
                ) {

                    currentIndex--;
                    showingAnswer = false;

                    renderCard();
                }
            }
        );


        renderCard();
    }

    function createPublicFlashcardCard(set) {

        var card =
            document.createElement("article");

        card.className =
            "community-card";

        var cards =
            Array.isArray(set.flashcards)
                ? set.flashcards
                : [];

        card.innerHTML =
            '<span class="community-badge community-approved">Approved</span>' +
            '<h3>' +
                communityEscape(set.name || "Flashcards") +
            '</h3>' +
            '<p>' +
                cards.length +
                ' flashcard' +
                (cards.length === 1 ? '' : 's') +
            '</p>' +
            '<p>By ' +
                communityEscape(set.author || "STUDYante User") +
            '</p>' +
            '<div class="community-actions"></div>';

        var actions =
            card.querySelector(".community-actions");

        var study =
            communityButton(
                "Study",
                "primary-btn"
            );

        study.addEventListener(
            "click",
            function () {

                openCommunityFlashcards(
                    set,
                    cards
                );
            }
        );

        var save =
            communityButton(
                "Save Copy",
                "secondary-btn"
            );

        save.addEventListener(
            "click",
            function () {
                saveCommunityFlashcards(
                    set,
                    save
                );
            }
        );

        actions.appendChild(study);
        actions.appendChild(save);

        return card;
    }


    async function viewCommunityFile(item) {

        try {

            var response = await fetch(
                API_BASE +
                "/api/community/file/" +
                encodeURIComponent(item.id) +
                "/content"
            );

            var data =
                await communityRead(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Could not open material."
                );
            }

            var material =
                data.material || {};

            showCommunityModal(
                material.name || "Study Material",

                '<p><strong>By ' +
                    communityEscape(
                        material.author ||
                        "STUDYante User"
                    ) +
                '</strong></p>' +

                '<div class="community-note-text">' +
                    communityEscape(
                        material.text ||
                        "No readable text is available."
                    ) +
                '</div>'
            );

        } catch (error) {

            alert(error.message);
        }
    }


    async function saveCommunityFlashcards(
        set,
        button
    ) {

        var oldText =
            button.textContent;

        button.disabled = true;
        button.textContent = "Saving...";

        try {

            var response = await fetch(
                API_BASE +
                "/api/community/flashcards/" +
                encodeURIComponent(set.id) +
                "/copy",
                {
                    method: "POST"
                }
            );

            var data =
                await communityRead(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Could not save copy."
                );
            }

            alert(
                "Saved privately to My Library."
            );

            if (typeof loadLibrary === "function") {
                await loadLibrary();
            }

        } catch (error) {

            alert(error.message);

        } finally {

            button.disabled = false;
            button.textContent = oldText;
        }
    }


    async function loadCommunity() {

        var grid =
            document.getElementById(
                "communityGrid"
            );

        var status =
            document.getElementById(
                "communityStatus"
            );

        if (!grid || !status) {
            return;
        }

        grid.innerHTML = "";

        status.hidden = false;
        status.textContent =
            "Loading community materials...";

        try {

            var responses =
                await Promise.all([
                    fetch(
                        API_BASE +
                        "/api/community"
                    ),

                    fetch(
                        API_BASE +
                        "/api/community/status"
                    )
                ]);

            var community =
                await communityRead(
                    responses[0]
                );

            var account =
                await communityRead(
                    responses[1]
                );

            if (
                !responses[0].ok ||
                !community.success
            ) {
                throw new Error(
                    community.message ||
                    "Could not load Community Notes."
                );
            }

            communityIsAdmin =
                Boolean(
                    responses[1].ok &&
                    account.isAdmin
                );

            var files =
                Array.isArray(community.files)
                    ? community.files
                    : [];

            var sets =
                Array.isArray(
                    community.flashcardSets
                )
                    ? community.flashcardSets
                    : [];

            if (
                files.length === 0 &&
                sets.length === 0
            ) {

                status.hidden = false;
                status.textContent =
                    "No approved community materials yet.";

            } else {

                status.hidden = true;

                files.forEach(function (item) {
                    grid.appendChild(
                        createPublicFileCard(item)
                    );
                });

                sets.forEach(function (set) {
                    grid.appendChild(
                        createPublicFlashcardCard(set)
                    );
                });
            }

            var admin =
                document.getElementById(
                    "communityAdmin"
                );

            if (admin) {
                admin.hidden =
                    !communityIsAdmin;
            }

            if (communityIsAdmin) {
                await loadPendingCommunity();
            }

            communityLoaded = true;

        } catch (error) {

            status.hidden = false;
            status.textContent =
                "Community Notes error: " +
                error.message;
        }
    }


    async function loadPendingCommunity() {

        var grid =
            document.getElementById(
                "communityPendingGrid"
            );

        var status =
            document.getElementById(
                "communityPendingStatus"
            );

        if (!grid || !status) {
            return;
        }

        grid.innerHTML = "";

        status.hidden = false;
        status.textContent =
            "Loading pending submissions...";

        try {

            var response = await fetch(
                API_BASE +
                "/api/admin/community/pending"
            );

            var data =
                await communityRead(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Could not load pending submissions."
                );
            }

            var pending = [];

            (data.files || []).forEach(function (item) {
                pending.push({
                    type: "file",
                    item: item
                });
            });

            (data.flashcardSets || []).forEach(function (item) {
                pending.push({
                    type: "flashcards",
                    item: item
                });
            });

            if (!pending.length) {

                status.hidden = false;
                status.textContent =
                    "No materials are waiting for approval.";

                return;
            }

            status.hidden = true;

            pending.forEach(function (entry) {

                var item = entry.item;

                var card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "community-card";

                var author =
                    item.author || {};

                card.innerHTML =
                    '<span class="community-badge community-pending">Pending</span>' +
                    '<h3>' +
                        communityEscape(
                            item.name || "Untitled"
                        ) +
                    '</h3>' +
                    '<p>By ' +
                        communityEscape(
                            author.name || "Unknown User"
                        ) +
                    '</p>' +
                    '<div class="community-actions"></div>';

                var actions =
                    card.querySelector(
                        ".community-actions"
                    );

                var approve =
                    communityButton(
                        "Approve",
                        "primary-btn"
                    );

                var reject =
                    communityButton(
                        "Reject",
                        "secondary-btn"
                    );

                approve.addEventListener(
                    "click",
                    function () {
                        reviewCommunity(
                            entry.type,
                            item.id,
                            "approve"
                        );
                    }
                );

                reject.addEventListener(
                    "click",
                    function () {
                        reviewCommunity(
                            entry.type,
                            item.id,
                            "reject"
                        );
                    }
                );

                actions.appendChild(approve);
                actions.appendChild(reject);

                grid.appendChild(card);
            });

        } catch (error) {

            status.hidden = false;
            status.textContent =
                "Admin Review error: " +
                error.message;
        }
    }


    async function reviewCommunity(
        type,
        id,
        action
    ) {

        if (
            !confirm(
                "Are you sure you want to " +
                action +
                " this material?"
            )
        ) {
            return;
        }

        try {

            var response = await fetch(
                API_BASE +
                "/api/admin/community/" +
                encodeURIComponent(type) +
                "/" +
                encodeURIComponent(id) +
                "/" +
                action,
                {
                    method: "POST"
                }
            );

            var data =
                await communityRead(response);

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Could not review material."
                );
            }

            alert(
                action === "approve"
                    ? "Material approved."
                    : "Material rejected."
            );

            await loadCommunity();

        } catch (error) {

            alert(error.message);
        }
    }


    function startCommunity() {

        watchLibrary();

        var refresh =
            document.getElementById(
                "refreshCommunity"
            );

        if (refresh) {
            refresh.addEventListener(
                "click",
                loadCommunity
            );
        }

        var refreshPending =
            document.getElementById(
                "refreshPendingCommunity"
            );

        if (refreshPending) {
            refreshPending.addEventListener(
                "click",
                loadPendingCommunity
            );
        }

        document.addEventListener(
            "click",
            function (event) {

                var communityLink =
                    event.target.closest(
                        '[data-page="community"]'
                    );

                if (communityLink) {

                    setTimeout(
                        loadCommunity,
                        50
                    );
                }

                var libraryLink =
                    event.target.closest(
                        '[data-page="library"]'
                    );

                if (libraryLink) {

                    setTimeout(
                        decorateLibrary,
                        150
                    );
                }
            },
            true
        );

        if (
            window.location.hash ===
            "#community"
        ) {
            setTimeout(
                loadCommunity,
                100
            );
        }
    }


    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            startCommunity
        );
    } else {
        startCommunity();
    }


    window.loadStudyanteCommunity =
        loadCommunity;

})();