import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { OfficeParser } from "officeparser";
import { GoogleGenAI } from "@google/genai";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TEXT_LENGTH = 40000;
const MAX_FLASHCARDS = 50;
const MAX_QUESTIONS = 100;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const uploadFolder = path.resolve(process.cwd(), "uploads");
const libraryFolder = path.resolve(process.cwd(), "library");
const libraryFilesFolder = path.join(libraryFolder, "files");
const libraryIndexFile = path.join(libraryFolder, "index.json");

const usersFile = path.join(
  libraryFolder,
  "users.json"
);

if (!process.env.JWT_SECRET) {
  console.warn(
    "WARNING: JWT_SECRET is missing from .env"
  );
}

fs.mkdirSync(
  uploadFolder,
  {
    recursive: true
  }
);

fs.mkdirSync(
  libraryFilesFolder,
  {
    recursive: true
  }
);

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

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(
    usersFile,
    JSON.stringify(
      [],
      null,
      2
    ),
    "utf8"
  );
}

function readUsers() {
  try {
    const data = JSON.parse(
      fs.readFileSync(
        usersFile,
        "utf8"
      )
    );

    return Array.isArray(data)
      ? data
      : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(
    usersFile,
    JSON.stringify(
      users,
      null,
      2
    ),
    "utf8"
  );
}

function getJWTSecret() {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is missing from backend/.env"
    );
  }

  return secret;
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    getJWTSecret(),
    {
      expiresIn: "7d"
    }
  );
}


const chatsFile = path.join(
    libraryFolder,
    "chats.json"
);

if (!fs.existsSync(chatsFile)) {
    fs.writeFileSync(
        chatsFile,
        JSON.stringify(
            [],
            null,
            2
        ),
        "utf8"
    );
}


function readChats() {
    try {
        const chats =
            JSON.parse(
                fs.readFileSync(
                    chatsFile,
                    "utf8"
                )
            );

        return Array.isArray(
            chats
        )
            ? chats
            : [];

    } catch {
        return [];
    }
}


function writeChats(
    chats
) {
    fs.writeFileSync(
        chatsFile,
        JSON.stringify(
            chats,
            null,
            2
        ),
        "utf8"
    );
}


function makeChatId() {
    return (
        "chat_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}


function makeMessageId() {
    return (
        "msg_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}


function makeChatTitle(
    text
) {
    const title =
        String(
            text || ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    if (!title) {
        return "New Chat";
    }

    return title.length > 45
        ? title.slice(
            0,
            45
        ) + "..."
        : title;
}


function requireAuth(
  req,
  res,
  next
) {
  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Please log in first."
        });
    }

    const token =
      authorization.slice(7);

    const decoded =
      jwt.verify(
        token,
        getJWTSecret()
      );

    req.user = {
      id: decoded.id,
      email: decoded.email
    };

    next();

  } catch {
    return res
      .status(401)
      .json({
        success: false,
        message:
          "Your login session has expired."
      });
  }
}

function claimLegacyLibrary(
  userId
) {
  const library =
    readLibrary();

  let changed = false;

  for (
    const folder
    of library.folders
  ) {
    if (!folder.userId) {
      folder.userId =
        userId;

      changed = true;
    }
  }

  for (
    const file
    of library.files
  ) {
    if (!file.userId) {
      file.userId =
        userId;

      changed = true;
    }
  }

  for (
    const set
    of library.flashcardSets
  ) {
    if (!set.userId) {
      set.userId =
        userId;

      changed = true;
    }
  }

  if (changed) {
    writeLibrary(
      library
    );
  }
}

function readLibrary() {
  try {
    const raw =
      fs.readFileSync(
        libraryIndexFile,
        "utf8"
      );

    const data =
      JSON.parse(raw);

    if (Array.isArray(data)) {
      return {
        folders: [],
        files: data,
        flashcardSets: []
      };
    }

    return {
      folders:
        Array.isArray(
          data.folders
        )
          ? data.folders
          : [],

      files:
        Array.isArray(
          data.files
        )
          ? data.files
          : [],

      flashcardSets:
        Array.isArray(
          data.flashcardSets
        )
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

function writeLibrary(
  data
) {
  fs.writeFileSync(
    libraryIndexFile,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}

function createId() {
  return `${
    Date.now()
  }-${
    Math.random()
      .toString(36)
      .slice(2, 10)
  }`;
}

function removeFile(
  filePath
) {
  if (!filePath) {
    return;
  }

  try {
    if (
      fs.existsSync(
        filePath
      )
    ) {
      fs.unlinkSync(
        filePath
      );
    }
  } catch (
    error
  ) {
    console.error(
      error
    );
  }
}

const allowedExtensions =
  new Set([
    ".pdf",
    ".docx",
    ".pptx",
    ".txt"
  ]);

const storage =
  multer.diskStorage({

    destination(
      req,
      file,
      callback
    ) {
      callback(
        null,
        uploadFolder
      );
    },

    filename(
      req,
      file,
      callback
    ) {
      const safeName =
        file.originalname
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
          );

      callback(
        null,
        `${
          Date.now()
        }-${
          Math.random()
            .toString(36)
            .slice(2, 8)
        }-${safeName}`
      );
    }
  });

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        MAX_FILE_SIZE
    },

    fileFilter(
      req,
      file,
      callback
    ) {
      const extension =
        path
          .extname(
            file.originalname
          )
          .toLowerCase();

      if (
        !allowedExtensions
          .has(
            extension
          )
      ) {
        return callback(
          new Error(
            "Only PDF, DOCX, PPTX and TXT files are allowed."
          )
        );
      }

      callback(
        null,
        true
      );
    }
  });


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


async function extractText(
  filePath,
  originalName
) {
  const extension =
    path
      .extname(
        originalName
      )
      .toLowerCase();

  if (
    extension === ".txt"
  ) {
    return fs.readFileSync(
      filePath,
      "utf8"
    );
  }

  const parsed =
    await OfficeParser
      .parseOffice(
        filePath
      );

  const result =
    await parsed.to(
      "text"
    );

  return (
    result?.value ||
    ""
  );
}

function prepareText(
  text
) {
  return String(
    text || ""
  )
    .replace(
      /\u0000/g,
      ""
    )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim()
    .slice(
      0,
      MAX_TEXT_LENGTH
    );
}

function parseAIJSON(
  output
) {
  let cleaned =
    String(
      output || ""
    )
      .trim()
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  const first =
    cleaned.indexOf(
      "{"
    );

  const last =
    cleaned.lastIndexOf(
      "}"
    );

  if (
    first !== -1 &&
    last !== -1
  ) {
    cleaned =
      cleaned.slice(
        first,
        last + 1
      );
  }

  return JSON.parse(
    cleaned
  );
}

function getFlashcardCount(
  value
) {
  const number =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 20;
  }

  return Math.min(
    MAX_FLASHCARDS,
    Math.max(
      10,
      number
    )
  );
}

