
"use strict";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "taskflow_standalone_tasks";
const THEME_KEY = "taskflow_standalone_theme";

let editingId = null;
let toastTimer;

function dateOffset(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn("Could not read TaskFlow data.", error);
  }

  // Demo data is added only when TaskFlow has no saved list.
  const demo = [
    {
      id: 101,
      title: "Finish project demo",
      description: "Test the main flow and prepare a short walkthrough.",
      category: "Study",
      priority: "High",
      due: dateOffset(1),
      reminder: "",
      done: false,
      createdAt: Date.now() - 50000
    },
    {
      id: 102,
      title: "Practice JavaScript DOM",
      description: "Review events, selectors, and event delegation.",
      category: "Study",
      priority: "Medium",
      due: dateOffset(2),
      reminder: "",
      done: false,
      createdAt: Date.now() - 40000
    },
    {
      id: 103,
      title: "Prepare interview notes",
      description: "Revise programming fundamentals and common questions.",
      category: "Work",
      priority: "High",
      due: dateOffset(3),
      reminder: "",
      done: false,
      createdAt: Date.now() - 30000
    },
    {
      id: 104,
      title: "Organize project files",
      description: "Keep the project folders clean and update the README.",
      category: "Personal",
      priority: "Low",
      due: dateOffset(-1),
      reminder: "",
      done: true,
      createdAt: Date.now() - 20000
    },
    {
      id: 105,
      title: "Update GitHub repository",
      description: "Review the latest changes and add clear documentation.",
      category: "Work",
      priority: "Medium",
      due: dateOffset(5),
      reminder: "",
      done: false,
      createdAt: Date.now() - 10000
    }
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
  return demo;
}

let tasks = loadTasks();

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    showToast("Could not save. Browser storage may be full.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function isOverdue(task) {
  return !task.done && task.due && task.due < dateOffset();
}

function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2600);
}

function prettyDate(value) {
  if (!value) return "No due date";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
}

