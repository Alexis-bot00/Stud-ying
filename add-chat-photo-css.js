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
        "STUDYante CHAT IMAGE DISPLAY"
    )
) {

css += `


/* =========================================================
   STUDYante CHAT IMAGE DISPLAY
========================================================= */

.message.user {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.message.user .chat-message-image-wrap {
    width: min(
        100%,
        420px
    );

    margin-bottom: 8px;

    display: flex;
    justify-content: flex-end;
}

.chat-message-image {
    display: block;

    width: auto;
    max-width: 100%;

    max-height: 420px;

    object-fit: contain;

    border-radius: 16px;

    background: #f4f4f4;

    box-shadow:
        0 2px 8px
        rgba(0, 0, 0, 0.08);
}

.message.user .message-text {
    max-width: min(
        85%,
        650px
    );
}

@media (max-width: 600px) {

    .message.user .chat-message-image-wrap {
        width: min(
            88vw,
            340px
        );
    }

    .chat-message-image {
        max-height: 360px;
        border-radius: 14px;
    }

    .message.user .message-text {
        max-width: 88%;
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
    "Chat image CSS added."
);
