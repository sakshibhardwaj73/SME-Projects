"use strict";

/*
  EmployeeHub
  - Works immediately with browser localStorage.
  - Optional Supabase support: set SUPABASE_URL and SUPABASE_ANON_KEY below,
    create the SQL table from README.md, then refresh.
  - Never put a Supabase service_role key in browser code.
*/
const SUPABASE_URL = "";      // Example: https://your-project.supabase.co
const SUPABASE_ANON_KEY = ""; // Supabase project anon/public key

const DEFAULT_DEPARTMENTS = ["IT", "HR", "Finance", "Marketing", "Operations"];
const $ = id => document.getElementById(id);
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
let supabaseClient = null;
if (isSupabaseConfigured) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let departments = [];
let employees = [];
let editingId = null;
let toastTimer = null;

function localRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
function localWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function normalizeEmployee(row) {
  return {
    id: row.id,
    employee_name: row.employee_name ?? row.name ?? "",
    employee_email: row.employee_email ?? row.email ?? "",
    employee_salary: Number(row.employee_salary ?? row.salary ?? 0),
    employee_age: Number(row.employee_age ?? row.age ?? 0),
    department: row.department || "Unassigned",
    joining_date: row.joining_date || "",
    status: row.status || "Active"
  };
}
function nextLocalId() {
  return employees.reduce((max, emp) => Math.max(max, Number(emp.id) || 0), 0) + 1;
}
function formatSalary(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.page === pageId));
  const titles = { dashboard: "Dashboard overview", employees: "Employee directory", departments: "Departments" };
  $("page-heading").textContent = titles[pageId] || "EmployeeHub";
  if (pageId === "dashboard") renderDashboard();
  if (pageId === "employees") renderEmployees();
  if (pageId === "departments") renderDepartments();
}
document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.go)));
$("quick-add").addEventListener("click", () => openEmployeeForm());
$("add-btn").addEventListener("click", () => openEmployeeForm());
$("close-form").addEventListener("click", closeEmployeeForm);
$("cancel-btn").addEventListener("click", closeEmployeeForm);

