const API_BASE = "https://stud-ying-production.up.railway.app";

let uploadedFile = null;
let activeLibraryId = null;

let libraryData = {
  folders: [],
  files: [],
  flashcardSets: []
};

let activeFolderFilter = "";

let flashcards = [];
let currentFlashcard = 0;
let currentFlashcardSetName = "";

let manualCardCount = 0;

let timerSeconds = 25 * 60;
let timerInterval = null;

const $ = id => document.getElementById(id);

const fileInput = $("fileInput");
const chooseFileButton = $("chooseFileButton");
const dropArea = $("dropArea");

const selectedFile = $("selectedFile");
const fileName = $("fileName");
const fileSize = $("fileSize");
const removeFile = $("removeFile");

const generateSection = $("generateSection");

const generatedContent = $("generatedContent");
const generatedIcon = $("generatedIcon");
const generatedTitle = $("generatedTitle");
const generatedBody = $("generatedBody");

const geminiSettings = $("geminiSettings");
const geminiKey = $("geminiKey");
const toggleGeminiKey = $("toggleGeminiKey");
const ollamaNotice = $("ollamaNotice");

const flashcardCount = $("flashcardCount");
const questionCount = $("questionCount");

const libraryStatus = $("libraryStatus");
const libraryGrid = $("libraryGrid");
const folderFilters = $("folderFilters");

const newFolderButton = $("newFolderButton");
const createFlashcardsButton = $("createFlashcardsButton");
const refreshLibrary = $("refreshLibrary");

const folderModal = $("folderModal");
const folderName = $("folderName");
const saveFolderButton = $("saveFolderButton");

const flashcardModal = $("flashcardModal");
const manualSetName = $("manualSetName");
const manualFolder = $("manualFolder");
const manualCards = $("manualCards");
const addManualCard = $("addManualCard");
const saveManualFlashcards = $("saveManualFlashcards");

const saveAIFlashcardsModal = $("saveAIFlashcardsModal");
const aiFlashcardSetName = $("aiFlashcardSetName");
const aiFlashcardFolder = $("aiFlashcardFolder");
const confirmSaveAIFlashcards = $("confirmSaveAIFlashcards");

const question = $("question");
const askButton = $("askButton");
const aiMessages = $("aiMessages");

const timerDisplay = $("timerDisplay");
const startTimer = $("startTimer");
const resetTimer = $("resetTimer");

const logoutButton = $("logoutButton");

function getProvider() {
  return (
    document.querySelector(
      'input[name="provider"]:checked'
    )?.value || "gemini"
  );
}

function updateProviderUI() {
  const provider = getProvider();

  geminiSettings.hidden =
    provider !== "gemini";

  ollamaNotice.hidden =
    provider !== "ollama";
}

document
  .querySelectorAll(
    'input[name="provider"]'
  )
  .forEach(radio => {
    radio.addEventListener(
      "change",
      updateProviderUI
    );
  });

toggleGeminiKey.addEventListener(
  "click",
  () => {
    const hidden =
      geminiKey.type === "password";

    geminiKey.type =
      hidden ? "text" : "password";

    toggleGeminiKey.textContent =
      hidden ? "Hide" : "Show";
  }
);

