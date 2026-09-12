const fs = require("fs");

const file = "./docs/style.css";

let css =
    fs.readFileSync(
        file,
        "utf8"
    ).replace(
        /\r\n/g,
        "\n"
    );

if (!css.includes("STUDYante REAL CAMERA")) {

css += `

/* =========================================================
   STUDYante REAL CAMERA
========================================================= */

.ai-camera-modal {
    position: fixed;
    inset: 0;

    z-index: 99999;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 16px;

    background: rgba(0, 0, 0, 0.75);
}

.ai-camera-box {
    width: min(100%, 620px);

    padding: 16px;

    border-radius: 18px;

    background: white;

    box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.3);
}

.ai-camera-header {
    display: flex;

    align-items: center;
    justify-content: space-between;

    margin-bottom: 12px;

    font-size: 18px;
}

.ai-camera-close {
    width: 40px;
    height: 40px;

    border: 0;
    border-radius: 10px;

    background: #f1f1f1;

    cursor: pointer;

    font-size: 18px;
}

#aiCameraVideo {
    display: block;

    width: 100%;

    max-height: 70vh;

    min-height: 240px;

    object-fit: cover;

    border-radius: 14px;

    background: #111;
}

.ai-capture-btn {
    width: 100%;

    margin-top: 12px;

    min-height: 48px;
}

@media (max-width: 600px) {

    .ai-camera-modal {
        padding: 8px;
    }

    .ai-camera-box {
        width: 100%;
        padding: 12px;
        border-radius: 14px;
    }

    #aiCameraVideo {
        min-height: 220px;
        max-height: 65vh;
    }
}

`;

fs.writeFileSync(
    file,
    css,
    "utf8"
);

}

console.log("Camera CSS updated.");
