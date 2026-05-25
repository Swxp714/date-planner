const STORAGE_KEY = "date-planner-v1";
const state = {
  plans: [],
  filter: "all",
  editingId: null
};

const els = {
  form: document.querySelector("#planForm"),
  title: document.querySelector("#titleInput"),
  date: document.querySelector("#dateInput"),
  time: document.querySelector("#timeInput"),
  place: document.querySelector("#placeInput"),
  memo: document.querySelector("#memoInput"),
  submit: document.querySelector("#submitBtn"),
  cancelEdit: document.querySelector("#cancelEditBtn"),
  plansList: document.querySelector("#plansList"),
  emptyState: document.querySelector("#emptyState"),
  template: document.querySelector("#planTemplate"),
  filters: document.querySelector(".filters"),
  copyShare: document.querySelector("#copyShareBtn"),
  export: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  toast: document.querySelector("#toast")
};

const formatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  weekday: "short"
});

function init() {
  loadFromHashOrStorage();
  render();
  els.form.addEventListener("submit", onSubmit);
  els.cancelEdit.addEventListener("click", resetForm);
  els.filters.addEventListener("click", onFilter);
  els.plansList.addEventListener("click", onPlanAction);
  els.copyShare.addEventListener("click", copyShareLink);
  els.export.addEventListener("click", exportPlans);
  els.importInput.addEventListener("change", importPlans);
}

function loadFromHashOrStorage() {
  const hashData = new URLSearchParams(location.hash.slice(1)).get("data");

  if (hashData) {
    try {
      state.plans = normalizePlans(JSON.parse(decodeURIComponent(atob(hashData))));
      save();
      history.replaceState(null, "", location.pathname);
      showToast("공유 링크의 일정을 불러왔어요.");
      return;
    } catch {
      showToast("공유 링크를 읽지 못했어요.");
    }
  }

  try {
    state.plans = normalizePlans(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    state.plans = [];
  }
}

function normalizePlans(plans) {
  if (!Array.isArray(plans)) return [];

  return plans
    .filter((plan) => plan && plan.title && plan.date)
    .map((plan) => ({
      id: String(plan.id || crypto.randomUUID()),
      title: String(plan.title),
      date: String(plan.date),
      time: String(plan.time || ""),
      place: String(plan.place || ""),
      memo: String(plan.memo || ""),
      done: Boolean(plan.done)
    }));
}

function onSubmit(event) {
  event.preventDefault();
  const plan = {
    id: state.editingId || crypto.randomUUID(),
    title: els.title.value.trim(),
    date: els.date.value,
    time: els.time.value,
    place: els.place.value.trim(),
    memo: els.memo.value.trim(),
    done: state.plans.find((item) => item.id === state.editingId)?.done || false
  };

  if (state.editingId) {
    state.plans = state.plans.map((item) => (item.id === state.editingId ? plan : item));
    showToast("일정을 수정했어요.");
  } else {
    state.plans.push(plan);
    showToast("일정을 추가했어요.");
  }

  save();
  resetForm();
  render();
}

function onFilter(event) {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
}

function onPlanAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = event.target.closest(".plan-card");
  const plan = state.plans.find((item) => item.id === card.dataset.id);
  if (!plan) return;

  if (button.dataset.action === "toggle") {
    plan.done = !plan.done;
    showToast(plan.done ? "완료로 표시했어요." : "예정으로 되돌렸어요.");
  }

  if (button.dataset.action === "edit") {
    startEdit(plan);
    return;
  }

  if (button.dataset.action === "delete") {
    state.plans = state.plans.filter((item) => item.id !== plan.id);
    showToast("일정을 삭제했어요.");
  }

  save();
  render();
}

function startEdit(plan) {
  state.editingId = plan.id;
  els.title.value = plan.title;
  els.date.value = plan.date;
  els.time.value = plan.time;
  els.place.value = plan.place;
  els.memo.value = plan.memo;
  els.submit.textContent = "일정 수정";
  els.cancelEdit.hidden = false;
  els.title.focus();
}

function resetForm() {
  state.editingId = null;
  els.form.reset();
  els.submit.textContent = "일정 추가";
  els.cancelEdit.hidden = true;
}

function render() {
  const plans = getVisiblePlans();
  els.plansList.innerHTML = "";
  els.emptyState.hidden = plans.length > 0;

  document.querySelectorAll(".filters button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });

  plans.forEach((plan) => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    const date = parseLocalDate(plan.date);
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

    card.dataset.id = plan.id;
    card.classList.toggle("done", plan.done);
    card.querySelector(".month").textContent = parts.month;
    card.querySelector(".day").textContent = parts.day;
    card.querySelector(".weekday").textContent = parts.weekday;
    card.querySelector("h2").textContent = plan.title;
    card.querySelector(".status").textContent = plan.done ? "완료" : "예정";
    card.querySelector(".meta").textContent = buildMeta(plan);
    card.querySelector(".memo").textContent = plan.memo || "메모 없음";
    card.querySelector('[data-action="toggle"]').textContent = plan.done ? "예정" : "완료";
    els.plansList.append(card);
  });
}

function getVisiblePlans() {
  return state.plans
    .filter((plan) => {
      if (state.filter === "todo") return !plan.done;
      if (state.filter === "done") return plan.done;
      return true;
    })
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function buildMeta(plan) {
  const details = [];
  if (plan.time) details.push(plan.time);
  if (plan.place) details.push(plan.place);
  return details.length ? details.join(" / ") : "시간과 장소 미정";
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.plans));
}

async function copyShareLink() {
  const payload = btoa(encodeURIComponent(JSON.stringify(state.plans)));
  const url = `${location.origin}${location.pathname}#data=${payload}`;

  try {
    await navigator.clipboard.writeText(url);
    showToast("공유 링크를 복사했어요.");
  } catch {
    prompt("이 링크를 복사해서 공유하세요.", url);
  }
}

function exportPlans() {
  const blob = new Blob([JSON.stringify(state.plans, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "date-plans.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("JSON 백업 파일을 만들었어요.");
}

function importPlans(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state.plans = normalizePlans(JSON.parse(reader.result));
      save();
      render();
      showToast("백업 파일을 불러왔어요.");
    } catch {
      showToast("JSON 파일을 읽지 못했어요.");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

init();
