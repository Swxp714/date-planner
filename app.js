const STORAGE_KEY = "date-planner-v3";

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
  const oldData = localStorage.getItem("date-planner-v2") || localStorage.getItem("date-planner-v1");
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
    ? `남은 약속 ${todoCount}개가 포스터에 담겨요.`
    : "일정을 추가하면 공유용 이미지에 자동 반영됩니다.";
  els.sharePreviewList.innerHTML = "";

  plans.forEach((plan) => {
    const row = document.createElement("div");
    row.className = "share-mini";
    row.innerHTML = "<strong></strong><span></span>";
    row.querySelector("strong").textContent = plan.title;
    row.querySelector("span").textContent = `${formatShortDate(plan.date)} / ${buildMeta(plan)}`;
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
  return details.length ? details.join(" / ") : "시간과 장소 미정";
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
    await document.fonts.load('64px "Press Start 2P"');
    await document.fonts.load('42px "DungGeunMo"');
  }

  const plans = getSortedPlans().slice(0, 6);
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = Math.max(1420, 700 + plans.length * 132);
  const ctx = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingEnabled = false;

  drawPosterImage(ctx, width, height, plans);

  const link = document.createElement("a");
  link.download = "date-plan-poster.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("픽셀 포스터 이미지를 저장했어요.");
}

function drawPosterImage(ctx, width, height, plans) {
  ctx.fillStyle = "#f2f2f0";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, 24, "#deded8");
  drawPinkRidge(ctx, 0, 252, width, 230);
  drawFlower(ctx, 78, 84, 1.25);
  drawFlower(ctx, width - 190, 178, 0.95);
  drawFlower(ctx, width - 160, height - 260, 1.35);

  ctx.fillStyle = "#080808";
  ctx.font = imageFont(66, "Press Start 2P");
  ctx.fillText("DATE PLAN", 72, 560);
  ctx.fillText("IS OUR ART", 72, 642);

  ctx.font = imageFont(28, "DungGeunMo");
  ctx.fillText("둘만 보는 약속 포스터", 78, 706);

  drawCanvasDino(ctx, width - 300, 520);

  ctx.fillStyle = "#080808";
  ctx.font = imageFont(22, "DungGeunMo");
  wrapText(ctx, "일정을 추가하고 이미지 저장을 누르면, 이 포스터 그대로 보낼 수 있어요.", 78, 790, 760, 32);

  ctx.fillStyle = "#ec4b9b";
  ctx.fillRect(78, 868, 226, 92);
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 6;
  ctx.strokeRect(78, 868, 226, 92);
  ctx.fillStyle = "#080808";
  ctx.font = imageFont(46, "Press Start 2P");
  ctx.fillText(String(plans.filter((plan) => !plan.done).length), 104, 930);
  ctx.font = imageFont(24, "DungGeunMo");
  ctx.fillText("남은 일정", 184, 928);

  if (!plans.length) {
    drawEmptyPoster(ctx);
    return;
  }

  plans.forEach((plan, index) => drawPosterPlan(ctx, plan, 78, 1025 + index * 132, width - 156));
}

function drawPosterPlan(ctx, plan, x, y, width) {
  const parts = getDateParts(plan.date);
  ctx.fillStyle = plan.done ? "#f8f8f5" : "#ec4b9b";
  ctx.fillRect(x, y, width, 102);
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 6;
  ctx.strokeRect(x, y, width, 102);

  ctx.fillStyle = "#080808";
  ctx.font = imageFont(22, "DungGeunMo");
  ctx.fillText(parts.month, x + 22, y + 32);
  ctx.font = imageFont(44, "Press Start 2P");
  ctx.fillText(parts.day, x + 20, y + 82);

  ctx.font = imageFont(32, "DungGeunMo");
  ctx.fillText(plan.title, x + 142, y + 42);
  ctx.font = imageFont(22, "DungGeunMo");
  ctx.fillText(`${parts.weekday} / ${buildMeta(plan)}`, x + 142, y + 76);
}

function drawEmptyPoster(ctx) {
  ctx.fillStyle = "#f8f8f5";
  ctx.fillRect(78, 1025, 924, 150);
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 6;
  ctx.strokeRect(78, 1025, 924, 150);
  ctx.fillStyle = "#080808";
  ctx.font = imageFont(34, "DungGeunMo");
  ctx.fillText("아직 일정이 없어요.", 116, 1095);
  ctx.font = imageFont(24, "DungGeunMo");
  ctx.fillText("웹에서 첫 약속을 추가해보세요.", 116, 1140);
}

function drawGrid(ctx, width, height, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawPinkRidge(ctx, x, y, width, height) {
  ctx.fillStyle = "#ec4b9b";
  ctx.beginPath();
  ctx.moveTo(x, y + 90);
  for (let px = 0; px <= width; px += 42) {
    const peak = y + 40 + ((px / 42) % 3) * 18;
    ctx.lineTo(px, peak);
    ctx.lineTo(px + 21, peak + 36);
  }
  ctx.lineTo(width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fill();
}

function drawFlower(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#31b856";
  ctx.lineWidth = 7;
  [[0, 34], [34, 34], [17, 4], [17, 64]].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.ellipse(px, py, 20, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.arc(17, 34, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCanvasDino(ctx, x, y) {
  ctx.fillStyle = "#31b856";
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 6;
  ctx.fillRect(x + 32, y + 58, 156, 72);
  ctx.strokeRect(x + 32, y + 58, 156, 72);
  ctx.fillRect(x + 144, y + 4, 72, 72);
  ctx.strokeRect(x + 144, y + 4, 72, 72);
  ctx.fillRect(x, y + 78, 52, 32);
  ctx.strokeRect(x, y + 78, 52, 32);
  ctx.fillRect(x + 70, y + 128, 28, 48);
  ctx.strokeRect(x + 70, y + 128, 28, 48);
  ctx.fillRect(x + 142, y + 128, 28, 48);
  ctx.strokeRect(x + 142, y + 128, 28, 48);
  ctx.fillStyle = "#080808";
  ctx.fillRect(x + 184, y + 28, 12, 12);
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(x + 28, y + 178, 196, 26);
  ctx.strokeRect(x + 28, y + 178, 196, 26);
}

function imageFont(size, family) {
  return `${size}px "${family}", "DungGeunMo", monospace`;
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
