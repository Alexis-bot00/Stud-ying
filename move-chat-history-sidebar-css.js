const fs = require("fs");

const file =
    "./docs/style.css";

let css =
    fs
        .readFileSync(
            file,
            "utf8"
        )
        .replace(
            /\r\n/g,
            "\n"
        );


if (
    !css.includes(
        "STUDYante SIDEBAR CHAT HISTORY"
    )
) {

css += `


/* =========================================================
   STUDYante SIDEBAR CHAT HISTORY
========================================================= */

@media (min-width: 801px) {

    .sidebar {
        display: flex !important;
        flex-direction: column !important;

        overflow: hidden;
    }

    .sidebar nav {
        flex-shrink: 0;
    }

    .sidebar-chat-history {
        min-height: 0;

        margin-top: 24px;
        padding-top: 16px;

        border-top: 1px solid var(--border);

        display: flex;
        flex: 1;
        flex-direction: column;

        overflow: hidden;
    }

    .sidebar-chat-history .chat-history-panel {
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;

        height: 100% !important;
        max-height: none !important;

        padding: 0 !important;

        border: 0 !important;
        border-radius: 0 !important;

        background: transparent !important;
        box-shadow: none !important;

        display: flex !important;
        flex-direction: column !important;

        overflow: hidden !important;
    }

    .sidebar-chat-history .chat-history-header {
        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 6px;

        margin-bottom: 8px;
    }

    .sidebar-chat-history .chat-history-header h3 {
        margin: 0;

        font-size: 13px;
        font-weight: 700;

        color: var(--text);
    }

    .sidebar-chat-history .new-chat-btn {
        width: auto !important;
        min-width: 0 !important;

        padding: 7px 9px !important;

        border-radius: 8px !important;

        font-size: 11px !important;
        white-space: nowrap;
    }

    .sidebar-chat-history .chat-history-list {
        min-height: 0;

        flex: 1;

        overflow-y: auto;
        overflow-x: hidden;

        padding-right: 3px;
    }

    .sidebar-chat-history .chat-history-item {
        min-width: 0;
    }

    .sidebar-chat-history .chat-history-row {
        min-width: 0;
    }

    .sidebar-chat-history .chat-history-title {
        min-width: 0;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        font-size: 12px;
    }

    .sidebar-chat-history .chat-delete-btn {
        flex-shrink: 0;
    }

    /*
       AI area no longer needs a history column.
    */

    #ai .ai-chat-layout {
        display: block !important;
        width: 100% !important;
    }

    #ai .chat-main {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
    }
}


/*
   On tablet/mobile the main sidebar becomes
   top navigation, so keep history out of that
   navigation area.
*/

@media (max-width: 800px) {

    .sidebar-chat-history {
        display: none !important;
    }

    #ai .ai-chat-layout {
        display: block !important;
        width: 100% !important;
    }

    #ai .chat-main {
        width: 100% !important;
        max-width: 100% !important;
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
    "Sidebar Chat History CSS added."
);
