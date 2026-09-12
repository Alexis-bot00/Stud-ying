const fs = require("fs");

const file = "./docs/style.css";

let css = fs
    .readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n");

if (!css.includes("STUDYante INLINE AI INPUT BAR")) {

css += `


/* =========================================================
   STUDYante INLINE AI INPUT BAR
========================================================= */

#ai .chat-input {
    width: 100% !important;
    min-height: 64px !important;

    display: flex !important;
    align-items: center !important;

    gap: 8px !important;

    padding: 8px 10px !important;

    border: 1px solid var(--border) !important;
    border-radius: 22px !important;

    background: #ffffff !important;

    box-shadow:
        0 1px 4px rgba(0, 0, 0, 0.04) !important;
}


/* + button inside bar */

#ai .ai-attach-wrap {
    position: relative !important;

    display: flex !important;
    align-items: center !important;

    flex: 0 0 auto !important;
}

#ai .ai-attach-btn {
    width: 42px !important;
    min-width: 42px !important;
    height: 42px !important;

    margin: 0 !important;
    padding: 0 !important;

    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    border: 0 !important;
    border-radius: 50% !important;

    background: transparent !important;

    font-size: 30px !important;
    font-weight: 300 !important;
    line-height: 1 !important;

    box-shadow: none !important;
}

#ai .ai-attach-btn:hover {
    background: #f2f3f5 !important;
}


/* Text area */

#ai .chat-input textarea,
#ai #question {
    flex: 1 1 auto !important;

    width: auto !important;
    min-width: 0 !important;

    min-height: 44px !important;
    max-height: 160px !important;

    margin: 0 !important;
    padding: 10px 6px !important;

    border: 0 !important;
    outline: 0 !important;

    background: transparent !important;

    box-shadow: none !important;

    resize: none !important;

    font: inherit !important;
    line-height: 24px !important;
}


/* Send button inside bar */

#ai .chat-input #askButton {
    flex: 0 0 auto !important;

    min-width: 82px !important;
    height: 44px !important;

    margin: 0 !important;
    padding: 0 18px !important;

    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    border-radius: 14px !important;

    align-self: center !important;
}


/* Keep attachment popup above + */

#ai .ai-attach-menu {
    left: 0 !important;
    bottom: calc(100% + 14px) !important;
}


/* Mobile */

@media (max-width: 600px) {

    #ai .chat-input {
        flex-direction: row !important;
        align-items: center !important;

        min-height: 58px !important;

        gap: 4px !important;

        padding: 6px 7px !important;

        border-radius: 20px !important;
    }

    #ai .ai-attach-btn {
        width: 38px !important;
        min-width: 38px !important;
        height: 38px !important;

        font-size: 27px !important;
    }

    #ai .chat-input textarea,
    #ai #question {
        min-height: 40px !important;

        padding: 8px 4px !important;

        font-size: 16px !important;
    }

    #ai .chat-input #askButton {
        min-width: 64px !important;
        height: 40px !important;

        padding: 0 12px !important;

        border-radius: 13px !important;
    }
}

`;

fs.writeFileSync(
    file,
    css,
    "utf8"
);

}

console.log(
    "STUDYante AI input bar updated."
);
