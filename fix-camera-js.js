const fs = require("fs");

const file = "./docs/script.js";
let js = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

if (!js.includes("let aiCameraStream = null;")) {

    const marker =
        'let selectedAIImageURL = "";';

    if (!js.includes(marker)) {
        throw new Error(
            "Camera variables not found."
        );
    }

    js = js.replace(
        marker,
        marker + `

let aiCameraStream = null;`
    );
}


const start =
    js.indexOf(
        "function clearAIImage()"
    );

if (start === -1) {
    throw new Error(
        "clearAIImage() not found."
    );
}

const sendStart =
    js.indexOf(
        "async function sendQuestion()",
        start
    );

if (sendStart === -1) {
    throw new Error(
        "sendQuestion() not found."
    );
}


const cameraCode = `function stopAICamera() {

    if (aiCameraStream) {

        aiCameraStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        aiCameraStream = null;
    }

    if (aiCameraVideo) {
        aiCameraVideo.srcObject = null;
    }

    if (aiCameraModal) {
        aiCameraModal.hidden = true;
    }
}


async function openAICamera() {

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

        alert(
            "Camera is not supported by this browser. Please use Upload Image instead."
        );

        return;
    }

    try {

        aiCameraStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: "environment"
                    }
                },
                audio: false
            });

        aiCameraVideo.srcObject =
            aiCameraStream;

        aiCameraModal.hidden = false;

        await aiCameraVideo.play();

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        alert(
            "Camera access was denied or unavailable. Please allow camera permission and try again."
        );

        stopAICamera();
    }
}


function captureAIPhoto() {

    if (!aiCameraVideo ||
        !aiCameraVideo.videoWidth) {

        alert(
            "Camera is not ready yet."
        );

        return;
    }

    const canvas =
        aiCameraCanvas;

    canvas.width =
        aiCameraVideo.videoWidth;

    canvas.height =
        aiCameraVideo.videoHeight;

    const context =
        canvas.getContext("2d");

    context.drawImage(
        aiCameraVideo,
        0,
        0,
        canvas.width,
        canvas.height
    );

    canvas.toBlob(
        blob => {

            if (!blob) {
                alert(
                    "Could not capture the photo."
                );

                return;
            }

            const file =
                new File(
                    [blob],
                    "camera-photo.jpg",
                    {
                        type:
                            "image/jpeg"
                    }
                );

            setAIImage(file);

            stopAICamera();

        },
        "image/jpeg",
        0.9
    );
}


`;

js =
    js.substring(
        0,
        start
    ) +
    cameraCode +
    js.substring(start);


const oldButtons =
`if (aiCameraButton) {
    aiCameraButton.addEventListener(
        "click",
        () => {
            aiCameraInput.click();
        }
    );
}`;

const newButtons =
`if (aiCameraButton) {
    aiCameraButton.addEventListener(
        "click",
        openAICamera
    );
}

const aiCameraModal =
    $("aiCameraModal");

const aiCameraVideo =
    $("aiCameraVideo");

const aiCameraCanvas =
    $("aiCameraCanvas");

const captureAIPhotoButton =
    $("captureAIPhoto");

const closeAICamera =
    $("closeAICamera");


if (captureAIPhotoButton) {
    captureAIPhotoButton.addEventListener(
        "click",
        captureAIPhoto
    );
}


if (closeAICamera) {
    closeAICamera.addEventListener(
        "click",
        stopAICamera
    );
}


if (aiCameraModal) {

    aiCameraModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                aiCameraModal
            ) {
                stopAICamera();
            }
        }
    );
}`;

if (!js.includes(oldButtons)) {
    throw new Error(
        "Existing camera button code not found."
    );
}

js =
    js.replace(
        oldButtons,
        newButtons
    );


fs.writeFileSync(
    file,
    js,
    "utf8"
);

console.log(
    "Camera JavaScript updated."
);
