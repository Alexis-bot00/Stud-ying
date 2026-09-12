const fs = require("fs");

const file = "./docs/index.html";
let html = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

const old = `
            <input
              id="aiCameraInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
            >`;

const replacement = `
            <input
              id="aiCameraInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
            >

            <div
              id="aiCameraModal"
              class="ai-camera-modal"
              hidden
            >
              <div class="ai-camera-box">

                <div class="ai-camera-header">
                  <strong>Take Photo</strong>

                  <button
                    id="closeAICamera"
                    type="button"
                    class="ai-camera-close"
                  >
                    &#x2715;
                  </button>
                </div>

                <video
                  id="aiCameraVideo"
                  autoplay
                  playsinline
                  muted
                ></video>

                <canvas
                  id="aiCameraCanvas"
                  hidden
                ></canvas>

                <button
                  id="captureAIPhoto"
                  type="button"
                  class="primary-btn ai-capture-btn"
                >
                  &#x1F4F7; Take Photo
                </button>

              </div>
            </div>`;

if (!html.includes('id="aiCameraModal"')) {

    if (!html.includes(old)) {
        throw new Error(
            "Could not find aiCameraInput."
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

console.log("Camera interface added.");
