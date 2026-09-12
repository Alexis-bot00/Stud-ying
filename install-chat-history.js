const fs = require("fs");

const indexFile = "./docs/index.html";
const scriptFile = "./docs/script.js";
const serverFile = "./backend/server.js";

function backup(file) {
    const backupFile = file + ".before-chat-history";
    fs.copyFileSync(file, backupFile);
    console.log("Backup:", backupFile);
}

backup(indexFile);
backup(scriptFile);
backup(serverFile);

/* =========================================================
   INDEX.HTML
   ========================================================= */

let html = fs.readFileSync(indexFile, "utf8");

if (!html.includes('id="newChatButton"')) {

    const aiStart = html.indexOf('<section\n      id="ai"');

    if (aiStart === -1) {
        throw new Error("STUDYante AI section was not found in index.html");
    }

    const aiEnd = html.indexOf("</section>", aiStart);

    if (aiEnd === -1) {
        throw new Error("Could not find end of STUDYante AI section.");
    }

    const newAI = `
<section
      id="ai"
      class="panel"
    >

      <div class="section-title">
        <h2>&#x1F916; STUDYante AI</h2>
        <p>
          Ask questions about any topic or your selected lesson.
        </p>
      </div>

      <div class="ai-chat-layout">

        <div class="chat-history-panel">

          <div class="chat-history-header">

            <h3>Chat History</h3>

            <button
              id="newChatButton"
              class="new-chat-btn"
              type="button"
            >
              + New Chat
            </button>

          </div>

          <div
            id="chatHistoryList"
            class="chat-history-list"
          >
            <div class="chat-empty-history">
              Loading chats...
            </div>
          </div>

        </div>


        <div class="chat-main">

          <div
            id="aiMessages"
            class="chat-messages"
          >

            <div class="message assistant">

              <span class="message-avatar">
                &#x1F916;
              </span>

              <div class="message-text">
                Hi! Start a conversation with STUDYante AI.
              </div>

            </div>

          </div>


          <div class="chat-input">

            <textarea
              id="question"
              placeholder="Ask STUDYante AI..."
            ></textarea>

            <button
              id="askButton"
              class="send-btn"
              type="button"
            >
              Send
            </button>

          </div>

        </div>

      </div>

    </section>`;

    html =
        html.substring(0, aiStart) +
        newAI +
        html.substring(aiEnd + "</section>".length);
}

if (!html.includes('id="studyante-chat-history-style"')) {

    const css = `
<style id="studyante-chat-history-style">

.ai-chat-layout {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 18px;
    margin-top: 18px;
}

.chat-history-panel {
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 14px;
    background: #f8fafc;
    min-height: 480px;
}

.chat-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
}

.chat-history-header h3 {
    margin: 0;
    font-size: 16px;
}

.new-chat-btn {
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    background: #2563eb;
    color: white;
    font-weight: 700;
    cursor: pointer;
}

.chat-history-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.chat-history-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.chat-history-open {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    border-radius: 9px;
    padding: 10px;
    text-align: left;
    cursor: pointer;
    color: #172033;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.chat-history-item.active .chat-history-open,
.chat-history-open:hover {
    background: #e7efff;
    color: #1d4ed8;
}

.chat-history-delete {
    border: 0;
    background: transparent;
    cursor: pointer;
    border-radius: 8px;
    padding: 7px;
}

.chat-history-delete:hover {
    background: #fee2e2;
}

.chat-main {
    min-width: 0;
}

.chat-empty-history {
    color: #64748b;
    font-size: 13px;
    padding: 10px 4px;
}

@media (max-width: 800px) {

    .ai-chat-layout {
        grid-template-columns: 1fr;
    }

    .chat-history-panel {
        min-height: auto;
    }
}

</style>
`;

    html = html.replace("</head>", css + "\n</head>");
}

fs.writeFileSync(indexFile, html, "utf8");


/* =========================================================
   SCRIPT.JS
   ========================================================= */

let script = fs.readFileSync(scriptFile, "utf8");

if (!script.includes("let activeChatId = null;")) {

    script = script.replace(
        'const aiMessages = $("aiMessages");',
`const aiMessages = $("aiMessages");
const newChatButton = $("newChatButton");
const chatHistoryList = $("chatHistoryList");

let activeChatId = null;
let chatHistory = [];`
    );
}

const sendStart =
    script.indexOf("async function sendQuestion()");

const timerStart =
    script.indexOf("function updateTimer()", sendStart);

