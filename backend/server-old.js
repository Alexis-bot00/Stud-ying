import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { OfficeParser } from "officeparser";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TEXT_LENGTH = 120000;
const MAX_FLASHCARDS = 50;
const MAX_QUESTIONS = 100;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const uploadFolder = path.resolve(process.cwd(), "uploads");
const libraryFolder = path.resolve(process.cwd(), "library");
const libraryFilesFolder = path.join(libraryFolder, "files");
const libraryIndexFile = path.join(libraryFolder, "index.json");

fs.mkdirSync(uploadFolder, { recursive: true });
fs.mkdirSync(libraryFilesFolder, { recursive: true });

if (!fs.existsSync(libraryIndexFile)) {
  fs.writeFileSync(
    libraryIndexFile,
    JSON.stringify(
      {
        folders: [],
        files: [],
        flashcardSets: []
      },
      null,
      2
    )
  );
}

function readLibrary() {
  try {
    const raw = fs.readFileSync(libraryIndexFile, "utf8");
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      return {
        folders: [],
        files: data,
        flashcardSets: []
      };
    }

    return {
      folders: Array.isArray(data.folders) ? data.folders : [],
      files: Array.isArray(data.files) ? data.files : [],
      flashcardSets: Array.isArray(data.flashcardSets)
        ? data.flashcardSets
        : []
    };
  } catch {
    return {
      folders: [],
      files: [],
      flashcardSets: []
    };
  }
}

function writeLibrary(data) {
  fs.writeFileSync(
    libraryIndexFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function removeFile(filePath) {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(error);
  }
}

const allowedExtensions = new Set([
  ".pdf",
  ".docx",
  ".pptx",
  ".txt"
]);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadFolder);
  },

  filename(req, file, callback) {
    const safeName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      "-"
    );

    callback(
      null,
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${safeName}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE
  },

  fileFilter(req, file, callback) {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return callback(
        new Error(
          "Only PDF, DOCX, PPTX and TXT files are allowed."
        )
      );
    }

    callback(null, true);
  }
});

async function extractText(filePath, originalName) {
  const extension = path
    .extname(originalName)
    .toLowerCase();

  if (extension === ".txt") {
    return fs.readFileSync(filePath, "utf8");
  }

  const parsed = await OfficeParser.parseOffice(filePath);
  const result = await parsed.to("text");

  return result?.value || "";
}

function prepareText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function parseAIJSON(output) {
  let cleaned = String(output || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first !== -1 && last !== -1) {
    cleaned = cleaned.slice(first, last + 1);
  }

  return JSON.parse(cleaned);
}

function getFlashcardCount(value) {
   const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number)) {
    return 20;
  }

  return Math.min(
    MAX_QUESTIONS,
    Math.max(10, number)
  );
}
function publicFile(item) {
  return {
    id: item.id,
    name: item.name,
    extension: item.extension,
    size: item.size,
    uploadedAt: item.uploadedAt,
    folderId: item.folderId || null
  };
}

function buildPrompt(type, lesson, count) {
  const rules = `
You are Studying AI.

Use ONLY the information contained in the lesson.

Do not invent information.

Explain information clearly for a student.

LESSON:

${lesson}
`;

  if (type === "notes") {
    return `
${rules}

Create complete study notes.

Include:
- Overview
- Key points
- Important terms and definitions
- Important facts
- Names and dates when available
- Processes and steps
- Formulas when available
- Examples
- Quick review

Use clear headings and bullet points.
`;
  }

  if (type === "flashcards") {
    return `
${rules}

Create up to ${count} useful flashcards.

If enough unique information exists,
create exactly ${count} flashcards.

Do not repeat questions just to reach the requested number.

Return ONLY valid JSON:

{
  "flashcards": [
    {
      "question": "Question",
      "answer": "Answer"
    }
  ]
}
`;
  }

if (type === "test") {
  return `
${rules}

Create up to ${count} multiple choice practice test questions.

If the lesson contains enough unique information,
create exactly ${count} questions.

If there is not enough information,
create fewer questions instead of repeating or inventing facts.

Maximum allowed is ${MAX_QUESTIONS} questions.

Cover different parts of the lesson.

Return ONLY valid JSON:

{
  "questions": [
    {
      "question": "Question",
      "choices": [
        "Choice A",
        "Choice B",
        "Choice C",
        "Choice D"
      ],
      "answer": 0,
      "explanation": "Explanation"
    }
  ]
}

answer:
0 = A
1 = B
2 = C
3 = D
`;
}
  }

 if (type === "game") {
  return `
${rules}

Create up to ${count} multiple choice study game questions.

If the lesson contains enough unique information,
create exactly ${count} questions.

If there is not enough information,
create fewer questions instead of repeating or inventing facts.

Maximum allowed is ${MAX_QUESTIONS} questions.

Cover different parts of the lesson.

Return ONLY valid JSON:

{
  "game": [
    {
      "question": "Question",
      "choices": [
        "Choice A",
        "Choice B",
        "Choice C",
        "Choice D"
      ],
      "answer": 0
    }
  ]
}
`;

  throw new Error("Invalid generation type.");
}

