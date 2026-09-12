const fs = require("fs");

function read(file) {
    return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function write(file, text) {
    fs.writeFileSync(file, text, "utf8");
}

function fail(message) {
    throw new Error(message);
}


/* =========================================================
   INDEX.HTML
========================================================= */

const indexFile = "./docs/index.html";
let html = read(indexFile);

if (!html.includes('id="aiImageInput"')) {

    const oldInput = `<div class="chat-input">

            <textarea
              id="question"
              placeholder="Ask STUDYante AI..."
            ></textarea>`;

    const newInput = `<div
            id="aiImagePreview"
            class="ai-image-preview"
            hidden
          >
            <div class="ai-image-preview-card">
              <img
                id="aiImagePreviewImg"
                alt="Selected image preview"
              >

              <div class="ai-image-preview-info">
                <span id="aiImageName">
                  Selected image
                </span>

                <button
                  id="removeAIImage"
                  class="ai-image-remove"
                  type="button"
                  aria-label="Remove selected image"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div class="chat-input">

            <input
              id="aiImageInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
            >

            <input
              id="aiCameraInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
            >

            <div class="ai-media-buttons">
              <button
                id="aiCameraButton"
                class="ai-media-btn"
                type="button"
                title="Take a photo"
                aria-label="Take a photo"
              >
                &#x1F4F7;
              </button>

              <button
                id="aiImageButton"
                class="ai-media-btn"
                type="button"
                title="Upload an image"
                aria-label="Upload an image"
              >
                &#x1F5BC;
              </button>
            </div>

            <textarea
              id="question"
              placeholder="Ask STUDYante AI..."
            ></textarea>`;

    if (!html.includes(oldInput)) {
        fail("Could not find STUDYante AI chat input in index.html.");
    }

    html = html.replace(oldInput, newInput);

    write(indexFile, html);
}


/* =========================================================
   SCRIPT.JS
========================================================= */

const scriptFile = "./docs/script.js";
let js = read(scriptFile);

if (!js.includes("let selectedAIImage = null;")) {

    const oldConstants = `const question = $("question");
const askButton = $("askButton");
const aiMessages = $("aiMessages");`;

    const newConstants = `const question = $("question");
const askButton = $("askButton");
const aiMessages = $("aiMessages");

const aiImageInput = $("aiImageInput");
const aiCameraInput = $("aiCameraInput");
const aiCameraButton = $("aiCameraButton");
const aiImageButton = $("aiImageButton");
const aiImagePreview = $("aiImagePreview");
const aiImagePreviewImg = $("aiImagePreviewImg");
const aiImageName = $("aiImageName");
const removeAIImage = $("removeAIImage");

let selectedAIImage = null;
let selectedAIImageURL = "";`;

    if (!js.includes(oldConstants)) {
        fail("Could not find AI constants in script.js.");
    }

    js = js.replace(oldConstants, newConstants);
}


if (!js.includes("function setAIImage(file)")) {

    const sendStart = js.indexOf(
        "async function sendQuestion() {"
    );

    if (sendStart === -1) {
        fail("sendQuestion() not found.");
    }

    const cameraFunctions = `
function clearAIImage() {
    selectedAIImage = null;

    if (selectedAIImageURL) {
        URL.revokeObjectURL(
            selectedAIImageURL
        );

        selectedAIImageURL = "";
    }

    if (aiImageInput) {
        aiImageInput.value = "";
    }

    if (aiCameraInput) {
        aiCameraInput.value = "";
    }

    if (aiImagePreviewImg) {
        aiImagePreviewImg.removeAttribute(
            "src"
        );
    }

    if (aiImagePreview) {
        aiImagePreview.hidden = true;
    }
}


function setAIImage(file) {
    if (!file) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        alert(
            "Please select a JPG, PNG or WEBP image."
        );

        return;
    }

    const maxSize =
        10 * 1024 * 1024;

    if (file.size > maxSize) {
        alert(
            "The image must be 10 MB or smaller."
        );

        return;
    }

    clearAIImage();

    selectedAIImage = file;

    selectedAIImageURL =
        URL.createObjectURL(file);

    aiImagePreviewImg.src =
        selectedAIImageURL;

    aiImageName.textContent =
        file.name || "Camera photo";

    aiImagePreview.hidden = false;
}


if (aiCameraButton) {
    aiCameraButton.addEventListener(
        "click",
        () => {
            aiCameraInput.click();
        }
    );
}


if (aiImageButton) {
    aiImageButton.addEventListener(
        "click",
        () => {
            aiImageInput.click();
        }
    );
}


if (aiCameraInput) {
    aiCameraInput.addEventListener(
        "change",
        event => {
            setAIImage(
                event.target.files?.[0]
            );
        }
    );
}


if (aiImageInput) {
    aiImageInput.addEventListener(
        "change",
        event => {
            setAIImage(
                event.target.files?.[0]
            );
        }
    );
}


if (removeAIImage) {
    removeAIImage.addEventListener(
        "click",
        clearAIImage
    );
}


`;

    js =
        js.substring(0, sendStart) +
        cameraFunctions +
        js.substring(sendStart);
}


/*
 * Allow sending:
 * text only
 * OR image + text
 * OR image by itself
 */

const currentSendStart =
    js.indexOf(
        "async function sendQuestion() {"
    );

const currentAddMessage =
    js.indexOf(
        "\nfunction addMessage(",
        currentSendStart
    );

if (
    currentSendStart === -1 ||
    currentAddMessage === -1
) {
    fail(
        "Could not locate complete sendQuestion()."
    );
}

const newSendQuestion = `async function sendQuestion() {
    let text =
        question.value.trim();

    if (!text && !selectedAIImage) {
        return;
    }

    if (!text && selectedAIImage) {
        text =
            "Please analyze this image and explain what it shows.";
    }

    const imageForRequest =
        selectedAIImage;

    const displayedText =
        imageForRequest
            ? "📷 " + text
            : text;

    addMessage(
        displayedText,
        "user"
    );

    question.value = "";
    askButton.disabled = true;

    const loading =
        addMessage(
            "STUDYante AI is thinking...",
            "assistant"
        );

    const formData =
        new FormData();

    if (imageForRequest) {
        formData.append(
            "image",
            imageForRequest,
            imageForRequest.name ||
                "camera-image.jpg"
        );
    } else if (activeLibraryId) {
        formData.append(
            "libraryId",
            activeLibraryId
        );
    } else if (uploadedFile) {
        formData.append(
            "file",
            uploadedFile,
            uploadedFile.name
        );
    }

    formData.append(
        "question",
        text
    );

    formData.append(
        "provider",
        getProvider()
    );

    if (activeChatId) {
        formData.append(
            "chatId",
            activeChatId
        );
    }

    try {
        const response =
            await fetch(
                \`\${API_BASE}/api/chat\`,
                {
                    method: "POST",
                    body: formData
                }
            );

        const data =
            await readResponse(
                response
            );

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.message ||
                "Could not get an answer."
            );
        }

        activeChatId =
            data.chatId ||
            activeChatId;

        loading
            .querySelector(
                ".message-text"
            )
            .textContent =
                data.answer;

        if (imageForRequest) {
            clearAIImage();
        }

        await loadChatHistory();

    } catch (error) {
        loading
            .querySelector(
                ".message-text"
            )
            .textContent =
                "Error: " +
                error.message;

    } finally {
        askButton.disabled =
            false;

        question.focus();
    }
}

`;

js =
    js.substring(
        0,
        currentSendStart
    ) +
    newSendQuestion +
    js.substring(
        currentAddMessage + 1
    );

write(scriptFile, js);


/* =========================================================
   BACKEND SERVER.JS
========================================================= */

const serverFile =
    "./backend/server.js";

let server = read(serverFile);


/*
 * Add a separate image uploader.
 * This keeps the existing study-material uploader unchanged.
 */

if (!server.includes("const imageUpload =")) {

    const marker =
        "\nasync function extractText(";

    const markerIndex =
        server.indexOf(marker);

    if (markerIndex === -1) {
        fail(
            "Could not locate upload configuration."
        );
    }

    const imageUploader = `

const imageUpload =
  multer({
    storage,

    limits: {
      fileSize:
        10 * 1024 * 1024
    },

    fileFilter(
      req,
      file,
      callback
    ) {
      const allowedImageTypes =
        new Set([
          "image/jpeg",
          "image/png",
          "image/webp"
        ]);

      if (
        !allowedImageTypes.has(
          file.mimetype
        )
      ) {
        return callback(
          new Error(
            "Only JPG, PNG and WEBP images are allowed."
          )
        );
      }

      callback(
        null,
        true
      );
    }
  });

`;

    server =
        server.substring(
            0,
            markerIndex
        ) +
        imageUploader +
        server.substring(
            markerIndex
        );
}


/*
 * Add Gemini multimodal helper.
 */

if (!server.includes("async function askGeminiWithImage(")) {

    const providerMarker =
        "\nasync function askProvider(";

    const providerIndex =
        server.indexOf(
            providerMarker
        );

    if (providerIndex === -1) {
        fail(
            "askProvider() not found."
        );
    }

    const imageGemini = `

async function askGeminiWithImage(
  prompt,
  imagePath,
  mimeType
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is not configured on the server."
    );
  }

  const ai =
    new GoogleGenAI({
      apiKey:
        GEMINI_API_KEY
    });

  const base64Image =
    fs.readFileSync(
      imagePath,
      {
        encoding:
          "base64"
      }
    );

  const interaction =
    await ai.interactions.create({
      model:
        GEMINI_MODEL,

      input: [
        {
          type:
            "text",

          text:
            prompt
        },

        {
          type:
            "image",

          data:
            base64Image,

          mime_type:
            mimeType ||
            "image/jpeg"
        }
      ],

      store:
        false
    });

  const text =
    String(
      interaction.outputText ||
      interaction.output_text ||
      ""
    ).trim();

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return text;
}

`;

    server =
        server.substring(
            0,
            providerIndex
        ) +
        imageGemini +
        server.substring(
            providerIndex
        );
}


/*
 * Chat route:
 * accept either a lesson file OR an image.
 */

const routeStart =
    server.indexOf(
        'app.post(\n    "/api/chat",'
    );

if (routeStart === -1) {
    fail(
        "/api/chat route not found."
    );
}

const nextMiddleware =
    server.indexOf(
        "\n\napp.use(",
        routeStart
    );

if (nextMiddleware === -1) {
    fail(
        "Could not find end of /api/chat route."
    );
}

let route =
    server.substring(
        routeStart,
        nextMiddleware
    );


route = route.replace(
`    upload.single(
        "file"
    ),`,
`    imageUpload.fields([
        {
            name: "file",
            maxCount: 1
        },
        {
            name: "image",
            maxCount: 1
        }
    ]),`
);


route = route.replace(
`        const temporaryPath =
            req.file?.path;`,
`        const lessonFile =
            req.files?.file?.[0] ||
            null;

        const imageFile =
            req.files?.image?.[0] ||
            null;

        if (lessonFile) {
            req.file =
                lessonFile;
        }

        const temporaryPath =
            lessonFile?.path;

        const temporaryImagePath =
            imageFile?.path;`
);


const oldAnswer = `            const answer =
                await askProvider(
                    provider,
                    buildChatPrompt(
                        finalQuestion,
                        lesson
                    ),
                    "",
                    false
                );`;

const newAnswer = `            const chatPrompt =
                buildChatPrompt(
                    finalQuestion,
                    lesson
                );

            const answer =
                imageFile
                    ? await askGeminiWithImage(
                        chatPrompt,
                        imageFile.path,
                        imageFile.mimetype
                    )
                    : await askProvider(
                        provider,
                        chatPrompt,
                        "",
                        false
                    );`;

if (!route.includes(oldAnswer)) {
    fail(
        "Could not locate AI answer call inside /api/chat."
    );
}

route =
    route.replace(
        oldAnswer,
        newAnswer
    );


route = route.replace(
`            removeFile(
                temporaryPath
            );`,
`            removeFile(
                temporaryPath
            );

            removeFile(
                temporaryImagePath
            );`
);


server =
    server.substring(
        0,
        routeStart
    ) +
    route +
    server.substring(
        nextMiddleware
    );

write(serverFile, server);


/* =========================================================
   STYLE.CSS
========================================================= */

const cssFile =
    "./docs/style.css";

let css = read(cssFile);

if (
    !css.includes(
        "STUDYante AI CAMERA"
    )
) {

    css += `


/* =========================================================
   STUDYante AI CAMERA
========================================================= */

.ai-media-buttons {
    display: flex;
    gap: 6px;
    align-items: center;
}

.ai-media-btn {
    width: 44px;
    min-width: 44px;
    height: 44px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    border: 1px solid var(--border);
    border-radius: 12px;

    background: white;
    color: var(--text);

    font-size: 20px;
    cursor: pointer;

    transition:
        transform 0.15s ease,
        background 0.15s ease;
}

.ai-media-btn:hover {
    background: var(--blue-soft);
    transform: translateY(-1px);
}

.ai-image-preview {
    margin-top: 12px;
    margin-bottom: 10px;
}

.ai-image-preview-card {
    width: min(100%, 360px);

    padding: 10px;

    border: 1px solid var(--border);
    border-radius: 14px;

    background: white;
}

.ai-image-preview-card img {
    display: block;

    width: 100%;
    max-height: 240px;

    object-fit: contain;

    border-radius: 10px;
}

.ai-image-preview-info {
    margin-top: 8px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 10px;

    font-size: 13px;
}

.ai-image-preview-info span {
    min-width: 0;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ai-image-remove {
    flex-shrink: 0;

    border: 0;
    background: transparent;

    color: var(--red);
    font-weight: 700;

    cursor: pointer;
}

@media (max-width: 600px) {

    .ai-media-buttons {
        width: 100%;
    }

    .ai-media-btn {
        flex: 1;
    }

    .ai-image-preview-card {
        width: 100%;
    }
}

`;

    write(cssFile, css);
}


console.log("");
console.log(
    "STUDYante AI camera feature installed."
);
console.log("");
