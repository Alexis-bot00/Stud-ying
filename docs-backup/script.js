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
  flashcardSets: [],
  studyMaterials: []
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

const aiAttachButton = $("aiAttachButton");
const aiAttachMenu = $("aiAttachMenu");
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

if (logoutButton) {
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

}

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
    `${formatFileSize(file.size)} � Saving to My Library...`;

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
        `${formatFileSize(data.file.size)} � Saved in My Library ?`;
    }

    await loadLibrary();
  } catch (error) {
    console.error(error);

    if (uploadedFile === file) {
      fileSize.textContent =
        `${formatFileSize(file.size)} � Could not save to My Library`;
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
          : [],

      studyMaterials:
        Array.isArray(data.studyMaterials)
          ? data.studyMaterials
          : []
    };

    renderFolderFilters();
    updateFolderSelects();
    renderLibrary();
  } catch (error) {
    libraryGrid.innerHTML = "";

    libraryStatus.hidden = false;

    libraryStatus.innerHTML =
      `?? ${escapeHTML(error.message)}`;
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
        `?? ${folder.name}`;

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
      ??
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
      �
      ${formatFileSize(item.size)}
    </p>

    <small>
      ?? ${
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
      ??
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
      ?? ${
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
    `${formatFileSize(item.size)} � From My Library`;

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
      ?
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
  generatedIcon.textContent = "?";

  generatedTitle.textContent =
    `Creating ${titles[type]}...`;

  generatedBody.innerHTML = `
    <div class="loading-box">
      ?? Studying AI is reading your lesson...
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
    generatedIcon.textContent = "??";
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

    generatedIcon.textContent = "??";

    generatedTitle.textContent =
      `${flashcards.length} Flashcards`;

    renderFlashcard(true);

    return;
  }

  if (type === "test") {

    generatedIcon.textContent = "?";
    generatedTitle.textContent =
      "Practice Test";

    const questions =
      Array.isArray(data.questions)
        ? data.questions
        : [];

    generatedBody.innerHTML = `
      <div class="studyante-test-container">

        ${questions
          .map(
            (item, index) => `
              <div
                class="question-card"
                data-question-index="${index}"
              >

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
                        type="button"
                        class="test-choice"
                        data-selected="${choiceIndex}"
                        data-correct="${Number(
                          item.answer || 0
                        )}"
                      >
                        ${String.fromCharCode(
                          65 + choiceIndex
                        )}.
                        ${escapeHTML(choice)}
                      </button>
                    `
                  )
                  .join("")}

                <div
                  class="studyante-test-answer"
                  hidden
                >
                  <p class="studyante-test-answer-text"></p>

                  <p>
                    ${escapeHTML(
                      item.explanation || ""
                    )}
                  </p>
                </div>

              </div>
            `
          )
          .join("")}

        ${
          questions.length
            ? `
              <div class="studyante-test-submit-area">

                <button
                  id="submitPracticeTest"
                  class="primary-btn"
                  type="button"
                >
                  Submit Test
                </button>

                <div
                  id="practiceTestResult"
                  class="studyante-test-result"
                  hidden
                ></div>

              </div>
            `
            : `
              <div class="error-box">
                No test questions found.
              </div>
            `
        }

      </div>
    `;

    generatedBody
      .querySelectorAll(".test-choice")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {
            selectTestAnswer(button);
          }
        );
      });

    const submitButton =
      generatedBody.querySelector(
        "#submitPracticeTest"
      );

    if (submitButton) {

      submitButton.addEventListener(
        "click",
        submitPracticeTest
      );
    }

    return;
  }

  if (type === "game") {
    generatedIcon.textContent = "??";
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

/* ==========================================================
   STUDYANTE_FLASHCARD_SWIPE_SYSTEM
   ========================================================== */

let studyanteFlashcardRatings = [];

/* Keep Expand mode active when changing/swiping cards */
let studyanteFlashcardFocusActive = false;


function resetFlashcardSwipeResults() {

  studyanteFlashcardRatings =
    Array(flashcards.length).fill(null);
}


function ensureFlashcardSwipeResults() {

  if (
    !Array.isArray(
      studyanteFlashcardRatings
    ) ||
    studyanteFlashcardRatings.length !==
      flashcards.length
  ) {
    resetFlashcardSwipeResults();
  }
}


function rateFlashcard(
  knows,
  showSaveButton
) {

  ensureFlashcardSwipeResults();

  studyanteFlashcardRatings[
    currentFlashcard
  ] = knows
    ? "known"
    : "learning";

  const activeFlashcard =
    document.getElementById(
      "activeFlashcard"
    );

  if (!activeFlashcard) {
    return;
  }

  activeFlashcard.classList.add(
    knows
      ? "swipe-out-right"
      : "swipe-out-left"
  );

  setTimeout(() => {

    const finished =
      studyanteFlashcardRatings.every(
        rating => rating !== null
      );

    if (finished) {

      showFlashcardSwipeResult(
        showSaveButton
      );

      return;
    }


    let nextIndex =
      (
        currentFlashcard + 1
      ) % flashcards.length;

    let checked = 0;

    while (
      studyanteFlashcardRatings[
        nextIndex
      ] !== null &&
      checked < flashcards.length
    ) {

      nextIndex =
        (
          nextIndex + 1
        ) % flashcards.length;

      checked++;
    }

    currentFlashcard =
      nextIndex;

    renderFlashcard(
      showSaveButton
    );

  }, 250);
}


function showFlashcardSwipeResult(
  showSaveButton
) {

  studyanteFlashcardFocusActive = false;

  document.body.classList.remove(
    "studyante-flashcard-focus-active"
  );

  ensureFlashcardSwipeResults();

  const known =
    studyanteFlashcardRatings.filter(
      rating => rating === "known"
    ).length;

  const learning =
    studyanteFlashcardRatings.filter(
      rating => rating === "learning"
    ).length;

  const total =
    flashcards.length;

  const mastery =
    total
      ? Math.round(
          known / total * 100
        )
      : 0;


  generatedBody.innerHTML = `
    <div class="studyante-flashcard-result">

      <h2>
        Flashcard Result
      </h2>

      <div class="studyante-flashcard-result-score">
        ${known}/${total}
      </div>

      <p>
        Know It:
        <strong>${known}</strong>
      </p>

      <p>
        Still Learning:
        <strong>${learning}</strong>
      </p>

      <p>
        Mastery:
        <strong>${mastery}%</strong>
      </p>

      <button
        id="restartFlashcards"
        type="button"
        class="primary-btn"
      >
        Study Again
      </button>

    </div>
  `;


  const restart =
    document.getElementById(
      "restartFlashcards"
    );

  if (restart) {

    restart.onclick = () => {

      resetFlashcardSwipeResults();

      currentFlashcard = 0;

      renderFlashcard(
        showSaveButton
      );
    };
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

      <div class="studyante-flashcard-topbar">

      <div class="flashcard-progress">
        Card
        ${currentFlashcard + 1}
        of
        ${flashcards.length}
      </div>

      <button
        id="studyanteExpandFlashcard"
        class="studyante-flashcard-expand"
        type="button"
      >
        ? Expand
      </button>

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
          ? Previous
        </button>

        <button
          id="nextCard"
          class="primary-btn"
          type="button"
        >
          Next ?
        </button>

        ${
          showSaveButton
            ? `
              <button
                id="saveAIFlashcards"
                class="secondary-btn"
                type="button"
              >
                ?? Save to My Library
              </button>
            `
            : ""
        }

      </div>

    </div>
  `;
  /* STUDYANTE_FLASHCARD_POINTER_SWIPE */

  ensureFlashcardSwipeResults();

  const activeFlashcard =
    $("activeFlashcard");

  let swipeStartX = 0;
  let swipeCurrentX = 0;
  let swipeDragging = false;
  let swipeMoved = false;


  activeFlashcard.addEventListener(
    "pointerdown",
    event => {

      swipeDragging = true;
      swipeMoved = false;

      swipeStartX =
        event.clientX;

      swipeCurrentX =
        event.clientX;

      activeFlashcard.classList.add(
        "swiping"
      );

      try {
        activeFlashcard.setPointerCapture(
          event.pointerId
        );
      } catch (error) {}
    }
  );


  activeFlashcard.addEventListener(
    "pointermove",
    event => {

      if (!swipeDragging) {
        return;
      }

      swipeCurrentX =
        event.clientX;

      const distance =
        swipeCurrentX -
        swipeStartX;

      if (
        Math.abs(distance) > 6
      ) {
        swipeMoved = true;
      }

      activeFlashcard.style.transform =
        `translateX(${distance}px) rotate(${distance / 25}deg)`;

      activeFlashcard.classList.toggle(
        "swipe-know",
        distance > 35
      );

      activeFlashcard.classList.toggle(
        "swipe-learning",
        distance < -35
      );
    }
  );


  const finishFlashcardSwipe =
    event => {

      if (!swipeDragging) {
        return;
      }

      swipeDragging = false;

      activeFlashcard.classList.remove(
        "swiping"
      );

      const distance =
        swipeCurrentX -
        swipeStartX;


      if (
        Math.abs(distance) >= 90
      ) {

        rateFlashcard(
          distance > 0,
          showSaveButton
        );

        return;
      }


      activeFlashcard.style.transform = "";

      activeFlashcard.classList.remove(
        "swipe-know",
        "swipe-learning"
      );


      if (!swipeMoved) {

        activeFlashcard.classList.toggle(
          "flipped"
        );
      }
    };


  activeFlashcard.addEventListener(
    "pointerup",
    finishFlashcardSwipe
  );

  activeFlashcard.addEventListener(
    "pointercancel",
    finishFlashcardSwipe
  );

  /* ==========================================================
     STUDYANTE_FLASHCARD_FOCUS_MODE
     ========================================================== */

  const flashcardExpandButton =
    document.getElementById(
      "studyanteExpandFlashcard"
    );

  /* STUDYANTE_RESTORE_FLASHCARD_FOCUS */
  if (studyanteFlashcardFocusActive) {

    const restoredFlashcardArea =
      activeFlashcard.closest(
        ".flashcard-area"
      );

    if (restoredFlashcardArea) {

      restoredFlashcardArea.classList.add(
        "studyante-flashcard-focus-mode"
      );

      document.body.classList.add(
        "studyante-flashcard-focus-active"
      );

      flashcardExpandButton.textContent =
        "? Exit";
    }
  }

  const flashcardViewer =
    activeFlashcard.closest(
      ".flashcard-area"
    );


  function setFlashcardFocusMode(enabled) {

    if (
      !flashcardViewer ||
      !flashcardExpandButton
    ) {
      return;
    }

    studyanteFlashcardFocusActive =
      enabled;

    flashcardViewer.classList.toggle(
      "studyante-flashcard-focus-mode",
      enabled
    );

    document.body.classList.toggle(
      "studyante-flashcard-focus-active",
      enabled
    );

    flashcardExpandButton.textContent =
      enabled
        ? "? Exit"
        : "? Expand";
  }


  if (flashcardExpandButton) {

    flashcardExpandButton.onclick =
      () => {

        const enabled =
          !flashcardViewer.classList.contains(
            "studyante-flashcard-focus-mode"
          );

        setFlashcardFocusMode(
          enabled
        );
      };
  }

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

  /* STUDYANTE_SAVED_FLASHCARD_SWIPE_RESET */
  resetFlashcardSwipeResults();

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

  generatedIcon.textContent = "??";

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
        "Flashcards saved to My Library! ?"
      );
    } catch (error) {
      alert(error.message);
    }
  }
);

/* ==========================================================
   STUDYANTE PRACTICE TEST FINAL RESULTS
   ========================================================== */

function selectTestAnswer(button) {

  const card =
    button.closest(
      ".question-card"
    );

  if (!card) {
    return;
  }

  const choices =
    card.querySelectorAll(
      ".test-choice"
    );

  choices.forEach(choice => {
    choice.classList.remove(
      "selected",
      "correct",
      "wrong"
    );
  });

  button.classList.add(
    "selected"
  );

  card.dataset.selected =
    button.dataset.selected;
}


function submitPracticeTest() {

  const cards =
    generatedBody.querySelectorAll(
      ".question-card"
    );

  if (!cards.length) {
    return;
  }

  let answered = 0;
  let correctCount = 0;

  cards.forEach(card => {

    if (
      typeof card.dataset.selected !==
      "undefined"
    ) {
      answered++;
    }
  });

  if (answered < cards.length) {

    alert(
      `Please answer all questions first. ` +
      `${answered}/${cards.length} answered.`
    );

    return;
  }


  cards.forEach(card => {

    const choices =
      card.querySelectorAll(
        ".test-choice"
      );

    const selected =
      Number(
        card.dataset.selected
      );

    const correct =
      Number(
        choices[0]?.dataset.correct || 0
      );

    if (selected === correct) {
      correctCount++;
    }

    choices.forEach(
      (choice, index) => {

        choice.disabled = true;

        choice.classList.remove(
          "selected",
          "correct",
          "wrong"
        );

        if (index === correct) {
          choice.classList.add(
            "correct"
          );
        }

        if (
          index === selected &&
          selected !== correct
        ) {
          choice.classList.add(
            "wrong"
          );
        }
      }
    );

    const answerBox =
      card.querySelector(
        ".studyante-test-answer"
      );

    const answerText =
      card.querySelector(
        ".studyante-test-answer-text"
      );

    if (answerText) {

      answerText.textContent =
        "Correct Answer: " +
        String.fromCharCode(
          65 + correct
        );
    }

    if (answerBox) {
      answerBox.hidden = false;
    }
  });


  const percentage =
    Math.round(
      (
        correctCount /
        cards.length
      ) * 100
    );


  const result =
    generatedBody.querySelector(
      "#practiceTestResult"
    );

  if (result) {

    result.hidden = false;

    result.innerHTML = `
      <div class="studyante-test-result-card">

        <h2>
          Test Result
        </h2>

        <div class="studyante-test-score">
          ${correctCount}/${cards.length}
        </div>

        <p>
          Score: ${correctCount} out of
          ${cards.length}
        </p>

        <p>
          Percentage: ${percentage}%
        </p>

      </div>
    `;

    result.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }


  const submitButton =
    generatedBody.querySelector(
      "#submitPracticeTest"
    );

  if (submitButton) {

    submitButton.disabled = true;
    submitButton.textContent =
      "Test Submitted";
  }
}

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
  generatedIcon.textContent = "??";
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
        () => {

            closeAIAttachMenu();

            /* STUDYANTE_CROSS_DEVICE_CAMERA */

            const isTouchDevice =
                navigator.maxTouchPoints > 0 ||
                "ontouchstart" in window;

            const looksLikeMobile =
                /Android|iPhone|iPad|iPod|Mobile/i.test(
                    navigator.userAgent || ""
                );

            /*
             * Phones/tablets:
             * use the native camera input.
             *
             * Laptop/desktop:
             * use the existing live camera.
             */

            if (
                aiCameraInput &&
                (isTouchDevice || looksLikeMobile)
            ) {

                aiCameraInput.value = "";

                aiCameraInput.click();

                return;
            }

            openAICamera();
        }
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

            closeAIAttachMenu();

            /* STUDYANTE_CROSS_DEVICE_IMAGE_UPLOAD */

            if (!aiImageInput) {
                return;
            }

            aiImageInput.value = "";

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

    const userMessage =
        addMessage(
            text,
            "user"
        );

    if (imageForRequest) {
        addImageToChatMessage(
            userMessage,
            imageForRequest
        );
    }

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

        const assistantMessageText =
            loading.querySelector(
                ".message-text"
            );

        if (assistantMessageText) {
            const answer =
                String(
                    data.answer || ""
                );

            if (
                typeof window.studyanteRenderMarkdown ===
                "function"
            ) {
                assistantMessageText.innerHTML =
                    window.studyanteRenderMarkdown(
                        answer
                    );
            } else {
                assistantMessageText.textContent =
                    answer;
            }
        }

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
                ??
            </span>

            <div class="message-text"></div>
        `;
    } else {
        message.innerHTML = `
            <div class="message-text"></div>
        `;
    }

    const messageText =
        message.querySelector(
            ".message-text"
        );

    if (
        role === "assistant" &&
        typeof window.studyanteRenderMarkdown ===
            "function"
    ) {
        messageText.innerHTML =
            window.studyanteRenderMarkdown(
                String(text || "")
            );
    } else {
        messageText.textContent =
            text;
    }

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
                "??";

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

/* ==========================================================
   STUDYante SINGLE-PAGE NAVIGATION
   ========================================================== */

(function () {

    const STUDYANTE_PAGES = [
        "dashboard",
        "upload",
        "library",
        "community",
        "ai"
    ];


    function showStudyantePage(
        pageId,
        updateHash = true
    ) {

        if (
            !STUDYANTE_PAGES.includes(pageId)
        ) {
            pageId = "dashboard";
        }


        STUDYANTE_PAGES.forEach(
            function (id) {

                const page =
                    document.getElementById(id);

                if (!page) {
                    return;
                }

                const active =
                    id === pageId;


                if (active) {

                    page.hidden = false;

                    page.removeAttribute(
                        "hidden"
                    );

                    page.style.setProperty(
                        "display",
                        "block",
                        "important"
                    );

                    page.classList.add(
                        "studyante-page-active"
                    );

                } else {

                    page.hidden = true;

                    page.setAttribute(
                        "hidden",
                        ""
                    );

                    page.style.setProperty(
                        "display",
                        "none",
                        "important"
                    );

                    page.classList.remove(
                        "studyante-page-active"
                    );
                }
            }
        );


        document
            .querySelectorAll(
                ".sidebar nav a"
            )
            .forEach(
                function (link) {

                    const target =
                        (
                            link.dataset.page ||
                            link.getAttribute("href") ||
                            ""
                        )
                        .replace("#", "")
                        .trim();

                    const active =
                        target === pageId;

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
                }
            );


        if (updateHash) {

            history.replaceState(
                null,
                "",
                "#" + pageId
            );
        }


        if (
            pageId === "library" &&
            typeof loadLibrary === "function"
        ) {
            loadLibrary();
        }


        if (
            pageId === "community" &&
            typeof loadCommunity === "function"
        ) {
            loadCommunity();
        }


        if (
            pageId === "ai" &&
            typeof loadChatHistory === "function"
        ) {
            loadChatHistory();
        }
    }


    function getStudyantePageFromLink(
        link
    ) {

        if (!link) {
            return "";
        }

        return (
            link.dataset.page ||
            link.getAttribute("href") ||
            ""
        )
        .replace("#", "")
        .trim();
    }


    function installStudyanteNavigation() {

        document
            .querySelectorAll(
                ".sidebar nav a"
            )
            .forEach(
                function (link) {

                    if (
                        link.dataset.navReady ===
                        "true"
                    ) {
                        return;
                    }

                    link.dataset.navReady =
                        "true";


                    link.addEventListener(
                        "click",
                        function (event) {

                            const pageId =
                                getStudyantePageFromLink(
                                    link
                                );

                            if (
                                !STUDYANTE_PAGES.includes(
                                    pageId
                                )
                            ) {
                                return;
                            }

                            event.preventDefault();
                            event.stopPropagation();

                            showStudyantePage(
                                pageId,
                                true
                            );
                        },
                        true
                    );
                }
            );


        let initialPage =
            window.location.hash
                .replace("#", "")
                .trim();


        if (
            !STUDYANTE_PAGES.includes(
                initialPage
            )
        ) {
            initialPage =
                "dashboard";
        }


        showStudyantePage(
            initialPage,
            false
        );
    }


    window.showStudyantePage =
        showStudyantePage;


    window.addEventListener(
        "hashchange",
        function () {

            const pageId =
                window.location.hash
                    .replace("#", "")
                    .trim();

            if (
                STUDYANTE_PAGES.includes(
                    pageId
                )
            ) {

                showStudyantePage(
                    pageId,
                    false
                );
            }
        }
    );


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            installStudyanteNavigation
        );

    } else {

        installStudyanteNavigation();
    }

})();

