const STORAGE_KEY = "date-planner-v2";

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
  filters: document.querySelector(".toolbar"),
  saveImage: document.querySelector("#saveImageBtn"),
  export: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  toast: document.querySelector("#toast"),
  shareCount: document.querySelector("#shareCount"),
  shareSummary: document.querySelector("#shareSummary"),
  sharePreviewList: document.querySelector("#sharePreviewList")
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  weekday: "short"
});

init();

function init() {
  load();
  render();
  els.form.addEventListener("submit", onSubmit);
  els.cancelEdit.addEventListener("click", resetForm);
  els.filters.addEventListener("click", onFilter);
  els.plansList.addEventListener("click", onPlanAction);
  els.saveImage.addEventListener("click", savePlanImage);
  els.export.addEventListener("click", exportPlans);
  els.importInput.addEventListener("change", importPlans);
}

function load() {
  const oldData = localStorage.getItem("date-planner-v1");
  const data = localStorage.getItem(STORAGE_KEY) || oldData || "[]";

  try {
    state.plans = normalizePlans(JSON.parse(data));
    save();
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

  document.querySelectorAll(".toolbar button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });

  plans.forEach((plan) => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    const parts = getDateParts(plan.date);

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

  renderSharePreview();
}

function renderSharePreview() {
  const plans = getSortedPlans().slice(0, 4);
  const todoCount = state.plans.filter((plan) => !plan.done).length;
  els.shareCount.textContent = String(todoCount);
  els.shareSummary.textContent = todoCount
    ? `남은 약속 ${todoCount}개를 정리했어요.`
    : "일정을 추가하면 공유 이미지에 자동 반영됩니다.";
  els.sharePreviewList.innerHTML = "";

  plans.forEach((plan) => {
    const row = document.createElement("div");
    row.className = "share-mini";
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = plan.title;
    row.querySelector("span").textContent = `${formatShortDate(plan.date)} · ${buildMeta(plan)}`;
    els.sharePreviewList.append(row);
  });
}

function getVisiblePlans() {
  return getSortedPlans().filter((plan) => {
    if (state.filter === "todo") return !plan.done;
    if (state.filter === "done") return plan.done;
    return true;
  });
}

function getSortedPlans() {
  return [...state.plans].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function buildMeta(plan) {
  const details = [];
  if (plan.time) details.push(plan.time);
  if (plan.place) details.push(plan.place);
  return details.length ? details.join(" · ") : "시간과 장소 미정";
}

function getDateParts(value) {
  const parts = dateFormatter.formatToParts(parseLocalDate(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function formatShortDate(value) {
  const parts = getDateParts(value);
  return `${parts.month} ${parts.day}일 ${parts.weekday}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.plans));
}

function exportPlans() {
  const blob = new Blob([JSON.stringify(state.plans, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "date-plans.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("JSON 파일로 저장했어요.");
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
      showToast("일정을 불러왔어요.");
    } catch {
      showToast("JSON 파일을 읽지 못했어요.");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

async function savePlanImage() {
  if (document.fonts) {
    await document.fonts.ready;
  }

  const plans = getSortedPlans();
  const canvas = document.createElement("canvas");
  const width = 1200;
  const rowHeight = 128;
  const height = Math.max(760, 420 + Math.min(plans.length, 6) * rowHeight);
  const ctx = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  drawImageCard(ctx, width, height, plans.slice(0, 6));

  const link = document.createElement("a");
  link.download = "date-plan.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("공유용 이미지를 저장했어요.");
}

function drawImageCard(ctx, width, height, plans) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#11121a");
  gradient.addColorStop(0.55, "#07080c");
  gradient.addColorStop(1, "#15101a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawGlow(ctx, 170, 80, 270, "rgba(124, 92, 255, 0.28)");
  drawGlow(ctx, 1040, 120, 240, "rgba(255, 92, 138, 0.22)");
  drawGlow(ctx, 960, 650, 220, "rgba(103, 232, 201, 0.13)");

  ctx.fillStyle = "#67e8c9";
  ctx.font = imageFont(28, 700);
  ctx.fillText("PRIVATE DATE PLAN", 76, 92);

  ctx.fillStyle = "#f7f7fb";
  ctx.font = imageFont(76, 700);
  wrapText(ctx, "우리의 다음 약속", 72, 178, 760, 86);

  ctx.fillStyle = "#a2a5b1";
  ctx.font = imageFont(30, 400);
  ctx.fillText(`${new Date().toLocaleDateString("ko-KR")} 저장`, 76, 264);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, 850, 68, 270, 138, 16);
  ctx.fill();
  ctx.fillStyle = "#f7f7fb";
  ctx.font = imageFont(62, 700);
  ctx.fillText(String(plans.filter((plan) => !plan.done).length), 890, 150);
  ctx.fillStyle = "#a2a5b1";
  ctx.font = imageFont(24, 400);
  ctx.fillText("남은 일정", 975, 150);

  if (!plans.length) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 76, 350, width - 152, 170, 16);
    ctx.fill();
    ctx.fillStyle = "#f7f7fb";
    ctx.font = imageFont(34, 700);
    ctx.fillText("아직 일정이 없어요.", 118, 420);
    ctx.fillStyle = "#a2a5b1";
    ctx.font = imageFont(26, 400);
    ctx.fillText("웹에서 일정을 추가한 뒤 다시 저장해보세요.", 118, 468);
    return;
  }

  plans.forEach((plan, index) => {
    const y = 340 + index * 128;
    const parts = getDateParts(plan.date);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRect(ctx, 76, y, width - 152, 104, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.stroke();

    ctx.fillStyle = plan.done ? "#7d808b" : "#ff5c8a";
    ctx.font = imageFont(24, 700);
    ctx.fillText(parts.month, 112, y + 34);
    ctx.fillStyle = "#f7f7fb";
    ctx.font = imageFont(44, 700);
    ctx.fillText(parts.day, 112, y + 80);

    ctx.fillStyle = plan.done ? "#a2a5b1" : "#f7f7fb";
    ctx.font = imageFont(30, 700);
    ctx.fillText(plan.title, 220, y + 42);

    ctx.fillStyle = "#a2a5b1";
    ctx.font = imageFont(24, 400);
    ctx.fillText(`${parts.weekday} · ${buildMeta(plan)}`, 220, y + 78);
  });
}

function imageFont(size, weight) {
  return `${weight} ${size}px "Gowun Batang", "Nanum Myeongjo", "Noto Serif KR", Batang, serif`;
}

function drawGlow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";

  words.forEach((word, index) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = next;
    }

    if (index === words.length - 1) {
      ctx.fillText(line, x, y);
    }
  });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => els.toast.classList.remove("show"), 2200);
}