logoutButton.addEventListener(
  "click",
  () => {
    if (!confirm("Do you want to log out?")) {
      return;
    }

    geminiKey.value = "";
    uploadedFile = null;
    activeLibraryId = null;

    fileInput.value = "";

    selectedFile.hidden = true;
    generateSection.hidden = true;
    generatedContent.hidden = true;

    question.value = "";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
);

chooseFileButton.addEventListener(
  "click",
  () => {
    fileInput.click();
  }
);

fileInput.addEventListener(
  "change",
  () => {
    const file = fileInput.files?.[0];

    if (file) {
      handleFile(file);
    }
  }
);

["dragenter", "dragover"].forEach(
  eventName => {
    dropArea.addEventListener(
      eventName,
      event => {
        event.preventDefault();

        dropArea.classList.add(
          "dragging"
        );
      }
    );
  }
);

["dragleave", "drop"].forEach(
  eventName => {
    dropArea.addEventListener(
      eventName,
      event => {
        event.preventDefault();

        dropArea.classList.remove(
          "dragging"
        );
      }
    );
  }
);

dropArea.addEventListener(
  "drop",
  event => {
    const file =
      event.dataTransfer.files?.[0];

    if (file) {
      handleFile(file);
    }
  }
);

function handleFile(file) {
  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();

  if (
    ![
      "pdf",
      "docx",
      "pptx",
      "txt"
    ].includes(extension)
  ) {
    alert(
      "Only PDF, DOCX, PPTX and TXT files are allowed."
    );

    return;
  }

  if (
    file.size >
    20 * 1024 * 1024
  ) {
    alert(
      "Maximum file size is 20 MB."
    );

    return;
  }

  uploadedFile = file;
  activeLibraryId = null;

  fileName.textContent = file.name;

  fileSize.textContent =
    `${formatFileSize(file.size)} • Saving to My Library...`;

  selectedFile.hidden = false;
  generateSection.hidden = false;
  generatedContent.hidden = true;

  saveUploadedFile(file);
}

removeFile.addEventListener(
  "click",
  () => {
    uploadedFile = null;
    activeLibraryId = null;

    fileInput.value = "";

    selectedFile.hidden = true;
    generateSection.hidden = true;
    generatedContent.hidden = true;

    loadLibrary();
  }
);

async function saveUploadedFile(file) {
  const formData = new FormData();

  formData.append(
    "file",
    file,
    file.name
  );

  try {
    const response = await fetch(
      `${API_BASE}/api/library`,
      {
        method: "POST",
        body: formData
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not save file."
      );
    }

    if (uploadedFile === file) {
      activeLibraryId = data.file.id;

      fileSize.textContent =
        `${formatFileSize(data.file.size)} • Saved in My Library ✅`;
    }

    await loadLibrary();
  } catch (error) {
    console.error(error);

    if (uploadedFile === file) {
      fileSize.textContent =
        `${formatFileSize(file.size)} • Could not save to My Library`;
    }
  }
}

async function loadLibrary() {
  libraryStatus.hidden = false;
  libraryStatus.textContent =
    "Loading your library...";

  try {
    const response = await fetch(
      `${API_BASE}/api/library`
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not load My Library."
      );
    }

    libraryData = {
      folders:
        Array.isArray(data.folders)
          ? data.folders
          : [],

      files:
        Array.isArray(data.files)
          ? data.files
          : [],

      flashcardSets:
        Array.isArray(data.flashcardSets)
          ? data.flashcardSets
          : []
    };

    renderFolderFilters();
    updateFolderSelects();
    renderLibrary();
  } catch (error) {
    libraryGrid.innerHTML = "";

    libraryStatus.hidden = false;

    libraryStatus.innerHTML =
      `⚠️ ${escapeHTML(error.message)}`;
  }
}

refreshLibrary.addEventListener(
  "click",
  loadLibrary
);

function renderFolderFilters() {
  folderFilters.innerHTML = "";

  libraryData.folders.forEach(
    folder => {
      const button =
        document.createElement(
          "button"
        );

      button.type = "button";

      button.className =
        "folder-filter";

      button.dataset.folder =
        folder.id;

      button.textContent =
        `📁 ${folder.name}`;

      if (
        activeFolderFilter ===
        folder.id
      ) {
        button.classList.add(
          "active"
        );
      }

      button.addEventListener(
        "click",
        () => {
          setFolderFilter(
            folder.id
          );
        }
      );

      folderFilters.appendChild(
        button
      );
    }
  );

  document
    .querySelectorAll(
      ".library-filter > .folder-filter"
    )
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.folder ===
          activeFolderFilter
      );

      button.onclick = () => {
        setFolderFilter(
          button.dataset.folder
        );
      };
    });
}