/* ===== STUDYANTE_IMAGE_GENERATION_CLIENT ===== */

(function () {

    const STUDYANTE_IMAGE_API =
        "https://stud-ying-production.up.railway.app/api/generate-image";

    function getStudyanteToken() {
        return (
            localStorage.getItem("token") ||
            localStorage.getItem("authToken") ||
            localStorage.getItem("studyanteToken") ||
            ""
        );
    }

    function createImageMessageContainer() {
        const aiMessages = document.getElementById("aiMessages");

        if (!aiMessages) {
            return null;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "message ai-message studyante-generated-image-message";

        const content = document.createElement("div");
        content.className = "message-content";

        wrapper.appendChild(content);
        aiMessages.appendChild(wrapper);

        aiMessages.scrollTop = aiMessages.scrollHeight;

        return content;
    }

    function safeImageFilename(prompt, mimeType) {
        let name = String(prompt || "generated-image")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 45);

        if (!name) {
            name = "generated-image";
        }

        let extension = "png";

        if (mimeType === "image/jpeg") {
            extension = "jpg";
        } else if (mimeType === "image/webp") {
            extension = "webp";
        }

        return "studyante-" + name + "." + extension;
    }

    function displayGeneratedImage(imageData, mimeType, prompt, text) {

        const content = createImageMessageContainer();

        if (!content) {
            return;
        }

        const dataURL =
            "data:" +
            (mimeType || "image/png") +
            ";base64," +
            imageData;

        if (text) {
            const description = document.createElement("div");
            description.className = "generated-image-description";
            description.textContent = text;
            content.appendChild(description);
        }

        const imageWrapper = document.createElement("div");
        imageWrapper.className = "generated-image-wrapper";

        const image = document.createElement("img");
        image.className = "studyante-generated-image";
        image.src = dataURL;
        image.alt = prompt || "Image generated by STUDYante AI";
        image.loading = "lazy";

        imageWrapper.appendChild(image);
        content.appendChild(imageWrapper);

        const actions = document.createElement("div");
        actions.className = "generated-image-actions";

        const download = document.createElement("a");
        download.className = "generated-image-action";
        download.href = dataURL;
        download.download = safeImageFilename(prompt, mimeType);
        download.textContent = "Download";

        const open = document.createElement("button");
        open.type = "button";
        open.className = "generated-image-action";
        open.textContent = "Open Full Size";

        open.addEventListener("click", function () {
            const newWindow = window.open();

            if (newWindow) {
                newWindow.document.write(
                    '<html><head><title>STUDYante AI Image</title></head>' +
                    '<body style="margin:0;background:#111;display:flex;' +
                    'align-items:center;justify-content:center;min-height:100vh;">' +
                    '<img src="' +
                    dataURL +
                    '" style="max-width:100%;max-height:100vh;object-fit:contain;">' +
                    '</body></html>'
                );

                newWindow.document.close();
            }
        });

        const again = document.createElement("button");
        again.type = "button";
        again.className = "generated-image-action";
        again.textContent = "Generate Again";

        again.addEventListener("click", function () {
            generateStudyanteImage(prompt, false);
        });

        actions.appendChild(download);
        actions.appendChild(open);
        actions.appendChild(again);

        content.appendChild(actions);

        const aiMessages = document.getElementById("aiMessages");

        if (aiMessages) {
            aiMessages.scrollTop = aiMessages.scrollHeight;
        }
    }

    function showImageGenerationError(message) {
        if (typeof addMessage === "function") {
            addMessage(
                message || "I could not generate that image. Please try again.",
                "ai"
            );
            return;
        }

        alert(message || "Unable to generate image.");
    }

    async function generateStudyanteImage(prompt, showUserMessage = true) {

        prompt = String(prompt || "").trim();

        if (!prompt) {
            const question = document.getElementById("question");

            if (question) {
                question.focus();
                question.placeholder =
                    "Describe the image you want STUDYante AI to generate...";
            }

            return;
        }

        const question = document.getElementById("question");

        if (showUserMessage && typeof addMessage === "function") {
            addMessage(prompt, "user");
        }

        if (question && showUserMessage) {
            question.value = "";
        }

        let loadingMessage = null;

        if (typeof addMessage === "function") {
            loadingMessage = addMessage(
                "Creating your image...",
                "ai"
            );
        }

        try {

            const headers = {
                "Content-Type": "application/json"
            };

            const token = getStudyanteToken();

            if (token) {
                headers.Authorization = "Bearer " + token;
            }

            const response = await fetch(STUDYANTE_IMAGE_API, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    prompt
                })
            });

            const data = await response.json().catch(() => ({}));

            if (loadingMessage && loadingMessage.remove) {
                loadingMessage.remove();
            }

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Image generation failed."
                );
            }

            if (!data.imageData) {
                throw new Error(
                    "No generated image was returned."
                );
            }

            displayGeneratedImage(
                data.imageData,
                data.mimeType || "image/png",
                prompt,
                data.text || ""
            );

        } catch (error) {

            if (loadingMessage && loadingMessage.remove) {
                loadingMessage.remove();
            }

            console.error("STUDYante image generation:", error);

            showImageGenerationError(
                error.message ||
                "STUDYante AI could not generate the image."
            );
        }
    }

    function installGenerateImageButton() {

        const menu = document.getElementById("aiAttachMenu");

        if (!menu) {
            return;
        }

        if (document.getElementById("aiGenerateImageButton")) {
            return;
        }

        const button = document.createElement("button");

        button.type = "button";
        button.id = "aiGenerateImageButton";
        button.className = "ai-attach-menu-item";

        button.innerHTML =
            '<span class="ai-attach-menu-icon">??</span>' +
            '<span>Generate Image</span>';

        button.addEventListener("click", function (event) {

            event.preventDefault();
            event.stopPropagation();

            menu.classList.remove("show");
            menu.classList.remove("open");
            menu.hidden = true;

            const question = document.getElementById("question");

            const prompt = question
                ? question.value.trim()
                : "";

            generateStudyanteImage(prompt, true);
        });

        menu.appendChild(button);
    }

    window.generateStudyanteImage = generateStudyanteImage;

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            installGenerateImageButton
        );
    } else {
        installGenerateImageButton();
    }

    setTimeout(installGenerateImageButton, 500);

})();


