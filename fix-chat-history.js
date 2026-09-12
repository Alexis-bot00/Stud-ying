const fs = require("fs");

const scriptFile = "./docs/script.js";
const serverFile = "./backend/server.js";

/* ============================
   BACKUPS
============================ */

fs.copyFileSync(
  scriptFile,
  scriptFile + ".before-chat-history-fix"
);

fs.copyFileSync(
  serverFile,
  serverFile + ".before-chat-history-fix"
);


/* ============================
   UPDATE SCRIPT.JS
============================ */

let script = fs.readFileSync(
  scriptFile,
  "utf8"
);

if (!script.includes('const newChatButton = $("newChatButton");')) {

  const target =
    'const aiMessages = $("aiMessages");';

  if (!script.includes(target)) {
    throw new Error(
      "Could not find aiMessages in docs/script.js"
    );
  }

  script = script.replace(
    target,
`const aiMessages = $("aiMessages");
const newChatButton = $("newChatButton");
const chatHistoryList = $("chatHistoryList");

let activeChatId = null;
let chatHistory = [];`
  );
}


/* Replace old AI chat functions */

const sendStart =
  script.indexOf(
    "async function sendQuestion()"
  );

const timerStart =
  script.indexOf(
    "function updateTimer()",
    sendStart
  );

if (
  sendStart === -1 ||
  timerStart === -1
) {
  throw new Error(
    "Could not find sendQuestion/updateTimer in docs/script.js"
  );
}

const newChatFunctions = `
async function sendQuestion() {
  const text =
    question.value.trim();

  if (!text) {
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
      "STUDYante AI is thinking...",
      "assistant"
    );

  const formData =
    new FormData();

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
        "Could not answer."
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

    await loadChatHistory();

  } catch (error) {

    loading
      .querySelector(
        ".message-text"
      )
      .textContent =
        "⚠️ " + error.message;

  } finally {
    askButton.disabled = false;
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
    \`message \${role}\`;

  if (
    role ===
    "assistant"
  ) {
    message.innerHTML = \`
      <span class="message-avatar">
        🤖
      </span>

      <div class="message-text"></div>
    \`;
  } else {
    message.innerHTML = \`
      <div class="message-text"></div>
    \`;
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


function showNewChat() {
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
  if (
    !chatHistoryList
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        \`\${API_BASE}/api/chats\`
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
      \`
        <div class="chat-empty-history">
          \${escapeHTML(
            error.message
          )}
        </div>
      \`;
  }
}


function renderChatHistory() {
  if (
    !chatHistoryList
  ) {
    return;
  }

  chatHistoryList.innerHTML = "";

  if (
    chatHistory.length === 0
  ) {
    chatHistoryList.innerHTML =
      \`
        <div class="chat-empty-history">
          No saved chats yet.
        </div>
      \`;

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

      openButton.title =
        chat.title ||
        "New Chat";

      openButton.addEventListener(
        "click",
        () => {
          openChat(
            chat.id
          );
        }
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
        "🗑️";

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
        \`\${API_BASE}/api/chats/\${encodeURIComponent(
          chatId
        )}\`
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

    aiMessages.innerHTML = "";

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
      \`Delete "\${
        chat.title ||
        "this chat"
      }"?\`
    );

  if (!confirmed) {
    return;
  }

  try {
    const response =
      await fetch(
        \`\${API_BASE}/api/chats/\${encodeURIComponent(
          chat.id
        )}\`,
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
      showNewChat();
    }

    await loadChatHistory();

  } catch (error) {
    alert(
      error.message
    );
  }
}


if (
  newChatButton
) {
  newChatButton.addEventListener(
    "click",
    showNewChat
  );
}


`;

script =
  script.substring(
    0,
    sendStart
  ) +
  newChatFunctions +
  script.substring(
    timerStart
  );


/* Add startup load */

const startupTarget =
`updateProviderUI();
updateTimer();
loadLibrary();`;

if (
  script.includes(
    startupTarget
  )
) {
  script = script.replace(
    startupTarget,
`updateProviderUI();
updateTimer();
loadLibrary();
loadChatHistory();`
  );
} else if (
  !script
    .trimEnd()
    .endsWith(
      "loadChatHistory();"
    )
) {
  script +=
    "\nloadChatHistory();\n";
}

fs.writeFileSync(
  scriptFile,
  script,
  "utf8"
);


