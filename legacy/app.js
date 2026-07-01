(function () {
  "use strict";

  const STORAGE_KEY = "zadachnik.tasks.v1";
  const THEME_KEY = "zadachnik.theme";

  // --- State ---
  let tasks = loadTasks();
  let currentFilter = "all";

  // --- DOM ---
  const form = document.getElementById("taskForm");
  const input = document.getElementById("taskInput");
  const priorityInput = document.getElementById("priorityInput");
  const list = document.getElementById("taskList");
  const emptyState = document.getElementById("emptyState");
  const filters = document.getElementById("filters");
  const clearDoneBtn = document.getElementById("clearDone");
  const themeToggle = document.getElementById("themeToggle");
  const statTotal = document.getElementById("statTotal");
  const statActive = document.getElementById("statActive");
  const statDone = document.getElementById("statDone");

  const PRIO_LABELS = { low: "Низкий", medium: "Средний", high: "Высокий" };

  // --- Storage helpers ---
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      /* storage unavailable — ignore */
    }
  }

  // --- Rendering ---
  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  function getFilteredTasks() {
    if (currentFilter === "active") return tasks.filter((t) => !t.done);
    if (currentFilter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }

  function render() {
    list.innerHTML = "";
    const visible = getFilteredTasks();

    visible.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task" + (task.done ? " is-done" : "");
      li.dataset.id = task.id;

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "task__check";
      check.checked = task.done;
      check.addEventListener("change", () => toggleTask(task.id));

      const body = document.createElement("div");
      body.className = "task__body";

      const text = document.createElement("div");
      text.className = "task__text";
      text.textContent = task.text;

      const meta = document.createElement("div");
      meta.className = "task__meta";

      const prio = document.createElement("span");
      prio.className = "prio prio--" + task.priority;
      prio.textContent = PRIO_LABELS[task.priority] || task.priority;

      const date = document.createElement("span");
      date.className = "task__date";
      date.textContent = formatDate(task.createdAt);

      meta.appendChild(prio);
      meta.appendChild(date);
      body.appendChild(text);
      body.appendChild(meta);

      const del = document.createElement("button");
      del.className = "task__delete";
      del.textContent = "×";
      del.title = "Удалить";
      del.addEventListener("click", () => deleteTask(task.id));

      li.appendChild(check);
      li.appendChild(body);
      li.appendChild(del);
      list.appendChild(li);
    });

    emptyState.classList.toggle("is-visible", visible.length === 0);
    renderStats();
  }

  function renderStats() {
    const done = tasks.filter((t) => t.done).length;
    statTotal.textContent = tasks.length;
    statActive.textContent = tasks.length - done;
    statDone.textContent = done;
  }

  // --- Actions ---
  function addTask(text, priority) {
    tasks.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text,
      priority: priority,
      done: false,
      createdAt: Date.now(),
    });
    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.done = !task.done;
      saveTasks();
      render();
    }
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  }

  function clearDone() {
    tasks = tasks.filter((t) => !t.done);
    saveTasks();
    render();
  }

  // --- Theme ---
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* ignore */
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  }

  // --- Events ---
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addTask(text, priorityInput.value);
    input.value = "";
    input.focus();
  });

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    filters.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    render();
  });

  clearDoneBtn.addEventListener("click", clearDone);
  themeToggle.addEventListener("click", toggleTheme);

  // --- Init ---
  const savedTheme = (function () {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  })();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

  render();
})();