/* ===== STUDYANTE_AUTO_IMAGE_DETECTION ===== */

(function () {

    function isStudyanteImageRequest(text) {

        const prompt = String(text || "")
            .trim()
            .toLowerCase();

        if (!prompt) {
            return false;
        }

        /*
            Examples detected:

            make me a logo
            create a logo for STUDYante
            generate an image of a computer
            make a poster about gender equality
            draw a diagram of the water cycle
            create an illustration
            design a mascot
            generate a banner
        */

        const directImageWords =
            /\b(generate|create|make|design|draw|render|illustrate)\b/;

        const visualWords =
            /\b(image|picture|photo|logo|poster|banner|illustration|drawing|diagram|infographic|mascot|icon|wallpaper|artwork|graphic|cover|flyer|visual)\b/;

        const explicitPatterns = [
            /\bmake me (an?|the)?\s*(logo|image|picture|poster|banner|diagram|illustration|mascot|icon|graphic|flyer)\b/,
            /\bcreate (me )?(an?|the)?\s*(logo|image|picture|poster|banner|diagram|illustration|mascot|icon|graphic|flyer)\b/,
            /\bgenerate (me )?(an?|the)?\s*(logo|image|picture|poster|banner|diagram|illustration|mascot|icon|graphic|flyer)\b/,
            /\bdesign (me )?(an?|the)?\s*(logo|poster|banner|mascot|icon|graphic|flyer)\b/,
            /\bdraw (me )?(an?|the)?\s*(image|picture|diagram|illustration|logo)\b/,
            /\bvisualize\b/,
            /\bturn .* into (an?|the)?\s*(image|picture|diagram|illustration|logo|poster)\b/
        ];

        if (explicitPatterns.some(pattern => pattern.test(prompt))) {
            return true;
        }

        return directImageWords.test(prompt) &&
               visualWords.test(prompt);
    }


    function handleStudyanteImageRequest(event) {

        const question =
            document.getElementById("question");

        if (!question) {
            return false;
        }

        const prompt =
            String(question.value || "").trim();

        if (!isStudyanteImageRequest(prompt)) {
            return false;
        }

        if (
            typeof window.generateStudyanteImage !==
            "function"
        ) {
            return false;
        }

        if (event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }

        window.generateStudyanteImage(
            prompt,
            true
        );

        return true;
    }


    function installStudyanteAutoImageDetection() {

        const askButton =
            document.getElementById("askButton");

        const question =
            document.getElementById("question");

        if (
            askButton &&
            !askButton.dataset.studyanteImageDetection
        ) {

            askButton.dataset.studyanteImageDetection =
                "true";

            askButton.addEventListener(
                "click",
                function (event) {
                    handleStudyanteImageRequest(event);
                },
                true
            );
        }


        if (
            question &&
            !question.dataset.studyanteImageDetection
        ) {

            question.dataset.studyanteImageDetection =
                "true";

            question.addEventListener(
                "keydown",
                function (event) {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        handleStudyanteImageRequest(
                            event
                        );
                    }

                },
                true
            );
        }
    }


    window.isStudyanteImageRequest =
        isStudyanteImageRequest;


    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            installStudyanteAutoImageDetection
        );

    } else {

        installStudyanteAutoImageDetection();
    }


    setTimeout(
        installStudyanteAutoImageDetection,
        500
    );

})();


