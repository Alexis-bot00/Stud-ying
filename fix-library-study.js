const fs = require("fs");

const file = "./docs/script.js";

let code = fs
    .readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n");

const start =
    code.indexOf(
        "function openSavedFlashcards(set) {"
    );

if (start === -1) {
    throw new Error(
        "openSavedFlashcards() not found."
    );
}

const nextFunction =
    code.indexOf(
        "\nconfirmSaveAIFlashcards.addEventListener(",
        start
    );

if (nextFunction === -1) {
    throw new Error(
        "Could not find end of openSavedFlashcards()."
    );
}

const replacement = `function openSavedFlashcards(set) {
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

`;

code =
    code.substring(0, start) +
    replacement +
    code.substring(nextFunction);

fs.writeFileSync(
    file,
    code,
    "utf8"
);

console.log("");
console.log(
    "Library Study button fixed."
);
console.log("");
