import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ================= 1. FIREBASE SETUP ================= */

const firebaseConfig = {
  apiKey: "AIzaSyDRGAladhnaytWa1aMQVTnv4_XDgINCVU4",
  authDomain: "campusos-f9d06.firebaseapp.com",
  projectId: "campusos-f9d06",
  storageBucket: "campusos-f9d06.firebasestorage.app",
  messagingSenderId: "177105854302",
  appId: "1:177105854302:web:042f30862d215bec1539cf",
  measurementId: "G-64MR49EF66"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/* ================= 2. DOM HELPERS & TOAST ================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const toast = $("#toast");
let toastTimer = null;

function notify(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/* ================= 3. STATE MANAGEMENT ================= */

let tasks = [];
let events = [];
let notices = [];
let lostItems = [];

// Real-time listener unsubscribers (Security: only active when authenticated)
let unsubscribeTasks = null;
let unsubscribeEvents = null;
let unsubscribeNotices = null;
let unsubscribeLostItems = null;

// Filter states
let taskFilter = "all";
let taskSearch = "";

let eventFilter = "all";
let eventSearch = "";

let noticeFilter = "all";
let noticeSearch = "";

let lostFilter = "all";
let lostSearch = "";

/* ================= 4. AUTHENTICATION & ACCOUNT ================= */

const authScreen = $("#auth-screen");
const authForm = $("#auth-form");
const authTitle = $("#auth-title");
const authDescription = $("#auth-description");
const authName = $("#auth-name");
const nameField = $("#name-field");
const authEmail = $("#auth-email");
const authPassword = $("#auth-password");
const authError = $("#auth-error");
const authSubmit = $("#auth-submit");
const authToggle = $("#auth-toggle");
const authSwitchText = $("#auth-switch-text");

let isRegistering = false;

authToggle.addEventListener("click", () => {
  isRegistering = !isRegistering;

  nameField.hidden = !isRegistering;
  authName.required = isRegistering;
  authPassword.autocomplete = isRegistering ? "new-password" : "current-password";

  authTitle.textContent = isRegistering ? "Create your account" : "Welcome back!";
  authDescription.textContent = isRegistering
    ? "Join your college campus community and stay organized."
    : "Sign in to access your dashboard, study planner, and campus hub.";

  authSubmit.querySelector("span").textContent = isRegistering ? "Create Account" : "Sign In";
  authSwitchText.textContent = isRegistering ? "Already have an account?" : "New to CampusOS?";
  authToggle.textContent = isRegistering ? "Sign in" : "Create an account";
  authError.textContent = "";
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";

  const submitText = authSubmit.querySelector("span");
  authSubmit.disabled = true;
  submitText.textContent = "Please wait...";

  try {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (isRegistering) {
      const name = authName.value.trim();
      if (!name) throw new Error("Please enter your full name.");

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });

      notify(`Welcome to CampusOS, ${name}!`);
      authForm.reset();
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      notify("Welcome back! Signed in successfully.");
      authForm.reset();
    }
  } catch (error) {
    console.error("Auth error:", error);
    const messages = {
      "auth/email-already-in-use": "This email already has an account. Please sign in.",
      "auth/invalid-email": "Please enter a valid college email address.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/invalid-credential": "Email or password is incorrect. Please try again.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/network-request-failed": "Network error. Check your internet connection.",
      "auth/too-many-requests": "Too many attempts. Please try again later."
    };
    authError.textContent = messages[error.code] || error.message || "Authentication failed.";
  } finally {
    authSubmit.disabled = false;
    submitText.textContent = isRegistering ? "Create Account" : "Sign In";
  }
});

/* Settings dropdown menu & Logout */
const settingsButton = $("#settings-button");
const settingsMenu = $("#settings-menu");
const topAvatar = $("#top-avatar");
const logoutButton = $("#logout-button");

function toggleSettingsMenu(event) {
  event.stopPropagation();
  settingsMenu.hidden = !settingsMenu.hidden;
}

if (settingsButton) settingsButton.addEventListener("click", toggleSettingsMenu);
if (topAvatar) topAvatar.addEventListener("click", toggleSettingsMenu);

