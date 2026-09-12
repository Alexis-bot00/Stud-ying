const fs = require("fs");

const file = "./docs/index.html";
let html = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

const old = `
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
            </div>`;

const replacement = `
            <div class="ai-attach-wrap">

              <button
                id="aiAttachButton"
                class="ai-attach-btn"
                type="button"
                aria-label="Add attachment"
                aria-expanded="false"
              >
                +
              </button>

              <div
                id="aiAttachMenu"
                class="ai-attach-menu"
                hidden
              >

                <button
                  id="aiImageButton"
                  class="ai-attach-option"
                  type="button"
                >
                  <span class="ai-attach-icon">
                    &#x1F4CE;
                  </span>

                  <span>
                    <strong>Upload file</strong>
                    <small>
                      Add an image from your device
                    </small>
                  </span>
                </button>

                <button
                  id="aiCameraButton"
                  class="ai-attach-option"
                  type="button"
                >
                  <span class="ai-attach-icon">
                    &#x1F4F7;
                  </span>

                  <span>
                    <strong>Camera</strong>
                    <small>
                      Take a photo
                    </small>
                  </span>
                </button>

              </div>

            </div>`;

if (!html.includes('id="aiAttachButton"')) {

    if (!html.includes(old)) {
        throw new Error(
            "Could not find the current camera/upload buttons."
        );
    }

    html = html.replace(
        old,
        replacement
    );

    fs.writeFileSync(
        file,
        html,
        "utf8"
    );
}

console.log("Attachment menu HTML added.");