function getQuestionCount(
  value
) {
  const number =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 20;
  }

  return Math.min(
    MAX_QUESTIONS,
    Math.max(
      10,
      number
    )
  );
}

function publicFile(
  item
) {
  return {
    id:
      item.id,

    name:
      item.name,

    extension:
      item.extension,

    size:
      item.size,

    uploadedAt:
      item.uploadedAt,

    folderId:
      item.folderId ||
      null
  };
}

function buildPrompt(
  type,
  lesson,
  count
) {
  const rules = `
You are STUDYante AI. Do not repeatedly greet or reintroduce yourself during an ongoing conversation. Only greet the user at the beginning of a new conversation. After the first exchange, answer the user directly without saying hello, welcome back, great to see you again, or similar repeated greetings..

Use ONLY the information contained in the lesson.

Do not invent information.

Explain information clearly for a student.

LESSON:

${lesson}
`;

  if (
    type === "notes"
  ) {
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

  if (
    type === "flashcards"
  ) {
    return `
${rules}

Create up to ${count} useful flashcards.

If the lesson contains enough unique information,
create exactly ${count} flashcards.

If there is not enough information,
create fewer flashcards instead of repeating or inventing facts.

Maximum allowed is ${MAX_FLASHCARDS} flashcards.

Cover different parts of the lesson.

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

  if (
    type === "test"
  ) {
    return `
${rules}

Create up to ${count} multiple choice practice test questions.

If the lesson contains enough unique information,
create exactly ${count} questions.

If there is not enough information,
create fewer questions instead of repeating or inventing facts.

Maximum allowed is ${MAX_QUESTIONS} questions.

Cover different parts of the lesson.

Each question must have exactly four choices and only one correct answer.

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

  if (
    type === "game"
  ) {
    return `
${rules}

Create up to ${count} multiple choice study game questions.

If the lesson contains enough unique information,
create exactly ${count} questions.

If there is not enough information,
create fewer questions instead of repeating or inventing facts.

Maximum allowed is ${MAX_QUESTIONS} questions.

Cover different parts of the lesson.

Each question must have exactly four choices and only one correct answer.

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

answer:
0 = A
1 = B
2 = C
3 = D
`;
  }

  throw new Error(
    "Invalid generation type."
  );
}

function buildChatPrompt(
  question,
  lesson = ""
) {
  const material = String(
    lesson || ""
  ).trim();

  if (material) {
    return `
You are STUDYante AI. Do not repeatedly greet or reintroduce yourself during an ongoing conversation. Only greet the user at the beginning of a new conversation. After the first exchange, answer the user directly without saying hello, welcome back, great to see you again, or similar repeated greetings..

Answer using only the study material below.

Be clear and accurate.
Use simple student-friendly words.
Make the answer easy to understand.
Keep explanations organized.

Use plain text only.
Do not use Markdown formatting.
Do not use asterisks.
Do not use **.
Do not use #.
Do not use underscores for formatting.
Do not use backticks.
Do not use Markdown bullet symbols.

You may use:
Normal headings
Numbered lists
Short paragraphs
Simple examples

If the answer is not in the material, say:
"The answer is not found in the uploaded lesson."

Question:
${question}

Study material:
${material}
`;
  }

  return `
You are STUDYante AI. Do not repeatedly greet or reintroduce yourself during an ongoing conversation. Only greet the user at the beginning of a new conversation. After the first exchange, answer the user directly without saying hello, welcome back, great to see you again, or similar repeated greetings., a helpful study assistant.

Answer the student's question clearly.
Use simple student-friendly words.
Make difficult topics easier to understand.
Give step-by-step explanations when useful.
Give examples when they help.

If asked to create questions, quizzes, notes,
flashcards, or examples, follow the requested amount.

Use plain text only.
Do not use Markdown formatting.
Do not use asterisks.
Do not use **.
Do not use #.
Do not use underscores for formatting.
Do not use backticks.
Do not use Markdown bullet symbols.

You may use:
Normal headings
Numbered lists
Short paragraphs

Question:
${question}
`;
}

async function askOllama(
  prompt,
  jsonMode = false
) {
  const body = {
    model:
      OLLAMA_MODEL,

    prompt,

    stream:
      false,

    options: {
      temperature:
        0.25
    }
  };

  if (
    jsonMode
  ) {
    body.format =
      "json";
  }

  let response;

  try {
    response =
      await fetch(
        "http://127.0.0.1:11434/api/generate",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              body
            )
        }
      );

  } catch {
    throw new Error(
      "Cannot connect to Ollama. Make sure Ollama is running."
    );
  }

  if (
    !response.ok
  ) {
    throw new Error(
      await response.text()
    );
  }

  const data =
    await response.json();

  if (
    !data.response
  ) {
    throw new Error(
      "Ollama returned an empty response."
    );
  }

  return data
    .response
    .trim();
}