/* STUDYANTE_NOTES_MARKDOWN_CLEANUP */

/*
   Cleans raw Markdown symbols from generated Study Notes.

   Example:
   ### Overview
   * **Course:** Personal Development

   becomes:

   Overview
   Course: Personal Development
*/

function cleanStudyanteNotesMarkdown(text) {
    if (!text) return "";

    return String(text)

        /* Remove escaped Markdown characters */
        .replace(/\\([*#_`~>])/g, "$1")

        /* Remove heading symbols: # ## ### etc. */
        .replace(/^\s*#{1,6}\s*/gm, "")

        /* Remove bullet *, but keep the text */
        .replace(/^\s*\*\s+/gm, "")

        /* Remove bullet - */
        .replace(/^\s*-\s+/gm, "")

        /* Remove bold/italic **text**, *text* */
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")

        /* Remove underscores used for Markdown emphasis */
        .replace(/__(.*?)__/g, "$1")
        .replace(/_(.*?)_/g, "$1")

        /* Remove leftover Markdown stars */
        .replace(/\*+/g, "")

        /* Remove leftover heading hashes at line beginnings */
        .replace(/^\s*#+\s*/gm, "")

        /* Clean excessive spaces */
        .replace(/[ \t]+/g, " ")

        /* Keep paragraph breaks clean */
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")

        .trim();
}


/*
   Automatically clean generated Notes when they are rendered.
*/

const studyanteNotesObserver = new MutationObserver(() => {

    const generatedArea =
        document.querySelector("#generatedContent") ||
        document.querySelector(".generated-content");

    if (!generatedArea) return;

    const notesHeading = Array.from(
        generatedArea.querySelectorAll("h1, h2, h3, strong")
    ).find(el =>
        /study notes/i.test(el.textContent || "")
    );

    if (!notesHeading) return;

    generatedArea.querySelectorAll("p, div, pre").forEach(element => {

        if (element.children.length > 0) return;

        const original = element.textContent || "";

        if (
            original.includes("###") ||
            original.includes("**") ||
            original.includes("\\*") ||
            original.includes("\\#")
        ) {
            element.textContent =
                cleanStudyanteNotesMarkdown(original);
        }
    });
});


document.addEventListener("DOMContentLoaded", () => {

    studyanteNotesObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

});


/* ==========================================================
   STUDYANTE_SAVED_STUDY_MATERIALS_FRONTEND
   ========================================================== */

let studyanteGeneratedMaterial =
  null;

let studyanteOpeningSavedMaterial =
  false;


function studyanteMaterialInfo(type) {

  const types = {

    notes: {
      icon: "??",
      title: "Notes",
      action: "Open"
    },

    test: {
      icon: "?",
      title: "Practice Test",
      action: "Study"
    },

    game: {
      icon: "??",
      title: "Study Game",
      action: "Play"
    }
  };

  return types[type] || {
    icon: "??",
    title: "Study Material",
    action: "Open"
  };
}


/* ----------------------------------------------------------
   Capture generated Notes / Test / Game
---------------------------------------------------------- */

const studyanteOriginalDisplayGenerated =
  displayGenerated;

displayGenerated =
  function(
    type,
    data,
    sourceFile
  ) {

    studyanteOriginalDisplayGenerated(
      type,
      data,
      sourceFile
    );


    if (
      ![
        "notes",
        "test",
        "game"
      ].includes(type)
    ) {
      return;
    }


    studyanteGeneratedMaterial = {
      type,
      data:
        JSON.parse(
          JSON.stringify(
            data || {}
          )
        ),
      sourceFile:
        sourceFile || ""
    };


    if (
      studyanteOpeningSavedMaterial
    ) {

      studyanteOpeningSavedMaterial =
        false;

      return;
    }


    studyanteAddSaveButton();
  };


function studyanteAddSaveButton() {

  const old =
    document.getElementById(
      "studyanteSaveGenerated"
    );

  if (old) {
    old.remove();
  }


  const button =
    document.createElement(
      "button"
    );

  button.id =
    "studyanteSaveGenerated";

  button.type =
    "button";

  button.className =
    "secondary-btn studyante-save-generated";

  button.textContent =
    "?? Save to My Library";


  button.onclick =
    studyanteSaveGenerated;


  generatedBody.appendChild(
    button
  );
}


async function studyanteSaveGenerated() {

  const material =
    studyanteGeneratedMaterial;

  if (!material) {
    return;
  }


  const info =
    studyanteMaterialInfo(
      material.type
    );


  let baseName =
    material.sourceFile
      ? String(
          material.sourceFile
        ).replace(
          /\.[^.]+$/,
          ""
        )
      : "";


  const suggested =
    baseName
      ? `${baseName} ${info.title}`
      : info.title;


  const entered =
    window.prompt(
      `Name this ${info.title}:`,
      suggested
    );


  if (entered === null) {
    return;
  }


  const name =
    entered.trim();


  if (!name) {

    alert(
      "Enter a name."
    );

    return;
  }


  try {

    const response =
      await fetch(
        `${API_BASE}/api/library/study-materials`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              type:
                material.type,

              name,

              folderId:
                null,

              data:
                material.data
            })
        }
      );


    const result =
      await readResponse(
        response
      );


    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Could not save study material."
      );
    }


    await loadLibrary();


    alert(
      `${info.title} saved to My Library! ?`
    );

  } catch (error) {

    alert(
      error.message
    );
  }
}


