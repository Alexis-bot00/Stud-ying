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

        /* STUDYANTE_COMMUNITY_SWIPE_STATE */
        var communityRatings =
            new Array(cards.length).fill(null);

        var communitySwipeBusy = false;

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


        /* =====================================================
           STUDYANTE_COMMUNITY_SWIPE_FUNCTIONS
           ===================================================== */

        function showCommunityFlashcardResults() {

            var known =
                communityRatings.filter(
                    function (rating) {
                        return rating === "known";
                    }
                ).length;

            var learning =
                communityRatings.filter(
                    function (rating) {
                        return rating === "learning";
                    }
                ).length;

            var mastery =
                cards.length
                    ? Math.round(
                        (known / cards.length) * 100
                    )
                    : 0;

            card.style.transform = "";
            card.style.opacity = "";

            studyContainer.innerHTML =
                '<div class="community-flashcard-result">' +

                    '<div class="community-result-icon">?</div>' +

                    '<h2>Flashcard Result</h2>' +

                    '<div class="community-result-score">' +
                        mastery +
                        '%' +
                    '</div>' +

                    '<p class="community-result-label">Mastery</p>' +

                    '<div class="community-result-stats">' +

                        '<div>' +
                            '<strong>' +
                                known +
                            '</strong>' +
                            '<span>Know It</span>' +
                        '</div>' +

                        '<div>' +
                            '<strong>' +
                                learning +
                            '</strong>' +
                            '<span>Still Learning</span>' +
                        '</div>' +

                    '</div>' +

                    '<button type="button" ' +
                        'id="communityStudyAgain" ' +
                        'class="primary-btn">' +
                        'Study Again' +
                    '</button>' +

                '</div>';

            var studyAgain =
                document.getElementById(
                    "communityStudyAgain"
                );

            if (studyAgain) {

                studyAgain.addEventListener(
                    "click",
                    function () {

                        openCommunityFlashcards(
                            set,
                            cards
                        );
                    }
                );
            }
        }


        function rateCommunityCard(knows) {

            if (communitySwipeBusy) {
                return;
            }

            communitySwipeBusy = true;

            communityRatings[currentIndex] =
                knows
                    ? "known"
                    : "learning";

            card.classList.remove(
                "community-swipe-known",
                "community-swipe-learning"
            );

            card.classList.add(
                knows
                    ? "community-swipe-out-right"
                    : "community-swipe-out-left"
            );

            window.setTimeout(
                function () {

                    var complete =
                        communityRatings.every(
                            function (rating) {
                                return rating !== null;
                            }
                        );

                    if (complete) {

                        showCommunityFlashcardResults();
                        return;
                    }

                    var nextIndex = -1;

                    for (
                        var offset = 1;
                        offset <= cards.length;
                        offset++
                    ) {

                        var candidate =
                            (currentIndex + offset) %
                            cards.length;

                        if (
                            communityRatings[candidate] ===
                            null
                        ) {
                            nextIndex = candidate;
                            break;
                        }
                    }

                    if (nextIndex >= 0) {
                        currentIndex = nextIndex;
                    }

                    showingAnswer = false;

                    card.classList.remove(
                        "community-swipe-out-right",
                        "community-swipe-out-left"
                    );

                    card.style.transform = "";
                    card.style.opacity = "";

                    communitySwipeBusy = false;

                    renderCard();

                },
                250
            );
        }

        function toggleCard() {

            showingAnswer =
                !showingAnswer;

            renderCard();
        }


        /* =====================================================
           STUDYANTE_COMMUNITY_POINTER_SWIPE
           Tap = reveal
           Left = Still Learning
           Right = Know It
           ===================================================== */

        var communityPointerDown = false;
        var communityPointerId = null;
        var communityStartX = 0;
        var communityStartY = 0;
        var communityDeltaX = 0;
        var communityDeltaY = 0;


        card.addEventListener(
            "pointerdown",
            function (event) {

                if (communitySwipeBusy) {
                    return;
                }

                communityPointerDown = true;
                communityPointerId =
                    event.pointerId;

                communityStartX =
                    event.clientX;

                communityStartY =
                    event.clientY;

                communityDeltaX = 0;
                communityDeltaY = 0;

                try {
                    card.setPointerCapture(
                        event.pointerId
                    );
                } catch (error) {
                }

                card.classList.add(
                    "community-swipe-dragging"
                );
            }
        );


        card.addEventListener(
            "pointermove",
            function (event) {

                if (
                    !communityPointerDown ||
                    event.pointerId !==
                        communityPointerId
                ) {
                    return;
                }

                communityDeltaX =
                    event.clientX -
                    communityStartX;

                communityDeltaY =
                    event.clientY -
                    communityStartY;

                if (
                    Math.abs(communityDeltaX) <=
                    Math.abs(communityDeltaY)
                ) {
                    return;
                }

                event.preventDefault();

                var rotation =
                    communityDeltaX / 35;

                card.style.transform =
                    "translateX(" +
                    communityDeltaX +
                    "px) rotate(" +
                    rotation +
                    "deg)";

                card.classList.toggle(
                    "community-swipe-known",
                    communityDeltaX > 35
                );

                card.classList.toggle(
                    "community-swipe-learning",
                    communityDeltaX < -35
                );
            }
        );


        function finishCommunitySwipe(event) {

            if (
                !communityPointerDown ||
                event.pointerId !==
                    communityPointerId
            ) {
                return;
            }

            communityPointerDown = false;

            card.classList.remove(
                "community-swipe-dragging"
            );

            try {
                card.releasePointerCapture(
                    event.pointerId
                );
            } catch (error) {
            }

            var horizontal =
                Math.abs(communityDeltaX) >
                Math.abs(communityDeltaY);

            if (
                horizontal &&
                Math.abs(communityDeltaX) >= 90
            ) {

                rateCommunityCard(
                    communityDeltaX > 0
                );

                return;
            }

            card.style.transform = "";

            card.classList.remove(
                "community-swipe-known",
                "community-swipe-learning"
            );

            if (
                Math.abs(communityDeltaX) < 10 &&
                Math.abs(communityDeltaY) < 10
            ) {
                toggleCard();
            }
        }


        card.addEventListener(
            "pointerup",
            finishCommunitySwipe
        );

        card.addEventListener(
            "pointercancel",
            function (event) {

                if (
                    event.pointerId !==
                    communityPointerId
                ) {
                    return;
                }

                communityPointerDown = false;

                card.style.transform = "";

                card.classList.remove(
                    "community-swipe-dragging",
                    "community-swipe-known",
                    "community-swipe-learning"
                );
            }
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


    /* STUDYANTE_USER_SEARCH_PROFILES_START */


    function communityPublicInitial(name) {

        var value =
            String(
                name ||
                "S"
            )
                .trim();

        return value
            ? value.charAt(0).toUpperCase()
            : "S";
    }


    async function searchCommunityUsers() {

        var input =
            document.getElementById(
                "communityUserSearchInput"
            );

        var results =
            document.getElementById(
                "communityUserResults"
            );

        var status =
            document.getElementById(
                "communityUserSearchStatus"
            );


        if (!input || !results || !status) {
            return;
        }


        var query =
            String(
                input.value || ""
            ).trim();


        results.innerHTML = "";

        status.hidden = false;

        status.textContent =
            query
                ? "Searching students..."
                : "Loading students...";


        try {

            var url =
                API_BASE +
                "/api/community/users";

            if (query) {

                url +=
                    "?q=" +
                    encodeURIComponent(
                        query
                    );
            }


            var response =
                await fetch(url);

            var data =
                await communityRead(
                    response
                );


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Could not search students."
                );
            }


            var users =
                Array.isArray(data.users)
                    ? data.users
                    : [];


            if (!users.length) {

                status.hidden =
                    false;

                status.textContent =
                    query
                        ? "No students found."
                        : "No students have shared materials yet.";

                return;
            }


            status.hidden =
                true;


            users.forEach(
                function (user) {

                    var card =
                        document.createElement(
                            "button"
                        );

                    card.type =
                        "button";

                    card.className =
                        "community-user-card";


                    var initial =
                        communityPublicInitial(
                            user.name
                        );


                    var avatarHTML =
                        user.profilePicture
                            ? '<span class="community-user-avatar"><img src="' +
                                communityEscape(
                                    user.profilePicture
                                ) +
                                '" alt=""></span>'
                            : '<span class="community-user-avatar">' +
                                communityEscape(initial) +
                                '</span>';


                    card.innerHTML =
                        avatarHTML +

                        '<span class="community-user-info">' +

                            '<strong>' +
                                communityEscape(
                                    user.name ||
                                    "STUDYante User"
                                ) +
                            '</strong>' +

                            '<small>' +
                                Number(
                                    user.notesCount || 0
                                ) +
                                ' note' +
                                (
                                    Number(
                                        user.notesCount || 0
                                    ) === 1
                                        ? ''
                                        : 's'
                                ) +
                                ' � ' +
                                Number(
                                    user.flashcardsCount || 0
                                ) +
                                ' flashcard set' +
                                (
                                    Number(
                                        user.flashcardsCount || 0
                                    ) === 1
                                        ? ''
                                        : 's'
                                ) +
                            '</small>' +

                        '</span>' +

                        '<span class="community-user-open">' +
                            'View Profile' +
                        '</span>';


                    card.addEventListener(
                        "click",
                        function () {

                            openCommunityUserProfile(
                                user.id
                            );
                        }
                    );


                    results.appendChild(
                        card
                    );
                }
            );


        } catch (error) {

            status.hidden =
                false;

            status.textContent =
                "Search error: " +
                error.message;
        }
    }



    async function openCommunityUserProfile(
        userId
    ) {

        try {

            var response =
                await fetch(
                    API_BASE +
                    "/api/community/users/" +
                    encodeURIComponent(
                        userId
                    )
                );


            var data =
                await communityRead(
                    response
                );


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Could not open user profile."
                );
            }


            var user =
                data.user || {};

            var files =
                Array.isArray(
                    data.files
                )
                    ? data.files
                    : [];

            var sets =
                Array.isArray(
                    data.flashcardSets
                )
                    ? data.flashcardSets
                    : [];


            var total =
                files.length +
                sets.length;


            var html =
                '<div class="community-public-profile">' +

                    '<div class="community-profile-header">' +

                        (
                            user.profilePicture
                                ? '<div class="community-profile-avatar"><img src="' +
                                    communityEscape(
                                        user.profilePicture
                                    ) +
                                    '" alt=""></div>'
                                : '<div class="community-profile-avatar">' +
                                    communityEscape(
                                        communityPublicInitial(
                                            user.name
                                        )
                                    ) +
                                    '</div>'
                        ) +

                        '<div>' +

                            '<h3>' +
                                communityEscape(
                                    user.name ||
                                    "STUDYante User"
                                ) +
                            '</h3>' +

                            '<p>' +
                                total +
                                ' shared material' +
                                (
                                    total === 1
                                        ? ''
                                        : 's'
                                ) +
                            '</p>' +

                        '</div>' +

                    '</div>' +

                    '<div class="community-profile-sections">' +

                        '<section>' +

                            '<h3>Shared Notes</h3>' +

                            '<div id="communityProfileNotes" class="community-profile-materials"></div>' +

                        '</section>' +

                        '<section>' +

                            '<h3>Shared Flashcards</h3>' +

                            '<div id="communityProfileFlashcards" class="community-profile-materials"></div>' +

                        '</section>' +

                    '</div>' +

                '</div>';


            showCommunityModal(
                user.name ||
                    "Student Profile",
                html
            );


            var notesContainer =
                document.getElementById(
                    "communityProfileNotes"
                );

            var flashcardsContainer =
                document.getElementById(
                    "communityProfileFlashcards"
                );


            if (notesContainer) {

                if (!files.length) {

                    notesContainer.innerHTML =
                        '<p class="community-profile-empty">' +
                            'No shared notes.' +
                        '</p>';

                } else {

                    files.forEach(
                        function (item) {

                            var row =
                                document.createElement(
                                    "article"
                                );

                            row.className =
                                "community-profile-material";


                            row.innerHTML =
                                '<div>' +

                                    '<strong>' +
                                        communityEscape(
                                            item.name ||
                                            "Study Notes"
                                        ) +
                                    '</strong>' +

                                    '<small>Shared Note</small>' +

                                '</div>';


                            var button =
                                communityButton(
                                    "Open",
                                    "primary-btn"
                                );


                            button.addEventListener(
                                "click",
                                function () {

                                    viewCommunityFile(
                                        item
                                    );
                                }
                            );


                            row.appendChild(
                                button
                            );

                            notesContainer.appendChild(
                                row
                            );
                        }
                    );
                }
            }


            if (flashcardsContainer) {

                if (!sets.length) {

                    flashcardsContainer.innerHTML =
                        '<p class="community-profile-empty">' +
                            'No shared flashcards.' +
                        '</p>';

                } else {

                    sets.forEach(
                        function (set) {

                            var cards =
                                Array.isArray(
                                    set.flashcards
                                )
                                    ? set.flashcards
                                    : [];


                            var row =
                                document.createElement(
                                    "article"
                                );

                            row.className =
                                "community-profile-material";


                            var info =
                                document.createElement(
                                    "div"
                                );


                            info.innerHTML =
                                '<strong>' +
                                    communityEscape(
                                        set.name ||
                                        "Flashcards"
                                    ) +
                                '</strong>' +

                                '<small>' +
                                    cards.length +
                                    ' card' +
                                    (
                                        cards.length === 1
                                            ? ''
                                            : 's'
                                    ) +
                                '</small>';


                            var actions =
                                document.createElement(
                                    "div"
                                );

                            actions.className =
                                "community-profile-actions";


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


                            actions.appendChild(
                                study
                            );

                            actions.appendChild(
                                save
                            );

                            row.appendChild(
                                info
                            );

                            row.appendChild(
                                actions
                            );

                            flashcardsContainer.appendChild(
                                row
                            );
                        }
                    );
                }
            }


        } catch (error) {

            alert(
                error.message
            );
        }
    }



    function installCommunityUserSearch() {

        var input =
            document.getElementById(
                "communityUserSearchInput"
            );

        var button =
            document.getElementById(
                "communityUserSearchButton"
            );


        if (
            button &&
            !button.dataset.studyanteSearchReady
        ) {

            button.dataset.studyanteSearchReady =
                "true";

            button.addEventListener(
                "click",
                searchCommunityUsers
            );
        }


        if (
            input &&
            !input.dataset.studyanteSearchReady
        ) {

            input.dataset.studyanteSearchReady =
                "true";


            input.addEventListener(
                "keydown",
                function (event) {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        searchCommunityUsers();
                    }
                }
            );


            var timer = null;

            input.addEventListener(
                "input",
                function () {

                    clearTimeout(
                        timer
                    );

                    timer =
                        setTimeout(
                            searchCommunityUsers,
                            350
                        );
                }
            );
        }
    }


    document.addEventListener(
        "DOMContentLoaded",
        function () {

            installCommunityUserSearch();
        }
    );


    if (
        document.readyState !==
        "loading"
    ) {

        installCommunityUserSearch();
    }


    /* STUDYANTE_USER_SEARCH_PROFILES_END */


    /* STUDYANTE_GLOBAL_SEARCH_BEHAVIOR_START */

    function studyanteGlobalSearchPanel() {

        return document.getElementById(
            "communityUserSearchPanel"
        );
    }


    function studyanteOpenGlobalSearchPanel() {

        var panel =
            studyanteGlobalSearchPanel();

        if (panel) {
            panel.hidden = false;
        }
    }


    function studyanteCloseGlobalSearchPanel() {

        var panel =
            studyanteGlobalSearchPanel();

        if (panel) {
            panel.hidden = true;
        }
    }


    function installStudyanteGlobalSearchBehavior() {

        var root =
            document.getElementById(
                "studyanteGlobalSearch"
            );

        var input =
            document.getElementById(
                "communityUserSearchInput"
            );

        var button =
            document.getElementById(
                "communityUserSearchButton"
            );

        var results =
            document.getElementById(
                "communityUserResults"
            );


        if (
            input &&
            !input.dataset.studyanteGlobalPanelReady
        ) {

            input.dataset.studyanteGlobalPanelReady =
                "true";


            input.addEventListener(
                "focus",
                function () {

                    if (
                        String(
                            input.value || ""
                        ).trim()
                    ) {

                        studyanteOpenGlobalSearchPanel();
                    }
                }
            );


            input.addEventListener(
                "input",
                function () {

                    studyanteOpenGlobalSearchPanel();
                }
            );
        }


        if (
            button &&
            !button.dataset.studyanteGlobalPanelReady
        ) {

            button.dataset.studyanteGlobalPanelReady =
                "true";

            button.addEventListener(
                "click",
                function () {

                    studyanteOpenGlobalSearchPanel();
                }
            );
        }


        if (
            results &&
            !results.dataset.studyanteGlobalPanelReady
        ) {

            results.dataset.studyanteGlobalPanelReady =
                "true";

            results.addEventListener(
                "click",
                function () {

                    setTimeout(
                        studyanteCloseGlobalSearchPanel,
                        150
                    );
                }
            );
        }


        if (
            !document.documentElement.dataset
                .studyanteGlobalSearchOutsideReady
        ) {

            document.documentElement.dataset
                .studyanteGlobalSearchOutsideReady =
                "true";


            document.addEventListener(
                "click",
                function (event) {

                    var currentRoot =
                        document.getElementById(
                            "studyanteGlobalSearch"
                        );

                    if (
                        currentRoot &&
                        !currentRoot.contains(
                            event.target
                        )
                    ) {

                        studyanteCloseGlobalSearchPanel();
                    }
                }
            );


            document.addEventListener(
                "keydown",
                function (event) {

                    if (
                        event.key ===
                        "Escape"
                    ) {

                        studyanteCloseGlobalSearchPanel();
                    }
                }
            );
        }
    }


    document.addEventListener(
        "DOMContentLoaded",
        installStudyanteGlobalSearchBehavior
    );


    if (
        document.readyState !==
        "loading"
    ) {

        installStudyanteGlobalSearchBehavior();
    }

    /* STUDYANTE_GLOBAL_SEARCH_BEHAVIOR_END */

})();
