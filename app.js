const STORAGE_KEY = "calendar-todos-v1";
const PRIORITY_RANK = { urgent: 0, important: 1, normal: 2 };
const PRIORITY_LABEL = { normal: "일반", important: "중요", urgent: "긴급" };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const monthLabel = document.querySelector("#month-label");
const calendarGrid = document.querySelector("#calendar-grid");
const selectedLabel = document.querySelector("#selected-label");
const remainingLabel = document.querySelector("#remaining");
const todoForm = document.querySelector("#todo-form");
const titleInput = document.querySelector("#todo-title");
const prioritySelect = document.querySelector("#todo-priority");
const fromInput = document.querySelector("#todo-from");
const toInput = document.querySelector("#todo-to");
const timeError = document.querySelector("#time-error");
const nowClock = document.querySelector("#now-clock");
const todoList = document.querySelector("#todo-list");
const emptyState = document.querySelector("#empty-state");

const today = startOfDay(new Date());
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selectedKey = dateKey(today);
let todos = loadTodos();

document.querySelector("#prev-month").addEventListener("click", () => {
  shiftMonth(-1);
});

document.querySelector("#next-month").addEventListener("click", () => {
  shiftMonth(1);
});

document.querySelector("#today-btn").addEventListener("click", () => {
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();
  selectedKey = dateKey(today);
  render();
  titleInput.focus();
});

calendarGrid.addEventListener("click", (event) => {
  const day = event.target.closest(".day");
  if (!day) return;
  const [year, month] = day.dataset.date.split("-").map(Number);
  viewYear = year;
  viewMonth = month - 1;
  selectedKey = day.dataset.date;
  render();
});

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  const time = readTimeRange();
  if (time.error) {
    showTimeError(time.error);
    return;
  }
  const priority = PRIORITY_RANK[prioritySelect.value] != null
    ? prioritySelect.value
    : "normal";
  todos.push({
    id: createId(),
    date: selectedKey,
    title,
    priority,
    from: time.from,
    to: time.to,
    done: false,
    createdAt: Date.now(),
  });
  saveTodos();
  titleInput.value = "";
  prioritySelect.value = "normal";
  fromInput.value = "";
  toInput.value = "";
  showTimeError("");
  syncPrioritySelect();
  render();
  titleInput.focus();
});

fromInput.addEventListener("input", () => showTimeError(""));
toInput.addEventListener("input", () => showTimeError(""));

document.querySelectorAll(".time-range .field").forEach((field) => {
  const input = field.querySelector('input[type="time"]');
  field.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || typeof input.showPicker !== "function") return;
    event.preventDefault();
    try {
      input.showPicker();
    } catch {
      // The picker is already open from this press.
    }
  });
});

renderNow();
setTimeout(function tick() {
  renderNow();
  setTimeout(tick, 1000 - (Date.now() % 1000));
}, 1000 - (Date.now() % 1000));

prioritySelect.addEventListener("change", syncPrioritySelect);

todoList.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".todo-check");
  if (!checkbox) return;
  const todo = findTodo(checkbox.closest(".todo")?.dataset.id);
  if (!todo) return;
  todo.done = checkbox.checked;
  saveTodos();
  render();
});

todoList.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-btn");
  if (!button) return;
  const id = button.closest(".todo")?.dataset.id;
  todos = todos.filter((todo) => todo.id !== id);
  saveTodos();
  render();
});

render();
syncPrioritySelect();

function shiftMonth(delta) {
  const next = new Date(viewYear, viewMonth + delta, 1);
  viewYear = next.getFullYear();
  viewMonth = next.getMonth();
  render();
}

function render() {
  renderCalendar();
  renderTodos();
}

function renderNow() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  nowClock.textContent = `${hours}:${minutes}:${seconds}`;
  nowClock.dateTime = now.toISOString();
}