function renderDepartmentOptions() {
  const filter = $("department-filter");
  const select = $("emp-department");
  const oldFilter = filter.value || "All";
  const oldDepartment = select.value;
  filter.replaceChildren();
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = "All"; all.textContent = "All departments"; filter.appendChild(all);
  const placeholder = document.createElement("option");
  placeholder.value = ""; placeholder.textContent = "Select department"; select.appendChild(placeholder);
  departments.forEach(department => {
    const a = document.createElement("option"); a.value = department; a.textContent = department; filter.appendChild(a);
    const b = document.createElement("option"); b.value = department; b.textContent = department; select.appendChild(b);
  });
  filter.value = departments.includes(oldFilter) ? oldFilter : "All";
  select.value = departments.includes(oldDepartment) ? oldDepartment : "";
}
function emptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}" class="empty-state">${escapeText(message)}</td></tr>`;
}
function statusPill(status) {
  const key = status.toLowerCase().replace(/\s+/g, "-");
  return `<span class="status-pill status-${key}">${escapeText(status)}</span>`;
}
function personCell(emp) {
  return `<div class="person-cell"><span class="avatar">${escapeText(initials(emp.employee_name))}</span><div><div class="person-name">${escapeText(emp.employee_name)}</div><div class="person-email">${escapeText(emp.employee_email)}</div></div></div>`;
}
function renderDashboard() {
  $("total").textContent = employees.length;
  $("department-total").textContent = departments.length;
  $("active-total").textContent = employees.filter(emp => emp.status === "Active").length;
  const recent = [...employees].sort((a, b) => String(b.joining_date || "").localeCompare(String(a.joining_date || ""))).slice(0, 5);
  $("recent-list").innerHTML = recent.length ? recent.map(emp =>
    `<tr><td>${personCell(emp)}</td><td>${escapeText(emp.department)}</td><td>${escapeText(formatDate(emp.joining_date))}</td><td>${statusPill(emp.status)}</td></tr>`
  ).join("") : emptyRow(4, "No employees yet. Add your first employee to get started.");
  $("dashboard-departments").innerHTML = departments.length ? departments.slice(0, 6).map(dept => {
    const count = employees.filter(emp => emp.department === dept).length;
    return `<div class="mini-dept"><strong>${escapeText(dept)}</strong><span>${count} ${count === 1 ? "employee" : "employees"}</span></div>`;
  }).join("") : `<p class="empty-state">No departments added yet.</p>`;
}
function renderEmployees() {
  const query = $("search").value.trim().toLowerCase();
  const selectedDepartment = $("department-filter").value || "All";
  const selectedStatus = $("status-filter").value || "All";
  const filtered = employees.filter(emp => {
    const matchesSearch = [emp.employee_name, emp.employee_email, emp.id].some(value => String(value ?? "").toLowerCase().includes(query));
    return matchesSearch && (selectedDepartment === "All" || emp.department === selectedDepartment) && (selectedStatus === "All" || emp.status === selectedStatus);
  });
  $("employee-list").innerHTML = filtered.length ? filtered.map(emp => `
    <tr>
      <td><span class="id-pill">EMP-${String(emp.id).padStart(3, "0")}</span></td>
      <td>${personCell(emp)}</td>
      <td>${escapeText(emp.department)}</td>
      <td>₹${escapeText(formatSalary(emp.employee_salary))}</td>
      <td>${escapeText(emp.employee_age)}</td>
      <td>${escapeText(formatDate(emp.joining_date))}</td>
      <td>${statusPill(emp.status)}</td>
      <td><div class="action-buttons"><button type="button" class="edit-btn" data-edit="${escapeText(emp.id)}">Edit</button><button type="button" class="delete-btn" data-delete="${escapeText(emp.id)}">Delete</button></div></td>
    </tr>`).join("") : emptyRow(8, query || selectedDepartment !== "All" || selectedStatus !== "All" ? "No matching employees found." : "No employees yet. Use “Add employee” to create a record.");
  $("employee-count").textContent = `${filtered.length} of ${employees.length} ${employees.length === 1 ? "employee" : "employees"}`;
}
function renderDepartments() {
  $("department-list").innerHTML = departments.length ? departments.map((department, index) => {
    const count = employees.filter(emp => emp.department === department).length;
    return `<article class="department-card">
      <div class="department-card-top"><span class="department-symbol">${["▤", "✦", "◈", "⌘"][index % 4]}</span><span class="department-count">${count} ${count === 1 ? "employee" : "employees"}</span></div>
      <h3>${escapeText(department)}</h3><p>Department team</p>
      <button class="delete-btn" type="button" data-delete-department="${escapeText(department)}">Delete department</button>
    </article>`;
  }).join("") : `<div class="panel empty-state">No departments yet. Add one above.</div>`;
}
function renderAll() {
  renderDepartmentOptions();
  renderDashboard();
  renderEmployees();
  renderDepartments();
}
function openEmployeeForm(emp = null) {
  editingId = emp ? emp.id : null;
  $("employee-form").reset();
  renderDepartmentOptions();
  $("form-title").textContent = emp ? "Edit employee" : "Add new employee";
  $("save-employee").textContent = emp ? "Update employee" : "Save employee";
  $("emp-id").value = emp ? emp.id : "";
  if (emp) {
    $("emp-name").value = emp.employee_name;
    $("emp-email").value = emp.employee_email;
    $("emp-salary").value = emp.employee_salary;
    $("emp-age").value = emp.employee_age;
    $("emp-department").value = emp.department;
    $("emp-joining").value = emp.joining_date || "";
    $("emp-status").value = emp.status || "Active";
  } else {
    $("emp-status").value = "Active";
    $("emp-joining").value = new Date().toISOString().slice(0, 10);
  }
  $("employee-form").hidden = false;
  $("employee-form").scrollIntoView({ behavior: "smooth", block: "start" });
  $("emp-name").focus({ preventScroll: true });
}
function closeEmployeeForm() {
  $("employee-form").hidden = true;
  $("employee-form").reset();
  editingId = null;
}
async function loadData() {
  if (supabaseClient) {
    $("storage-status").textContent = "Connecting to Supabase…";
    const [deptResult, empResult] = await Promise.all([
      supabaseClient.from("departments").select("name").order("name"),
      supabaseClient.from("employees").select("*").order("id")
    ]);
    if (!deptResult.error && !empResult.error) {
      departments = deptResult.data.map(item => item.name);
      employees = empResult.data.map(normalizeEmployee);
      $("storage-status").textContent = "Connected to Supabase";
      document.querySelector(".connection-dot").style.background = "#4ade80";
      renderAll();
      return;
    }
    console.error("Supabase load error:", deptResult.error || empResult.error);
    $("storage-status").textContent = "Database connection error";
    document.querySelector(".connection-dot").style.background = "#f87171";
    showToast("Could not load Supabase data. Check your credentials and table setup.");
    return;
  }
  departments = localRead("departments", DEFAULT_DEPARTMENTS);
  if (!Array.isArray(departments)) departments = [...DEFAULT_DEPARTMENTS];
  const storedEmployees = localRead("employees", null);
  employees = Array.isArray(storedEmployees) ? storedEmployees.map(normalizeEmployee) : [
    { id: 1, employee_name: "Aarav Sharma", employee_email: "aarav@example.com", employee_salary: 50000, employee_age: 25, department: "IT", joining_date: "2025-04-14", status: "Active" },
    { id: 2, employee_name: "Priya Verma", employee_email: "priya@example.com", employee_salary: 45000, employee_age: 24, department: "HR", joining_date: "2025-07-01", status: "Active" },
    { id: 3, employee_name: "Rahul Singh", employee_email: "rahul@example.com", employee_salary: 55000, employee_age: 28, department: "Finance", joining_date: "2024-11-18", status: "On leave" }
  ];
  localWrite("departments", departments);
  localWrite("employees", employees);
  $("storage-status").textContent = "Browser storage mode";
  renderAll();
}
async function persistEmployee(emp, isNew) {
  if (supabaseClient) {
    const payload = {
      employee_name: emp.employee_name, employee_email: emp.employee_email,
      employee_salary: emp.employee_salary, employee_age: emp.employee_age,
      department: emp.department, joining_date: emp.joining_date || null, status: emp.status
    };
    if (isNew) {
      const { data, error } = await supabaseClient.from("employees").insert(payload).select().single();
      if (error) throw error;
      return normalizeEmployee(data);
    }
    const { data, error } = await supabaseClient.from("employees").update(payload).eq("id", emp.id).select().single();
    if (error) throw error;
    return normalizeEmployee(data);
  }
  if (isNew) {
    emp.id = nextLocalId();
    employees.push(emp);
  } else {
    const index = employees.findIndex(item => String(item.id) === String(emp.id));
    if (index < 0) throw new Error("Employee record was not found.");
    employees[index] = emp;
  }
  localWrite("employees", employees);
  return emp;
}
$("employee-form").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("emp-name").value.trim();
  const email = $("emp-email").value.trim();
  const salary = Number($("emp-salary").value);
  const age = Number($("emp-age").value);
  const department = $("emp-department").value;
  const joiningDate = $("emp-joining").value;
  const status = $("emp-status").value;
  if (!name || !email || !department) return showToast("Please complete all required fields.");
  if (!Number.isFinite(salary) || salary < 0 || !Number.isInteger(age) || age < 18 || age > 100) return showToast("Enter a valid salary and age (18–100).");
  const duplicate = employees.some(emp => emp.employee_email.toLowerCase() === email.toLowerCase() && String(emp.id) !== String(editingId));
  if (duplicate) return showToast("This email is already registered.");
  const isNew = editingId === null;
  const record = { id: editingId, employee_name: name, employee_email: email, employee_salary: salary, employee_age: age, department, joining_date: joiningDate, status };
  const saveButton = $("save-employee");
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  try {
    if (supabaseClient) {
      const saved = await persistEmployee(record, isNew);
      if (isNew) employees.push(saved);
      else employees = employees.map(emp => String(emp.id) === String(saved.id) ? saved : emp);
    } else {
      await persistEmployee(record, isNew);
    }
    closeEmployeeForm();
    renderAll();
    showToast(isNew ? "Employee added successfully." : "Employee updated successfully.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save employee.");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId === null ? "Save employee" : "Update employee";
  }
});
$("employee-list").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const emp = employees.find(item => String(item.id) === editButton.dataset.edit);
    if (emp) openEmployeeForm(emp);
  }
  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    const emp = employees.find(item => String(item.id) === id);
    if (!emp || !confirm(`Delete ${emp.employee_name}'s record? This cannot be undone.`)) return;
    try {
      if (supabaseClient) {
        const { error } = await supabaseClient.from("employees").delete().eq("id", id);
        if (error) throw error;
        employees = employees.filter(item => String(item.id) !== id);
      } else {
        employees = employees.filter(item => String(item.id) !== id);
        localWrite("employees", employees);
      }
      renderAll();
      showToast("Employee deleted.");
    } catch (error) {
      console.error(error); showToast(error.message || "Could not delete employee.");
    }
  }
});
$("search").addEventListener("input", renderEmployees);
$("department-filter").addEventListener("change", renderEmployees);
$("status-filter").addEventListener("change", renderEmployees);