async function askGemini(
  prompt,
  apiKeyOrJsonMode = false,
  possibleJsonMode = false
) {
  let jsonMode = false;

  if (
    typeof apiKeyOrJsonMode === "boolean"
  ) {
    jsonMode = apiKeyOrJsonMode;
  } else {
    jsonMode = possibleJsonMode;
  }

  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is not configured on the server."
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    });

    let finalPrompt = prompt;

    if (jsonMode) {
      finalPrompt =
        prompt +
        "\n\nIMPORTANT: Return only valid JSON. " +
        "Do not include markdown code fences.";
    }

    const interaction =
      await ai.interactions.create({
        model: GEMINI_MODEL,
        input: finalPrompt,
        store: false
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

  } catch (error) {
    const message =
      error?.message ||
      String(error);

    console.error(
      "Gemini Interactions API error:",
      message
    );

    if (
      message.includes("429") ||
      message
        .toLowerCase()
        .includes("quota")
    ) {
      throw new Error(
        "Gemini free limit reached. Please try again shortly."
      );
    }

    if (
      message.includes("API_KEY_INVALID") ||
      message.includes(
        "API key not valid"
      )
    ) {
      throw new Error(
        "The Gemini API key configured in Railway is invalid."
      );
    }

    if (
      message.includes("401") ||
      message.includes("403")
    ) {
      throw new Error(
        "Gemini authentication failed."
      );
    }

    throw new Error(message);
  }
}


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


async function askProvider(
  provider,
  prompt,
  apiKey,
  jsonMode = false
) {
  return askGemini(
    prompt,
    jsonMode
  );
}

