let studyingChatBusy = false;

function cleanAIAnswer(text) {
  return String(text || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\*/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

const aiImageInput = $("aiImageInput");
const aiCameraInput = $("aiCameraInput");
const aiCameraButton = $("aiCameraButton");
const aiImageButton = $("aiImageButton");
const aiImagePreview = $("aiImagePreview");
const aiImagePreviewImg = $("aiImagePreviewImg");
const aiImageName = $("aiImageName");
const removeAIImage = $("removeAIImage");

let selectedAIImage = null;
let selectedAIImageURL = "";

let aiCameraStream = null;
const newChatButton = $("newChatButton");
const chatHistoryList = $("chatHistoryList");

let activeChatId = null;
let chatHistory = [];

const logoutButton = $("logoutButton");

function getProvider() {
  return "gemini";
}

function updateProviderUI() {
  return;
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

logoutButton.addEventListener(
  "click",
  () => {
    if (!confirm("Do you want to log out?")) {
      return;
    }
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
  

  const provider = getProvider();

  showLoading(type);

  const formData = new FormData();

  if (activeLibraryId) {
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
    "type",
    type
  );

  formData.append("provider", "gemini");

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
  flashcards = Array.isArray(set.flashcards)
    ? [...set.flashcards]
    : [];

  currentFlashcard = 0;

  if (flashcards.length === 0) {
    alert("This flashcard set is empty.");
    return;
  }

  /*
   * Saved flashcards use the existing generated-content viewer.
   * That viewer is inside the Upload Material page, so switch to
   * that page before displaying the saved set.
   */
  if (
    typeof window.showStudyantePage ===
    "function"
  ) {
    window.showStudyantePage("upload");
  } else {
    const uploadPage =
      document.getElementById("upload");

    const libraryPage =
      document.getElementById("library");

    if (libraryPage) {
      libraryPage.hidden = true;
      libraryPage.style.display = "none";
    }

    if (uploadPage) {
      uploadPage.hidden = false;
      uploadPage.style.display = "";
    }
  }

  generatedContent.hidden = false;

  generatedIcon.textContent = "🧠";

  generatedTitle.textContent =
    set.name || "Study Flashcards";

  renderFlashcard(false);

  setTimeout(() => {
    generatedContent.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
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



function stopAICamera() {

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


async function sendQuestion() {
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
                `${API_BASE}/api/chat`,
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

function addMessage(
    text,
    role
) {
    const message =
        document.createElement(
            "div"
        );

    message.className =
        `message ${role}`;

    if (
        role ===
        "assistant"
    ) {
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
        .textContent =
            text;

    aiMessages.appendChild(
        message
    );

    aiMessages.scrollTop =
        aiMessages.scrollHeight;

    return message;
}


function startNewChat() {
    activeChatId = null;

    aiMessages.innerHTML = "";

    addMessage(
        "Hi! Start a new conversation with STUDYante AI.",
        "assistant"
    );

    renderChatHistory();

    question.focus();
}


async function loadChatHistory() {
    if (!chatHistoryList) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE}/api/chats`
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
                "Could not load chat history."
            );
        }

        chatHistory =
            Array.isArray(
                data.chats
            )
                ? data.chats
                : [];

        renderChatHistory();

    } catch (error) {
        chatHistoryList.innerHTML =
            "";

        const notice =
            document.createElement(
                "div"
            );

        notice.className =
            "chat-empty-history";

        notice.textContent =
            error.message;

        chatHistoryList.appendChild(
            notice
        );
    }
}


function renderChatHistory() {
    if (!chatHistoryList) {
        return;
    }

    chatHistoryList.innerHTML =
        "";

    if (
        chatHistory.length === 0
    ) {
        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "chat-empty-history";

        empty.textContent =
            "No saved chats yet.";

        chatHistoryList.appendChild(
            empty
        );

        return;
    }

    chatHistory.forEach(
        chat => {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "chat-history-item";

            if (
                chat.id ===
                activeChatId
            ) {
                row.classList.add(
                    "active"
                );
            }

            const openButton =
                document.createElement(
                    "button"
                );

            openButton.type =
                "button";

            openButton.className =
                "chat-history-open";

            openButton.textContent =
                chat.title ||
                "New Chat";

            openButton.addEventListener(
                "click",
                () =>
                    openChat(
                        chat.id
                    )
            );

            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.type =
                "button";

            deleteButton.className =
                "chat-history-delete";

            deleteButton.textContent =
                "🗑";

            deleteButton.title =
                "Delete chat";

            deleteButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    deleteChat(
                        chat
                    );
                }
            );

            row.appendChild(
                openButton
            );

            row.appendChild(
                deleteButton
            );

            chatHistoryList.appendChild(
                row
            );
        }
    );
}


async function openChat(
    chatId
) {
    try {
        const response =
            await fetch(
                `${API_BASE}/api/chats/${encodeURIComponent(
                    chatId
                )}`
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
                "Could not open chat."
            );
        }

        activeChatId =
            data.chat.id;

        aiMessages.innerHTML =
            "";

        const messages =
            Array.isArray(
                data.chat.messages
            )
                ? data.chat.messages
                : [];

        if (
            messages.length === 0
        ) {
            addMessage(
                "Start this conversation.",
                "assistant"
            );
        } else {
            messages.forEach(
                message => {
                    addMessage(
                        message.content,
                        message.role ===
                        "user"
                            ? "user"
                            : "assistant"
                    );
                }
            );
        }

        renderChatHistory();

        question.focus();

    } catch (error) {
        alert(
            error.message
        );
    }
}


async function deleteChat(
    chat
) {
    const confirmed =
        confirm(
            'Delete "' +
            (
                chat.title ||
                "this chat"
            ) +
            '"?'
        );

    if (!confirmed) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE}/api/chats/${encodeURIComponent(
                    chat.id
                )}`,
                {
                    method:
                        "DELETE"
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
                "Could not delete chat."
            );
        }

        if (
            activeChatId ===
            chat.id
        ) {
            startNewChat();
        }

        await loadChatHistory();

    } catch (error) {
        alert(
            error.message
        );
    }
}


if (newChatButton) {
    newChatButton.addEventListener(
        "click",
        startNewChat
    );
}


loadChatHistory();


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
loadLibrary();

function setStudyingThinking(show) {
  const sendButton =
    document.getElementById("sendQuestion") ||
    document.getElementById("sendChat") ||
    document.getElementById("chatSend");

  const input =
    document.getElementById("chatInput") ||
    document.getElementById("questionInput");

  if (sendButton) {
    sendButton.disabled = show;

    if (!sendButton.dataset.originalText) {
      sendButton.dataset.originalText =
        sendButton.textContent;
    }

    sendButton.textContent =
      show
        ? "Thinking..."
        : sendButton.dataset.originalText;
  }

  if (input) {
    input.disabled = show;
  }
}

/* =========================================================
   STUDYante SINGLE-PAGE NAVIGATION
========================================================= */

(function () {

    const STUDYANTE_PAGES = [
        "dashboard",
        "upload",
        "library",
        "ai"
    ];


    function showStudyantePage(
        pageId,
        updateHash = true
    ) {
        if (
            !STUDYANTE_PAGES.includes(
                pageId
            )
        ) {
            pageId =
                "dashboard";
        }

        const selectedPage =
            document.getElementById(
                pageId
            );

        if (!selectedPage) {
            console.warn(
                "STUDYante page not found:",
                pageId
            );

            return;
        }


        STUDYANTE_PAGES.forEach(
            id => {
                const page =
                    document.getElementById(
                        id
                    );

                if (!page) {
                    return;
                }

                const active =
                    id === pageId;

                page.hidden =
                    !active;

                page.style.display =
                    active
                        ? ""
                        : "none";

                page.classList.toggle(
                    "studyante-page-active",
                    active
                );
            }
        );


        document
            .querySelectorAll(
                ".sidebar nav a"
            )
            .forEach(link => {

                const target =
                    (
                        link.dataset.page ||
                        link
                            .getAttribute(
                                "href"
                            ) ||
                        ""
                    )
                        .replace(
                            "#",
                            ""
                        )
                        .trim();

                const active =
                    target ===
                    pageId;

                link.classList.toggle(
                    "active",
                    active
                );

                if (active) {
                    link.setAttribute(
                        "aria-current",
                        "page"
                    );
                } else {
                    link.removeAttribute(
                        "aria-current"
                    );
                }
            });


        if (
            updateHash &&
            window.location.hash !==
                "#" + pageId
        ) {
            history.pushState(
                null,
                "",
                "#" + pageId
            );
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });


        if (
            pageId ===
            "library" &&
            typeof loadLibrary ===
            "function"
        ) {
            loadLibrary();
        }


        if (
            pageId ===
            "ai" &&
            typeof loadChatHistory ===
            "function"
        ) {
            loadChatHistory();
        }
    }


    document.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    ".sidebar nav a"
                );

            if (!link) {
                return;
            }

            const pageId =
                (
                    link.dataset.page ||
                    link
                        .getAttribute(
                            "href"
                        ) ||
                    ""
                )
                    .replace(
                        "#",
                        ""
                    )
                    .trim();


            if (
                !STUDYANTE_PAGES.includes(
                    pageId
                )
            ) {
                return;
            }


            event.preventDefault();

            showStudyantePage(
                pageId
            );
        },
        true
    );


    function openInitialPage() {

        let pageId =
            window.location.hash
                .replace(
                    "#",
                    ""
                )
                .trim();


        if (
            !STUDYANTE_PAGES.includes(
                pageId
            )
        ) {
            pageId =
                "dashboard";
        }


        showStudyantePage(
            pageId,
            false
        );
    }


    window.addEventListener(
        "popstate",
        () => {

            let pageId =
                window.location.hash
                    .replace(
                        "#",
                        ""
                    )
                    .trim();


            if (
                !STUDYANTE_PAGES.includes(
                    pageId
                )
            ) {
                pageId =
                    "dashboard";
            }


            showStudyantePage(
                pageId,
                false
            );
        }
    );


    window.showStudyantePage =
        showStudyantePage;


    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            openInitialPage
        );
    } else {
        openInitialPage();
    }

})();
