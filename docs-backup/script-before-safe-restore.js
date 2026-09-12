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
    `${formatFileSize(file.size)} â€¢ Saving to My Library...`;

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
        `${formatFileSize(data.file.size)} â€¢ Saved in My Library âœ…`;
    }

    await loadLibrary();
  } catch (error) {
    console.error(error);

    if (uploadedFile === file) {
      fileSize.textContent =
        `${formatFileSize(file.size)} â€¢ Could not save to My Library`;
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
      `âš ï¸ ${escapeHTML(error.message)}`;
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
        `ðŸ“ ${folder.name}`;

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
      ðŸ“„
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
      â€¢
      ${formatFileSize(item.size)}
    </p>

    <small>
      ðŸ“ ${
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
      ðŸ§ 
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
      ðŸ“ ${
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
    `${formatFileSize(item.size)} â€¢ From My Library`;

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
      âœ•
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
  generatedIcon.textContent = "âœ¨";

  generatedTitle.textContent =
    `Creating ${titles[type]}...`;

  generatedBody.innerHTML = `
    <div class="loading-box">
      ðŸ§  Studying AI is reading your lesson...
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
    generatedIcon.textContent = "ðŸ“";
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

    generatedIcon.textContent = "ðŸ§ ";

    generatedTitle.textContent =
      `${flashcards.length} Flashcards`;

    renderFlashcard(true);

    return;
  }

  if (type === "test") {
    generatedIcon.textContent = "âœ…";
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
    generatedIcon.textContent = "ðŸŽ®";
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
          â† Previous
        </button>

        <button
          id="nextCard"
          class="primary-btn"
          type="button"
        >
          Next â†’
        </button>

        ${
          showSaveButton
            ? `
              <button
                id="saveAIFlashcards"
                class="secondary-btn"
                type="button"
              >
                ðŸ’¾ Save to My Library
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

  generatedIcon.textContent = "ðŸ§ ";

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
        "Flashcards saved to My Library! âœ…"
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
  generatedIcon.textContent = "âš ï¸";
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
                ðŸ¤–
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
                "ðŸ—‘";

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
        "community",
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
            '<span class="ai-attach-menu-icon">ðŸŽ¨</span>' +
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



/* ==========================================================
   STUDYANTE_COMMUNITY_FRONTEND
   ========================================================== */

let studyanteCommunityData = {
    files: [],
    flashcardSets: []
};

let studyanteCommunityIsAdmin = false;


/* ----------------------------------------------------------
   STATUS BADGE
---------------------------------------------------------- */

function getStudyanteCommunityStatus(item) {

    const status =
        String(
            item.communityStatus ||
            "private"
        ).toLowerCase();

    if (status === "pending") {
        return {
            text: "⏳ Pending",
            className:
                "community-status-pending"
        };
    }

    if (status === "approved") {
        return {
            text: "✅ Approved",
            className:
                "community-status-approved"
        };
    }

    if (status === "rejected") {
        return {
            text: "❌ Rejected",
            className:
                "community-status-rejected"
        };
    }

    return {
        text: "🔒 Private",
        className:
            "community-status-private"
    };
}


/* ----------------------------------------------------------
   ADD SUBMIT BUTTONS TO MY LIBRARY
---------------------------------------------------------- */

if (
    typeof createFileCard ===
    "function"
) {

    const originalStudyanteCreateFileCard =
        createFileCard;

    createFileCard =
        function(item) {

            const card =
                originalStudyanteCreateFileCard(
                    item
                );

            addStudyanteSubmitControls(
                card,
                item,
                "file"
            );

            return card;
        };
}


if (
    typeof createFlashcardSetCard ===
    "function"
) {

    const originalStudyanteCreateFlashcardCard =
        createFlashcardSetCard;

    createFlashcardSetCard =
        function(set) {

            const card =
                originalStudyanteCreateFlashcardCard(
                    set
                );

            addStudyanteSubmitControls(
                card,
                set,
                "flashcards"
            );

            return card;
        };
}


function addStudyanteSubmitControls(
    card,
    item,
    type
) {

    if (
        !card ||
        card.querySelector(
            ".community-owner-controls"
        )
    ) {
        return;
    }


    const status =
        getStudyanteCommunityStatus(
            item
        );


    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "community-owner-controls";


    const badge =
        document.createElement(
            "span"
        );

    badge.className =
        `community-status-badge ${status.className}`;

    badge.textContent =
        status.text;

    wrapper.appendChild(
        badge
    );


    const currentStatus =
        String(
            item.communityStatus ||
            "private"
        ).toLowerCase();


    if (
        currentStatus === "private" ||
        currentStatus === "rejected"
    ) {

        const submitButton =
            document.createElement(
                "button"
            );

        submitButton.type =
            "button";

        submitButton.className =
            "secondary-btn community-submit-button";

        submitButton.textContent =
            currentStatus ===
            "rejected"
                ? "↻ Submit Again"
                : "🌐 Submit for Approval";


        submitButton.addEventListener(
            "click",
            async event => {

                event.stopPropagation();

                await submitStudyanteCommunityMaterial(
                    type,
                    item.id,
                    submitButton
                );
            }
        );


        wrapper.appendChild(
            submitButton
        );
    }


    card.appendChild(
        wrapper
    );
}


/* ----------------------------------------------------------
   SUBMIT OWN MATERIAL
---------------------------------------------------------- */

async function submitStudyanteCommunityMaterial(
    type,
    id,
    button
) {

    if (
        !confirm(
            "Submit this study material for administrator approval?"
        )
    ) {
        return;
    }


    const originalText =
        button
            ? button.textContent
            : "";


    if (button) {
        button.disabled = true;
        button.textContent =
            "Submitting...";
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/community/submit/${type}/${encodeURIComponent(
                    id
                )}`,
                {
                    method:
                        "POST"
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
                "Could not submit material."
            );
        }


        alert(
            "Submitted for approval! ✅"
        );


        if (
            typeof loadLibrary ===
            "function"
        ) {

            await loadLibrary();
        }

    }
    catch (error) {

        alert(
            error.message
        );

        if (button) {
            button.disabled = false;
            button.textContent =
                originalText;
        }
    }
}


/* ----------------------------------------------------------
   LOAD COMMUNITY
---------------------------------------------------------- */

async function loadStudyanteCommunity() {

    const status =
        document.getElementById(
            "communityStatus"
        );

    const grid =
        document.getElementById(
            "communityGrid"
        );


    if (
        !status ||
        !grid
    ) {
        return;
    }


    status.hidden = false;

    status.textContent =
        "Loading community materials...";

    grid.innerHTML = "";


    try {

        const [
            communityResponse,
            statusResponse
        ] =
            await Promise.all([
                fetch(
                    `${API_BASE}/api/community`
                ),

                fetch(
                    `${API_BASE}/api/community/status`
                )
            ]);


        const communityData =
            await readResponse(
                communityResponse
            );


        const accountData =
            await readResponse(
                statusResponse
            );


        if (
            !communityResponse.ok ||
            !communityData.success
        ) {

            throw new Error(
                communityData.message ||
                "Could not load Community Notes."
            );
        }


        studyanteCommunityData = {
            files:
                Array.isArray(
                    communityData.files
                )
                    ? communityData.files
                    : [],

            flashcardSets:
                Array.isArray(
                    communityData.flashcardSets
                )
                    ? communityData.flashcardSets
                    : []
        };


        studyanteCommunityIsAdmin =
            Boolean(
                accountData &&
                accountData.isAdmin
            );


        renderStudyanteCommunity();


        const adminPanel =
            document.getElementById(
                "communityAdminPanel"
            );


        if (adminPanel) {

            adminPanel.hidden =
                !studyanteCommunityIsAdmin;
        }


        if (
            studyanteCommunityIsAdmin
        ) {

            await loadStudyantePendingCommunity();
        }

    }
    catch (error) {

        grid.innerHTML = "";

        status.hidden = false;

        status.textContent =
            `⚠️ ${error.message}`;
    }
}


/* ----------------------------------------------------------
   RENDER APPROVED MATERIALS
---------------------------------------------------------- */

function renderStudyanteCommunity() {

    const status =
        document.getElementById(
            "communityStatus"
        );

    const grid =
        document.getElementById(
            "communityGrid"
        );


    if (
        !status ||
        !grid
    ) {
        return;
    }


    grid.innerHTML = "";


    const files =
        studyanteCommunityData.files;

    const sets =
        studyanteCommunityData
            .flashcardSets;


    if (
        files.length === 0 &&
        sets.length === 0
    ) {

        status.hidden = false;

        status.textContent =
            "No approved community materials yet.";

        return;
    }


    status.hidden = true;


    files.forEach(
        item => {

            grid.appendChild(
                createStudyanteCommunityFileCard(
                    item
                )
            );
        }
    );


    sets.forEach(
        item => {

            grid.appendChild(
                createStudyanteCommunityFlashcardCard(
                    item
                )
            );
        }
    );
}


/* ----------------------------------------------------------
   COMMUNITY FILE CARD
---------------------------------------------------------- */

function createStudyanteCommunityFileCard(
    item
) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "library-card community-card";


    card.innerHTML = `
        <div class="library-card-icon">
            📄
        </div>

        <span class="community-public-badge">
            ✅ Approved
        </span>

        <h3>
            ${escapeHTML(
                item.name || "Study Material"
            )}
        </h3>

        <p class="community-author">
            👤 ${escapeHTML(
                item.author ||
                "STUDYante User"
            )}
        </p>

        <div class="library-actions">
            <button
                type="button"
                class="primary-btn community-view-file"
            >
                View
            </button>
        </div>
    `;


    card
        .querySelector(
            ".community-view-file"
        )
        .addEventListener(
            "click",
            () => {

                viewStudyanteCommunityFile(
                    item
                );
            }
        );


    return card;
}


/* ----------------------------------------------------------
   COMMUNITY FLASHCARD CARD
---------------------------------------------------------- */

function createStudyanteCommunityFlashcardCard(
    set
) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "library-card community-card";


    const count =
        Array.isArray(
            set.flashcards
        )
            ? set.flashcards.length
            : 0;


    card.innerHTML = `
        <div class="library-card-icon">
            🧠
        </div>

        <span class="community-public-badge">
            ✅ Approved
        </span>

        <h3>
            ${escapeHTML(
                set.name ||
                "Flashcards"
            )}
        </h3>

        <p>
            ${count} flashcard${
                count === 1
                    ? ""
                    : "s"
            }
        </p>

        <p class="community-author">
            👤 ${escapeHTML(
                set.author ||
                "STUDYante User"
            )}
        </p>

        <div class="library-actions">

            <button
                type="button"
                class="primary-btn community-study-set"
            >
                Study
            </button>

            <button
                type="button"
                class="secondary-btn community-copy-set"
            >
                💾 Save Copy
            </button>

        </div>
    `;


    card
        .querySelector(
            ".community-study-set"
        )
        .addEventListener(
            "click",
            () => {

                showStudyanteCommunityFlashcards(
                    set
                );
            }
        );


    card
        .querySelector(
            ".community-copy-set"
        )
        .addEventListener(
            "click",
            async event => {

                await copyStudyanteCommunityFlashcards(
                    set,
                    event.currentTarget
                );
            }
        );


    return card;
}


/* ----------------------------------------------------------
   VIEW COMMUNITY FILE
---------------------------------------------------------- */

async function viewStudyanteCommunityFile(
    item
) {

    try {

        const response =
            await fetch(
                `${API_BASE}/api/community/file/${encodeURIComponent(
                    item.id
                )}/content`
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
                "Could not open material."
            );
        }


        const material =
            data.material || {};


        showStudyanteCommunityModal(
            material.name ||
            "Study Material",

            `
                <p class="community-modal-author">
                    👤 ${escapeHTML(
                        material.author ||
                        "STUDYante User"
                    )}
                </p>

                <div class="community-note-content">
                    ${escapeHTML(
                        material.text ||
                        "No readable text is available for this material."
                    )}
                </div>
            `
        );

    }
    catch (error) {

        alert(
            error.message
        );
    }
}


/* ----------------------------------------------------------
   STUDY COMMUNITY FLASHCARDS
---------------------------------------------------------- */

function showStudyanteCommunityFlashcards(
    set
) {

    const cards =
        Array.isArray(
            set.flashcards
        )
            ? set.flashcards
            : [];


    if (!cards.length) {

        alert(
            "This flashcard set has no cards."
        );

        return;
    }


    const content =
        cards
            .map(
                (card, index) => `
                    <div class="community-flashcard-preview">

                        <strong>
                            ${index + 1}.
                            ${escapeHTML(
                                card.question || ""
                            )}
                        </strong>

                        <p>
                            ${escapeHTML(
                                card.answer || ""
                            )}
                        </p>

                    </div>
                `
            )
            .join("");


    showStudyanteCommunityModal(
        set.name ||
        "Community Flashcards",

        `
            <p class="community-modal-author">
                👤 ${escapeHTML(
                    set.author ||
                    "STUDYante User"
                )}
            </p>

            ${content}
        `
    );
}


/* ----------------------------------------------------------
   SAVE FLASHCARD COPY
---------------------------------------------------------- */

async function copyStudyanteCommunityFlashcards(
    set,
    button
) {

    const originalText =
        button.textContent;


    button.disabled = true;
    button.textContent =
        "Saving...";


    try {

        const response =
            await fetch(
                `${API_BASE}/api/community/flashcards/${encodeURIComponent(
                    set.id
                )}/copy`,
                {
                    method:
                        "POST"
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
                "Could not save copy."
            );
        }


        alert(
            "Saved privately to My Library! ✅"
        );


        if (
            typeof loadLibrary ===
            "function"
        ) {

            await loadLibrary();
        }

    }
    catch (error) {

        alert(
            error.message
        );
    }
    finally {

        button.disabled = false;
        button.textContent =
            originalText;
    }
}


/* ----------------------------------------------------------
   COMMUNITY MODAL
---------------------------------------------------------- */

function showStudyanteCommunityModal(
    title,
    html
) {

    let modal =
        document.getElementById(
            "studyanteCommunityModal"
        );


    if (!modal) {

        modal =
            document.createElement(
                "div"
            );

        modal.id =
            "studyanteCommunityModal";

        modal.className =
            "community-modal-overlay";

        modal.innerHTML = `
            <div class="community-modal">

                <div class="community-modal-header">

                    <h2 id="communityModalTitle"></h2>

                    <button
                        id="communityModalClose"
                        type="button"
                        class="modal-close"
                    >
                        ✕
                    </button>

                </div>

                <div
                    id="communityModalBody"
                    class="community-modal-body"
                ></div>

            </div>
        `;


        document.body.appendChild(
            modal
        );


        modal
            .querySelector(
                "#communityModalClose"
            )
            .addEventListener(
                "click",
                () => {

                    modal.classList.remove(
                        "show"
                    );
                }
            );


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    modal.classList.remove(
                        "show"
                    );
                }
            }
        );
    }


    modal
        .querySelector(
            "#communityModalTitle"
        )
        .textContent =
            title;


    modal
        .querySelector(
            "#communityModalBody"
        )
        .innerHTML =
            html;


    modal.classList.add(
        "show"
    );
}


/* ----------------------------------------------------------
   ADMIN PENDING
---------------------------------------------------------- */

async function loadStudyantePendingCommunity() {

    if (
        !studyanteCommunityIsAdmin
    ) {
        return;
    }


    const status =
        document.getElementById(
            "communityPendingStatus"
        );

    const grid =
        document.getElementById(
            "communityPendingGrid"
        );


    if (
        !status ||
        !grid
    ) {
        return;
    }


    status.hidden = false;

    status.textContent =
        "Loading pending submissions...";

    grid.innerHTML = "";


    try {

        const response =
            await fetch(
                `${API_BASE}/api/admin/community/pending`
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
                "Could not load pending materials."
            );
        }


        const files =
            Array.isArray(
                data.files
            )
                ? data.files
                : [];


        const sets =
            Array.isArray(
                data.flashcardSets
            )
                ? data.flashcardSets
                : [];


        if (
            files.length === 0 &&
            sets.length === 0
        ) {

            status.hidden = false;

            status.textContent =
                "No materials are waiting for approval.";

            return;
        }


        status.hidden = true;


        files.forEach(
            item => {

                grid.appendChild(
                    createStudyanteAdminCommunityCard(
                        item,
                        "file"
                    )
                );
            }
        );


        sets.forEach(
            item => {

                grid.appendChild(
                    createStudyanteAdminCommunityCard(
                        item,
                        "flashcards"
                    )
                );
            }
        );

    }
    catch (error) {

        status.hidden = false;

        status.textContent =
            `⚠️ ${error.message}`;
    }
}


/* ----------------------------------------------------------
   ADMIN CARD
---------------------------------------------------------- */

function createStudyanteAdminCommunityCard(
    item,
    type
) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "library-card community-admin-card";


    const authorName =
        item.author &&
        item.author.name
            ? item.author.name
            : "Unknown User";


    const authorEmail =
        item.author &&
        item.author.email
            ? item.author.email
            : "";


    card.innerHTML = `
        <div class="library-card-icon">
            ${type === "file"
                ? "📄"
                : "🧠"
            }
        </div>

        <span class="community-status-badge community-status-pending">
            ⏳ Pending
        </span>

        <h3>
            ${escapeHTML(
                item.name ||
                "Untitled"
            )}
        </h3>

        <p>
            👤 ${escapeHTML(
                authorName
            )}
        </p>

        ${
            authorEmail
                ? `
                    <small>
                        ${escapeHTML(
                            authorEmail
                        )}
                    </small>
                `
                : ""
        }

        <div class="library-actions">

            <button
                type="button"
                class="primary-btn community-approve"
            >
                ✅ Approve
            </button>

            <button
                type="button"
                class="danger-btn community-reject"
            >
                ❌ Reject
            </button>

        </div>
    `;


    card
        .querySelector(
            ".community-approve"
        )
        .addEventListener(
            "click",
            () => {

                reviewStudyanteCommunityMaterial(
                    type,
                    item.id,
                    "approve"
                );
            }
        );


    card
        .querySelector(
            ".community-reject"
        )
        .addEventListener(
            "click",
            () => {

                reviewStudyanteCommunityMaterial(
                    type,
                    item.id,
                    "reject"
                );
            }
        );


    return card;
}


/* ----------------------------------------------------------
   ADMIN APPROVE / REJECT
---------------------------------------------------------- */

async function reviewStudyanteCommunityMaterial(
    type,
    id,
    action
) {

    const actionWord =
        action === "approve"
            ? "approve"
            : "reject";


    if (
        !confirm(
            `Are you sure you want to ${actionWord} this material?`
        )
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/admin/community/${type}/${encodeURIComponent(
                    id
                )}/${action}`,
                {
                    method:
                        "POST"
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
                "Could not review material."
            );
        }


        alert(
            action === "approve"
                ? "Material approved and published! ✅"
                : "Material rejected."
        );


        await loadStudyanteCommunity();

    }
    catch (error) {

        alert(
            error.message
        );
    }
}


/* ----------------------------------------------------------
   BUTTON EVENTS
---------------------------------------------------------- */

const studyanteRefreshCommunity =
    document.getElementById(
        "refreshCommunity"
    );


if (studyanteRefreshCommunity) {

    studyanteRefreshCommunity
        .addEventListener(
            "click",
            loadStudyanteCommunity
        );
}


const studyanteRefreshPending =
    document.getElementById(
        "refreshPendingCommunity"
    );


if (studyanteRefreshPending) {

    studyanteRefreshPending
        .addEventListener(
            "click",
            loadStudyantePendingCommunity
        );
}


/* ----------------------------------------------------------
   LOAD COMMUNITY WHEN PAGE IS OPENED
---------------------------------------------------------- */

document.addEventListener(
    "click",
    event => {

        const link =
            event.target.closest(
                '[data-page="community"]'
            );


        if (link) {

            setTimeout(
                loadStudyanteCommunity,
                50
            );
        }
    }
);


/* Reload library so approval controls appear */
if (
    typeof loadLibrary ===
    "function"
) {

    loadLibrary();
}