async function getLesson(
  req
) {
  const libraryId =
    String(
      req.body.libraryId ||
      ""
    ).trim();

  if (
    libraryId
  ) {
    const library =
      readLibrary();

    const item =
      library.files.find(
        file =>
          file.id ===
            libraryId &&
          file.userId ===
            req.user.id
      );

    if (
      !item
    ) {
      throw new Error(
        "The selected library file was not found."
      );
    }

    return {
      lesson:
        item.text,

      name:
        item.name
    };
  }

  if (
    !req.file
  ) {
    throw new Error(
      "Please upload a study material."
    );
  }

  const raw =
    await extractText(
      req.file.path,
      req.file.originalname
    );

  return {
    lesson:
      prepareText(
        raw
      ),

    name:
      req.file.originalname
  };
}

app.post(
  "/api/auth/register",
  async (
    req,
    res
  ) => {
    try {
      const name =
        String(
          req.body.name ||
          ""
        ).trim();

      const email =
        String(
          req.body.email ||
          ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password ||
          ""
        );

      if (
        !name ||
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Please complete all fields."
          });
      }

      if (
        password.length <
        6
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Password must be at least 6 characters."
          });
      }

      const users =
        readUsers();

      if (
        users.some(
          user =>
            user.email ===
            email
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "An account with this email already exists."
          });
      }

      const user = {
        id:
          createId(),

        name,

        email,

        password:
          await bcrypt.hash(
            password,
            10
          ),

        createdAt:
          new Date()
            .toISOString()
      };

      users.push(
        user
      );

      writeUsers(
        users
      );

      if (
        users.length ===
        1
      ) {
        claimLegacyLibrary(
          user.id
        );
      }

      return res.json({
        success:
          true,

        token:
          createToken(
            user
          ),

        user: {
          id:
            user.id,

          name:
            user.name,

          email:
            user.email
        }
      });

    } catch (
      error
    ) {
      console.error(
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Could not create account."
        });
    }
  }
);

app.post(
  "/api/auth/login",
  async (
    req,
    res
  ) => {
    try {
      const email =
        String(
          req.body.email ||
          ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password ||
          ""
        );

      if (
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Enter your email and password."
          });
      }

      const users =
        readUsers();

      const user =
        users.find(
          account =>
            account.email ===
            email
        );

      if (
        !user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Incorrect email or password."
          });
      }

      const correct =
        await bcrypt.compare(
          password,
          user.password
        );

      if (
        !correct
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Incorrect email or password."
          });
      }

      return res.json({
        success:
          true,

        token:
          createToken(
            user
          ),

        user: {
          id:
            user.id,

          name:
            user.name,

          email:
            user.email
        }
      });

    } catch (
      error
    ) {
      console.error(
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message ||
            "Could not log in."
        });
    }
  }
);

app.get(
  "/api/auth/me",
  requireAuth,
  (
    req,
    res
  ) => {
    const users =
      readUsers();

    const user =
      users.find(
        account =>
          account.id ===
          req.user.id
      );

    if (
      !user
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Account not found."
        });
    }

    return res.json({
      success:
        true,

      user: {
        id:
          user.id,

        name:
          user.name,

        email:
          user.email
      }
    });
  }
);

app.get(
  "/",
  (
    req,
    res
  ) => {
    res.json({
      success:
        true,

      message:
        "Studying backend is running.",

      geminiModel:
        GEMINI_MODEL,

      ollamaModel:
        OLLAMA_MODEL,

      maxFlashcards:
        MAX_FLASHCARDS,

      maxQuestions:
        MAX_QUESTIONS
    });
  }
);

app.get(
  "/api/library",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const folders =
      library.folders
        .filter(
          folder =>
            folder.userId ===
            req.user.id
        )
        .sort(
          (
            a,
            b
          ) =>
            new Date(
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        );

    const files =
      library.files
        .filter(
          file =>
            file.userId ===
            req.user.id
        )
        .sort(
          (
            a,
            b
          ) =>
            new Date(
              b.uploadedAt
            ) -
            new Date(
              a.uploadedAt
            )
        );

    const flashcardSets =
      library
        .flashcardSets
        .filter(
          set =>
            set.userId ===
            req.user.id
        )
        .sort(
          (
            a,
            b
          ) =>
            new Date(
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        );

    res.json({
      success:
        true,

      folders,

      files:
        files.map(
          publicFile
        ),

      flashcardSets
    });
  }
);

app.post(
  "/api/library/folders",
  requireAuth,
  (
    req,
    res
  ) => {
    const name =
      String(
        req.body.name ||
        ""
      ).trim();

    if (
      !name
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Enter a folder name."
        });
    }

    const library =
      readLibrary();

    const duplicate =
      library.folders
        .some(
          folder =>
            folder.userId ===
              req.user.id &&
            folder.name
              .toLowerCase() ===
              name
                .toLowerCase()
        );

    if (
      duplicate
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "A folder with that name already exists."
        });
    }

    const folder = {
      id:
        createId(),

      userId:
        req.user.id,

      name,

      createdAt:
        new Date()
          .toISOString()
    };

    library.folders
      .push(
        folder
      );

    writeLibrary(
      library
    );

    res.json({
      success:
        true,

      folder
    });
  }
);