document.addEventListener("click", (event) => {
  if (settingsMenu && !settingsMenu.hidden) {
    if (!settingsMenu.contains(event.target) &&
        !settingsButton.contains(event.target) &&
        !(topAvatar && topAvatar.contains(event.target))) {
      settingsMenu.hidden = true;
    }
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await signOut(auth);
    settingsMenu.hidden = true;
    notify("Signed out successfully!");
  } catch (error) {
    console.error("Sign out error:", error);
    notify("Could not sign out. Please try again.");
  } finally {
    logoutButton.disabled = false;
  }
});

/* ================= 5. DYNAMIC GREETING & DATE ================= */

function updateGreeting(userName = "Student") {
  const greetingEl = $("#greeting");
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let timeOfDay = "Good morning";
  if (hour >= 12 && hour < 17) timeOfDay = "Good afternoon";
  else if (hour >= 17) timeOfDay = "Good evening";

  greetingEl.textContent = `${timeOfDay}, ${userName}!`;
}

function updateDateBadge() {
  const todayEl = $("#today");
  if (!todayEl) return;
  const now = new Date();
  todayEl.textContent = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

updateDateBadge();
updateGreeting("Student");

/* ================= 6. NAVIGATION SYSTEM ================= */

const pageTitles = {
  dashboard: "Student Dashboard",
  tasks: "Study Planner",
  events: "Campus Events",
  notices: "Notice Board",
  lost: "Lost & Found"
};

const pageViews = {
  dashboard: $("#page-dashboard"),
  tasks: $("#page-tasks"),
  events: $("#page-events"),
  notices: $("#page-notices"),
  lost: $("#page-lost")
};

function switchPage(targetPage) {
  if (!pageViews[targetPage]) targetPage = "dashboard";

  // Hide all page views
  Object.keys(pageViews).forEach((pageKey) => {
    if (pageViews[pageKey]) {
      pageViews[pageKey].hidden = (pageKey !== targetPage);
    }
  });

  // Update active navigation item
  $$("#navigation .nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === targetPage);
  });

  // Update page title
  const pageTitleEl = $("#page-title");
  if (pageTitleEl) {
    pageTitleEl.textContent = pageTitles[targetPage] || "CampusOS";
  }

  // Scroll main container to top
  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

$("#navigation").addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (button) {
    switchPage(button.dataset.page);
  }
});

// Brand click returns to dashboard
const brandLink = $(".brand");
if (brandLink) {
  brandLink.addEventListener("click", (e) => {
    e.preventDefault();
    switchPage("dashboard");
  });
}

// Global data-navigate handlers (e.g. from stat cards, preview banners)
document.addEventListener("click", (event) => {
  const navTrigger = event.target.closest("[data-navigate]");
  if (navTrigger) {
    const target = navTrigger.dataset.navigate;
    switchPage(target);
  }
});

// Top bar shortcuts
const notifShortcut = $("#notif-shortcut-button");
if (notifShortcut) {
  notifShortcut.addEventListener("click", () => switchPage("notices"));
}

const planButton = $("#plan-button");
if (planButton) {
  planButton.addEventListener("click", () => {
    switchPage("tasks");
    openPlannerForm();
  });
}

const quickEventsBtn = $("#quick-events-btn");
if (quickEventsBtn) {
  quickEventsBtn.addEventListener("click", () => switchPage("events"));
}

/* ================= 7. STUDY PLANNER (TASKS) ================= */

const taskList = $("#task-list");
const dashboardTaskList = $("#dashboard-task-list");

const taskForm = $("#task-form");
const taskInput = $("#task-input");
const plannerFormContainer = $("#planner-form-container");
const openPlannerFormBtn = $("#open-planner-form-btn");
const closePlannerFormBtn = $("#close-planner-form-btn");

const dashboardTaskForm = $("#dashboard-task-form");
const dashboardTaskInput = $("#dashboard-task-input");
const addTaskShortcut = $("#add-task-shortcut");
const cancelDashTaskBtn = $("#cancel-dash-task-btn");

function openPlannerForm() {
  if (plannerFormContainer) {
    plannerFormContainer.hidden = false;
    taskInput.focus();
  }
}

function closePlannerForm() {
  if (plannerFormContainer) plannerFormContainer.hidden = true;
}

if (openPlannerFormBtn) openPlannerFormBtn.addEventListener("click", openPlannerForm);
if (closePlannerFormBtn) closePlannerFormBtn.addEventListener("click", closePlannerForm);

if (addTaskShortcut) {
  addTaskShortcut.addEventListener("click", () => {
    dashboardTaskForm.hidden = false;
    dashboardTaskInput.focus();
  });
}