function buildChatPrompt(question, lesson) {
  return `
You are Studying AI.

Answer the student's question using ONLY the uploaded lesson.

If the answer is not found in the lesson, say:

"The answer is not found in the uploaded lesson."

QUESTION:

${question}

LESSON:

${lesson}
`;
}

async function askOllama(prompt, jsonMode = false) {
  const body = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: {
      temperature: 0.25
    }
  };

  if (jsonMode) {
    body.format = "json";
  }

  let response;

  try {
    response = await fetch(
      "http://127.0.0.1:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to Ollama. Make sure Ollama is running."
    );
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();

  if (!data.response) {
    throw new Error("Ollama returned an empty response.");
  }

  return data.response.trim();
}

async function askGemini(prompt, apiKey, jsonMode = false) {
  if (!apiKey) {
    throw new Error("Please enter your Gemini API key.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const config = {
      temperature: 0.25
    };

    if (jsonMode) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config
    });

    if (!response.text?.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    return response.text.trim();
  } catch (error) {
    const message = error?.message || String(error);

    if (
      message.includes("429") ||
      message.toLowerCase().includes("quota")
    ) {
      throw new Error(
        "Gemini free-tier limit reached. Please try again later."
      );
    }

    if (
      message.includes("401") ||
      message.includes("403")
    ) {
      throw new Error(
        "Your Gemini API key is invalid or does not have access."
      );
    }

    throw new Error(message);
  }
}

async function askProvider(
  provider,
  prompt,
  apiKey,
  jsonMode = false
) {
  if (provider === "ollama") {
    return askOllama(prompt, jsonMode);
  }

  if (provider === "gemini") {
    return askGemini(prompt, apiKey, jsonMode);
  }

  throw new Error("Invalid AI provider.");
}

async function getLesson(req) {
  const libraryId = String(req.body.libraryId || "").trim();

  if (libraryId) {
    const library = readLibrary();

    const item = library.files.find(
      file => file.id === libraryId
    );

    if (!item) {
      throw new Error(
        "The selected library file was not found."
      );
    }

    return {
      lesson: item.text,
      name: item.name
    };
  }

  if (!req.file) {
    throw new Error("Please upload a study material.");
  }

  const raw = await extractText(
    req.file.path,
    req.file.originalname
  );

  return {
    lesson: prepareText(raw),
    name: req.file.originalname
  };
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Studying backend is running.",
    geminiModel: GEMINI_MODEL,
    ollamaModel: OLLAMA_MODEL,
    maxFlashcards: MAX_FLASHCARDS
  });
});

app.get("/api/library", (req, res) => {
  const library = readLibrary();

  res.json({
    success: true,

    folders: library.folders.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    ),

    files: library.files
      .sort(
        (a, b) =>
          new Date(b.uploadedAt) -
          new Date(a.uploadedAt)
      )
      .map(publicFile),

    flashcardSets: library.flashcardSets.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
  });
});

app.post("/api/library/folders", (req, res) => {
  const name = String(req.body.name || "").trim();

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Enter a folder name."
    });
  }

  const library = readLibrary();

  const duplicate = library.folders.some(
    folder =>
      folder.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    return res.status(400).json({
      success: false,
      message: "A folder with that name already exists."
    });
  }

  const folder = {
    id: createId(),
    name,
    createdAt: new Date().toISOString()
  };

  library.folders.push(folder);

  writeLibrary(library);

  res.json({
    success: true,
    folder
  });
});