if (sendStart === -1 || timerStart === -1) {
    throw new Error(
        "Could not locate AI functions inside script.js"
    );
}

const chatCode = `
async function sendQuestion() {

    const text = question.value.trim();

    if (!text) return;

    addMessage(text, "user");

    question.value = "";
    askButton.disabled = true;

    const loading = addMessage(
        "STUDYante AI is thinking...",
        "assistant"
    );

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

        const response = await fetch(
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
                "Error: " + error.message;

    } finally {

        askButton.disabled = false;
        question.focus();
    }
}


function addMessage(text, role) {

    const message =
        document.createElement("div");

    message.className =
        \`message \${role}\`;

    if (role === "assistant") {

        message.innerHTML =
            '<span class="message-avatar">&#x1F916;</span>' +
            '<div class="message-text"></div>';

    } else {

        message.innerHTML =
            '<div class="message-text"></div>';
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
                "Could not load chat history."
            );
        }

        chatHistory =
            Array.isArray(data.chats)
                ? data.chats
                : [];

        renderChatHistory();

    } catch (error) {

        chatHistoryList.innerHTML =
            '<div class="chat-empty-history">' +
            escapeHTML(error.message) +
            '</div>';
    }
}


function renderChatHistory() {

    chatHistoryList.innerHTML = "";

    if (chatHistory.length === 0) {

        chatHistoryList.innerHTML =
            '<div class="chat-empty-history">' +
            'No saved chats yet.' +
            '</div>';

        return;
    }

    chatHistory.forEach(chat => {

        const row =
            document.createElement("div");

        row.className =
            "chat-history-item";

        if (chat.id === activeChatId) {
            row.classList.add("active");
        }


        const open =
            document.createElement("button");

        open.type = "button";

        open.className =
            "chat-history-open";

        open.textContent =
            chat.title ||
            "New Chat";

        open.addEventListener(
            "click",
            () => openChat(chat.id)
        );


        const remove =
            document.createElement("button");

        remove.type = "button";

        remove.className =
            "chat-history-delete";

        remove.innerHTML =
            "&#x1F5D1;";

        remove.title =
            "Delete chat";

        remove.addEventListener(
            "click",
            () => deleteChat(chat)
        );


        row.appendChild(open);
        row.appendChild(remove);

        chatHistoryList.appendChild(row);
    });
}


async function openChat(chatId) {

    try {

        const response =
            await fetch(
                \`\${API_BASE}/api/chats/\${encodeURIComponent(chatId)}\`
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

        messages.forEach(message => {

            addMessage(
                message.content,
                message.role === "user"
                    ? "user"
                    : "assistant"
            );
        });

        renderChatHistory();

        question.focus();

    } catch (error) {

        alert(error.message);
    }
}


async function deleteChat(chat) {

    if (
        !confirm(
            'Delete "' +
            (chat.title || "this chat") +
            '"?'
        )
    ) {
        return;
    }

    try {

        const response =
            await fetch(
                \`\${API_BASE}/api/chats/\${encodeURIComponent(chat.id)}\`,
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
            activeChatId === chat.id
        ) {
            showNewChat();
        }

        await loadChatHistory();

    } catch (error) {

        alert(error.message);
    }
}


if (newChatButton) {

    newChatButton.addEventListener(
        "click",
        showNewChat
    );
}


`;

script =
    script.substring(0, sendStart) +
    chatCode +
    script.substring(timerStart);

if (!script.includes("loadChatHistory();")) {

    script += "\nloadChatHistory();\n";

} else {

    const lastLoadLibrary =
        script.lastIndexOf(
            "loadLibrary();"
        );

    if (
        lastLoadLibrary !== -1 &&
        !script
            .substring(lastLoadLibrary)
            .includes(
                "loadChatHistory();"
            )
    ) {

        const end =
            lastLoadLibrary +
            "loadLibrary();".length;

        script =
            script.substring(0, end) +
            "\nloadChatHistory();" +
            script.substring(end);
    }
}

fs.writeFileSync(
    scriptFile,
    script,
    "utf8"
);


/* =========================================================
   SERVER.JS
   ========================================================= */

let server =
    fs.readFileSync(
        serverFile,
        "utf8"
    );


