const fs = require("fs");

const file = "./docs/index.html";

let html = fs
    .readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n");


const historyRegex =
/\s*<div class="chat-history-panel">[\s\S]*?<div\s+id="chatHistoryList"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;


const match =
    html.match(historyRegex);


if (!match) {
    throw new Error(
        "Could not locate Chat History panel."
    );
}


const historyBlock =
    match[0].trim();


html =
    html.replace(
        historyRegex,
        ""
    );


const sidebarEnd =
    `    </nav>

  </aside>`;


if (!html.includes(sidebarEnd)) {
    throw new Error(
        "Could not locate sidebar closing tag."
    );
}


const sidebarHistory =
`
    </nav>

    <div class="sidebar-chat-history">
${historyBlock
    .split("\n")
    .map(line => "      " + line)
    .join("\n")}
    </div>

  </aside>`;


html =
    html.replace(
        sidebarEnd,
        sidebarHistory
    );


fs.writeFileSync(
    file,
    html,
    "utf8"
);


console.log(
    "Chat History moved into sidebar."
);