app.delete("/api/library/folders/:id", (req, res) => {
  const library = readLibrary();

  const exists = library.folders.some(
    folder => folder.id === req.params.id
  );

  if (!exists) {
    return res.status(404).json({
      success: false,
      message: "Folder not found."
    });
  }

  library.folders = library.folders.filter(
    folder => folder.id !== req.params.id
  );

  library.files = library.files.map(file => {
    if (file.folderId === req.params.id) {
      return {
        ...file,
        folderId: null
      };
    }

    return file;
  });

  library.flashcardSets = library.flashcardSets.map(set => {
    if (set.folderId === req.params.id) {
      return {
        ...set,
        folderId: null
      };
    }

    return set;
  });

  writeLibrary(library);

  res.json({
    success: true
  });
});

app.post(
  "/api/library",
  upload.single("file"),
  async (req, res) => {
    let temporaryPath = req.file?.path;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please choose a file."
        });
      }

      const raw = await extractText(
        req.file.path,
        req.file.originalname
      );

      const text = prepareText(raw);

      if (!text || text.length < 20) {
        return res.status(400).json({
          success: false,
          message:
            "No readable text was found. The PDF may be scanned or image-only."
        });
      }

      const library = readLibrary();

      const requestedFolderId =
        String(req.body.folderId || "").trim() || null;

      const folderId = library.folders.some(
        folder => folder.id === requestedFolderId
      )
        ? requestedFolderId
        : null;

      const id = createId();

      const extension = path
        .extname(req.file.originalname)
        .toLowerCase();

      const storedName = `${id}${extension}`;

      const permanentPath = path.join(
        libraryFilesFolder,
        storedName
      );

      fs.renameSync(
        req.file.path,
        permanentPath
      );

      temporaryPath = null;

      const item = {
        id,
        name: req.file.originalname,
        storedName,
        extension,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        folderId,
        text
      };

      library.files.push(item);

      writeLibrary(library);

      res.json({
        success: true,
        file: publicFile(item)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    } finally {
      removeFile(temporaryPath);
    }
  }
);

app.patch("/api/library/files/:id", (req, res) => {
  const library = readLibrary();

  const item = library.files.find(
    file => file.id === req.params.id
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "File not found."
    });
  }

  const folderId =
    String(req.body.folderId || "").trim() || null;

  if (
    folderId &&
    !library.folders.some(folder => folder.id === folderId)
  ) {
    return res.status(400).json({
      success: false,
      message: "Folder not found."
    });
  }

  item.folderId = folderId;

  writeLibrary(library);

  res.json({
    success: true,
    file: publicFile(item)
  });
});

app.get("/api/library/:id/file", (req, res) => {
  const library = readLibrary();

  const item = library.files.find(
    file => file.id === req.params.id
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "File not found."
    });
  }

  const filePath = path.join(
    libraryFilesFolder,
    item.storedName
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "Saved file is missing."
    });
  }

  res.sendFile(filePath);
});

app.delete("/api/library/:id", (req, res) => {
  const library = readLibrary();

  const item = library.files.find(
    file => file.id === req.params.id
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "File not found."
    });
  }

  removeFile(
    path.join(
      libraryFilesFolder,
      item.storedName
    )
  );

  library.files = library.files.filter(
    file => file.id !== req.params.id
  );

  writeLibrary(library);

  res.json({
    success: true
  });
});

app.post("/api/library/flashcards", (req, res) => {
  const library = readLibrary();

  const name = String(req.body.name || "").trim();

  let cards = Array.isArray(req.body.flashcards)
    ? req.body.flashcards
    : [];

  cards = cards
    .filter(
      card =>
        card &&
        String(card.question || "").trim() &&
        String(card.answer || "").trim()
    )
    .map(card => ({
      question: String(card.question).trim(),
      answer: String(card.answer).trim()
    }))
    .slice(0, 50);

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Enter a flashcard set name."
    });
  }

  if (cards.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Add at least one flashcard."
    });
  }

  const requestedFolderId =
    String(req.body.folderId || "").trim() || null;

  const folderId = library.folders.some(
    folder => folder.id === requestedFolderId
  )
    ? requestedFolderId
    : null;

  const set = {
    id: createId(),
    name,
    folderId,
    flashcards: cards,
    createdAt: new Date().toISOString()
  };

  library.flashcardSets.push(set);

  writeLibrary(library);

  res.json({
    success: true,
    flashcardSet: set
  });
});