app.delete(
  "/api/library/folders/:id",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const exists =
      library.folders
        .some(
          folder =>
            folder.id ===
              req.params.id &&
            folder.userId ===
              req.user.id
        );

    if (
      !exists
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Folder not found."
        });
    }

    library.folders =
      library.folders
        .filter(
          folder =>
            !(
              folder.id ===
                req.params.id &&
              folder.userId ===
                req.user.id
            )
        );

    library.files =
      library.files
        .map(
          file => {
            if (
              file.userId ===
                req.user.id &&
              file.folderId ===
                req.params.id
            ) {
              return {
                ...file,
                folderId:
                  null
              };
            }

            return file;
          }
        );

    library.flashcardSets =
      library.flashcardSets
        .map(
          set => {
            if (
              set.userId ===
                req.user.id &&
              set.folderId ===
                req.params.id
            ) {
              return {
                ...set,
                folderId:
                  null
              };
            }

            return set;
          }
        );

    writeLibrary(
      library
    );

    res.json({
      success:
        true
    });
  }
);

app.post(
  "/api/library",
  requireAuth,
  upload.single(
    "file"
  ),
  async (
    req,
    res
  ) => {
    let temporaryPath =
      req.file?.path;

    try {
      if (
        !req.file
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Please choose a file."
          });
      }

      const raw =
        await extractText(
          req.file.path,
          req.file.originalname
        );

      const text =
        prepareText(
          raw
        );

      if (
        !text ||
        text.length < 20
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "No readable text was found. The PDF may be scanned or image-only."
          });
      }

      const library =
        readLibrary();

      const requestedFolderId =
        String(
          req.body.folderId ||
          ""
        ).trim() ||
        null;

      const folderId =
        library.folders.some(
          folder =>
            folder.id ===
              requestedFolderId &&
            folder.userId ===
              req.user.id
        )
          ? requestedFolderId
          : null;

      const id =
        createId();

      const extension =
        path
          .extname(
            req.file.originalname
          )
          .toLowerCase();

      const storedName =
        `${id}${extension}`;

      const permanentPath =
        path.join(
          libraryFilesFolder,
          storedName
        );

      fs.renameSync(
        req.file.path,
        permanentPath
      );

      temporaryPath =
        null;

      const item = {
        id,

        userId:
          req.user.id,

        name:
          req.file.originalname,

        storedName,

        extension,

        size:
          req.file.size,

        uploadedAt:
          new Date()
            .toISOString(),

        folderId,

        text
      };

      library.files
        .push(
          item
        );

      writeLibrary(
        library
      );

      res.json({
        success:
          true,

        file:
          publicFile(
            item
          )
      });

    } catch (
      error
    ) {
      res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message
        });

    } finally {
      removeFile(
        temporaryPath
      );
    }
  }
);

app.patch(
  "/api/library/files/:id",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const item =
      library.files.find(
        file =>
          file.id ===
            req.params.id &&
          file.userId ===
            req.user.id
      );

    if (
      !item
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "File not found."
        });
    }

    const folderId =
      String(
        req.body.folderId ||
        ""
      ).trim() ||
      null;

    if (
      folderId &&
      !library.folders
        .some(
          folder =>
            folder.id ===
              folderId &&
            folder.userId ===
              req.user.id
        )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Folder not found."
        });
    }

    item.folderId =
      folderId;

    writeLibrary(
      library
    );

    res.json({
      success:
        true,

      file:
        publicFile(
          item
        )
    });
  }
);

app.get(
  "/api/library/:id/file",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const item =
      library.files.find(
        file =>
          file.id ===
            req.params.id &&
          file.userId ===
            req.user.id
      );

    if (
      !item
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "File not found."
        });
    }

    const filePath =
      path.join(
        libraryFilesFolder,
        item.storedName
      );

    if (
      !fs.existsSync(
        filePath
      )
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Saved file is missing."
        });
    }

    res.sendFile(
      filePath
    );
  }
);

app.delete(
  "/api/library/:id",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const item =
      library.files.find(
        file =>
          file.id ===
            req.params.id &&
          file.userId ===
            req.user.id
      );

    if (
      !item
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "File not found."
        });
    }

    removeFile(
      path.join(
        libraryFilesFolder,
        item.storedName
      )
    );

    library.files =
      library.files.filter(
        file =>
          !(
            file.id ===
              req.params.id &&
            file.userId ===
              req.user.id
          )
      );

    writeLibrary(
      library
    );

    res.json({
      success:
        true
    });
  }
);