/* ----------------------------------------------------------
   Extend My Library
---------------------------------------------------------- */

const studyanteOriginalRenderLibrary =
  renderLibrary;

renderLibrary =
  function() {

    studyanteOriginalRenderLibrary();

    studyanteRenderMaterialCards();
  };


function studyanteRenderMaterialCards() {

  let items =
    Array.isArray(
      libraryData.studyMaterials
    )
      ? [
          ...libraryData.studyMaterials
        ]
      : [];


  if (
    activeFolderFilter ===
      "uncategorized"
  ) {

    items =
      items.filter(
        item =>
          !item.folderId
      );

  } else if (
    activeFolderFilter
  ) {

    items =
      items.filter(
        item =>
          item.folderId ===
            activeFolderFilter
      );
  }


  if (
    items.length > 0 &&
    libraryStatus
  ) {
    libraryStatus.hidden =
      true;
  }


  items.forEach(
    item => {

      libraryGrid.appendChild(
        studyanteCreateMaterialCard(
          item
        )
      );
    }
  );
}


function studyanteCreateMaterialCard(
  item
) {

  const info =
    studyanteMaterialInfo(
      item.type
    );


  const card =
    document.createElement(
      "div"
    );

  card.className =
    "library-card studyante-saved-material";


  const folder =
    item.folderId
      ? getFolder(
          item.folderId
        )
      : null;


  card.innerHTML = `

    <div class="studyante-saved-material-header">

      <div class="studyante-saved-material-icon">
        ${info.icon}
      </div>

      <div>
        <h3>
          ${escapeHTML(item.name)}
        </h3>

        <span class="studyante-saved-material-type">
          ${escapeHTML(info.title)}
        </span>
      </div>

    </div>


    <div class="studyante-saved-material-folder">

      ${
        folder
          ? `?? ${escapeHTML(folder.name)}`
          : "?? Uncategorized"
      }

    </div>


    <div class="studyante-saved-material-actions">

      <button
        type="button"
        class="secondary-btn studyante-open-material"
      >
        ${escapeHTML(info.action)}
      </button>


      <select
        class="studyante-move-material"
      >
        ${folderOptions(item.folderId || "")}
      </select>


      <button
        type="button"
        class="delete-btn studyante-delete-material"
      >
        Delete
      </button>

    </div>
  `;


  card
    .querySelector(
      ".studyante-open-material"
    )
    .onclick =
      () =>
        studyanteOpenMaterial(
          item
        );


  card
    .querySelector(
      ".studyante-move-material"
    )
    .onchange =
      event =>
        studyanteMoveMaterial(
          item.id,
          event.target.value
        );


  card
    .querySelector(
      ".studyante-delete-material"
    )
    .onclick =
      () =>
        studyanteDeleteMaterial(
          item
        );


  return card;
}