function setFolderFilter(folderId) {
  activeFolderFilter = folderId;

  renderFolderFilters();
  renderLibrary();
}

function renderLibrary() {
  libraryGrid.innerHTML = "";

  let files = [...libraryData.files];
  let sets = [...libraryData.flashcardSets];

  if (
    activeFolderFilter ===
    "uncategorized"
  ) {
    files = files.filter(
      item => !item.folderId
    );

    sets = sets.filter(
      item => !item.folderId
    );
  } else if (activeFolderFilter) {
    files = files.filter(
      item =>
        item.folderId ===
        activeFolderFilter
    );

    sets = sets.filter(
      item =>
        item.folderId ===
        activeFolderFilter
    );
  }

  if (
    files.length === 0 &&
    sets.length === 0
  ) {
    libraryStatus.hidden = false;

    libraryStatus.textContent =
      "Nothing is saved here yet.";

    return;
  }

  libraryStatus.hidden = true;

  files.forEach(item => {
    libraryGrid.appendChild(
      createFileCard(item)
    );
  });

  sets.forEach(set => {
    libraryGrid.appendChild(
      createFlashcardSetCard(set)
    );
  });
}

function createFileCard(item) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "library-card";

  if (
    item.id ===
    activeLibraryId
  ) {
    card.classList.add(
      "active"
    );
  }

  const folder =
    getFolder(item.folderId);

  card.innerHTML = `
    <div class="library-card-icon">
      📄
    </div>

    <h3>
      ${escapeHTML(item.name)}
    </h3>

    <p>
      ${escapeHTML(
        String(
          item.extension || ""
        )
          .replace(".", "")
          .toUpperCase()
      )}
      •
      ${formatFileSize(item.size)}
    </p>

    <small>
      📁 ${
        folder
          ? escapeHTML(folder.name)
          : "Uncategorized"
      }
    </small>

    <div class="library-actions">

      <button
        type="button"
        class="primary-btn study-file"
      >
        Study
      </button>

      <button
        type="button"
        class="secondary-btn open-file"
      >
        Open
      </button>

      <select class="move-file">
        ${folderOptions(
          item.folderId
        )}
      </select>

      <button
        type="button"
        class="delete-btn delete-file"
      >
        Delete
      </button>

    </div>
  `;

  card
    .querySelector(".study-file")
    .addEventListener(
      "click",
      () => {
        selectLibraryFile(item);
      }
    );

  card
    .querySelector(".open-file")
    .addEventListener(
      "click",
      () => {
        window.open(
          `${API_BASE}/api/library/${encodeURIComponent(
            item.id
          )}/file`,
          "_blank"
        );
      }
    );

  card
    .querySelector(".move-file")
    .addEventListener(
      "change",
      event => {
        moveFile(
          item.id,
          event.target.value
        );
      }
    );

  card
    .querySelector(".delete-file")
    .addEventListener(
      "click",
      () => {
        deleteFile(item);
      }
    );

  return card;
}

function createFlashcardSetCard(set) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "library-card";

  const folder =
    getFolder(set.folderId);

  card.innerHTML = `
    <div class="library-card-icon">
      🧠
    </div>

    <h3>
      ${escapeHTML(set.name)}
    </h3>

    <p>
      ${set.flashcards.length}
      Flashcard${
        set.flashcards.length === 1
          ? ""
          : "s"
      }
    </p>

    <small>
      📁 ${
        folder
          ? escapeHTML(folder.name)
          : "Uncategorized"
      }
    </small>

    <div class="library-actions">

      <button
        type="button"
        class="primary-btn study-set"
      >
        Study
      </button>

      <select class="move-set">
        ${folderOptions(
          set.folderId
        )}
      </select>

      <button
        type="button"
        class="delete-btn delete-set"
      >
        Delete
      </button>

    </div>
  `;

  card
    .querySelector(".study-set")
    .addEventListener(
      "click",
      () => {
        openSavedFlashcards(set);
      }
    );

  card
    .querySelector(".move-set")
    .addEventListener(
      "change",
      event => {
        moveFlashcardSet(
          set.id,
          event.target.value
        );
      }
    );

  card
    .querySelector(".delete-set")
    .addEventListener(
      "click",
      () => {
        deleteFlashcardSet(set);
      }
    );

  return card;
}