app.post(
  "/api/library/flashcards",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const name =
      String(
        req.body.name ||
        ""
      ).trim();

    let cards =
      Array.isArray(
        req.body.flashcards
      )
        ? req.body.flashcards
        : [];

    cards =
      cards
        .filter(
          card =>
            card &&
            String(
              card.question ||
              ""
            ).trim() &&
            String(
              card.answer ||
              ""
            ).trim()
        )
        .map(
          card => ({
            question:
              String(
                card.question
              ).trim(),

            answer:
              String(
                card.answer
              ).trim()
          })
        )
        .slice(
          0,
          MAX_FLASHCARDS
        );

    if (
      !name
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Enter a flashcard set name."
        });
    }

    if (
      cards.length ===
      0
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Add at least one flashcard."
        });
    }

    const requestedFolderId =
      String(
        req.body.folderId ||
        ""
      ).trim() ||
      null;

    const folderId =
      library.folders.some(
        folder =>
          folder.id ===
            requestedFolderId &&
          folder.userId ===
            req.user.id
      )
        ? requestedFolderId
        : null;

    const set = {
      id:
        createId(),

      userId:
        req.user.id,

      name,

      folderId,

      flashcards:
        cards,

      createdAt:
        new Date()
          .toISOString()
    };

    library.flashcardSets
      .push(
        set
      );

    writeLibrary(
      library
    );

    res.json({
      success:
        true,

      flashcardSet:
        set
    });
  }
);

app.patch(
  "/api/library/flashcards/:id",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const set =
      library
        .flashcardSets
        .find(
          item =>
            item.id ===
              req.params.id &&
            item.userId ===
              req.user.id
        );

    if (
      !set
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Flashcard set not found."
        });
    }

    if (
      req.body.name !==
      undefined
    ) {
      const name =
        String(
          req.body.name ||
          ""
        ).trim();

      if (
        !name
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Enter a flashcard set name."
          });
      }

      set.name =
        name;
    }

    if (
      req.body.folderId !==
      undefined
    ) {
      const folderId =
        String(
          req.body.folderId ||
          ""
        ).trim() ||
        null;

      if (
        folderId &&
        !library.folders
          .some(
            folder =>
              folder.id ===
                folderId &&
              folder.userId ===
                req.user.id
          )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Folder not found."
          });
      }

      set.folderId =
        folderId;
    }

    writeLibrary(
      library
    );

    res.json({
      success:
        true,

      flashcardSet:
        set
    });
  }
);

app.delete(
  "/api/library/flashcards/:id",
  requireAuth,
  (
    req,
    res
  ) => {
    const library =
      readLibrary();

    const exists =
      library
        .flashcardSets
        .some(
          set =>
            set.id ===
              req.params.id &&
            set.userId ===
              req.user.id
        );

    if (
      !exists
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Flashcard set not found."
        });
    }

    library.flashcardSets =
      library
        .flashcardSets
        .filter(
          set =>
            !(
              set.id ===
                req.params.id &&
              set.userId ===
                req.user.id
            )
        );

    writeLibrary(
      library
    );

    res.json({
      success:
        true
    });
  }
);