if (!server.includes("const chatsFile")) {

    const usersPattern =
        /const usersFile = path\\.join\\([\\s\\S]*?"users\\.json"[\\s\\S]*?\\);/;

    const match =
        server.match(usersPattern);

    if (!match) {
        throw new Error(
            "usersFile was not found in server.js"
        );
    }

    server =
        server.replace(
            match[0],
            match[0] +
`
const chatsFile = path.join(
    libraryFolder,
    "chats.json"
);`
        );
}


if (
    !server.includes(
        "fs.existsSync(chatsFile)"
    )
) {

    const insertPoint =
        server.indexOf(
            "function readLibrary"
        );

    if (insertPoint === -1) {
        throw new Error(
            "Could not locate storage functions."
        );
    }

    const storageCode = `
if (!fs.existsSync(chatsFile)) {

    fs.writeFileSync(
        chatsFile,
        JSON.stringify([], null, 2),
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

        return Array.isArray(data)
            ? data
            : [];

    } catch {

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


function makeChatTitle(text) {

    const clean =
        String(text || "")
            .replace(/\\s+/g, " ")
            .trim();

    if (!clean) {
        return "New Chat";
    }

    return clean.length > 45
        ? clean.slice(0, 45) + "..."
        : clean;
}


`;

    server =
        server.substring(
            0,
            insertPoint
        ) +
        storageCode +
        server.substring(
            insertPoint
        );
}


if (
    !server.includes(
        '"/api/chats"'
    )
) {

    const chatRoute =
        server.indexOf(
            'app.post(\n  "/api/chat"'
        );

    if (chatRoute === -1) {
        throw new Error(
            "/api/chat route was not found."
        );
    }

    const routes = `
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
                .map(chat => ({
                    id: chat.id,
                    title: chat.title,
                    createdAt:
                        chat.createdAt,
                    updatedAt:
                        chat.updatedAt
                }));

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
                item =>
                    item.id ===
                        req.params.id &&
                    item.userId ===
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

        chats.splice(index, 1);

        writeChats(chats);

        res.json({
            success: true
        });
    }
);


`;

    server =
        server.substring(
            0,
            chatRoute
        ) +
        routes +
        server.substring(
            chatRoute
        );
}


/* Replace existing /api/chat route */

const routeStart =
    server.indexOf(
        'app.post(\n  "/api/chat"'
    );

const routeEnd =
    server.indexOf(
        "\napp.use(",
        routeStart
    );

if (
    routeStart === -1 ||
    routeEnd === -1
) {

    throw new Error(
        "Could not update /api/chat."
    );
}

const newRoute = `
app.post(
  "/api/chat",
  requireAuth,
  upload.single("file"),
  async (req, res) => {

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
                source.lesson;
        }


        let chats =
            readChats();

        let chatId =
            String(
                req.body.chatId ||
                ""
            ).trim();

        let chat =
            chatId
                ? chats.find(
                    item =>
                        item.id ===
                            chatId &&
                        item.userId ===
                            req.user.id
                )
                : null;


        const now =
            new Date()
                .toISOString();


        if (!chat) {

            chat = {
                id: createId(),
                userId:
                    req.user.id,
                title:
                    makeChatTitle(
                        question
                    ),
                messages: [],
                createdAt:
                    now,
                updatedAt:
                    now
            };

            chats.push(chat);

            chatId =
                chat.id;
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
                .map(message => {

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
                })
                .join("\\n\\n");


        const contextualQuestion =
            conversation
                ? (
                    "Continue this conversation. " +
                    "Use the previous messages as context.\\n\\n" +
                    "Previous conversation:\\n" +
                    conversation +
                    "\\n\\nStudent's new question:\\n" +
                    question
                )
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


        chat.messages =
            Array.isArray(
                chat.messages
            )
                ? chat.messages
                : [];


        chat.messages.push(
            {
                id: createId(),
                role: "user",
                content:
                    question,
                createdAt:
                    now
            },
            {
                id: createId(),
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


        writeChats(chats);


        res.json({
            success: true,
            answer:
                answer.trim(),
            chatId:
                chat.id,
            title:
                chat.title
        });


    } catch (error) {

        res
            .status(500)
            .json({
                success: false,
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
        routeStart
    ) +
    newRoute +
    server.substring(
        routeEnd
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
console.log(
    "=================================="
);
console.log(
    " STUDYante Chat History Installed"
);
console.log(
    "=================================="
);
console.log("");
console.log(
    "Updated: docs/index.html"
);
console.log(
    "Updated: docs/script.js"
);
console.log(
    "Updated: backend/server.js"
);
console.log("");
