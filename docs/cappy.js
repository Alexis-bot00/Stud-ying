(function () {
  "use strict";

  const API = "https://studyante-backend-test-v2.onrender.com";
  const KEY = "studyante-cappy-planner-v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const money = value => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value) || 0);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fresh = () => ({ tasks: [], classes: [], expenses: [], subjects: [] });

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      return { ...fresh(), ...(saved && typeof saved === "object" ? saved : {}) };
    } catch (_) { return fresh(); }
  }
  let data = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (_) { alert("Could not save planner data in this browser."); }
    render();
  }
  function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
  function empty(message) { return '<p class="cp-empty">' + safe(message) + '</p>'; }
  function row(title, meta, actions, done) {
    return '<article class="cp-item ' + (done ? 'cp-done' : '') + '"><div class="cp-item-main"><div class="cp-item-title">' + safe(title) + '</div><div class="cp-item-meta">' + safe(meta || "") + '</div></div><div class="cp-item-actions">' + actions + '</div></article>';
  }
  function button(action, id, label, secondary) {
    return '<button type="button" data-action="' + safe(action) + '" data-id="' + safe(id) + '"' + (secondary ? ' class="cp-secondary"' : '') + '>' + safe(label) + '</button>';
  }

  function render() {
    const done = data.tasks.filter(x => x.done).length;
    $("#cp-task-progress").textContent = done + " / " + data.tasks.length;
    $("#cp-class-count").textContent = data.classes.length;
    $("#cp-subject-count").textContent = data.subjects.length;
    const balance = data.expenses.reduce((sum, x) => sum + (x.income ? x.amount : -x.amount), 0);
    $("#cp-balance").textContent = money(balance);

    $("#cp-task-total").textContent = data.tasks.length + (data.tasks.length === 1 ? " task" : " tasks");
    $("#cp-task-list").innerHTML = data.tasks.length ? data.tasks.map(x =>
      row(x.title, (x.due ? "Due " + x.due + " · " : "") + (x.done ? "Completed" : "Not completed"),
        button("toggle-task", x.id, x.done ? "Undo" : "Complete", true) + button("delete-task", x.id, "Delete"), x.done)
    ).join("") : empty("No tasks yet. Add your first task above.");

    const dayOrder = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const classes = [...data.classes].sort((a,b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || a.start.localeCompare(b.start));
    $("#cp-class-list").innerHTML = classes.length ? classes.map(x =>
      row(x.name, x.day + " · " + x.start + "–" + x.end + (x.room ? " · " + x.room : ""),
        button("delete-class", x.id, "Delete", true))
    ).join("") : empty("No classes saved yet. Add your weekly classes above.");

    const income = data.expenses.filter(x => x.income).reduce((s,x) => s+x.amount, 0);
    const expenses = data.expenses.filter(x => !x.income).reduce((s,x) => s+x.amount, 0);
    $("#cp-income").textContent = money(income);
    $("#cp-expenses").textContent = money(expenses);
    $("#cp-budget-balance").textContent = money(income-expenses);
    $("#cp-budget-list").innerHTML = data.expenses.length ? [...data.expenses].reverse().map(x =>
      row((x.income ? "＋ " : "− ") + x.label, x.income ? "Income" : "Expense",
        '<strong>' + safe(money(x.amount)) + '</strong> ' + button("delete-expense", x.id, "Delete", true))
    ).join("") : empty("No money records yet.");

    $("#cp-grade-list").innerHTML = data.subjects.length ? data.subjects.map(subject => {
      const scores = subject.scores || [];
      const earned = scores.reduce((s,x) => s+x.earned, 0);
      const total = scores.reduce((s,x) => s+x.total, 0);
      const pct = total ? (earned/total*100).toFixed(1) + "%" : "No scores yet";
      const details = scores.map(x => x.name + ": " + x.earned + "/" + x.total).join(" · ");
      return row(subject.name, (details || "No assessments") + " · Overall: " + pct,
        button("delete-subject", subject.id, "Delete subject", true));
    }).join("") : empty("No subjects yet. Add a subject and score above.");
  }

  document.addEventListener("click", event => {
    const go = event.target.closest("[data-go]");
    if (go) {
      if (typeof window.showStudyantePage === "function") window.showStudyantePage(go.dataset.go);
      return;
    }
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "toggle-task") {
      const item = data.tasks.find(x => x.id === id);
      if (item) item.done = !item.done;
    } else if (action === "delete-task") data.tasks = data.tasks.filter(x => x.id !== id);
    else if (action === "delete-class") data.classes = data.classes.filter(x => x.id !== id);
    else if (action === "delete-expense") data.expenses = data.expenses.filter(x => x.id !== id);
    else if (action === "delete-subject") data.subjects = data.subjects.filter(x => x.id !== id);
    else if (action === "join-circle") requestJoin(id);
    else return;
    save();
  });

  $("#cp-task-form").addEventListener("submit", event => {
    event.preventDefault();
    const v = formData(event.currentTarget);
    data.tasks.push({ id: makeId(), title: v.title.trim(), due: v.due, done: false });
    event.currentTarget.reset(); save();
  });

  $("#cp-class-form").addEventListener("submit", event => {
    event.preventDefault();
    const v = formData(event.currentTarget);
    if (v.end <= v.start) return alert("The end time must be later than the start time.");
    data.classes.push({ id: makeId(), ...v });
    event.currentTarget.reset(); save();
  });

  $("#cp-budget-form").addEventListener("submit", event => {
    event.preventDefault();
    const v = formData(event.currentTarget), amount = Number(v.amount);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Enter an amount greater than zero.");
    data.expenses.push({ id: makeId(), label: v.label.trim(), amount, income: v.type === "income" });
    event.currentTarget.reset(); save();
  });

  $("#cp-grade-form").addEventListener("submit", event => {
    event.preventDefault();
    const v = formData(event.currentTarget), earned = Number(v.earned), total = Number(v.total);
    if (!Number.isFinite(earned) || !Number.isFinite(total) || total <= 0 || earned < 0 || earned > total)
      return alert("Enter a valid score. The earned score cannot exceed the total.");
    let subject = data.subjects.find(x => x.name.toLowerCase() === v.name.trim().toLowerCase());
    if (!subject) {
      subject = { id: makeId(), name: v.name.trim(), scores: [] };
      data.subjects.push(subject);
    }
    subject.scores.push({ id: makeId(), name: v.assessment.trim(), earned, total });
    event.currentTarget.reset(); save();
  });

  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || ("Request failed (" + response.status + ")"));
    return result;
  }
  function circleArray(result) {
    if (Array.isArray(result)) return result;
    return result.circles || result.items || result.results || result.data || [];
  }
  function circleId(circle) { return circle.id || circle._id || circle.circleId; }

  async function loadCircles(search = "") {
    const status = $("#cp-circle-status"), list = $("#cp-circle-list");
    status.textContent = "Loading Study Circles…";
    list.innerHTML = "";
    try {
      const result = await api("/api/cappy/circles" + (search ? "?search=" + encodeURIComponent(search) : ""));
      const circles = circleArray(result);
      status.textContent = circles.length ? circles.length + " circle(s) found." : "No circles found. You can create one below.";
      list.innerHTML = circles.map(circle => {
        const id = circleId(circle);
        if (!id) return "";
        return row(circle.name || circle.title || "Study Circle", circle.description || "Study together with other learners.",
          button("join-circle", id, "Request to join"));
      }).join("") || empty("Try another search or create a new circle.");
    } catch (error) {
      status.textContent = "Could not load circles: " + error.message + ". Please check that you are signed in and the backend is available.";
    }
  }
  async function requestJoin(id) {
    try {
      await api("/api/cappy/circles/" + encodeURIComponent(id) + "/requests", { method: "POST", body: JSON.stringify({}) });
      $("#cp-circle-status").textContent = "Join request sent.";
      await loadCircles($("#cp-circle-search input[name=search]").value.trim());
    } catch (error) {
      $("#cp-circle-status").textContent = "Could not send join request: " + error.message;
    }
  }

  $("#cp-circle-search").addEventListener("submit", event => {
    event.preventDefault();
    loadCircles(formData(event.currentTarget).search.trim());
  });
  $("#cp-circle-refresh").addEventListener("click", () => loadCircles($("#cp-circle-search input[name=search]").value.trim()));

  $("#cp-circle-create").addEventListener("submit", async event => {
    event.preventDefault();
    const v = formData(event.currentTarget);
    $("#cp-circle-status").textContent = "Creating your circle…";
    try {
      await api("/api/cappy/circles", {
        method: "POST",
        body: JSON.stringify({ name: v.name.trim(), description: v.description.trim() })
      });
      event.currentTarget.reset();
      $("#cp-circle-status").textContent = "Circle created.";
      await loadCircles($("#cp-circle-search input[name=search]").value.trim());
    } catch (error) {
      $("#cp-circle-status").textContent = "Could not create circle: " + error.message;
    }
  });

  $("#cp-scan-form").addEventListener("submit", async event => {
    event.preventDefault();
    const file = formData(event.currentTarget).image;
    if (!file || !file.size) return;
    const status = $("#cp-scan-status"), results = $("#cp-scan-results");
    status.textContent = "Scanning schedule…";
    results.innerHTML = "";
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read the selected image."));
        reader.readAsDataURL(file);
      });
      const response = await api("/api/schedule/scan", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || "image/jpeg" })
      });
      const found = response.classes || response.data?.classes || [];
      if (!found.length) {
        status.textContent = "The scan returned no classes. Please check the image or enter classes manually.";
        return;
      }
      status.textContent = "Review the detected classes below. Add each class to your planner if it is correct.";
      results.innerHTML = found.map((c, i) => row(
        c.name || c.subject || ("Detected class " + (i+1)),
        [c.day, c.start, c.end, c.room].filter(Boolean).join(" · "),
        button("add-scanned-class", String(i), "Add class")
      )).join("");
      results.dataset.found = JSON.stringify(found);
    } catch (error) {
      status.textContent = "Schedule scan failed: " + error.message;
    }
  });

  document.addEventListener("click", event => {
    const btn = event.target.closest('[data-action="add-scanned-class"]');
    if (!btn) return;
    try {
      const found = JSON.parse($("#cp-scan-results").dataset.found || "[]");
      const c = found[Number(btn.dataset.id)];
      if (!c) return;
      data.classes.push({
        id: makeId(),
        name: c.name || c.subject || "Class",
        day: c.day || "Monday",
        start: c.start || "08:00",
        end: c.end || "09:00",
        room: c.room || ""
      });
      save();
      btn.textContent = "Added";
      btn.disabled = true;
    } catch (_) {
      $("#cp-scan-status").textContent = "Could not add this scanned class.";
    }
  });

  render();
  if (location.hash === "#circles") loadCircles();
  document.addEventListener("click", event => {
    const link = event.target.closest('.sidebar nav a[data-page="circles"]');
    if (link) loadCircles();
  });
})();