app.post(
  "/api/generate",
  requireAuth,
  upload.single(
    "file"
  ),
  async (
    req,
    res
  ) => {
    const temporaryPath =
      req.file?.path;

    try {
      const type =
        String(
          req.body.type ||
          ""
        )
          .trim()
          .toLowerCase();

      const provider =
        String(
          req.body.provider ||
          "gemini"
        )
          .trim()
          .toLowerCase();

      const apiKey =
        String(
          req.body.apiKey ||
          ""
        ).trim();

      let count;

      if (
        type ===
        "flashcards"
      ) {
        count =
          getFlashcardCount(
            req.body
              .flashcardCount
          );

      } else if (
        type ===
          "test" ||
        type ===
          "game"
      ) {
        count =
          getQuestionCount(
            req.body
              .questionCount
          );

      } else {
        count =
          20;
      }

      if (
        ![
          "notes",
          "flashcards",
          "test",
          "game"
        ].includes(
          type
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid generation type."
          });
      }

      const {
        lesson,
        name
      } =
        await getLesson(
          req
        );

      if (
        !lesson ||
        lesson.length <
        20
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "No readable lesson text was found."
          });
      }

      const output =
        await askProvider(
          provider,
          buildPrompt(
            type,
            lesson,
            count
          ),
          apiKey,
          type !==
            "notes"
        );

      if (
        type ===
        "notes"
      ) {
        return res.json({
          success:
            true,

          provider,

          type,

          file:
            name,

          data: {
            notes:
              output.trim()
          }
        });
      }

      const parsed =
        parseAIJSON(
          output
        );

      if (
        type ===
        "flashcards"
      ) {
        const cards =
          Array.isArray(
            parsed.flashcards
          )
            ? parsed
                .flashcards
                .filter(
                  card =>
                    card?.question &&
                    card?.answer
                )
                .slice(
                  0,
                  count
                )
            : [];

        return res.json({
          success:
            true,

          provider,

          type,

          file:
            name,

          data: {
            flashcards:
              cards
          }
        });
      }

      if (
        type ===
        "test"
      ) {
        const questions =
          Array.isArray(
            parsed.questions
          )
            ? parsed
                .questions
                .slice(
                  0,
                  count
                )
            : [];

        return res.json({
          success:
            true,

          provider,

          type,

          file:
            name,

          data: {
            questions
          }
        });
      }

      if (
        type ===
        "game"
      ) {
        const game =
          Array.isArray(
            parsed.game
          )
            ? parsed
                .game
                .slice(
                  0,
                  count
                )
            : [];

        return res.json({
          success:
            true,

          provider,

          type,

          file:
            name,

          data: {
            game
          }
        });
      }

    } catch (
      error
    ) {
      console.error(
        error
      );

      res
        .status(500)
        .json({
          success:
            false,

          message:
            error.message
        });

    } finally {
      removeFile(
        temporaryPath
      );
    }
  }
);


app.get(
    "/api/chats",
    requireAuth,
    (req, res) => {
        const chats =
            readChats()
                .filter(
                    chat =>
                        chat.userId ===
                        req.user.id
                )
                .sort(
                    (a, b) =>
                        String(
                            b.updatedAt ||
                            ""
                        ).localeCompare(
                            String(
                                a.updatedAt ||
                                ""
                            )
                        )
                )
                .map(
                    chat => ({
                        id:
                            chat.id,

                        title:
                            chat.title,

                        createdAt:
                            chat.createdAt,

                        updatedAt:
                            chat.updatedAt
                    })
                );

        res.json({
            success: true,
            chats
        });
    }
);


app.get(
    "/api/chats/:id",
    requireAuth,
    (req, res) => {
        const chat =
            readChats()
                .find(
                    item =>
                        item.id ===
                        req.params.id &&
                        item.userId ===
                        req.user.id
                );

        if (!chat) {
            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Chat not found."
                });
        }

        res.json({
            success: true,
            chat
        });
    }
);


app.delete(
    "/api/chats/:id",
    requireAuth,
    (req, res) => {
        const chats =
            readChats();

        const index =
            chats.findIndex(
                chat =>
                    chat.id ===
                    req.params.id &&
                    chat.userId ===
                    req.user.id
            );

        if (
            index === -1
        ) {
            return res
                .status(404)
                .json({
                    success:
                        false,

                    message:
                        "Chat not found."
                });
        }

        chats.splice(
            index,
            1
        );

        writeChats(
            chats
        );

        res.json({
            success: true
        });
    }
);


