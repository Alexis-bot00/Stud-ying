const fs = require("fs");

const file = "./docs/script.js";

let js = fs
    .readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n");


if (!js.includes("function addImageToChatMessage(")) {

    const marker =
        "async function sendQuestion() {";

    const index =
        js.indexOf(marker);

    if (index === -1) {
        throw new Error(
            "sendQuestion() not found."
        );
    }


    const helper = `
function addImageToChatMessage(
    messageElement,
    file
) {
    if (
        !messageElement ||
        !file
    ) {
        return;
    }

    const imageURL =
        URL.createObjectURL(file);

    const imageWrap =
        document.createElement(
            "div"
        );

    imageWrap.className =
        "chat-message-image-wrap";


    const image =
        document.createElement(
            "img"
        );

    image.className =
        "chat-message-image";

    image.alt =
        "Uploaded image";

    image.src =
        imageURL;


    image.addEventListener(
        "load",
        () => {
            URL.revokeObjectURL(
                imageURL
            );
        },
        {
            once: true
        }
    );


    imageWrap.appendChild(
        image
    );


    const messageText =
        messageElement.querySelector(
            ".message-text"
        );


    if (messageText) {

        messageElement.insertBefore(
            imageWrap,
            messageText
        );

    } else {

        messageElement.appendChild(
            imageWrap
        );
    }


    aiMessages.scrollTop =
        aiMessages.scrollHeight;
}


`;

    js =
        js.substring(0, index) +
        helper +
        js.substring(index);
}


/*
    Change user message so uploaded/camera
    photo appears directly inside chat.
*/

const oldBlock =
`    const displayedText =
        imageForRequest
            ? "📷 " + text
            : text;

    addMessage(
        displayedText,
        "user"
    );`;


const newBlock =
`    const userMessage =
        addMessage(
            text,
            "user"
        );

    if (imageForRequest) {
        addImageToChatMessage(
            userMessage,
            imageForRequest
        );
    }`;


if (js.includes(oldBlock)) {

    js =
        js.replace(
            oldBlock,
            newBlock
        );

} else if (
    !js.includes(
        "addImageToChatMessage(\n            userMessage"
    )
) {

    throw new Error(
        "Could not find current image message block."
    );
}


fs.writeFileSync(
    file,
    js,
    "utf8"
);

console.log(
    "Chat image display added."
);