function getFolder(folderId) {
  return libraryData.folders.find(
    folder =>
      folder.id === folderId
  );
}

function folderOptions(selectedId = "") {
  let html = `
    <option
      value=""
      ${!selectedId ? "selected" : ""}
    >
      Uncategorized
    </option>
  `;

  libraryData.folders.forEach(
    folder => {
      html += `
        <option
          value="${escapeHTML(folder.id)}"
          ${
            selectedId === folder.id
              ? "selected"
              : ""
          }
        >
          ${escapeHTML(folder.name)}
        </option>
      `;
    }
  );

  return html;
}

function updateFolderSelects() {
  manualFolder.innerHTML =
    folderOptions("");

  aiFlashcardFolder.innerHTML =
    folderOptions("");
}

function selectLibraryFile(item) {
  uploadedFile = null;
  activeLibraryId = item.id;

  fileInput.value = "";

  fileName.textContent =
    item.name;

  fileSize.textContent =
    `${formatFileSize(item.size)} • From My Library`;

  selectedFile.hidden = false;
  generateSection.hidden = false;
  generatedContent.hidden = true;

  renderLibrary();

  $("upload").scrollIntoView({
    behavior: "smooth"
  });
}

async function moveFile(
  id,
  folderId
) {
  try {
    const response = await fetch(
      `${API_BASE}/api/library/files/${encodeURIComponent(
        id
      )}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          folderId:
            folderId || null
        })
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not move file."
      );
    }

    await loadLibrary();
  } catch (error) {
    alert(error.message);
  }
}

async function moveFlashcardSet(
  id,
  folderId
) {
  try {
    const response = await fetch(
      `${API_BASE}/api/library/flashcards/${encodeURIComponent(
        id
      )}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          folderId:
            folderId || null
        })
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not move flashcards."
      );
    }

    await loadLibrary();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteFile(item) {
  if (
    !confirm(
      `Delete "${item.name}"?`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/library/${encodeURIComponent(
        item.id
      )}`,
      {
        method: "DELETE"
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not delete file."
      );
    }

    if (
      activeLibraryId === item.id
    ) {
      activeLibraryId = null;
      uploadedFile = null;

      selectedFile.hidden = true;
      generateSection.hidden = true;
    }

    await loadLibrary();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteFlashcardSet(set) {
  if (
    !confirm(
      `Delete "${set.name}"?`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/library/flashcards/${encodeURIComponent(
        set.id
      )}`,
      {
        method: "DELETE"
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not delete flashcards."
      );
    }

    await loadLibrary();
  } catch (error) {
    alert(error.message);
  }
}

newFolderButton.addEventListener(
  "click",
  () => {
    folderName.value = "";

    openModal(folderModal);

    setTimeout(
      () => folderName.focus(),
      100
    );
  }
);

saveFolderButton.addEventListener(
  "click",
  createFolder
);

folderName.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      createFolder();
    }
  }
);