if (cancelDashTaskBtn) {
  cancelDashTaskBtn.addEventListener("click", () => {
    dashboardTaskForm.hidden = true;
    dashboardTaskInput.value = "";
  });
}

// Add task submit handlers
async function handleCreateTask(title) {
  const user = auth.currentUser;
  if (!user) {
    notify("Please sign in to add tasks.");
    return false;
  }

  try {
    await addDoc(collection(db, "users", user.uid, "tasks"), {
      title: title.trim(),
      done: false,
      createdAt: serverTimestamp()
    });
    notify("Task added successfully!");
    return true;
  } catch (error) {
    console.error("Task add error:", error);
    notify("Could not save task. Please try again.");
    return false;
  }
}

if (taskForm) {
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = taskInput.value.trim();
    if (!val) return;
    const ok = await handleCreateTask(val);
    if (ok) {
      taskInput.value = "";
      closePlannerForm();
    }
  });
}

if (dashboardTaskForm) {
  dashboardTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = dashboardTaskInput.value.trim();
    if (!val) return;
    const ok = await handleCreateTask(val);
    if (ok) {
      dashboardTaskInput.value = "";
      dashboardTaskForm.hidden = true;
    }
  });
}

// Render Tasks across Dashboard and Dedicated Planner Page
function renderTasks() {
  const completed = tasks.filter((t) => t.done).length;
  const pending = tasks.length - completed;
  const progressPercent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  // Live Counts on Dashboard
  const pendingCountEl = $("#pending-count");
  const completedCountEl = $("#completed-count");
  const progressTextEl = $("#progress-text");
  const progressBarEl = $("#progress-bar");
  const navTasksBadge = $("#nav-tasks-badge");

  if (pendingCountEl) pendingCountEl.textContent = pending;
  if (completedCountEl) completedCountEl.textContent = completed;
  if (progressTextEl) progressTextEl.textContent = `${progressPercent}%`;
  if (progressBarEl) progressBarEl.style.width = `${progressPercent}%`;
  if (navTasksBadge) navTasksBadge.textContent = pending;

  // Dedicated Planner Page Stats
  const plannerPercentageEl = $("#planner-percentage-display");
  const plannerSummaryEl = $("#planner-status-summary");
  const plannerProgressBarEl = $("#planner-progress-bar");
  const plannerPendingBadge = $("#planner-pending-badge");
  const plannerCompletedBadge = $("#planner-completed-badge");

  if (plannerPercentageEl) plannerPercentageEl.textContent = `${progressPercent}%`;
  if (plannerSummaryEl) plannerSummaryEl.textContent = `${completed} of ${tasks.length} tasks completed`;
  if (plannerProgressBarEl) plannerProgressBarEl.style.width = `${progressPercent}%`;
  if (plannerPendingBadge) plannerPendingBadge.textContent = pending;
  if (plannerCompletedBadge) plannerCompletedBadge.textContent = completed;

  // 1. Render Dashboard Preview List (top 4 tasks)
  if (dashboardTaskList) {
    dashboardTaskList.replaceChildren();
    if (tasks.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No tasks yet. Click '+ Add task' to set your study goals!";
      dashboardTaskList.append(p);
    } else {
      tasks.slice(0, 4).forEach((task) => {
        dashboardTaskList.append(createTaskRow(task));
      });
    }
  }

  // 2. Render Dedicated Planner List (with filters & search)
  if (taskList) {
    taskList.replaceChildren();

    const filtered = tasks.filter((task) => {
      if (taskFilter === "pending" && task.done) return false;
      if (taskFilter === "completed" && !task.done) return false;
      if (taskSearch) {
        return (task.title || "").toLowerCase().includes(taskSearch.toLowerCase());
      }
      return true;
    });

    if (filtered.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = tasks.length === 0
        ? "Your study planner is empty. Add your first goal above!"
        : "No tasks match your current filter or search.";
      taskList.append(p);
    } else {
      filtered.forEach((task) => {
        taskList.append(createTaskRow(task));
      });
    }
  }

  refreshIcons();
}