$("department-form").addEventListener("submit", async event => {
  event.preventDefault();
  const input = $("new-department");
  const name = input.value.trim();
  if (!name) return;
  if (departments.some(dept => dept.toLowerCase() === name.toLowerCase())) return showToast("That department already exists.");
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from("departments").insert({ name });
      if (error) throw error;
    }
    departments.push(name);
    if (!supabaseClient) localWrite("departments", departments);
    input.value = "";
    renderAll();
    showToast("Department added.");
  } catch (error) {
    console.error(error); showToast(error.message || "Could not add department.");
  }
});
$("department-list").addEventListener("click", async event => {
  const button = event.target.closest("[data-delete-department]");
  if (!button) return;
  const department = button.dataset.deleteDepartment;
  if (employees.some(emp => emp.department === department)) return showToast("Reassign employees before deleting this department.");
  if (!confirm(`Delete the ${department} department?`)) return;
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from("departments").delete().eq("name", department);
      if (error) throw error;
    }
    departments = departments.filter(item => item !== department);
    if (!supabaseClient) localWrite("departments", departments);
    renderAll();
    showToast("Department deleted.");
  } catch (error) {
    console.error(error); showToast(error.message || "Could not delete department.");
  }
});
$("export-btn").addEventListener("click", () => {
  const headers = ["ID", "Name", "Email", "Department", "Salary", "Age", "Joining date", "Status"];
  const rows = employees.map(emp => [emp.id, emp.employee_name, emp.employee_email, emp.department, emp.employee_salary, emp.employee_age, emp.joining_date, emp.status]);
  const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "employeehub-employees.csv"; link.click();
  URL.revokeObjectURL(url);
  showToast("Employee CSV exported.");
});

loadData().catch(error => {
  console.error(error);
  showToast("Unable to load EmployeeHub data.");
});