async function createFolder() {
  const name =
    folderName.value.trim();

  if (!name) {
    alert("Enter a folder name.");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/library/folders`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          name
        })
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not create folder."
      );
    }

    closeModal(folderModal);

    await loadLibrary();
  } catch (error) {
    alert(error.message);
  }
}

createFlashcardsButton.addEventListener(
  "click",
  () => {
    manualSetName.value = "";
    manualCards.innerHTML = "";
    manualCardCount = 0;

    updateFolderSelects();

    addManualFlashcard();
    addManualFlashcard();

    openModal(flashcardModal);
  }
);

addManualCard.addEventListener(
  "click",
  addManualFlashcard
);

function addManualFlashcard() {
  if (
    manualCards.children.length >= 50
  ) {
    alert(
      "Maximum 50 flashcards."
    );

    return;
  }

  manualCardCount++;

  const card =
    document.createElement(
      "div"
    );

  card.className =
    "manual-card";

  card.innerHTML = `
    <h4>
      Card ${manualCardCount}
    </h4>

    <button
      type="button"
      class="remove-manual-card"
    >
      ✕
    </button>

    <label class="field-label">
      Question
    </label>

    <textarea
      class="manual-question"
      placeholder="Enter the question..."
    ></textarea>

    <label class="field-label">
      Answer
    </label>

    <textarea
      class="manual-answer"
      placeholder="Enter the answer..."
    ></textarea>
  `;

  card
    .querySelector(
      ".remove-manual-card"
    )
    .addEventListener(
      "click",
      () => {
        card.remove();
        renumberManualCards();
      }
    );

  manualCards.appendChild(card);
}

function renumberManualCards() {
  [
    ...manualCards.children
  ].forEach(
    (card, index) => {
      card.querySelector(
        "h4"
      ).textContent =
        `Card ${index + 1}`;
    }
  );
}

saveManualFlashcards.addEventListener(
  "click",
  async () => {
    const name =
      manualSetName.value.trim();

    if (!name) {
      alert(
        "Enter a flashcard set name."
      );

      return;
    }

    const cards = [
      ...manualCards.querySelectorAll(
        ".manual-card"
      )
    ]
      .map(card => ({
        question:
          card
            .querySelector(
              ".manual-question"
            )
            .value
            .trim(),

        answer:
          card
            .querySelector(
              ".manual-answer"
            )
            .value
            .trim()
      }))
      .filter(
        card =>
          card.question &&
          card.answer
      );

    if (cards.length === 0) {
      alert(
        "Add at least one complete flashcard."
      );

      return;
    }

    try {
      await saveFlashcardSet({
        name,
        folderId:
          manualFolder.value ||
          null,
        flashcards: cards
      });

      closeModal(
        flashcardModal
      );

      await loadLibrary();
    } catch (error) {
      alert(error.message);
    }
  }
);

async function saveFlashcardSet(data) {
  const response = await fetch(
    `${API_BASE}/api/library/flashcards`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify(data)
    }
  );

  const result = await readResponse(
    response
  );

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
      "Could not save flashcards."
    );
  }

  return result;
}

document
  .querySelectorAll(
    ".generate-card"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        generateMaterial(
          button.dataset.type
        );
      }
    );
  });

async function generateMaterial(type) {
  if (
    !uploadedFile &&
    !activeLibraryId
  ) {
    alert(
      "Upload a file or choose one from My Library."
    );

    return;
  }

  const provider = getProvider();

  if (
    provider === "gemini" &&
    !geminiKey.value.trim()
  ) {
    alert(
      "Please enter your Gemini API key."
    );

    return;
  }

  showLoading(type);

  const formData = new FormData();

  if (activeLibraryId) {
    formData.append(
      "libraryId",
      activeLibraryId
    );
  } else {
    formData.append(
      "file",
      uploadedFile,
      uploadedFile.name
    );
  }

  formData.append(
    "type",
    type
  );

  formData.append(
    "provider",
    provider
  );

  if (type === "flashcards") {
    formData.append(
      "flashcardCount",
      flashcardCount.value
    );
  }

  if (
    type === "test" ||
    type === "game"
  ) {
    formData.append(
      "questionCount",
      questionCount
        ? questionCount.value
        : "20"
    );
  }

  if (provider === "gemini") {
    formData.append(
      "apiKey",
      geminiKey.value.trim()
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/generate`,
      {
        method: "POST",
        body: formData
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Generation failed."
      );
    }

    displayGenerated(
      type,
      data.data,
      data.file
    );
  } catch (error) {
    showError(error.message);
  }
}