app.post(
    "/api/chat",
    requireAuth,
    imageUpload.fields([
        {
            name: "file",
            maxCount: 1
        },
        {
            name: "image",
            maxCount: 1
        }
    ]),
    async (
        req,
        res
    ) => {
        const lessonFile =
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
            imageFile?.path;

        try {
            const question =
                String(
                    req.body.question ||
                    ""
                ).trim();

            const provider =
                String(
                    req.body.provider ||
                    "gemini"
                )
                    .trim()
                    .toLowerCase();

            if (!question) {
                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Please enter a question."
                    });
            }


            let lesson = "";

            const libraryId =
                String(
                    req.body.libraryId ||
                    ""
                ).trim();

            if (
                libraryId ||
                req.file
            ) {
                const source =
                    await getLesson(
                        req
                    );

                lesson =
                    source.lesson ||
                    "";
            }


            const chats =
                readChats();

            const requestedChatId =
                String(
                    req.body.chatId ||
                    ""
                ).trim();


            let chat =
                requestedChatId
                    ? chats.find(
                        item =>
                            item.id ===
                            requestedChatId &&
                            item.userId ===
                            req.user.id
                    )
                    : null;


            const now =
                new Date()
                    .toISOString();


            if (!chat) {
                chat = {
                    id:
                        makeChatId(),

                    userId:
                        req.user.id,

                    title:
                        makeChatTitle(
                            question
                        ),

                    messages:
                        [],

                    createdAt:
                        now,

                    updatedAt:
                        now
                };

                chats.push(
                    chat
                );
            }


            const oldMessages =
                Array.isArray(
                    chat.messages
                )
                    ? chat.messages
                        .slice(-16)
                    : [];


            const history =
                oldMessages
                    .map(
                        message => {
                            const speaker =
                                message.role ===
                                "user"
                                    ? "Student"
                                    : "STUDYante AI";

                            return (
                                speaker +
                                ": " +
                                message.content
                            );
                        }
                    )
                    .join(
                        "\n\n"
                    );


            const finalQuestion =
                history
                    ? (
                        "Continue this conversation using the previous messages as context.\n\n" +
                        "Previous conversation:\n\n" +
                        history +
                        "\n\nNew student message:\n\n" +
                        question
                    )
                    : question;


            const chatPrompt =
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
                    );


            if (
                !Array.isArray(
                    chat.messages
                )
            ) {
                chat.messages =
                    [];
            }


            chat.messages.push(
                {
                    id:
                        makeMessageId(),

                    role:
                        "user",

                    content:
                        question,

                    createdAt:
                        now
                },

                {
                    id:
                        makeMessageId(),

                    role:
                        "assistant",

                    content:
                        String(answer)
                            .trim(),

                    createdAt:
                        new Date()
                            .toISOString()
                }
            );


            chat.updatedAt =
                new Date()
                    .toISOString();


            writeChats(
                chats
            );


            res.json({
                success:
                    true,

                answer:
                    String(answer)
                        .trim(),

                chatId:
                    chat.id,

                title:
                    chat.title
            });

        } catch (error) {
            console.error(
                "Chat error:",
                error
            );

            res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        error.message ||
                        "Could not answer."
                });

        } finally {
            removeFile(
                temporaryPath
            );

            removeFile(
                temporaryImagePath
            );
        }
    }
);


app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      error
    );

    if (
      error instanceof
        multer.MulterError &&
      error.code ===
        "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Maximum file size is 20 MB."
        });
    }

    res
      .status(400)
      .json({
        success:
          false,

        message:
          error.message ||
          "Request failed."
      });
  }
);


/* ===== STUDYANTE_IMAGE_GENERATION_ROUTE ===== */

app.post("/api/generate-image", requireAuth, async (req, res) => {
    try {
        const prompt = String(req.body?.prompt || "").trim();

        if (!prompt) {
            return res.status(400).json({
                error: "Please describe the image you want to generate."
            });
        }

        if (!GEMINI_API_KEY) {
            return res.status(500).json({
                error: "Gemini API is not configured."
            });
        }

        const imageAI = new GoogleGenAI({
            apiKey: GEMINI_API_KEY
        });

        const interaction = await imageAI.interactions.create({
            model: "gemini-3.1-flash-image",
            input: prompt,
            response_format: {
                type: "image",
                mime_type: "image/png",
                aspect_ratio: "1:1"
            },
            store: false
        });

        let generatedImage = interaction.output_image || null;

        if (!generatedImage && Array.isArray(interaction.steps)) {
            for (const step of interaction.steps) {
                if (
                    step &&
                    step.type === "model_output" &&
                    Array.isArray(step.content)
                ) {
                    const imageBlock = step.content.find(
                        (block) => block && block.type === "image" && block.data
                    );

                    if (imageBlock) {
                        generatedImage = imageBlock;
                        break;
                    }
                }
            }
        }

        if (!generatedImage || !generatedImage.data) {
            return res.status(502).json({
                error: "STUDYante AI could not generate an image for that request."
            });
        }

        const mimeType =
            generatedImage.mime_type ||
            generatedImage.mimeType ||
            "image/png";

        return res.json({
            success: true,
            imageData: generatedImage.data,
            mimeType,
            text: String(
                interaction.outputText ||
                interaction.output_text ||
                ""
            ).trim()
        });

    } catch (error) {
        console.error("Image generation error:", error);

        return res.status(500).json({
            error:
                error?.message ||
                "Unable to generate the image right now."
        });
    }
});

app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "==============================="
    );
    console.log(
      "          STUDYING AI"
    );
    console.log(
      "==============================="
    );
    console.log(
      `Backend: http://localhost:${PORT}`
    );
    console.log(
      `Library: http://localhost:${PORT}/api/library`
    );
    console.log(
      `Gemini: ${GEMINI_MODEL}`
    );
    console.log(
      `Ollama: ${OLLAMA_MODEL}`
    );
    console.log(
      "Ready âœ…"
    );
    console.log("");
  }
);