function renderTasks() {
  const query = $("task-search").value.trim().toLowerCase();
  const statusFilter = $("task-filter").value;
  const priorityFilter = $("priority-filter").value;
  const categoryFilter = $("category-filter").value;
  const sort = $("sort-tasks").value;

  let visible = tasks.filter(task => {
    const searchMatch =
      `${task.title} ${task.description || ""} ${task.category || ""}`
        .toLowerCase()
        .includes(query);

    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "pending" && !task.done) ||
      (statusFilter === "completed" && task.done) ||
      (statusFilter === "overdue" && isOverdue(task));

    const priorityMatch =
      priorityFilter === "all" || task.priority === priorityFilter;

    const categoryMatch =
      categoryFilter === "all" ||
      (task.category || "Other") === categoryFilter;

    return searchMatch && statusMatch && priorityMatch && categoryMatch;
  });

  const rank = { High: 0, Medium: 1, Low: 2 };

  visible.sort((a, b) => {
    if (sort === "due") {
      return (a.due || "9999-12-31").localeCompare(
        b.due || "9999-12-31"
      );
    }

    if (sort === "priority") {
      return rank[a.priority] - rank[b.priority] ||
        (a.createdAt || 0) - (b.createdAt || 0);
    }

    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }

    return (b.createdAt || b.id) - (a.createdAt || a.id);
  });

  const completed = tasks.filter(task => task.done).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter(isOverdue).length;
  const percent = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  $("total-tasks").textContent = tasks.length;
  $("completed-tasks").textContent = completed;
  $("pending-tasks").textContent = pending;
  $("overdue-tasks").textContent = overdue;
  $("progress-label").textContent = `${percent}%`;
  $("progress-bar").style.width = `${percent}%`;

  $("task-count").textContent =
    `${visible.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  $("select-all-visible").checked =
    visible.length > 0 && visible.every(task => task.selected);

  $("task-list").innerHTML = visible.length
    ? visible.map(task => `
      <article class="task-item ${task.done ? "done" : ""}">
        <input
          class="task-check"
          type="checkbox"
          data-complete="${task.id}"
          ${task.done ? "checked" : ""}
          aria-label="Mark ${escapeHTML(task.title)} complete"
        >

        <div class="task-copy">
          <h3>${escapeHTML(task.title)}</h3>
          <p>${escapeHTML(task.description || "No notes added.")}</p>

          <div class="task-meta">
            <span class="chip">${escapeHTML(task.category || "Other")}</span>

            <span class="chip ${escapeHTML(task.priority)} priority">
              ${escapeHTML(task.priority)}
            </span>

            <span class="chip ${isOverdue(task) ? "overdue-chip" : ""}">
              ${isOverdue(task) ? "Overdue · " : "Due · "}
              ${escapeHTML(prettyDate(task.due))}
            </span>

            ${task.reminder ? `
              <span class="chip">
                Reminder ${escapeHTML(task.reminder)}
              </span>
            ` : ""}
          </div>
        </div>

        <input
          type="checkbox"
          data-select="${task.id}"
          ${task.selected ? "checked" : ""}
          aria-label="Select task ${escapeHTML(task.title)}"
          title="Select for bulk actions"
        >

        <div class="task-actions">
          <button class="edit-btn" type="button" data-edit="${task.id}">
            Edit
          </button>
          <button class="delete-btn" type="button" data-delete="${task.id}">
            Delete
          </button>
        </div>
      </article>
    `).join("")
    : `<div class="empty">${
        tasks.length
          ? "No tasks match these filters."
          : "Your task list is empty. Add a task to get started."
      }</div>`;
}

function openForm(task = null) {
  editingId = task ? task.id : null;
  $("task-form").reset();

  $("form-heading").textContent =
    task ? "Edit task" : "Add a new task";

  $("save-task").textContent =
    task ? "Update task" : "Save task";

  if (task) {
    $("task-title").value = task.title;
    $("task-description").value = task.description || "";
    $("task-category").value = task.category || "Other";
    $("task-priority").value = task.priority || "Medium";
    $("task-due").value = task.due || "";
    $("task-reminder").value = task.reminder || "";
  }

  $("task-form").hidden = false;

  $("task-form").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("task-title").focus();
}

function closeForm() {
  $("task-form").hidden = true;
  $("task-form").reset();
  editingId = null;
}

$("add-task").addEventListener("click", () => openForm());
$("close-form").addEventListener("click", closeForm);
$("cancel-task").addEventListener("click", closeForm);

$("task-form").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("task-title").value.trim();

  if (!title) {
    return showToast("Please enter a task title.");
  }

  const old = tasks.find(task => task.id === editingId);

  const task = {
    id: editingId ?? Date.now(),
    title,
    description: $("task-description").value.trim(),
    category: $("task-category").value,
    priority: $("task-priority").value,
    due: $("task-due").value,
    reminder: $("task-reminder").value,
    done: old ? old.done : false,
    createdAt: old ? old.createdAt : Date.now()
  };

  if (editingId !== null) {
    tasks = tasks.map(item => item.id === editingId ? task : item);
  } else {
    tasks.push(task);
  }

  saveTasks();
  closeForm();
  renderTasks();

  showToast(old ? "Task updated." : "Task added.");
});

// Mark tasks complete or select them for bulk actions.
$("task-list").addEventListener("change", event => {
  const complete = event.target.closest("[data-complete]");
  const select = event.target.closest("[data-select]");

  if (complete) {
    const id = Number(complete.dataset.complete);

    tasks = tasks.map(task =>
      task.id === id
        ? { ...task, done: complete.checked }
        : task
    );

    saveTasks();
    renderTasks();

    showToast(
      complete.checked ? "Task completed!" : "Task reopened."
    );
  }

  if (select) {
    const id = Number(select.dataset.select);

    tasks = tasks.map(task =>
      task.id === id
        ? { ...task, selected: select.checked }
        : task
    );

    saveTasks();
    renderTasks();
  }
});

// Edit or delete individual tasks.
$("task-list").addEventListener("click", event => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");

  if (edit) {
    const task = tasks.find(
      item => item.id === Number(edit.dataset.edit)
    );

    if (task) openForm(task);
  }

  if (del) {
    const id = Number(del.dataset.delete);
    const task = tasks.find(item => item.id === id);

    if (!task || !confirm(`Delete "${task.title}"?`)) return;

    tasks = tasks.filter(item => item.id !== id);

    saveTasks();
    renderTasks();
    showToast("Task deleted.");
  }
});

// Search, filters, and sorting.
[
  "task-search",
  "task-filter",
  "priority-filter",
  "category-filter",
  "sort-tasks"
].forEach(id => {
  $(id).addEventListener(
    id === "task-search" ? "input" : "change",
    renderTasks
  );
});

// Select all currently visible tasks.
$("select-all-visible").addEventListener("change", event => {
  const query = $("task-search").value.trim().toLowerCase();
  const statusFilter = $("task-filter").value;
  const priorityFilter = $("priority-filter").value;
  const categoryFilter = $("category-filter").value;

  tasks = tasks.map(task => {
    const searchMatch =
      `${task.title} ${task.description || ""} ${task.category || ""}`
        .toLowerCase()
        .includes(query);

    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "pending" && !task.done) ||
      (statusFilter === "completed" && task.done) ||
      (statusFilter === "overdue" && isOverdue(task));

    const priorityMatch =
      priorityFilter === "all" || task.priority === priorityFilter;

    const categoryMatch =
      categoryFilter === "all" ||
      (task.category || "Other") === categoryFilter;

    const matches =
      searchMatch && statusMatch && priorityMatch && categoryMatch;

    return matches
      ? { ...task, selected: event.target.checked }
      : task;
  });

  saveTasks();
  renderTasks();
});

// Complete selected tasks.
$("complete-selected").addEventListener("click", () => {
  const count = tasks.filter(task => task.selected).length;

  if (!count) {
    return showToast("Select at least one task first.");
  }

  tasks = tasks.map(task =>
    task.selected
      ? { ...task, done: true, selected: false }
      : task
  );

  saveTasks();
  renderTasks();
  showToast(`${count} task(s) completed.`);
});

// Delete selected tasks.
$("delete-selected").addEventListener("click", () => {
  const selected = tasks.filter(task => task.selected);

  if (!selected.length) {
    return showToast("Select at least one task first.");
  }

  if (!confirm(`Delete ${selected.length} selected task(s)?`)) return;

  tasks = tasks.filter(task => !task.selected);

  saveTasks();
  renderTasks();
  showToast("Selected tasks deleted.");
});

// Remove all completed tasks.
$("clear-completed").addEventListener("click", () => {
  const count = tasks.filter(task => task.done).length;

  if (!count) {
    return showToast("There are no completed tasks to clear.");
  }

  if (!confirm(`Remove all ${count} completed task(s)?`)) return;

  tasks = tasks.filter(task => !task.done);

  saveTasks();
  renderTasks();
  showToast("Completed tasks cleared.");
});

// Download a file to the user's computer.
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Export tasks to JSON backup.
$("export-json").addEventListener("click", () => {
  downloadFile(
    "taskflow-backup.json",
    JSON.stringify(tasks, null, 2),
    "application/json"
  );

  showToast("JSON backup downloaded.");
});

// Export tasks to CSV.
$("export-csv").addEventListener("click", () => {
  const headers = [
    "Title",
    "Description",
    "Category",
    "Priority",
    "Due date",
    "Reminder",
    "Completed"
  ];

  const rows = tasks.map(task => [
    task.title,
    task.description,
    task.category,
    task.priority,
    task.due,
    task.reminder,
    task.done ? "Yes" : "No"
  ]);

  const cell = value =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [headers, ...rows]
    .map(row => row.map(cell).join(","))
    .join("\r\n");

  downloadFile(
    "taskflow-tasks.csv",
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );

  showToast("CSV exported.");
});

// Import tasks from a JSON backup.
$("import-json").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());

    if (
      !Array.isArray(parsed) ||
      !parsed.every(task => task && typeof task.title === "string")
    ) {
      throw new Error("Invalid task backup format.");
    }

    if (
      !confirm(
        `Import ${parsed.length} tasks? This replaces the current TaskFlow list.`
      )
    ) {
      event.target.value = "";
      return;
    }

    tasks = parsed.map((task, index) => ({
      id: Number(task.id) || Date.now() + index,
      title: task.title,
      description: String(task.description || ""),
      category: [
        "Personal", "Study", "Work", "Health", "Shopping", "Other"
      ].includes(task.category) ? task.category : "Other",
      priority: ["Low", "Medium", "High"].includes(task.priority)
        ? task.priority
        : "Medium",
      due: /^\d{4}-\d{2}-\d{2}$/.test(task.due || "")
        ? task.due
        : "",
      reminder: String(task.reminder || ""),
      done: Boolean(task.done),
      createdAt: Number(task.createdAt) || Date.now() + index
    }));

    saveTasks();
    renderTasks();
    showToast("Backup imported.");
  } catch (error) {
    showToast(error.message || "Could not import that file.");
  } finally {
    event.target.value = "";
  }
});

// Toggle and remember dark mode.
$("theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const dark = document.body.classList.contains("dark");

  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  $("theme-toggle").textContent = dark ? "☀" : "☾";
});

if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
  $("theme-toggle").textContent = "☀";
}

// Set the date and current year in the interface.
$("welcome-date").textContent = new Date().toLocaleDateString(
  undefined,
  { weekday: "long", month: "long", day: "numeric" }
);

$("year").textContent = new Date().getFullYear();

// Initial display.
renderTasks();
