const fs = require("fs");

const scriptFile = "./docs/script.js";
const serverFile = "./backend/server.js";

function backup(file) {
  fs.copyFileSync(file, file + ".chat-history-backup");
}

backup(scriptFile);
backup(serverFile);

/* =========================================================
   FRONTEND - script.js
========================================================= */

let script = fs.readFileSync(scriptFile, "utf8");

if (!script.includes('const newChatButton = $("newChatButton");')) {
  const marker = 'const aiMessages = $("aiMessages");';

  if (!script.includes(marker)) {
    throw new Error("aiMessages marker not found.");
  }

  script = script.replace(
    marker,
`const aiMessages = $("aiMessages");
const newChatButton = $("newChatButton");
const chatHistoryList = $("chatHistoryList");

let activeChatId = null;
let chatHistory = [];`
  );
}

const sendStart =
  script.indexOf("async function sendQuestion()");

const nextSection =
  script.indexOf(
    "\ndocument\n  .querySelectorAll(",
    sendStart
  );

if (sendStart === -1) {
  throw new Error("sendQuestion() not found.");
}

if (nextSection === -1) {
  throw new Error(
    "Could not find section after addMessage()."
  );
}

const newFrontendChatCode = `
async function sendQuestion() {
  const text = question.value.trim();

  if (!text) {
    return;
  }

  const provider = getProvider();

  addMessage(
    text,
    "user"
  );

  question.value = "";
  askButton.disabled = true;

  const loading = addMessage(
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
    provider
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
      await readResponse(response);

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

  if (role === "assistant") {
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


function newChat() {
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
        \`\${API_BASE}/api/chats\`
      );

    const data =
      await readResponse(response);

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
        "Could not load chats."
      );
    }

    chatHistory =
      Array.isArray(data.chats)
        ? data.chats
        : [];

    renderChatHistory();

  } catch (error) {
    chatHistoryList.innerHTML = "";

    const message =
      document.createElement("div");

    message.className =
      "chat-empty-history";

    message.textContent =
      error.message;

    chatHistoryList.appendChild(
      message
    );
  }
}


function renderChatHistory() {
  if (!chatHistoryList) {
    return;
  }

  chatHistoryList.innerHTML = "";

  if (chatHistory.length === 0) {
    const empty =
      document.createElement("div");

    empty.className =
      "chat-empty-history";

    empty.textContent =
      "No saved chats yet.";

    chatHistoryList.appendChild(
      empty
    );

    return;
  }

  chatHistory.forEach(chat => {
    const row =
      document.createElement("div");

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
      () => openChat(chat.id)
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

        deleteChat(chat);
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
  });
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
      await readResponse(response);

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

    if (messages.length === 0) {
      addMessage(
        "Start this conversation.",
        "assistant"
      );
    } else {
      messages.forEach(
        message => {
          addMessage(
            message.content,
            message.role === "user"
              ? "user"
              : "assistant"
          );
        }
      );
    }

    renderChatHistory();
    question.focus();

  } catch (error) {
    alert(error.message);
  }
}


async function deleteChat(
  chat
) {
  const confirmed =
    confirm(
      'Delete "' +
      (chat.title || "this chat") +
      '"?'
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
          method: "DELETE"
        }
      );

    const data =
      await readResponse(response);

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
      newChat();
    }

    await loadChatHistory();

  } catch (error) {
    alert(error.message);
  }
}


if (newChatButton) {
  newChatButton.addEventListener(
    "click",
    newChat
  );
}


loadChatHistory();

`;

script =
  script.substring(0, sendStart) +
  newFrontendChatCode +
  script.substring(nextSection);

fs.writeFileSync(
  scriptFile,
  script,
  "utf8"
);


/* =========================================================
   BACKEND - server.js
========================================================= */

let server =
  fs.readFileSync(
    serverFile,
    "utf8"
  );

if (
  !server.includes(
    "const chatsFile ="
  )
) {
  const authMarker =
    server.indexOf(
      "function requireAuth("
    );

  if (authMarker === -1) {
    throw new Error(
      "requireAuth() not found."
    );
  }

  const chatStorageCode = `
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

    return Array.isArray(chats)
      ? chats
      : [];

  } catch (error) {
    console.error(
      "Could not read chats:",
      error
    );

    return [];
  }
}


function writeChats(chats) {
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


function makeChatTitle(text) {
  const title =
    String(text || "")
      .replace(/\\s+/g, " ")
      .trim();

  if (!title) {
    return "New Chat";
  }

  if (title.length > 45) {
    return (
      title.slice(0, 45) +
      "..."
    );
  }

  return title;
}


`;

  server =
    server.substring(
      0,
      authMarker
    ) +
    chatStorageCode +
    server.substring(
      authMarker
    );
}


/* Find the existing chat route */

const apiChatStart =
  server.indexOf(
    'app.post(\n  "/api/chat",'
  );

if (apiChatStart === -1) {
  throw new Error(
    "/api/chat route not found."
  );
}

const afterChatRoute =
  server.indexOf(
    "\napp.use(",
    apiChatStart
  );

if (afterChatRoute === -1) {
  throw new Error(
    "Could not find end of /api/chat route."
  );
}

const backendChatRoutes = `
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
              b.updatedAt || ""
            ).localeCompare(
              String(
                a.updatedAt || ""
              )
            )
        )
        .map(
          chat => ({
            id: chat.id,
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
      readChats().find(
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
          success: false,
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

    if (index === -1) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Chat not found."
        });
    }

    chats.splice(
      index,
      1
    );

    writeChats(chats);

    res.json({
      success: true
    });
  }
);


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
            success: false,
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
          await getLesson(req);

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

      let chat = null;

      if (requestedChatId) {
        chat =
          chats.find(
            item =>
              item.id ===
                requestedChatId &&
              item.userId ===
                req.user.id
          );
      }


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

        chats.push(chat);
      }


      const previousMessages =
        Array.isArray(
          chat.messages
        )
          ? chat.messages
              .slice(-16)
          : [];


      const previousConversation =
        previousMessages
          .map(message => {
            const role =
              message.role ===
              "user"
                ? "Student"
                : "STUDYante AI";

            return (
              role +
              ": " +
              message.content
            );
          })
          .join("\\n\\n");


      const questionWithHistory =
        previousConversation
          ? (
              "Continue the conversation below. " +
              "Remember the previous messages and answer the student's new message naturally.\\n\\n" +
              "Previous conversation:\\n\\n" +
              previousConversation +
              "\\n\\nNew student message:\\n\\n" +
              question
            )
          : question;


      const answer =
        await askProvider(
          provider,
          buildChatPrompt(
            questionWithHistory,
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
        chat.messages = [];
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
        }
      );


      chat.messages.push(
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


      writeChats(chats);


      res.json({
        success: true,

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
          success: false,
          message:
            error.message ||
            "Could not answer."
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
    apiChatStart
  ) +
  backendChatRoutes +
  server.substring(
    afterChatRoute
  );

server =
  server.replace(
    /Studying AI/g,
    "STUDYante AI"
  );

fs.writeFileSync(
  serverFile,
  server,
  "utf8"
);

console.log("");
console.log("================================");
console.log(" STUDYante Chat History Updated");
console.log("================================");
console.log("");