function createTaskRow(task) {
  const row = document.createElement("div");
  row.className = `task-row${task.done ? " done" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-check";
  checkbox.checked = !!task.done;
  checkbox.setAttribute("aria-label", `Mark "${task.title}" as ${task.done ? "incomplete" : "complete"}`);

  checkbox.addEventListener("change", async () => {
    const user = auth.currentUser;
    if (!user) return;
    checkbox.disabled = true;
    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id), {
        done: checkbox.checked
      });
    } catch (err) {
      console.error("Task toggle error:", err);
      notify("Failed to update task.");
      checkbox.checked = !checkbox.checked;
    } finally {
      checkbox.disabled = false;
    }
  });

  const copy = document.createElement("div");
  copy.className = "task-copy";

  const title = document.createElement("strong");
  title.textContent = task.title || "Untitled Goal";

  const sub = document.createElement("small");
  sub.textContent = task.done ? "Completed ✓" : "Active study goal";

  copy.append(title, sub);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-task";
  deleteBtn.type = "button";
  deleteBtn.innerHTML = "&times;";
  deleteBtn.setAttribute("aria-label", `Delete task ${task.title}`);

  deleteBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;
    deleteBtn.disabled = true;
    try {
      await deleteDoc(doc(db, "users", user.uid, "tasks", task.id));
      notify("Task removed.");
    } catch (err) {
      console.error("Delete task error:", err);
      notify("Could not delete task.");
      deleteBtn.disabled = false;
    }
  });

  row.append(checkbox, copy, deleteBtn);
  return row;
}

// Task filter tabs
const taskFilterTabs = $("#task-filter-tabs");
if (taskFilterTabs) {
  taskFilterTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    taskFilterTabs.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    taskFilter = btn.dataset.filter || "all";
    renderTasks();
  });
}

// Task search input
const taskSearchInput = $("#task-search-input");
if (taskSearchInput) {
  taskSearchInput.addEventListener("input", (e) => {
    taskSearch = e.target.value.trim();
    renderTasks();
  });
}

// Global search button in topbar opens Study Planner search
const searchButton = $("#search-button");
if (searchButton) {
  searchButton.addEventListener("click", () => {
    switchPage("tasks");
    if (taskSearchInput) {
      taskSearchInput.focus();
    }
  });
}

/* ================= 8. CAMPUS EVENTS ================= */

const dashboardEventGrid = $("#dashboard-event-grid");
const eventGrid = $("#event-grid");
const eventsCountEl = $("#events-count");
const navEventsBadge = $("#nav-events-badge");

function renderEventsView() {
  if (eventsCountEl) eventsCountEl.textContent = events.length;
  if (navEventsBadge) navEventsBadge.textContent = events.length;

  // 1. Dashboard Events Preview (First 3)
  if (dashboardEventGrid) {
    dashboardEventGrid.replaceChildren();
    if (events.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No campus events scheduled right now. Check back soon!";
      dashboardEventGrid.append(p);
    } else {
      events.slice(0, 3).forEach((ev) => {
        dashboardEventGrid.append(createEventCard(ev));
      });
    }
  }

  // 2. Dedicated Events Page
  if (eventGrid) {
    eventGrid.replaceChildren();

    const filtered = events.filter((ev) => {
      if (eventFilter !== "all") {
        const cat = (ev.category || "").toLowerCase();
        if (!cat.includes(eventFilter.toLowerCase())) return false;
      }
      if (eventSearch) {
        const q = eventSearch.toLowerCase();
        const matchesTitle = (ev.title || "").toLowerCase().includes(q);
        const matchesDesc = (ev.description || "").toLowerCase().includes(q);
        const matchesLocation = (ev.location || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLocation) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = events.length === 0
        ? "No campus events found in Firestore."
        : "No events match your search or filter.";
      eventGrid.append(p);
    } else {
      filtered.forEach((ev) => {
        eventGrid.append(createEventCard(ev));
      });
    }
  }

  refreshIcons();
}

function createEventCard(ev) {
  const card = document.createElement("article");
  card.className = "event-card";

  const header = document.createElement("div");
  header.className = "event-card-header";

  const tag = document.createElement("span");
  const cat = (ev.category || "Campus").toUpperCase();
  tag.className = `event-tag tag-${getCategoryColorClass(cat)}`;
  tag.textContent = cat;

  const iconDiv = document.createElement("div");
  iconDiv.className = "event-icon-watermark";
  iconDiv.innerHTML = '<i data-lucide="calendar"></i>';

  header.append(tag, iconDiv);

  const title = document.createElement("h3");
  title.textContent = ev.title || "Campus Gathering";

  const desc = document.createElement("p");
  desc.textContent = ev.description || "Exciting college activity happening on campus.";

  const footer = document.createElement("div");
  footer.className = "event-card-footer";

  const dateSpan = document.createElement("span");
  dateSpan.innerHTML = `<i data-lucide="clock"></i> ${ev.date || "Upcoming"}`;

  footer.append(dateSpan);

  if (ev.location) {
    const locSpan = document.createElement("span");
    locSpan.innerHTML = `<i data-lucide="map-pin"></i> ${ev.location}`;
    footer.append(locSpan);
  }

  card.append(header, title, desc, footer);
  return card;
}

function getCategoryColorClass(cat) {
  const c = cat.toLowerCase();
  if (c.includes("tech") || c.includes("hack")) return "purple";
  if (c.includes("cult") || c.includes("fest")) return "orange";
  if (c.includes("sport") || c.includes("fit")) return "emerald";
  return "cyan";
}

// Event filters
const eventFilterTabs = $("#event-filter-tabs");
if (eventFilterTabs) {
  eventFilterTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    eventFilterTabs.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    eventFilter = btn.dataset.eventFilter || "all";
    renderEventsView();
  });
}

const eventSearchInput = $("#event-search-input");
if (eventSearchInput) {
  eventSearchInput.addEventListener("input", (e) => {
    eventSearch = e.target.value.trim();
    renderEventsView();
  });
}

/* ================= 9. NOTICE BOARD ================= */

const dashboardNoticeList = $("#dashboard-notice-list");
const noticePageList = $("#notice-page-list");
const noticesCountEl = $("#notices-count");
const navNoticesBadge = $("#nav-notices-badge");

function renderNoticesView() {
  if (noticesCountEl) noticesCountEl.textContent = notices.length;
  if (navNoticesBadge) navNoticesBadge.textContent = notices.length;

  // 1. Dashboard Preview (Top 3)
  if (dashboardNoticeList) {
    dashboardNoticeList.replaceChildren();
    if (notices.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No campus announcements right now.";
      dashboardNoticeList.append(p);
    } else {
      notices.slice(0, 3).forEach((n, idx) => {
        const item = document.createElement("div");
        item.className = "notice-item";

        const dot = document.createElement("span");
        dot.className = `notice-dot ${idx % 3 === 0 ? "purple" : idx % 3 === 1 ? "cyan" : "orange"}`;

        const content = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = n.title || "Announcement";

        const desc = document.createElement("p");
        desc.textContent = n.description || "";

        const category = document.createElement("small");
        category.textContent = `${n.category || "Official circular"}${n.date ? ` • ${n.date}` : ""}`;

        content.append(title, desc, category);
        item.append(dot, content);
        dashboardNoticeList.append(item);
      });
    }
  }

  // 2. Dedicated Notice Board Page
  if (noticePageList) {
    noticePageList.replaceChildren();

    const filtered = notices.filter((n) => {
      if (noticeFilter !== "all") {
        const cat = (n.category || "").toLowerCase();
        if (!cat.includes(noticeFilter.toLowerCase())) return false;
      }
      if (noticeSearch) {
        const q = noticeSearch.toLowerCase();
        const matchesTitle = (n.title || "").toLowerCase().includes(q);
        const matchesDesc = (n.description || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = notices.length === 0
        ? "No notices currently published."
        : "No announcements match your search or filter.";
      noticePageList.append(p);
    } else {
      filtered.forEach((n) => {
        const card = document.createElement("article");
        card.className = "notice-card";

        const header = document.createElement("div");
        header.className = "notice-card-header";

        const meta = document.createElement("div");
        meta.className = "notice-meta";

        const tag = document.createElement("span");
        const cat = n.category || "Official Notice";
        tag.className = `event-tag tag-${getCategoryColorClass(cat)}`;
        tag.textContent = cat;

        meta.append(tag);

        if (n.date) {
          const date = document.createElement("span");
          date.className = "notice-date";
          date.textContent = n.date;
          header.append(meta, date);
        } else {
          header.append(meta);
        }

        const title = document.createElement("h3");
        title.textContent = n.title || "Notice";

        const desc = document.createElement("p");
        desc.textContent = n.description || "";

        card.append(header, title, desc);
        noticePageList.append(card);
      });
    }
  }

  refreshIcons();
}

// Notice filters
const noticeFilterTabs = $("#notice-filter-tabs");
if (noticeFilterTabs) {
  noticeFilterTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    noticeFilterTabs.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    noticeFilter = btn.dataset.noticeFilter || "all";
    renderNoticesView();
  });
}

const noticeSearchInput = $("#notice-search-input");
if (noticeSearchInput) {
  noticeSearchInput.addEventListener("input", (e) => {
    noticeSearch = e.target.value.trim();
    renderNoticesView();
  });
}

/* ================= 10. LOST & FOUND ================= */

const lostFormPanel = $("#lost-form-panel");
const openLostFormBtn = $("#open-lost-form-btn");
const closeLostFormBtn = $("#close-lost-form-btn");
const cancelLostFormBtn = $("#cancel-lost-form-btn");
const lostForm = $("#lost-form");
const lostList = $("#lost-list");
const lostSubmitBtn = $("#lost-submit-btn");

function openLostForm() {
  if (lostFormPanel) {
    lostFormPanel.hidden = false;
    $("#item-title").focus();
  }
}

function closeLostForm() {
  if (lostFormPanel) lostFormPanel.hidden = true;
}

if (openLostFormBtn) openLostFormBtn.addEventListener("click", openLostForm);
if (closeLostFormBtn) closeLostFormBtn.addEventListener("click", closeLostForm);
if (cancelLostFormBtn) cancelLostFormBtn.addEventListener("click", closeLostForm);

// Post Lost/Found Item
if (lostForm) {
  lostForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      notify("Please sign in to post items.");
      return;
    }

    const title = $("#item-title").value.trim();
    const type = $("#item-type").value;
    const location = $("#item-location").value.trim();
    const description = $("#item-description").value.trim();

    if (!title || !location || !description) {
      notify("Please complete all required fields.");
      return;
    }

    if (lostSubmitBtn) {
      lostSubmitBtn.disabled = true;
      lostSubmitBtn.innerHTML = "Posting...";
    }

    try {
      await addDoc(collection(db, "lostItems"), {
        title,
        type,
        location,
        description,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      lostForm.reset();
      closeLostForm();
      notify(`${type} item reported successfully!`);
    } catch (error) {
      console.error("Save lost item error:", error);
      notify("Could not post item. Please verify your connection.");
    } finally {
      if (lostSubmitBtn) {
        lostSubmitBtn.disabled = false;
        lostSubmitBtn.innerHTML = '<i data-lucide="send"></i> Post Item';
        refreshIcons();
      }
    }
  });
}

// Render Lost & Found items
function renderLostView() {
  if (!lostList) return;
  lostList.replaceChildren();

  const filtered = lostItems.filter((item) => {
    if (lostFilter !== "all" && item.type !== lostFilter) {
      return false;
    }
    if (lostSearch) {
      const q = lostSearch.toLowerCase();
      const matchesTitle = (item.title || "").toLowerCase().includes(q);
      const matchesLoc = (item.location || "").toLowerCase().includes(q);
      const matchesDesc = (item.description || "").toLowerCase().includes(q);
      if (!matchesTitle && !matchesLoc && !matchesDesc) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = lostItems.length === 0
      ? "No lost or found items posted yet. Report an item above!"
      : "No items match your filter criteria.";
    lostList.append(empty);
    return;
  }

  const currentUser = auth.currentUser;

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "lost-card";

    // Card Header
    const header = document.createElement("div");
    header.className = "lost-card-header";

    const isLost = (item.type || "").toLowerCase() === "lost";
    const badge = document.createElement("span");
    badge.className = `status-badge ${isLost ? "lost" : "found"}`;
    badge.innerHTML = `<i data-lucide="${isLost ? "alert-circle" : "check-circle"}"></i> ${item.type || "Report"}`;

    header.append(badge);

    // If current authenticated student is the owner of this post
    const isOwner = currentUser && item.userId === currentUser.uid;
    if (isOwner) {
      const ownerChip = document.createElement("span");
      ownerChip.className = "owner-chip";
      ownerChip.textContent = "Your Post";
      header.append(ownerChip);
    }

    // Card Title
    const title = document.createElement("h3");
    title.textContent = item.title || "Untitled item";

    // Location
    const locationBadge = document.createElement("div");
    locationBadge.className = "lost-location-badge";
    locationBadge.innerHTML = `<i data-lucide="map-pin"></i> <span>${item.location || "Location not specified"}</span>`;

    // Description
    const desc = document.createElement("p");
    desc.className = "lost-card-desc";
    desc.textContent = item.description || "No description provided.";

    // Footer with date and delete button (only for owner)
    const footer = document.createElement("div");
    footer.className = "lost-card-footer";

    let dateText = "Recent";
    if (item.createdAt && item.createdAt.toDate) {
      dateText = item.createdAt.toDate().toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric"
      });
    }

    const dateEl = document.createElement("span");
    dateEl.className = "lost-card-date";
    dateEl.textContent = `Posted ${dateText}`;
    footer.append(dateEl);

    if (isOwner) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-item-btn";
      deleteBtn.type = "button";
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i> <span>Delete</span>';

      deleteBtn.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Are you sure you want to permanently delete your post for "${item.title}"?`
        );
        if (!confirmed) return;

        deleteBtn.disabled = true;
        try {
          await deleteDoc(doc(db, "lostItems", item.id));
          notify("Your post has been deleted.");
        } catch (error) {
          console.error("Delete item error:", error);
          notify("Could not delete item. Check permissions.");
          deleteBtn.disabled = false;
        }
      });

      footer.append(deleteBtn);
    }

    card.append(header, title, locationBadge, desc, footer);
    lostList.append(card);
  });

  refreshIcons();
}