function showLoading(type) {
  const titles = {
    notes: "Study Notes",
    flashcards: "Flashcards",
    test: "Practice Test",
    game: "Study Game"
  };

  generatedContent.hidden = false;
  generatedIcon.textContent = "✨";

  generatedTitle.textContent =
    `Creating ${titles[type]}...`;

  generatedBody.innerHTML = `
    <div class="loading-box">
      🧠 Studying AI is reading your lesson...
    </div>
  `;

  generatedContent.scrollIntoView({
    behavior: "smooth"
  });
}

function displayGenerated(
  type,
  data,
  sourceFile
) {
  generatedContent.hidden = false;

  if (type === "notes") {
    generatedIcon.textContent = "📝";
    generatedTitle.textContent =
      "Study Notes";

    generatedBody.innerHTML = `
      <div class="notes-content">
        ${escapeHTML(
          data.notes || ""
        )}
      </div>
    `;

    return;
  }

  if (type === "flashcards") {
    flashcards =
      Array.isArray(
        data.flashcards
      )
        ? data.flashcards
        : [];

    currentFlashcard = 0;

    currentFlashcardSetName =
      sourceFile
        ? `${removeExtension(
            sourceFile
          )} Flashcards`
        : "Study Flashcards";

    generatedIcon.textContent = "🧠";

    generatedTitle.textContent =
      `${flashcards.length} Flashcards`;

    renderFlashcard(true);

    return;
  }

  if (type === "test") {
    generatedIcon.textContent = "✅";
    generatedTitle.textContent =
      "Practice Test";

    const questions =
      data.questions || [];

    generatedBody.innerHTML =
      questions
        .map(
          (item, index) => `
            <div class="question-card">

              <h3>
                ${index + 1}.
                ${escapeHTML(
                  item.question
                )}
              </h3>

              ${(item.choices || [])
                .map(
                  (choice, choiceIndex) => `
                    <div class="test-choice">
                      ${String.fromCharCode(
                        65 + choiceIndex
                      )}.
                      ${escapeHTML(choice)}
                    </div>
                  `
                )
                .join("")}

              <details>

                <summary>
                  Show Answer
                </summary>

                <p>
                  Answer:
                  ${String.fromCharCode(
                    65 +
                      Number(
                        item.answer || 0
                      )
                  )}
                </p>

                <p>
                  ${escapeHTML(
                    item.explanation || ""
                  )}
                </p>

              </details>

            </div>
          `
        )
        .join("");

    return;
  }

  if (type === "game") {
    generatedIcon.textContent = "🎮";
    generatedTitle.textContent =
      "Study Game";

    generatedBody.innerHTML =
      (data.game || [])
        .map(
          (item, index) => `
            <div class="question-card">

              <h3>
                ${index + 1}.
                ${escapeHTML(
                  item.question
                )}
              </h3>

              ${(item.choices || [])
                .map(
                  (choice, choiceIndex) => `
                    <button
                      class="game-choice"
                      data-selected="${choiceIndex}"
                      data-correct="${Number(
                        item.answer || 0
                      )}"
                      type="button"
                    >
                      ${escapeHTML(choice)}
                    </button>
                  `
                )
                .join("")}

            </div>
          `
        )
        .join("");

    document
      .querySelectorAll(
        ".game-choice"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            checkGameAnswer(button);
          }
        );
      });
  }
}