function renderCalendar() {
  monthLabel.textContent = `${viewYear}년 ${viewMonth + 1}월`;
  calendarGrid.replaceChildren();

  const cells = buildMonthCells(viewYear, viewMonth);
  for (const date of cells) {
    const key = dateKey(date);
    const inMonth = date.getMonth() === viewMonth;
    const dayTodos = todos.filter((todo) => todo.date === key);
    const openTodos = dayTodos.filter((todo) => !todo.done);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    button.dataset.date = key;
    button.setAttribute("aria-pressed", String(key === selectedKey));
    button.setAttribute(
      "aria-label",
      `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일, 할일 ${dayTodos.length}개`
    );

    if (!inMonth) button.classList.add("is-outside");
    if (key === dateKey(today)) button.classList.add("is-today");
    if (key === selectedKey) button.classList.add("is-selected");

    const number = document.createElement("span");
    number.className = "day-num";
    number.textContent = String(date.getDate());
    button.append(number);

    if (dayTodos.length > 0) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");
      if (openTodos.some((todo) => todo.priority === "urgent")) {
        dot.classList.add("is-urgent");
      } else if (openTodos.length > 0) {
        dot.classList.add("is-open");
      }
      button.append(dot);
    }

    calendarGrid.append(button);
  }
}

function renderTodos() {
  const selected = parseDateKey(selectedKey);
  const weekday = WEEKDAYS[selected.getDay()];
  selectedLabel.textContent = `${selected.getFullYear()}년 ${selected.getMonth() + 1}월 ${selected.getDate()}일 ${weekday}요일`;

  const items = todos
    .filter((todo) => todo.date === selectedKey)
    .sort(compareTodos);

  const openCount = items.filter((todo) => !todo.done).length;
  if (items.length === 0) {
    remainingLabel.textContent = "";
  } else if (openCount === 0) {
    remainingLabel.textContent = "모두 완료";
  } else {
    remainingLabel.textContent = `남은 할일 ${openCount}`;
  }

  emptyState.hidden = items.length > 0;
  todoList.replaceChildren();

  for (const todo of items) {
    const item = document.createElement("li");
    item.className = `todo priority-${todo.priority}`;
    item.dataset.id = todo.id;
    if (todo.done) item.classList.add("is-done");

    const label = document.createElement("label");
    label.className = "todo-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-check";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", `${todo.title} 완료`);

    const body = document.createElement("span");
    body.className = "todo-body";

    const title = document.createElement("span");
    title.className = "todo-title";
    title.textContent = todo.title;

    const meta = document.createElement("span");
    meta.className = "todo-meta";
    const priorityLabel = PRIORITY_LABEL[todo.priority] || PRIORITY_LABEL.normal;
    const range = formatTimeRange(todo);
    meta.textContent = range ? `${range} · ${priorityLabel}` : priorityLabel;

    body.append(title, meta);
    label.append(checkbox, body);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-btn";
    remove.textContent = "삭제";
    remove.setAttribute("aria-label", `${todo.title} 삭제`);

    item.append(label, remove);
    todoList.append(item);
  }
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    cells.push(date);
  }

  while (cells.length > 28 && cells[cells.length - 7].getMonth() !== month) {
    cells.splice(cells.length - 7, 7);
  }

  return cells;
}

function compareTodos(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const rank = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
  if (rank !== 0) return rank;
  return a.createdAt - b.createdAt;
}

function syncPrioritySelect() {
  prioritySelect.classList.toggle("is-urgent", prioritySelect.value === "urgent");
}

function readTimeRange() {
  const from = fromInput.value;
  const to = toInput.value;
  if (!from && !to) return { from: "", to: "" };
  if (!from || !to) return { error: "FROM과 TO를 모두 입력하세요." };
  if (to < from) return { error: "TO는 FROM보다 이후여야 합니다." };
  return { from, to };
}

function showTimeError(message) {
  timeError.hidden = !message;
  timeError.textContent = message;
}

function formatTimeRange(todo) {
  if (!todo.from || !todo.to) return "";
  return `${todo.from}–${todo.to}`;
}

function normalizeTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";
}

function loadTodos() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(isValidTodo).map((todo) => {
      const from = normalizeTime(todo.from);
      const to = normalizeTime(todo.to);
      const hasRange = Boolean(from && to && to >= from);
      return {
        id: String(todo.id),
        date: todo.date,
        title: todo.title,
        priority: PRIORITY_RANK[todo.priority] != null ? todo.priority : "normal",
        from: hasRange ? from : "",
        to: hasRange ? to : "",
        done: Boolean(todo.done),
        createdAt: Number(todo.createdAt) || 0,
      };
    });
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function isValidTodo(todo) {
  return Boolean(
    todo &&
      todo.id &&
      typeof todo.title === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(todo.date)
  );
}

function findTodo(id) {
  return todos.find((todo) => todo.id === id);
}

function createId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