/* ============================
   UPDATE SERVER.JS
============================ */

let server =
  fs.readFileSync(
    serverFile,
    "utf8"
  );


/* chats.json location */

if (
  !server.includes(
    "const chatsFile"
  )
) {
  const usersMatch =
    server.match(
      /const usersFile = path\.join\([\s\S]*?"users\.json"[\s\S]*?\);/
    );

  if (!usersMatch) {
    throw new Error(
      "Could not find usersFile in backend/server.js"
    );
  }

  server =
    server.replace(
      usersMatch[0],
      usersMatch[0] +
`

const chatsFile = path.join(
  libraryFolder,
  "chats.json"
);`
    );
}


/* Create chats.json and helper functions */

if (
  !server.includes(
    "function readChats()"
  )
) {

  const helperTarget =
    server.indexOf(
      "function getJWTSecret()"
    );

  if (
    helperTarget === -1
  ) {
    throw new Error(
      "Could not find getJWTSecret()"
    );
  }

  const helperCode = `
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
    const data =
      JSON.parse(
        fs.readFileSync(
          chatsFile,
          "utf8"
        )
      );

    return Array.isArray(
      data
    )
      ? data
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


function makeChatTitle(
  text
) {
  const clean =
    String(
      text || ""
    )
      .replace(
        /\\s+/g,
        " "
      )
      .trim();

  if (!clean) {
    return "New Chat";
  }

  return clean.length > 45
    ? clean.slice(
        0,
        45
      ) + "..."
    : clean;
}


`;

  server =
    server.substring(
      0,
      helperTarget
    ) +
    helperCode +
    server.substring(
      helperTarget
    );
}


/* Remove old chat-history routes if updater was run before */

const historyStart =
  server.indexOf(
    'app.get(\n  "/api/chats"'
  );

const apiChatStartForCleanup =
  server.indexOf(
    'app.post(\n  "/api/chat"'
  );

if (
  historyStart !== -1 &&
  apiChatStartForCleanup !== -1 &&
  historyStart <
    apiChatStartForCleanup
) {
  server =
    server.substring(
      0,
      historyStart
    ) +
    server.substring(
      apiChatStartForCleanup
    );
}


/* Add history routes */

const apiChatStart =
  server.indexOf(
    'app.post(\n  "/api/chat"'
  );

if (
  apiChatStart === -1
) {
  throw new Error(
    "Could not find /api/chat route."
  );
}

const historyRoutes = `
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
        item =>
          item.id ===
            req.params.id &&
          item.userId ===
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


`;

server =
  server.substring(
    0,
    apiChatStart
  ) +
  historyRoutes +
  server.substring(
    apiChatStart
  );


/* Replace original /api/chat */

const currentChatStart =
  server.indexOf(
    'app.post(\n  "/api/chat"'
  );

const errorHandlerStart =
  server.indexOf(
    "\napp.use(",
    currentChatStart
  );

if (
  currentChatStart === -1 ||
  errorHandlerStart === -1
) {
  throw new Error(
    "Could not locate complete /api/chat route."
  );
}

const newApiChat = `
app.post(
  "/api/chat",
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
          source.lesson;
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
            createId(),

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

      const previousMessages =
        Array.isArray(
          chat.messages
        )
          ? chat.messages
              .slice(-16)
          : [];

      const conversation =
        previousMessages
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
            "\\n\\n"
          );

      const contextualQuestion =
        conversation
          ? \`Continue this conversation using the previous messages as context.

Previous conversation:

\${conversation}

Student's new question:

\${question}\`
          : question;

      const answer =
        await askProvider(
          provider,
          buildChatPrompt(
            contextualQuestion,
            lesson
          ),
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
            createId(),

          role:
            "user",

          content:
            question,

          createdAt:
            now
        },
        {
          id:
            createId(),

          role:
            "assistant",

          content:
            answer.trim(),

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
          answer.trim(),

        chatId:
          chat.id,

        title:
          chat.title
      });

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

`;

server =
  server.substring(
    0,
    currentChatStart
  ) +
  newApiChat +
  server.substring(
    errorHandlerStart
  );

fs.writeFileSync(
  serverFile,
  server,
  "utf8"
);


console.log("");
console.log(
  "SCRIPT.JS UPDATED"
);

console.log(
  "SERVER.JS UPDATED"
);

console.log("");