function renderFlashcard(
  showSaveButton = false
) {
  if (flashcards.length === 0) {
    generatedBody.innerHTML =
      `<div class="error-box">No flashcards found.</div>`;

    return;
  }

  const card =
    flashcards[
      currentFlashcard
    ];

  generatedBody.innerHTML = `
    <div class="flashcard-area">

      <div class="flashcard-progress">
        Card
        ${currentFlashcard + 1}
        of
        ${flashcards.length}
      </div>

      <div
        id="activeFlashcard"
        class="flashcard"
      >

        <div class="card-front">

          <small>
            QUESTION
          </small>

          <h2>
            ${escapeHTML(
              card.question
            )}
          </h2>

          <span>
            Click to reveal answer
          </span>

        </div>

        <div class="card-back">

          <small>
            ANSWER
          </small>

          <h2>
            ${escapeHTML(
              card.answer
            )}
          </h2>

        </div>

      </div>

      <div class="flashcard-navigation">

        <button
          id="previousCard"
          class="secondary-btn"
          type="button"
        >
          ← Previous
        </button>

        <button
          id="nextCard"
          class="primary-btn"
          type="button"
        >
          Next →
        </button>

        ${
          showSaveButton
            ? `
              <button
                id="saveAIFlashcards"
                class="secondary-btn"
                type="button"
              >
                💾 Save to My Library
              </button>
            `
            : ""
        }

      </div>

    </div>
  `;

  $("activeFlashcard").onclick =
    event => {
      event.currentTarget
        .classList.toggle(
          "flipped"
        );
    };

  $("previousCard").onclick =
    () => {
      currentFlashcard =
        (
          currentFlashcard -
          1 +
          flashcards.length
        ) %
        flashcards.length;

      renderFlashcard(
        showSaveButton
      );
    };

  $("nextCard").onclick =
    () => {
      currentFlashcard =
        (
          currentFlashcard +
          1
        ) %
        flashcards.length;

      renderFlashcard(
        showSaveButton
      );
    };

  if (showSaveButton) {
    $("saveAIFlashcards").onclick =
      () => {
        aiFlashcardSetName.value =
          currentFlashcardSetName;

        updateFolderSelects();

        openModal(
          saveAIFlashcardsModal
        );
      };
  }
}

function openSavedFlashcards(set) {
  flashcards = [
    ...set.flashcards
  ];

  currentFlashcard = 0;

  generatedContent.hidden = false;
  generatedIcon.textContent = "🧠";
  generatedTitle.textContent = set.name;

  renderFlashcard(false);

  generatedContent.scrollIntoView({
    behavior: "smooth"
  });
}

confirmSaveAIFlashcards.addEventListener(
  "click",
  async () => {
    const name =
      aiFlashcardSetName.value.trim();

    if (!name) {
      alert(
        "Enter a flashcard set name."
      );

      return;
    }

    try {
      await saveFlashcardSet({
        name,

        folderId:
          aiFlashcardFolder.value ||
          null,

        flashcards
      });

      closeModal(
        saveAIFlashcardsModal
      );

      await loadLibrary();

      alert(
        "Flashcards saved to My Library! ✅"
      );
    } catch (error) {
      alert(error.message);
    }
  }
);

function checkGameAnswer(button) {
  const selected =
    Number(
      button.dataset.selected
    );

  const correct =
    Number(
      button.dataset.correct
    );

  const buttons =
    button.parentElement.querySelectorAll(
      ".game-choice"
    );

  buttons.forEach(
    (choice, index) => {
      choice.disabled = true;

      if (index === correct) {
        choice.classList.add(
          "correct"
        );
      }
    }
  );

  if (selected !== correct) {
    button.classList.add(
      "wrong"
    );
  }
}

function showError(message) {
  generatedContent.hidden = false;
  generatedIcon.textContent = "⚠️";
  generatedTitle.textContent =
    "Could not generate";

  generatedBody.innerHTML = `
    <div class="error-box">
      ${escapeHTML(message)}
    </div>
  `;
}

askButton.addEventListener(
  "click",
  sendQuestion
);

question.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendQuestion();
    }
  }
);

