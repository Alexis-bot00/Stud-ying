const fs = require("fs");

const file = "./docs/style.css";
let css = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

if (!css.includes("STUDYante PLUS ATTACHMENT MENU")) {

css += `


/* =========================================================
   STUDYante PLUS ATTACHMENT MENU
========================================================= */

.ai-attach-wrap {
    position: relative;

    display: flex;
    align-items: center;

    flex-shrink: 0;
}

.ai-attach-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    border: 1px solid var(--border);
    border-radius: 50%;

    background: white;
    color: var(--text);

    font-size: 30px;
    font-weight: 300;
    line-height: 1;

    cursor: pointer;

    transition:
        background 0.15s ease,
        transform 0.15s ease;
}

.ai-attach-btn:hover {
    background: #f3f4f6;
    transform: translateY(-1px);
}

.ai-attach-btn[aria-expanded="true"] {
    background: #eceff3;
    transform: rotate(45deg);
}

.ai-attach-menu {
    position: absolute;

    left: 0;
    bottom: calc(100% + 10px);

    z-index: 5000;

    width: 290px;

    padding: 8px;

    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 16px;

    background: white;

    box-shadow:
        0 12px 35px rgba(0, 0, 0, 0.16);
}

.ai-attach-menu[hidden] {
    display: none !important;
}

.ai-attach-option {
    width: 100%;

    display: flex;
    align-items: center;

    gap: 12px;

    padding: 12px;

    border: 0;
    border-radius: 12px;

    background: transparent;
    color: var(--text);

    text-align: left;

    cursor: pointer;
}

.ai-attach-option:hover {
    background: #f5f5f5;
}

.ai-attach-icon {
    width: 34px;
    height: 34px;

    flex-shrink: 0;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    font-size: 20px;
}

.ai-attach-option > span:last-child {
    min-width: 0;

    display: flex;
    flex-direction: column;

    gap: 2px;
}

.ai-attach-option strong {
    font-size: 14px;
    font-weight: 600;
}

.ai-attach-option small {
    font-size: 12px;
    color: var(--muted);
}

@media (max-width: 600px) {

    .ai-attach-menu {
        width: min(
            290px,
            calc(100vw - 32px)
        );

        left: 0;
    }

    .ai-attach-btn {
        width: 42px;
        min-width: 42px;
        height: 42px;
    }
}

`;

fs.writeFileSync(
    file,
    css,
    "utf8"
);

}

console.log("Attachment menu CSS added.");