// Lost filter tabs
const lostFilterTabs = $("#lost-filter-tabs");
if (lostFilterTabs) {
  lostFilterTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    lostFilterTabs.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    lostFilter = btn.dataset.lostFilter || "all";
    renderLostView();
  });
}

const lostSearchInput = $("#lost-search-input");
if (lostSearchInput) {
  lostSearchInput.addEventListener("input", (e) => {
    lostSearch = e.target.value.trim();
    renderLostView();
  });
}

/* ================= 11. SECURITY & AUTH STATE LISTENER ================= */

// Security: All Firestore real-time listeners for authenticated or private data
// attach ONLY while the user is signed in, and detach immediately on sign out.
onAuthStateChanged(auth, (user) => {
  // Clean up any existing listeners
  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }
  if (unsubscribeEvents) {
    unsubscribeEvents();
    unsubscribeEvents = null;
  }
  if (unsubscribeNotices) {
    unsubscribeNotices();
    unsubscribeNotices = null;
  }
  if (unsubscribeLostItems) {
    unsubscribeLostItems();
    unsubscribeLostItems = null;
  }

  // Toggle Auth Screen visibility
  authScreen.hidden = !!user;

  if (!user) {
    // Clear all state and private cached data on sign out
    tasks = [];
    events = [];
    notices = [];
    lostItems = [];

    renderTasks();
    renderEventsView();
    renderNoticesView();
    renderLostView();

    // Reset profile labels
    $("#profile-name").textContent = "Student";
    $("#settings-name").textContent = "Student";
    $("#settings-email").textContent = "Signed in";
    updateGreeting("Student");
    return;
  }

  // User is signed in: populate profile UI
  const displayName = user.displayName || user.email.split("@")[0] || "Student";
  const initial = displayName.charAt(0).toUpperCase();

  $("#profile-name").textContent = displayName;
  $("#settings-name").textContent = displayName;
  $("#settings-email").textContent = user.email || "";

  updateGreeting(displayName);

  // Set avatars
  $$("#sidebar-avatar, #top-avatar, #menu-avatar").forEach((el) => {
    if (el) el.textContent = initial;
  });

  // 1. Private User Tasks Listener
  unsubscribeTasks = onSnapshot(
    collection(db, "users", user.uid, "tasks"),
    (snapshot) => {
      tasks = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderTasks();
    },
    (error) => {
      console.error("Tasks listener error:", error);
      notify("Could not sync tasks.");
    }
  );

  // 2. Campus Events Listener (Authenticated read)
  unsubscribeEvents = onSnapshot(
    collection(db, "events"),
    (snapshot) => {
      events = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderEventsView();
    },
    (error) => {
      console.error("Events listener error:", error);
    }
  );

  // 3. Notice Board Listener (Authenticated read)
  unsubscribeNotices = onSnapshot(
    collection(db, "notices"),
    (snapshot) => {
      notices = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderNoticesView();
    },
    (error) => {
      console.error("Notices listener error:", error);
    }
  );

  // 4. Lost & Found Listener (Authenticated read, real-time sync)
  unsubscribeLostItems = onSnapshot(
    collection(db, "lostItems"),
    (snapshot) => {
      lostItems = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderLostView();
    },
    (error) => {
      console.error("Lost & Found listener error:", error);
    }
  );
});

// Initial icon rendering
refreshIcons();