function studyanteOpenMaterial(
  item
) {

  if (
    !item ||
    !item.data
  ) {

    alert(
      "Saved material is empty."
    );

    return;
  }


  if (
    typeof window.showStudyantePage ===
      "function"
  ) {

    window.showStudyantePage(
      "upload"
    );
  }


  studyanteOpeningSavedMaterial =
    true;


  displayGenerated(
    item.type,
    JSON.parse(
      JSON.stringify(
        item.data
      )
    ),
    item.name
  );

  if (item.type === "game") {
    studyanteRebindGameChoices();
  }


  setTimeout(
    () => {

      generatedContent.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    },
    100
  );
}


async function studyanteMoveMaterial(
  id,
  folderId
) {

  try {

    const response =
      await fetch(
        `${API_BASE}/api/library/study-materials/${encodeURIComponent(id)}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              folderId:
                folderId || null
            })
        }
      );


    const result =
      await readResponse(
        response
      );


    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Could not move study material."
      );
    }


    await loadLibrary();

  } catch (error) {

    alert(
      error.message
    );
  }
}


async function studyanteDeleteMaterial(
  item
) {

  if (
    !window.confirm(
      `Delete "${item.name}" from My Library?`
    )
  ) {
    return;
  }


  try {

    const response =
      await fetch(
        `${API_BASE}/api/library/study-materials/${encodeURIComponent(item.id)}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await readResponse(
        response
      );


    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Could not delete study material."
      );
    }


    await loadLibrary();

  } catch (error) {

    alert(
      error.message
    );
  }
}