async function sendQuestion() {
  const text =
    question.value.trim();

  if (!text) return;

  if (
    !uploadedFile &&
    !activeLibraryId
  ) {
    alert(
      "Upload or select a lesson first."
    );

    return;
  }

  const provider = getProvider();

  if (
    provider === "gemini" &&
    !geminiKey.value.trim()
  ) {
    alert(
      "Please enter your Gemini API key."
    );

    return;
  }

  addMessage(
    text,
    "user"
  );

  question.value = "";
  askButton.disabled = true;

  const loading =
    addMessage(
      "Studying AI is thinking...",
      "assistant"
    );

  const formData =
    new FormData();

  if (activeLibraryId) {
    formData.append(
      "libraryId",
      activeLibraryId
    );
  } else {
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
    provider
  );

  if (provider === "gemini") {
    formData.append(
      "apiKey",
      geminiKey.value.trim()
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/chat`,
      {
        method: "POST",
        body: formData
      }
    );

    const data = await readResponse(
      response
    );

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not answer."
      );
    }

    loading
      .querySelector(
        ".message-text"
      )
      .textContent =
        data.answer;
  } catch (error) {
    loading
      .querySelector(
        ".message-text"
      )
      .textContent =
        `⚠️ ${error.message}`;
  } finally {
    askButton.disabled = false;
  }
}

function addMessage(text, role) {
  const message =
    document.createElement(
      "div"
    );

  message.className =
    `message ${role}`;

  if (role === "assistant") {
    message.innerHTML = `
      <span class="message-avatar">
        🤖
      </span>

      <div class="message-text"></div>
    `;
  } else {
    message.innerHTML = `
      <div class="message-text"></div>
    `;
  }

  message
    .querySelector(
      ".message-text"
    )
    .textContent = text;

  aiMessages.appendChild(message);

  aiMessages.scrollTop =
    aiMessages.scrollHeight;

  return message;
}

function updateTimer() {
  const minutes =
    Math.floor(
      timerSeconds / 60
    );

  const seconds =
    timerSeconds % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(
      2,
      "0"
    )}`;
}

startTimer.addEventListener(
  "click",
  () => {
    if (timerInterval) {
      clearInterval(timerInterval);

      timerInterval = null;

      startTimer.textContent =
        "Start";

      return;
    }

    startTimer.textContent =
      "Pause";

    timerInterval =
      setInterval(() => {
        if (timerSeconds > 0) {
          timerSeconds--;

          updateTimer();
        } else {
          clearInterval(
            timerInterval
          );

          timerInterval = null;

          startTimer.textContent =
            "Start";

          alert(
            "Study session finished! 🎉"
          );
        }
      }, 1000);
  }
);

resetTimer.addEventListener(
  "click",
  () => {
    clearInterval(timerInterval);

    timerInterval = null;

    timerSeconds = 25 * 60;

    startTimer.textContent =
      "Start";

    updateTimer();
  }
);

document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        closeModal(
          $(
            button.dataset.close
          )
        );
      }
    );
  });

document
  .querySelectorAll(".modal")
  .forEach(modal => {
    modal.addEventListener(
      "click",
      event => {
        if (
          event.target === modal
        ) {
          closeModal(modal);
        }
      }
    );
  });

function openModal(modal) {
  modal.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

async function readResponse(response) {
  const text =
    await response.text();

  try {
    return JSON.parse(text);
  } catch {
    if (
      text.includes(
        "Cannot GET /api/library"
      )
    ) {
      throw new Error(
        "The old backend is running. Stop it and restart the updated backend."
      );
    }

    throw new Error(
      text ||
      `Server error ${response.status}`
    );
  }
}

function formatFileSize(bytes) {
  const number = Number(bytes);

  if (!number) return "0 B";

  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(number) /
        Math.log(1024)
      ),
      units.length - 1
    );

  return `${(
    number /
    Math.pow(1024, index)
  ).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function removeExtension(name) {
  return String(name || "")
    .replace(
      /\.[^/.]+$/,
      ""
    );
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

updateProviderUI();
updateTimer();
loadLibrary();