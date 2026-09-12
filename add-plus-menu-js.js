const fs = require("fs");

const file = "./docs/script.js";
let js = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

if (!js.includes('const aiAttachButton = $("aiAttachButton");')) {

    const marker =
`const aiCameraButton = $("aiCameraButton");
const aiImageButton = $("aiImageButton");`;

    const replacement =
`const aiCameraButton = $("aiCameraButton");
const aiImageButton = $("aiImageButton");

const aiAttachButton = $("aiAttachButton");
const aiAttachMenu = $("aiAttachMenu");`;

    if (!js.includes(marker)) {
        throw new Error(
            "Could not find AI camera/image button constants."
        );
    }

    js = js.replace(
        marker,
        replacement
    );
}


if (!js.includes("function closeAIAttachMenu()")) {

    const marker =
        "function stopAICamera()";

    const index =
        js.indexOf(marker);

    if (index === -1) {
        throw new Error(
            "Could not find camera functions."
        );
    }

    const menuCode = `
function closeAIAttachMenu() {
    if (!aiAttachMenu) {
        return;
    }

    aiAttachMenu.hidden = true;

    if (aiAttachButton) {
        aiAttachButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }
}


function toggleAIAttachMenu(event) {
    if (event) {
        event.stopPropagation();
    }

    if (!aiAttachMenu) {
        return;
    }

    const willOpen =
        aiAttachMenu.hidden;

    aiAttachMenu.hidden =
        !willOpen;

    if (aiAttachButton) {
        aiAttachButton.setAttribute(
            "aria-expanded",
            willOpen
                ? "true"
                : "false"
        );
    }
}


if (aiAttachButton) {
    aiAttachButton.addEventListener(
        "click",
        toggleAIAttachMenu
    );
}


if (aiAttachMenu) {
    aiAttachMenu.addEventListener(
        "click",
        event => {
            event.stopPropagation();
        }
    );
}


document.addEventListener(
    "click",
    closeAIAttachMenu
);


document.addEventListener(
    "keydown",
    event => {
        if (event.key === "Escape") {
            closeAIAttachMenu();
        }
    }
);


`;

    js =
        js.substring(0, index) +
        menuCode +
        js.substring(index);
}


const oldCameraClick =
`if (aiCameraButton) {
    aiCameraButton.addEventListener(
        "click",
        openAICamera
    );
}`;

const newCameraClick =
`if (aiCameraButton) {
    aiCameraButton.addEventListener(
        "click",
        () => {
            closeAIAttachMenu();
            openAICamera();
        }
    );
}`;

if (js.includes(oldCameraClick)) {
    js = js.replace(
        oldCameraClick,
        newCameraClick
    );
}


const oldImageClick =
`if (aiImageButton) {
    aiImageButton.addEventListener(
        "click",
        () => {
            aiImageInput.click();
        }
    );
}`;

const newImageClick =
`if (aiImageButton) {
    aiImageButton.addEventListener(
        "click",
        () => {
            closeAIAttachMenu();
            aiImageInput.click();
        }
    );
}`;

if (js.includes(oldImageClick)) {
    js = js.replace(
        oldImageClick,
        newImageClick
    );
}

fs.writeFileSync(
    file,
    js,
    "utf8"
);

console.log("Attachment menu JavaScript added.");