/* ==========================================================
   STUDYANTE_GAME_REBIND_FIX
   ========================================================== */

function studyanteRebindGameChoices() {

  if (!generatedBody) {
    return;
  }

  generatedBody
    .querySelectorAll(".game-choice")
    .forEach(button => {

      button.disabled = false;

      button.onclick = () => {
        checkGameAnswer(button);
      };
    });
}

/* STUDYANTE_MOBILE_ATTACHMENT_FIX_START */

(function installStudyanteMobileAttachments() {

    function getElement(id) {
        return document.getElementById(id);
    }

    function closeMenu() {

        const menu = getElement("aiAttachMenu");
        const button = getElement("aiAttachButton");

        if (menu) {
            menu.hidden = true;
        }

        if (button) {
            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    function openMenu() {

        const menu = getElement("aiAttachMenu");
        const button = getElement("aiAttachButton");

        if (!menu) {
            return;
        }

        menu.hidden = false;

        if (button) {
            button.setAttribute(
                "aria-expanded",
                "true"
            );
        }
    }


    /*
     * Delegated handling makes the controls reliable
     * even if the AI area gets rebuilt/re-rendered.
     */

    document.addEventListener(
        "click",
        function (event) {

            const target =
                event.target instanceof Element
                    ? event.target
                    : null;

            if (!target) {
                return;
            }


            /*
             * + BUTTON
             */

            const attachButton =
                target.closest("#aiAttachButton");

            if (attachButton) {

                event.preventDefault();
                event.stopPropagation();

                const menu =
                    getElement("aiAttachMenu");

                if (!menu) {
                    return;
                }

                if (menu.hidden) {
                    openMenu();
                } else {
                    closeMenu();
                }

                return;
            }


            /*
             * UPLOAD FILE
             */

            const uploadButton =
                target.closest("#aiImageButton");

            if (uploadButton) {

                event.preventDefault();
                event.stopPropagation();

                const input =
                    getElement("aiImageInput");

                closeMenu();

                if (!input) {
                    alert(
                        "Image upload is not available."
                    );

                    return;
                }

                input.value = "";

                input.click();

                return;
            }


            /*
             * CAMERA
             */

            const cameraButton =
                target.closest("#aiCameraButton");

            if (cameraButton) {

                event.preventDefault();
                event.stopPropagation();

                closeMenu();

                const cameraInput =
                    getElement("aiCameraInput");

                const touchDevice =
                    navigator.maxTouchPoints > 0 ||
                    "ontouchstart" in window;

                const mobileBrowser =
                    /Android|iPhone|iPad|iPod|Mobile/i.test(
                        navigator.userAgent || ""
                    );


                /*
                 * PHONE / TABLET
                 */

                if (
                    cameraInput &&
                    (touchDevice || mobileBrowser)
                ) {

                    cameraInput.value = "";

                    cameraInput.click();

                    return;
                }


                /*
                 * LAPTOP / DESKTOP
                 */

                if (
                    typeof openAICamera ===
                    "function"
                ) {

                    openAICamera();

                    return;
                }


                /*
                 * FALLBACK
                 */

                if (cameraInput) {

                    cameraInput.value = "";

                    cameraInput.click();

                    return;
                }


                alert(
                    "Camera is not available on this device."
                );

                return;
            }


            /*
             * Click outside menu
             */

            const menu =
                getElement("aiAttachMenu");

            if (
                menu &&
                !menu.hidden &&
                !target.closest("#aiAttachMenu")
            ) {
                closeMenu();
            }

        },
        true
    );


    /*
     * Make sure file inputs always react.
     */

    document.addEventListener(
        "change",
        function (event) {

            const target = event.target;

            if (
                !(target instanceof HTMLInputElement)
            ) {
                return;
            }

            if (
                target.id !== "aiImageInput" &&
                target.id !== "aiCameraInput"
            ) {
                return;
            }

            const file =
                target.files &&
                target.files.length
                    ? target.files[0]
                    : null;

            if (!file) {
                return;
            }

            if (
                typeof setAIImage ===
                "function"
            ) {
                setAIImage(file);
            }

        },
        true
    );

})();

/* STUDYANTE_MOBILE_ATTACHMENT_FIX_END */
