const fs = require("fs");

const file = "./login.html";
const backup = "./login-before-symbol-fix.html";

fs.copyFileSync(file, backup);

let html = fs.readFileSync(file, "utf8");

// Library feature
html = html.replace(
    /<span[^>]*>.*?<\/span>\s*<div>\s*<strong>Your own library<\/strong>/s,
    '<span>&#x1F4DA;</span>\n<div>\n<strong>Your own library</strong>'
);

// AI feature
html = html.replace(
    /<span[^>]*>.*?<\/span>\s*<div>\s*<strong>.*?AI<\/strong>/s,
    '<span>&#x1F916;</span>\n<div>\n<strong>STUDYante AI</strong>'
);

// Practice feature
html = html.replace(
    /<span[^>]*>.*?<\/span>\s*<div>\s*<strong>Practice your lessons<\/strong>/s,
    '<span>&#x1F9E0;</span>\n<div>\n<strong>Practice your lessons</strong>'
);

// Login subtitle
html = html.replace(
    /Login to continue to your .*? account\./g,
    "Login to continue to your STUDYante account."
);

// Copyright
html = html.replace(
    /[^<]*2026 STUDYante/g,
    "&copy; 2026 STUDYante"
);

fs.writeFileSync(file, html, "utf8");

console.log("Login symbols fixed.");