app.patch(
  "/api/library/flashcards/:id",
  (req, res) => {
    const library = readLibrary();

    const set = library.flashcardSets.find(
      item => item.id === req.params.id
    );

    if (!set) {
      return res.status(404).json({
        success: false,
        message: "Flashcard set not found."
      });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Enter a flashcard set name."
        });
      }

      set.name = name;
    }

    if (req.body.folderId !== undefined) {
      const folderId =
        String(req.body.folderId || "").trim() || null;

      if (
        folderId &&
        !library.folders.some(
          folder => folder.id === folderId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Folder not found."
        });
      }

      set.folderId = folderId;
    }

    writeLibrary(library);

    res.json({
      success: true,
      flashcardSet: set
    });
  }
);

app.delete(
  "/api/library/flashcards/:id",
  (req, res) => {
    const library = readLibrary();

    const exists = library.flashcardSets.some(
      set => set.id === req.params.id
    );

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Flashcard set not found."
      });
    }

    library.flashcardSets =
      library.flashcardSets.filter(
        set => set.id !== req.params.id
      );

    writeLibrary(library);

    res.json({
      success: true
    });
  }
);

app.post(
  "/api/generate",
  upload.single("file"),
  async (req, res) => {
    const temporaryPath = req.file?.path;

    try {
      const type = String(req.body.type || "")
        .trim()
        .toLowerCase();

      const provider = String(
        req.body.provider || "gemini"
      )
        .trim()
        .toLowerCase();

      const apiKey = String(
        req.body.apiKey || ""
      ).trim();

      const count = getFlashcardCount(
        req.body.flashcardCount
      );

      if (
        !["notes", "flashcards", "test", "game"].includes(
          type
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid generation type."
        });
      }

      const { lesson, name } = await getLesson(req);

      if (!lesson || lesson.length < 20) {
        return res.status(400).json({
          success: false,
          message: "No readable lesson text was found."
        });
      }

      const output = await askProvider(
        provider,
        buildPrompt(type, lesson, count),
        apiKey,
        type !== "notes"
      );

      if (type === "notes") {
        return res.json({
          success: true,
          provider,
          type,
          file: name,
          data: {
            notes: output.trim()
          }
        });
      }

      const parsed = parseAIJSON(output);

      if (type === "flashcards") {
        const cards = Array.isArray(parsed.flashcards)
          ? parsed.flashcards
              .filter(
                card =>
                  card?.question &&
                  card?.answer
              )
              .slice(0, count)
          : [];

        return res.json({
          success: true,
          provider,
          type,
          file: name,
          data: {
            flashcards: cards
          }
        });
      }

      res.json({
        success: true,
        provider,
        type,
        file: name,
        data: parsed
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message
      });
    } finally {
      removeFile(temporaryPath);
    }
  }
);

app.post(
  "/api/chat",
  upload.single("file"),
  async (req, res) => {
    const temporaryPath = req.file?.path;

    try {
      const question = String(
        req.body.question || ""
      ).trim();

      const provider = String(
        req.body.provider || "gemini"
      )
        .trim()
        .toLowerCase();

      const apiKey = String(
        req.body.apiKey || ""
      ).trim();

      if (!question) {
        return res.status(400).json({
          success: false,
          message: "Please enter a question."
        });
      }

      const { lesson } = await getLesson(req);

      const answer = await askProvider(
        provider,
        buildChatPrompt(question, lesson),
        apiKey,
        false
      );

      res.json({
        success: true,
        answer: answer.trim()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    } finally {
      removeFile(temporaryPath);
    }
  }
);

app.use((error, req, res, next) => {
  console.error(error);

  if (
    error instanceof multer.MulterError &&
    error.code === "LIMIT_FILE_SIZE"
  ) {
    return res.status(400).json({
      success: false,
      message: "Maximum file size is 20 MB."
    });
  }

  res.status(400).json({
    success: false,
    message: error.message || "Request failed."
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("===============================");
  console.log("          STUDYING AI");
  console.log("===============================");
  console.log(`Backend: http://localhost:${PORT}`);
  console.log(
    `Library: http://localhost:${PORT}/api/library`
  );
  console.log(`Gemini: ${GEMINI_MODEL}`);
  console.log(`Ollama: ${OLLAMA_MODEL}`);
  console.log("Ready ✅");
  console.log("");
});