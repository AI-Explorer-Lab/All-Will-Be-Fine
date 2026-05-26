const {
  calibrationCards: fallbackCalibrationCards,
  methodCards: fallbackMethodCards,
  resultCards,
  reviewRecords: fallbackReviewRecords,
  scenes,
  summaryTemplates,
} = window.REVIEW_DATA;

const API_BASE = localStorage.getItem("review_api_base") || defaultApiBase();
const AUTH_TOKEN_KEY = "review_auth_token";
const AUTH_USER_KEY = "review_auth_user";
const app = document.querySelector("#app");

const store = {
  records: [],
  methods: [],
  calibrations: [],
};

const state = {
  tab: "review",
  route: "home",
  mode: "event",
  scene: "工作",
  draft: "",
  draftFields: {
    event: {
      improvement: "",
      next: "",
      reminder: "",
    },
    anxiety: {
      reality: "",
      action: "",
      reminder: "",
      verificationDate: "",
    },
  },
  filter: "全部",
  query: "",
  calibrationTab: "pending",
  selectedRecordId: "",
  editingRecordId: null,
  editingMethodId: null,
  editingCalibrationId: null,
  currentBundle: null,
  followUp: null,
  loading: false,
  saving: false,
  followUpLoading: false,
  saveDialogOpen: false,
  searchComposing: false,
  apiOnline: false,
  toast: "",
  authToken: localStorage.getItem(AUTH_TOKEN_KEY) || "",
  authUser: safeJsonParse(localStorage.getItem(AUTH_USER_KEY), null),
  authMode: "login",
  authSubmitting: false,
  calendarMonth: localDateKey().slice(0, 7),
  calendarExpanded: false,
  notificationsOpen: false,
};

const navItems = [
  ["review", "复盘", "home"],
  ["records", "记录", "note"],
  ["methods", "方法库", "bookmark"],
  ["calibration", "校准", "gauge"],
];

const icons = {
  home: `<svg viewBox="0 0 24 24"><path d="M4 11.3 12 4.8l8 6.5v7.4a1 1 0 0 1-1 1h-5.1v-5.2H10v5.2H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  note: `<svg viewBox="0 0 24 24"><rect x="6.5" y="4.8" width="11" height="14.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.4 9h5.2M9.4 12h5.2M9.4 15h3.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24"><path d="M7 5.4c0-.8.6-1.4 1.4-1.4h7.2c.8 0 1.4.6 1.4 1.4v14l-5-3.1-5 3.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24"><path d="M5 16a7 7 0 1 1 14 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/><path d="m12 14 3-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16.1 16.1 3.9 3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M18 10.4a6 6 0 0 0-12 0v4.1l-1.8 2h15.6l-1.8-2zM9.8 19.5h4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function defaultApiBase() {
  const { hostname, port, origin } = window.location;
  if ((hostname === "127.0.0.1" || hostname === "localhost") && port === "5173") {
    return "http://127.0.0.1:8000/api";
  }
  return `${origin}/api`;
}

function setState(next) {
  Object.assign(state, next);
  render();
}

function clearEditingState(next = {}) {
  return {
    editingRecordId: null,
    editingMethodId: null,
    editingCalibrationId: null,
    ...next,
  };
}

function notify(message) {
  state.toast = message;
  render();
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2200);
}

function typeText(type) {
  return type === "event" ? "事件" : "焦虑";
}

function modeLabel(mode) {
  return mode === "event" ? "复盘一件事" : "复盘一次焦虑";
}

function modePlaceholder(mode) {
  return mode === "event"
    ? "今天有什么事情值得复盘？发生了什么，你做了什么，结果哪里不满意？"
    : "把这次焦虑写下来。你在担心什么，它从哪里开始，最害怕发生什么？";
}

function icon(name) {
  return `<span class="icon">${icons[name]}</span>`;
}

function apiStatusText() {
  return state.apiOnline ? "后端已连接" : "后端未连接";
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

async function request(path, options = {}) {
  const { auth = true, headers = {}, ...fetchOptions } = options;
  const requestHeaders = { "Content-Type": "application/json", ...headers };
  if (auth && state.authToken) {
    requestHeaders.Authorization = `Bearer ${state.authToken}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers: requestHeaders,
    ...fetchOptions,
  });
  const rawPayload = await response.text();
  let payload;
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch (_error) {
    throw new Error(`后端返回了非 JSON 内容，请检查 API 地址：${API_BASE}`);
  }
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || "请求失败");
    error.code = payload.code || (response.status === 401 ? "UNAUTHORIZED" : "REQUEST_ERROR");
    if (error.code === "UNAUTHORIZED" && auth) clearAuthSession(false);
    throw error;
  }
  return payload.data;
}

function setAuthSession(data) {
  state.authToken = data.access_token;
  state.authUser = data.user;
  localStorage.setItem(AUTH_TOKEN_KEY, state.authToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(state.authUser));
}

function clearAuthSession(shouldRender = true) {
  state.authToken = "";
  state.authUser = null;
  state.currentBundle = null;
  store.records = [];
  store.methods = [];
  store.calibrations = [];
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  if (shouldRender) render();
}

function handleAuthError(error) {
  if (error.code !== "UNAUTHORIZED") return false;
  state.loading = false;
  state.saving = false;
  state.followUpLoading = false;
  state.authSubmitting = false;
  notify("请先登录后再使用");
  return true;
}

async function submitAuthForm(form = app.querySelector("[data-auth-form]")) {
  if (!form || state.authSubmitting) return;
  const username = form.querySelector("[data-auth-username]").value.trim();
  const password = form.querySelector("[data-auth-password]").value;
  if (!username || !password) {
    notify("请输入账号和密码");
    return;
  }

  state.authSubmitting = true;
  setAuthFormBusy(form, true);
  try {
    const data = await request(`/auth/${state.authMode === "register" ? "register" : "login"}`, {
      method: "POST",
      auth: false,
      body: JSON.stringify({ username, password }),
    });
    await storeBrowserCredential(form);
    setAuthSession(data);
    setState({ authSubmitting: false, apiOnline: true, route: "home", tab: "review" });
    await hydrateFromBackend();
    notify(state.authMode === "register" ? "账号已创建" : "已登录");
  } catch (error) {
    state.authSubmitting = false;
    setAuthFormBusy(form, false);
    state.apiOnline = false;
    notify(error.message || "登录失败");
  }
}

function setAuthFormBusy(form, busy) {
  form.setAttribute("aria-busy", busy ? "true" : "false");
  form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = busy;
  });
  const submitButton = form.querySelector(".auth-submit");
  if (submitButton) {
    submitButton.textContent = busy ? "处理中..." : state.authMode === "register" ? "创建并登录" : "登录";
  }
}

async function storeBrowserCredential(form) {
  if (!window.PasswordCredential || !navigator.credentials?.store) return;
  try {
    await navigator.credentials.store(new PasswordCredential(form));
  } catch (_error) {
    // Browser password saving is optional and may be disabled by the user or context.
  }
}

async function hydrateFromBackend() {
  if (!state.authToken) return;
  try {
    const [records, methods, calibrations] = await Promise.all([
      request("/reviews"),
      request("/methods"),
      request("/calibrations"),
    ]);
    store.records = records.map(normalizeRecord);
    store.methods = methods.map(normalizeMethod);
    store.calibrations = calibrations.map(normalizeCalibration);
    state.apiOnline = true;
    render();
  } catch (error) {
    if (handleAuthError(error)) return;
    state.apiOnline = false;
    render();
  }
}

async function analyzeDraft() {
  const rawInput = composeDraftInput();
  if (!state.draft.trim()) {
    notify("先写下一点内容，再开始整理");
    return;
  }

  setState({ loading: true });
  try {
    const bundle = await request("/reviews/analyze", {
      method: "POST",
      body: JSON.stringify({ type: state.mode, scene: state.scene, raw_input: rawInput, persist: false }),
    });
    const normalized = normalizeBundle(bundle);
    state.currentBundle = normalized;
    state.followUp = null;
    setState({ loading: false, route: "result", apiOnline: true });
    notify(normalized.warnings.length ? normalized.warnings[0] : "已生成行动卡");
  } catch (error) {
    if (handleAuthError(error)) return;
    const fallback = buildLocalBundle(rawInput, state.mode, state.scene);
    state.currentBundle = fallback;
    setState({ loading: false, route: "result", apiOnline: false });
    notify("后端未连接，已用本地结果继续流程");
  }
}

function startManualReview() {
  const rawInput = state.draft.trim();
  if (!rawInput) {
    notify("先写下一点内容，再开始复盘");
    return;
  }
  state.currentBundle = buildManualBundle(rawInput, state.mode, state.scene, currentDraftFields());
  state.followUp = null;
  setState({ route: "result", tab: "review" });
}

function normalizeBundle(bundle) {
  const normalized = {
    record: normalizeRecord(bundle.record),
    methodCard: bundle.method_card ? normalizeMethod(bundle.method_card) : null,
    calibrationCard: bundle.calibration_card ? normalizeCalibration(bundle.calibration_card) : null,
    warnings: bundle.warnings || [],
  };
  applyDraftVerificationDate(normalized);
  return normalized;
}

function normalizeRecord(record) {
  const createdAt = record.created_at || record.createdAt || record.date || "2026-05-18";
  const type = record.type || "event";
  const savedToMethodLibrary = Boolean(record.saved_to_method_library ?? record.savedToMethodLibrary);
  const savedToCalibration = Boolean(record.saved_to_calibration ?? record.savedToCalibration);
  const resultCard = record.result_card || record.resultCard || {};
  return {
    id: record.id,
    type,
    scene: record.scene || "其他",
    title: record.title || (type === "event" ? "新的事件复盘" : "新的焦虑复盘"),
    date: createdAt,
    createdAt,
    shortDate: displayDate(createdAt),
    rawInput: record.raw_input || record.rawInput || "",
    summary: record.summary || {},
    resultCard,
    conclusion: record.conclusion || firstValue(resultCard) || "已生成一张可执行的复盘卡。",
    note: record.note || record.myNote || "",
    status: savedToMethodLibrary ? "已生成方法卡" : savedToCalibration ? "已加入校准" : "未沉淀",
    savedToMethodLibrary,
    savedToCalibration,
  };
}

function normalizeMethod(card) {
  return {
    id: card.id,
    sourceReviewId: card.source_review_id || card.sourceReviewId || "",
    title: card.title,
    scenes: card.scenes || [],
    trigger: card.trigger || "",
    steps: card.steps || [],
    reminder: card.reminder || "",
    source: card.source || card.source_review_id || "当前复盘",
    createdAt: card.created_at || card.createdAt || "2026-05-18",
    updatedAt: card.updated_at || card.updatedAt || card.created_at || "2026-05-18",
  };
}

function normalizeCalibration(card) {
  return {
    id: card.id,
    sourceReviewId: card.source_review_id || card.sourceReviewId || "",
    worry: card.worry,
    scene: card.scene,
    estimatedProbability: card.estimated_probability || card.estimatedProbability || "80%",
    verificationDate: card.verification_date || card.verificationDate || "",
    status: card.status || "pending",
    finalResult: card.final_result || card.finalResult || "",
    actualImpact: card.actual_impact || card.actualImpact || "",
    calibrationConclusion: card.calibration_conclusion || card.calibrationConclusion || "",
  };
}

function firstValue(object) {
  const value = Object.values(object || {})[0];
  return Array.isArray(value) ? value[0] : value;
}

function searchableText(value) {
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(searchableText).join(" ");
  return String(value || "");
}

function normalizedSearchText(value) {
  return searchableText(value).replace(/\s+/g, "").toLowerCase();
}

function calibrationMatchesRecord(card = {}, record = {}, id = "") {
  if (!record.id) return false;
  const sourceReviewId = card.sourceReviewId || String(id || "").replace(/^derived-calibration-/, "");
  if (sourceReviewId && record.id === sourceReviewId) return true;

  const worryText = normalizedSearchText(card.worry);
  if (!worryText) return false;

  const recordText = normalizedSearchText([
    record.title,
    record.rawInput,
    record.conclusion,
    record.summary,
    record.resultCard,
  ]);
  return recordText.includes(worryText) || worryText.includes(normalizedSearchText(record.title));
}

function findRecordForCalibration(card = {}, id = "") {
  const sourceReviewId = card.sourceReviewId || String(id || "").replace(/^derived-calibration-/, "");
  if (sourceReviewId) {
    const direct = store.records.find((record) => record.id === sourceReviewId);
    if (direct) return direct;
  }

  const worryText = normalizedSearchText(card.worry);
  const candidates = store.records.filter((record) => record.type === "anxiety");
  if (worryText) {
    const matched = candidates.find((record) => calibrationMatchesRecord(card, record, id));
    if (matched) return matched;
  }

  const sameScene = candidates.filter((record) => record.savedToCalibration && record.scene === card.scene);
  if (sameScene.length === 1) return sameScene[0];

  const savedCandidates = candidates.filter((record) => record.savedToCalibration);
  return savedCandidates.length === 1 ? savedCandidates[0] : null;
}

function upsertRecord(record) {
  store.records = [record, ...store.records.filter((item) => item.id !== record.id)];
}

function upsertMethod(card) {
  store.methods = [card, ...store.methods.filter((item) => item.id !== card.id)];
}

function upsertCalibration(card) {
  store.calibrations = [card, ...store.calibrations.filter((item) => item.id !== card.id)];
}

function recordPayload(record) {
  return {
    id: record.id,
    type: record.type,
    scene: record.scene,
    title: record.title,
    raw_input: record.rawInput,
    summary: record.summary,
    result_card: record.resultCard,
    note: record.note || "",
    created_at: record.createdAt || record.date || localDateTimeKey(),
    updated_at: localDateTimeKey(),
    saved_to_method_library: Boolean(record.savedToMethodLibrary),
    saved_to_calibration: Boolean(record.savedToCalibration),
  };
}

function methodPayload(card) {
  return {
    id: card.id,
    source_review_id: card.sourceReviewId || "",
    title: card.title,
    scenes: card.scenes || [],
    trigger: card.trigger || "",
    steps: card.steps || [],
    reminder: card.reminder || "",
    created_at: card.createdAt || localDateTimeKey(),
    updated_at: localDateTimeKey(),
  };
}

function calibrationPayload(card) {
  return {
    id: card.id,
    source_review_id: card.sourceReviewId || "",
    worry: card.worry,
    scene: card.scene,
    estimated_probability: card.estimatedProbability,
    verification_date: card.verificationDate,
    status: card.status,
    final_result: card.finalResult,
    actual_impact: card.actualImpact,
    calibration_conclusion: card.calibrationConclusion,
  };
}

function bundlePayload(bundle) {
  const includeMethod = Boolean(bundle.includeMethodCard);
  const includeCalibration = Boolean(bundle.includeCalibrationCard);
  return {
    record: {
      id: bundle.record.id,
      type: bundle.record.type,
      scene: bundle.record.scene,
      title: bundle.record.title,
      raw_input: bundle.record.rawInput,
      summary: bundle.record.summary,
      result_card: bundle.record.resultCard,
      note: bundle.record.note || "",
      created_at: bundle.record.createdAt || bundle.record.date || localDateTimeKey(),
      updated_at: localDateTimeKey(),
      saved_to_method_library: includeMethod,
      saved_to_calibration: includeCalibration,
    },
    method_card: includeMethod && bundle.methodCard ? {
      id: bundle.methodCard.id,
      source_review_id: bundle.record.id,
      title: bundle.methodCard.title,
      scenes: bundle.methodCard.scenes,
      trigger: bundle.methodCard.trigger,
      steps: bundle.methodCard.steps,
      reminder: bundle.methodCard.reminder || "",
      created_at: bundle.methodCard.createdAt || bundle.record.createdAt || bundle.record.date || localDateTimeKey(),
      updated_at: localDateTimeKey(),
    } : null,
    calibration_card: includeCalibration && bundle.calibrationCard ? {
      id: bundle.calibrationCard.id,
      source_review_id: bundle.record.id,
      worry: bundle.calibrationCard.worry,
      scene: bundle.calibrationCard.scene,
      estimated_probability: bundle.calibrationCard.estimatedProbability,
      verification_date: bundle.calibrationCard.verificationDate,
      status: bundle.calibrationCard.status,
      final_result: bundle.calibrationCard.finalResult,
      actual_impact: bundle.calibrationCard.actualImpact,
      calibration_conclusion: bundle.calibrationCard.calibrationConclusion,
    } : null,
    warnings: bundle.warnings || [],
  };
}

async function persistCurrentBundle(destination = "records", options = {}) {
  if (!state.currentBundle?.record || state.saving) return;
  const previousBundle = state.currentBundle;
  const saveToMethod = destination === "methods";
  const saveToCalibration = destination === "calibration";
  state.currentBundle.includeMethodCard = saveToMethod;
  state.currentBundle.includeCalibrationCard = saveToCalibration;
  state.currentBundle.record.savedToMethodLibrary = saveToMethod;
  state.currentBundle.record.savedToCalibration = saveToCalibration;
  state.currentBundle.record.status = saveToMethod ? "已生成方法卡" : saveToCalibration ? "已加入校准" : "已保存";
  setState({ saving: true });
  try {
    const saved = await request("/reviews/save", {
      method: "POST",
      body: JSON.stringify(bundlePayload(state.currentBundle)),
    });
    const normalized = normalizeBundle(saved);
    if (!normalized.methodCard && previousBundle.methodCard) normalized.methodCard = previousBundle.methodCard;
    if (!normalized.calibrationCard && previousBundle.calibrationCard) normalized.calibrationCard = previousBundle.calibrationCard;
    normalized.record.status = saveToMethod ? "已生成方法卡" : saveToCalibration ? "已加入校准" : "已保存";
    normalized.record.savedToMethodLibrary = saveToMethod;
    normalized.record.savedToCalibration = saveToCalibration;
    state.currentBundle = normalized;
    upsertRecord(normalized.record);
    if (saveToMethod && normalized.methodCard) upsertMethod(normalized.methodCard);
    if (saveToCalibration && normalized.calibrationCard) upsertCalibration(normalized.calibrationCard);
    if (options.askMethodLibrary) {
      setState({ saving: false, saveDialogOpen: true, route: "result", tab: "review", apiOnline: true });
    } else {
      setState({ saving: false, saveDialogOpen: false, route: destination, tab: destination === "methods" ? "methods" : destination === "calibration" ? "calibration" : "records", apiOnline: true });
    }
    notify(destination === "methods" ? "记录已保存，并同步到方法库" : destination === "calibration" ? "记录已保存，并同步到校准" : "记录已保存");
  } catch (error) {
    if (handleAuthError(error)) return;
    const normalized = state.currentBundle;
    upsertRecord(normalized.record);
    if (normalized.methodCard) upsertMethod(normalized.methodCard);
    if (normalized.calibrationCard) upsertCalibration(normalized.calibrationCard);
    if (options.askMethodLibrary) {
      setState({ saving: false, saveDialogOpen: true, route: "result", tab: "review", apiOnline: false });
    } else {
      setState({ saving: false, saveDialogOpen: false, route: destination, tab: destination === "methods" ? "methods" : destination === "calibration" ? "calibration" : "records", apiOnline: false });
    }
    notify("后端未连接，已先保存在本地演示数据中");
  }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateTimeKey(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${localDateKey(date)}T${hours}:${minutes}:${seconds}`;
}

function addDays(date, amount) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function weekStartMonday(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy;
}

function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey || localDateKey().slice(0, 7)).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function shiftMonth(monthKey, amount) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + amount);
  return localDateKey(date).slice(0, 7);
}

function monthOptions(centerMonth) {
  return Array.from({ length: 7 }, (_, index) => shiftMonth(centerMonth, index - 3));
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function monthCalendarDays(monthKey) {
  const first = parseMonthKey(monthKey);
  const start = weekStartMonday(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function recordDateKey(record) {
  return String(record.date || record.createdAt || "").slice(0, 10);
}

function displayDate(value, options = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return raw;
  if (options.full) return key;
  return key.slice(5);
}

function monthDay(date) {
  return localDateKey(date).slice(5);
}

function fixedSceneTags(mode) {
  const source = mode ? scenes[mode] : [...scenes.event, ...scenes.anxiety];
  return [...new Set(source)];
}

function sceneSelect(currentScene, mode, attr = "data-record-scene") {
  const options = fixedSceneTags(mode);
  const value = options.includes(currentScene) ? currentScene : "其他";
  return `<select ${attr}>${options.map((scene) => `<option value="${escapeHtml(scene)}" ${value === scene ? "selected" : ""}>${escapeHtml(scene)}</option>`).join("")}</select>`;
}

function methodSelectedTag(card) {
  const options = fixedSceneTags();
  const direct = (card.scenes || []).filter((scene) => options.includes(scene));
  if (direct.length) return direct[0];
  const sourceRecord = store.records.find((record) => record.id === card.sourceReviewId || record.title === card.source);
  if (sourceRecord && options.includes(sourceRecord.scene)) return sourceRecord.scene;
  return "其他";
}

function methodSceneSelect(card) {
  return sceneSelect(methodSelectedTag(card), "", "data-method-scene");
}

function currentDraftFields() {
  return state.draftFields[state.mode];
}

function draftVerificationDate() {
  return String(state.draftFields.anxiety.verificationDate || "").trim();
}

function applyDraftVerificationDate(bundle) {
  const date = draftVerificationDate();
  if (state.mode === "anxiety" && date && bundle?.calibrationCard) {
    bundle.calibrationCard.verificationDate = date;
  }
  return bundle;
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function composeDraftInput() {
  const base = state.draft.trim();
  const fields = currentDraftFields();
  const lines = state.mode === "event"
    ? [
        ["发生了什么", base],
        ["需要改进的地方", fields.improvement],
        ["下次怎么做", fields.next],
        ["提醒自己", fields.reminder],
      ]
    : [
        ["我在担心什么", base],
        ["现实检查", fields.reality],
        ["我能做什么", fields.action],
        ["提醒自己", fields.reminder],
      ];
  return lines
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}：${String(value).trim()}`)
    .join("\n");
}

function buildLocalBundle(rawInput, mode, scene) {
  const today = localDateKey();
  const now = localDateTimeKey();
  const eventSteps = ["复述我对事情的理解", "确认目标和边界", "列出关键不确定点", "明确完成标准"];
  const eventReminder = "开始做之前，先确认清楚，返工和内耗的成本更高。";
  const anxietyAction = ["写下一个 30 分钟内能完成的小动作", "确认完成标准", "完成后再回来看这张卡"];
  const anxietyReminder = "焦虑不是预测结果，它只是提醒我有事情需要准备。";
  const record = normalizeRecord({
    id: `local-${Date.now()}`,
    type: mode,
    scene,
    title: rawInput.slice(0, 22) || (mode === "event" ? "新的事件复盘" : "新的焦虑复盘"),
    rawInput,
    summary: mode === "event" ? {
      发生了什么: rawInput,
      需要改进的地方: "开始前还需要把目标、边界和验收标准确认得更清楚。",
      下次怎么做: eventSteps,
      提醒自己: eventReminder,
    } : {
      我在担心什么: rawInput,
      现实检查: "这个担心有一部分现实依据，但还不能说明最坏结果一定会发生。",
      我能做什么: anxietyAction,
      提醒自己: anxietyReminder,
    },
    resultCard: mode === "event" ? {
      需要改进的地方: "开始前还需要把目标、边界和验收标准确认得更清楚。",
      下次怎么做: eventSteps,
      提醒自己: eventReminder,
    } : {
      我能做什么: anxietyAction,
      提醒自己: anxietyReminder,
    },
    createdAt: now,
    savedToMethodLibrary: mode === "event",
    savedToCalibration: mode === "anxiety",
  });
  return {
    record,
    methodCard: mode === "event" ? normalizeMethod({
      id: `local-method-${Date.now()}`,
      title: "开始前确认卡",
      scenes: [scene],
      trigger: "准备开始处理类似事情前",
      steps: eventSteps,
      source: record.title,
      createdAt: now,
      updatedAt: now,
    }) : null,
    calibrationCard: mode === "anxiety" ? normalizeCalibration({
      id: `local-calibration-${Date.now()}`,
      worry: record.title,
      scene,
      estimatedProbability: "80%",
      verificationDate: draftVerificationDate(),
      status: "pending",
    }) : null,
  };
}

function buildManualBundle(rawInput, mode, scene, fields = currentDraftFields()) {
  const bundle = buildLocalBundle(rawInput, mode, scene);
  if (mode === "event") {
    const nextSteps = splitLines(fields.next);
    const improvement = fields.improvement.trim();
    const reminder = fields.reminder.trim();
    bundle.record.summary = {
      发生了什么: rawInput,
      需要改进的地方: improvement,
      下次怎么做: nextSteps,
      提醒自己: reminder,
    };
    bundle.record.resultCard = {
      需要改进的地方: improvement,
      下次怎么做: nextSteps,
      提醒自己: reminder,
    };
    if (bundle.methodCard) {
      bundle.methodCard.steps = nextSteps;
      bundle.methodCard.trigger = improvement;
      bundle.methodCard.reminder = reminder;
    }
  } else {
    const actionSteps = splitLines(fields.action);
    const reminder = fields.reminder.trim();
    bundle.record.summary = {
      我在担心什么: rawInput,
      现实检查: fields.reality.trim(),
      我能做什么: actionSteps,
      提醒自己: reminder,
    };
    bundle.record.resultCard = {
      我能做什么: actionSteps,
      提醒自己: reminder,
    };
    if (bundle.calibrationCard) {
      bundle.calibrationCard.verificationDate = fields.verificationDate || draftVerificationDate();
    }
  }
  bundle.record.conclusion = rawInput;
  return bundle;
}

function currentRecord() {
  if (state.currentBundle?.record) return state.currentBundle.record;
  return store.records.find((item) => item.id === state.selectedRecordId) || store.records[0];
}

function objectFields(object, fallback) {
  const entries = Object.entries(object || {});
  return entries.length ? entries : fallback;
}

function methodSourceLabel(source) {
  const value = String(source || "").trim();
  if (!value || /^event-[a-z0-9-]+$/i.test(value) || /^local-\d+$/i.test(value)) return "";
  return value;
}

function findMethodForRecord(record) {
  return store.methods.find((method) => method.sourceReviewId === record.id || method.source === record.title || method.source === record.id);
}

function createMethodFromRecord(record) {
  const steps = record.resultCard?.下次怎么做 || record.resultCard?.["下次怎么做"] || [];
  const method = normalizeMethod({
    id: `local-method-${Date.now()}`,
    sourceReviewId: record.id,
    title: `${record.title.slice(0, 14)}方法卡`,
    scenes: [record.scene],
    trigger: record.summary?.需要改进的地方 || "再次遇到类似情况前",
    steps: Array.isArray(steps) && steps.length ? steps : ["复述当前情况", "确认目标和边界", "列出下一步行动"],
    source: record.title,
    createdAt: localDateTimeKey(),
    updatedAt: localDateTimeKey(),
  });
  upsertMethod(method);
  return method;
}

function findCalibrationForRecord(record) {
  return store.calibrations.find((card) => card.sourceReviewId === record.id || card.worry === record.title || card.worry === record.rawInput);
}

function calibrationFromRecord(record) {
  const existing = findCalibrationForRecord(record);
  if (existing) return existing;
  const summary = record.summary || {};
  const resultCard = record.resultCard || {};
  return normalizeCalibration({
    id: `derived-calibration-${record.id}`,
    sourceReviewId: record.id,
    worry: summary.我在担心什么 || record.rawInput || record.title,
    scene: record.scene,
    estimatedProbability: "待校准",
    verificationDate: "",
    status: "pending",
    finalResult: "",
    actualImpact: "",
    calibrationConclusion: resultCard.提醒自己 || summary.现实检查 || "",
  });
}

function calibrationCardsForPage() {
  const merged = new Map(store.calibrations.map((card) => [card.id, card]));
  store.records
    .filter((record) => record.type === "anxiety" && record.savedToCalibration)
    .forEach((record) => {
      if (!findCalibrationForRecord(record)) {
        const card = calibrationFromRecord(record);
        upsertCalibration(card);
        merged.set(card.id, card);
      }
    });
  return Array.from(merged.values());
}

function replaceTextReferences(oldText, newText) {
  const from = String(oldText || "").trim();
  const to = String(newText || "").trim();
  if (!from || from === to) return;

  const replaceValue = (value) => {
    if (typeof value === "string") return value === from ? to : value;
    if (Array.isArray(value)) return value.map(replaceValue);
    if (value && typeof value === "object") {
      Object.keys(value).forEach((key) => {
        value[key] = replaceValue(value[key]);
      });
    }
    return value;
  };

  replaceValue(store);
  if (state.currentBundle) replaceValue(state.currentBundle);
}

function syncFieldValue(oldValue, newValue) {
  if (Array.isArray(oldValue) || Array.isArray(newValue)) {
    const oldItems = Array.isArray(oldValue) ? oldValue : String(oldValue || "").split(/\r?\n/);
    const newItems = Array.isArray(newValue) ? newValue : String(newValue || "").split(/\r?\n/);
    oldItems.forEach((item, index) => replaceTextReferences(item, newItems[index] || ""));
    replaceTextReferences(oldItems.join("\n"), newItems.join("\n"));
    return;
  }
  replaceTextReferences(oldValue, newValue);
}

function editableFields(object, fallback) {
  return objectFields(object, fallback).map(([label, value]) => [label, Array.isArray(value) ? value : String(value || "")]);
}

function parseEditableValue(value, originalValue) {
  if (!Array.isArray(originalValue)) return value.trim();
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function shell(content) {
  const username = state.authUser?.username || "已登录";
  const notifications = notificationItems();
  return `
    <aside class="sidebar">
      <div class="brand">${leafLogo()}<div><div class="brand-name">复盘</div><div class="brand-subtitle">下一次会更好</div></div></div>
      <nav class="side-nav">
        ${navItems.map(([id, label, iconName]) => `
          <button class="side-nav-item ${state.tab === id ? "active" : ""}" data-tab="${id}">
            ${icon(iconName)}<span>${label}</span>
          </button>
        `).join("")}
      </nav>
      <div class="growth-card">
        ${deskPlantArt("small")}
        <div class="growth-title">把经历整理成方法</div>
        <p>你已经复盘了 ${store.records.length} 件事<br />沉淀了 ${store.methods.length} 张方法卡</p>
        <button class="outline-button" data-tab="methods">查看我的成长</button>
      </div>
    </aside>
    <section class="workspace">
      <header class="top-header">
        <label class="search-box">
          <input data-search value="${escapeHtml(state.query)}" placeholder="搜索复盘记录、方法卡片..." />
          <button type="button" data-search-submit aria-label="搜索">${icons.search}</button>
        </label>
        <div class="notification-wrap">
          <button class="header-icon" data-notifications aria-label="通知" aria-expanded="${state.notificationsOpen}">
            ${icons.bell}${notifications.length ? `<i></i>` : ""}
          </button>
          ${state.notificationsOpen ? notificationPanel(notifications) : ""}
        </div>
        <div class="profile-button" aria-label="当前用户">
          <span class="avatar"></span><span class="profile-name">${escapeHtml(username)}</span><button class="down" data-logout type="button">退出</button>
        </div>
      </header>
      ${content}
      ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
    </section>
  `;
}

function notificationItems() {
  const today = localDateKey();
  return calibrationCardsForPage()
    .filter((card) => {
      const verificationDate = String(card.verificationDate || "").slice(0, 10);
      return card.status === "pending" && verificationDate && verificationDate <= today;
    })
    .map((card) => ({
      id: card.id,
      title: "焦虑验证时间到了",
      body: card.worry || "有一张校准卡需要验证",
      date: String(card.verificationDate || "").slice(0, 10),
    }));
}

function notificationPanel(items) {
  return `
    <section class="notification-panel" aria-label="通知列表">
      <div class="notification-title">通知</div>
      ${items.length ? items.map((item) => `
        <button class="notification-item" data-open-calibration="${item.id}" type="button">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.body)}</span>
          <small>${displayDate(item.date, { full: true })}</small>
        </button>
      `).join("") : `<p>暂无新的提醒</p>`}
    </section>
  `;
}

function authPage() {
  const isRegister = state.authMode === "register";
  return `
    <section class="auth-page">
      <div class="auth-panel">
        <div class="brand auth-brand">${leafLogo()}<div><div class="brand-name">复盘</div></div></div>
        <form class="auth-form" data-auth-form method="post" action="/api/auth/${isRegister ? "register" : "login"}" autocomplete="on">
          <h1>${isRegister ? "创建账号" : "登录账号"}</h1>
          <p>登录后才能使用复盘、方法库和校准功能。</p>
          <label for="auth-username">账号<input id="auth-username" name="username" data-auth-username type="text" inputmode="text" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="${isRegister ? "例如 zhangsan" : ""}" /></label>
          <label for="auth-password">密码<input id="auth-password" name="password" data-auth-password type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required placeholder="${isRegister ? "至少 8 位，包含字母和数字" : ""}" /></label>
          <button class="primary-button auth-submit" type="submit" ${state.authSubmitting ? "disabled" : ""}>
            ${state.authSubmitting ? "处理中..." : isRegister ? "创建并登录" : "登录"}
          </button>
          <button class="text-link" type="button" data-auth-mode="${isRegister ? "login" : "register"}">
            ${isRegister ? "已有账号，去登录" : "没有账号，创建一个"}
          </button>
        </form>
      </div>
      ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
    </section>
  `;
}

function leafLogo() {
  return `
    <svg class="leaf-logo" viewBox="0 0 62 62" aria-hidden="true">
      <path d="M31 52C24 39 20 27 25 12c9 6 11 16 6 40z" fill="#b85f25"/>
      <path d="M34 46c1-16 7-28 22-34-1 15-8 26-22 34z" fill="#9c6f38"/>
      <path d="M22 42C12 38 7 31 6 19c12 2 18 9 16 23z" fill="#cf7b37"/>
      <path d="M12 48c13-4 25-3 37 3" fill="none" stroke="#7f4b25" stroke-width="2.2" stroke-linecap="round"/>
    </svg>
  `;
}

function deskPlantArt(size = "hero") {
  return `
    <svg class="desk-art ${size}" viewBox="0 0 360 240" aria-hidden="true">
      <path d="M6 206c85 30 234 28 337 1" fill="none" stroke="#edcfad" stroke-width="2" opacity=".55"/>
      <path d="M268 180c-5-54-1-95 14-129" fill="none" stroke="#96824e" stroke-width="3" stroke-linecap="round"/>
      ${Array.from({ length: 24 }).map((_, i) => {
        const x = 252 + (i % 4) * 17 + (i > 11 ? 18 : 0);
        const y = 62 + Math.floor(i / 4) * 18;
        const rot = i % 2 ? -32 : 28;
        return `<ellipse cx="${x}" cy="${y}" rx="8" ry="15" transform="rotate(${rot} ${x} ${y})" fill="#c8b26c" opacity=".78"/>`;
      }).join("")}
      <path d="M244 156h72l-8 60h-56z" fill="#f1e5d2" stroke="#c9a87d" stroke-width="2"/>
      <path d="M84 172c48-14 90-11 134 8v31c-44-18-86-22-134-8z" fill="#fff2df" stroke="#c9a87d" stroke-width="2"/>
      <path d="M218 180c32-16 62-18 92-6v30c-28-11-58-9-92 7z" fill="#f9ead8" stroke="#c9a87d" stroke-width="2"/>
      <ellipse cx="126" cy="129" rx="32" ry="11" fill="#f9c48b" stroke="#cf8d55" stroke-width="2"/>
      <path d="M94 129v56c0 8 14 15 32 15s32-7 32-15v-56" fill="#f3ae73" opacity=".55" stroke="#cf8d55" stroke-width="2"/>
      <path d="M126 116c8 13-2 23-6 26-6-8-2-18 6-26z" fill="#e97532"/>
      <path d="M244 182l60 16" stroke="#67432b" stroke-width="8" stroke-linecap="round"/>
      <path d="M243 179l61 16" stroke="#d9b187" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `;
}

function quoteArt() {
  return `
    <svg class="quote-art" viewBox="0 0 360 250" aria-hidden="true">
      <rect x="0" y="0" width="360" height="250" rx="10" fill="#fbf2e6"/>
      <text x="30" y="58" font-size="44" fill="#f0bb86" font-family="Georgia">“</text>
      <text x="52" y="92" font-size="18" fill="#3d2a1f" font-family="KaiTi, serif">真正的成长</text>
      <text x="52" y="126" font-size="18" fill="#3d2a1f" font-family="KaiTi, serif">不是变得完美</text>
      <text x="52" y="160" font-size="18" fill="#3d2a1f" font-family="KaiTi, serif">而是每次遇到问题</text>
      <text x="52" y="194" font-size="18" fill="#3d2a1f" font-family="KaiTi, serif">都有一点点进步</text>
      <g transform="translate(185 92)">
        <path d="M14 102h128" stroke="#d7b993" stroke-width="2" opacity=".55"/>
        <path d="M22 82c36-12 68-9 98 6v25c-31-13-62-17-98-6z" fill="#f9ead8" stroke="#c9a87d" stroke-width="2"/>
        <path d="M120 88c20-10 38-11 58-4v24c-18-7-37-5-58 5z" fill="#fff3df" stroke="#c9a87d" stroke-width="2"/>
        <path d="M108 35c-4 26-3 48 5 67" fill="none" stroke="#8d8151" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="98" cy="44" rx="6" ry="12" transform="rotate(-28 98 44)" fill="#c8b26c"/>
        <ellipse cx="118" cy="51" rx="6" ry="12" transform="rotate(31 118 51)" fill="#c8b26c"/>
        <ellipse cx="100" cy="66" rx="6" ry="12" transform="rotate(-28 100 66)" fill="#c8b26c"/>
        <path d="M91 92h45l-5 35H96z" fill="#f1e5d2" stroke="#c9a87d" stroke-width="2"/>
      </g>
    </svg>
  `;
}

function homePage() {
  const mode = state.mode;
  return shell(`
    <main class="home-page">
      <section class="hero">
        <div class="hero-copy">
          <h1>${modeLabel(mode)}，下一次会更好</h1>
          <div class="input-panel">
            ${reviewContextControls(mode)}
            ${structuredDraftForm(mode)}
            <div class="input-footer">
              <strong>${mode === "event" ? "先写清楚，再变成下次可用的行动卡" : "把担心拆成现实检查和可控行动"}</strong>
              <button class="ghost-button" data-home-ai ${state.loading ? "disabled" : ""}>${state.loading ? "生成中..." : "AI 复盘"}</button>
              <button class="primary-button" data-home-analyze>开始复盘</button>
            </div>
          </div>
        </div>
        ${deskPlantArt()}
      </section>
      <section class="dashboard-grid">
        ${recentPanel()}
        ${weekPanel()}
        ${inspirationPanel()}
      </section>
      <div class="footer-line"><span>复盘，是为了更好的下一次</span></div>
    </main>
  `);
}

function structuredDraftForm(mode) {
  const fields = currentDraftFields();
  const mainLabel = mode === "event" ? "发生了什么" : "我在担心什么";
  const mainPlaceholder = mode === "event"
    ? "把事情本身写清楚：背景、你做了什么、结果是什么。"
    : "把担心本身写清楚：你在担心什么，它从哪里开始。";
  const extraFields = mode === "event"
    ? [
        ["improvement", "需要改进的地方", "这次哪里可以做得更好？"],
        ["next", "下次怎么做", "一行一个动作，例如：先确认目标和边界"],
        ["reminder", "提醒自己", "写一句下次能提醒自己的话"],
      ]
    : [
        ["reality", "现实检查", "哪些证据支持/不支持这个担心？"],
        ["action", "我能做什么", "一行一个可控动作，例如：准备 3 个高频问题"],
        ["reminder", "提醒自己", "写一句能把自己拉回行动的话"],
      ];
  return `
    <div class="structured-draft">
      <label class="draft-field draft-field-main">
        <span>${mainLabel}</span>
        <textarea data-draft maxlength="1200" placeholder="${mainPlaceholder}">${escapeHtml(state.draft)}</textarea>
      </label>
      <div class="draft-field-grid">
        ${extraFields.map(([key, label, placeholder]) => `
          <label class="draft-field">
            <span>${label}</span>
            <textarea data-draft-field="${key}" maxlength="800" placeholder="${placeholder}">${escapeHtml(fields[key] || "")}</textarea>
          </label>
        `).join("")}
      </div>
      ${mode === "anxiety" ? `
        <label class="draft-field draft-date-field">
          <span>验证日期</span>
          <input type="date" data-draft-field="verificationDate" value="${escapeHtml(fields.verificationDate || "")}" />
        </label>
      ` : ""}
    </div>
  `;
}

function reviewContextControls(mode) {
  const sceneLabel = mode === "event" ? "主要场景" : "焦虑场景";
  return `
    <div class="review-context">
      <div class="context-group type-group">
        <span class="context-label">复盘类型</span>
        <div class="review-mode-row" role="tablist" aria-label="复盘类型">
          <button class="${mode === "event" ? "active" : ""}" data-mode="event" role="tab" aria-selected="${mode === "event"}">复盘一件事</button>
          <button class="${mode === "anxiety" ? "active" : ""}" data-mode="anxiety" role="tab" aria-selected="${mode === "anxiety"}">复盘一次焦虑</button>
        </div>
      </div>
      <div class="context-group scene-group">
        <span class="context-label">${sceneLabel}</span>
        <div class="chips context-chips">${scenes[mode].map((scene) => `<button class="chip ${state.scene === scene ? "selected" : ""}" data-scene="${scene}">${scene}</button>`).join("")}</div>
      </div>
    </div>
  `;
}

function recentPanel() {
  return `
    <article class="panel recent-panel">
      <div class="panel-head"><h2>最近复盘</h2><button data-tab="records">查看全部 ${icons.chevron}</button></div>
      <div class="recent-list">
        ${store.records.slice(0, 5).map((record, index) => `
          <button class="recent-item" data-detail="${record.id}">
            <span class="recent-icon tone-${index % 2}">${record.type === "event" ? icons.note : "❤"}</span>
            <span><strong>${record.title}</strong><small>${typeText(record.type)} · ${record.scene}</small></span>
            <em>${record.shortDate}</em>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function weekPanel() {
  const today = new Date();
  const todayKey = localDateKey(today);
  const weekStart = weekStartMonday(today);
  const weekKeys = new Set(Array.from({ length: 7 }, (_, index) => localDateKey(addDays(weekStart, index))));
  const recordCountByDate = store.records.reduce((counts, record) => {
    const key = recordDateKey(record);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const weekDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((label, index) => {
    const date = addDays(weekStart, index);
    const key = localDateKey(date);
    return {
      label,
      key,
      dateText: monthDay(date),
      count: recordCountByDate[key] || 0,
      isToday: key === todayKey,
    };
  });
  const weekRecordCountByDate = Object.fromEntries(Object.entries(recordCountByDate).filter(([key]) => weekKeys.has(key)));
  const reviewedDays = weekDays.filter((day) => day.count > 0).length;
  const weeklyRecordCount = Object.values(weekRecordCountByDate).reduce((total, count) => total + count, 0);
  const ringProgress = Math.round((reviewedDays / 7) * 100);
  const monthKey = state.calendarMonth;
  const monthDays = monthCalendarDays(monthKey);
  const weekSummary = `
    <div class="week-content">
      <div class="ring" style="--progress: ${ringProgress}%"><span>${reviewedDays}<small>/7</small></span></div>
      <ul class="week-days">
        ${weekDays.map((day) => `
          <li class="${day.count > 0 ? "done" : ""} ${day.isToday ? "today" : ""}">
            <span><b>${day.label}</b><small>${day.dateText}${day.isToday ? " · 今天" : ""}</small></span>
            <i>${day.count > 0 ? "✓" : ""}</i>
          </li>
        `).join("")}
      </ul>
    </div>
    <p>本周复盘 ${reviewedDays} 天<br />本周完成 ${weeklyRecordCount} 件复盘</p>
  `;
  const monthReview = `
    <div class="month-review in-panel">
      <div class="month-toolbar">
        <button class="month-arrow" data-month-shift="-1">${icons.back}</button>
        <select data-month-select aria-label="选择月份">
          ${monthOptions(monthKey).map((item) => `<option value="${item}" ${item === monthKey ? "selected" : ""}>${monthLabel(item)}</option>`).join("")}
        </select>
        <button class="month-arrow" data-month-shift="1">${icons.chevron}</button>
      </div>
      <div class="month-weekdays">${["一", "二", "三", "四", "五", "六", "日"].map((label) => `<span>${label}</span>`).join("")}</div>
      <div class="month-grid">
        ${monthDays.map((date) => {
          const key = localDateKey(date);
          const count = recordCountByDate[key] || 0;
          const outside = key.slice(0, 7) !== monthKey;
          return `<button class="month-day ${outside ? "outside" : ""} ${count ? "has-record" : ""} ${key === todayKey ? "today" : ""}" data-calendar-day="${key}">
            <span>${date.getDate()}</span>${count ? `<i>${count}</i>` : ""}
          </button>`;
        }).join("")}
      </div>
    </div>
  `;
  return `
    <article class="panel week-panel">
      <div class="panel-head week-head"><h2>${state.calendarExpanded ? "月历回顾" : "本周回顾"}</h2><button class="calendar-toggle ${state.calendarExpanded ? "open" : ""}" data-calendar-toggle>${state.calendarExpanded ? "本周" : "月历"} ${icons.chevron}</button></div>
      ${state.calendarExpanded ? monthReview : weekSummary}
    </article>
  `;
}

function inspirationPanel() {
  return `<article class="panel inspiration-panel"><h2>灵感卡片</h2>${quoteArt()}</article>`;
}

function pageHeader(title, back = "") {
  const backButton = back ? `<button class="back-button" data-route="${back}" aria-label="返回">${icons.back}</button>` : "";
  return `<div class="page-header">${backButton}<h1>${title}</h1></div>`;
}

function inputPage(mode) {
  const isEvent = mode === "event";
  const title = isEvent ? "把事情写下来" : "把焦虑写下来";
  const placeholder = isEvent ? "发生了什么？你做了什么？结果哪里不满意？" : "你在担心什么？它是怎么开始的？你最害怕发生什么？";
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader(title)}
      ${reviewContextControls(mode)}
      <textarea class="large-textarea" data-draft maxlength="2000" placeholder="${placeholder}">${escapeHtml(state.draft)}</textarea>
      <div class="textarea-count">${state.draft.length} / 2000</div>
      <div class="action-row">
        <button class="ghost-button" data-analyze ${state.loading ? "disabled" : ""}>${state.loading ? "生成中..." : "AI 复盘"}</button>
        <button class="primary-button" data-start-manual>开始复盘</button>
      </div>
    </main>
  `);
}

function flowTabs() {
  return `<div class="flow-tabs"><button class="${state.mode === "event" ? "active" : ""}" disabled>事件复盘</button><button class="${state.mode === "anxiety" ? "active" : ""}" disabled>焦虑复盘</button></div>`;
}

function summaryPage() {
  return resultPage();
}

function resultPage() {
  const record = currentRecord();
  const title = state.mode === "event" ? "行动卡" : "焦虑校准卡";
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader(title, "home")}
      ${fieldGrid(objectFields(record.resultCard, resultCards[state.mode].fields))}
      <div class="action-row wrap">
        <button class="ghost-button" data-follow-up="${record.id}" ${state.followUpLoading ? "disabled" : ""}>${state.followUpLoading ? "追问中..." : "继续追问"}</button>
        ${state.mode === "event"
          ? `<button class="primary-button" data-save-record-ask-method ${state.saving ? "disabled" : ""}>${state.saving ? "保存中..." : "保存记录"}</button>`
          : `<button class="primary-button" data-save-bundle="calibration" ${state.saving ? "disabled" : ""}>${state.saving ? "保存中..." : "保存记录"}</button>`}
      </div>
      ${state.followUp ? followUpPanel(state.followUp) : ""}
      ${state.saveDialogOpen ? saveMethodDialog() : ""}
    </main>
  `);
}

function saveMethodDialog() {
  return `
    <div class="modal-backdrop" role="presentation">
      <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="save-method-title">
        <div class="modal-mark">${icons.bookmark}</div>
        <h2 id="save-method-title">是否保存至方法库？</h2>
        <p>保存到方法库后，这张行动卡会出现在方法库里，方便下次遇到类似情况时复用。</p>
        <div class="modal-actions">
          <button class="secondary-button" data-skip-method-library>不保存</button>
          <button class="primary-button" data-save-record-method ${state.saving ? "disabled" : ""}>保存</button>
        </div>
      </section>
    </div>
  `;
}

function followUpPanel(followUp) {
  const data = followUp.follow_up || followUp;
  const warnings = followUp.warnings || [];
  return `
    <section class="follow-up-panel">
      <div class="panel-head"><h2>继续追问</h2>${warnings.length ? `<span>${escapeHtml(warnings[0])}</span>` : ""}</div>
      <article class="field-card">
        <h3>${escapeHtml(data.question || "下一步可以追问的问题")}</h3>
        <p>${escapeHtml(data.why || "")}</p>
        <p><strong>回答方式：</strong>${escapeHtml(data.suggested_answer_shape || "")}</p>
        <p><strong>下一步：</strong>${escapeHtml(data.next_action || "")}</p>
      </article>
    </section>
  `;
}

function fieldGrid(fields, numbered = false) {
  return `
    <div class="field-grid">
      ${fields.map(([label, value], index) => {
        const body = fieldBody(value);
        return `<article class="field-card">${numbered ? `<span class="number">${index + 1}</span>` : ""}<h3>${label}</h3>${body}</article>`;
      }).join("")}
    </div>
  `;
}

function sectionedFields(title, fields) {
  return fields.map(([label, value]) => [`${title} · ${label}`, value]);
}

function fieldBody(value) {
  if (Array.isArray(value)) {
    return `<ol>${value.map((item) => `<li>${escapeHtml(displayValue(item))}</li>`).join("")}</ol>`;
  }
  const text = displayValue(value);
  return text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function displayValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join("\n");
  if (typeof value !== "object") return String(value);
  return Object.entries(value)
    .map(([key, item]) => {
      const rendered = displayValue(item);
      return rendered ? `${key}: ${rendered}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function recordsPage() {
  const filters = ["全部", "焦虑", "工作", "学习", "面试", "人际", "决策", "健康", "未来", "生活", "其他"];
  const filtered = store.records.filter((record) => matchesFilter(record, state.filter) && matchesQuery([record.title, record.scene, record.conclusion]));
  return shell(`<main class="content-page"><h1 class="list-title">我的记录</h1>${filterRow(filters)}<div class="card-list">${filtered.map(recordCard).join("") || emptyState("没有找到匹配的记录")}</div></main>`);
}

function methodsPage() {
  if (state.editingMethodId) {
    const card = store.methods.find((item) => item.id === state.editingMethodId);
    if (card) {
      return shell(`
        <main class="content-page narrow-page">
          <h1 class="list-title">编辑方法卡</h1>
          ${methodEditCard(card)}
        </main>
      `);
    }
  }
  const filters = ["全部", ...fixedSceneTags()];
  const filtered = store.methods.filter((card) => (state.filter === "全部" || card.scenes.includes(state.filter)) && matchesQuery([card.title, card.trigger, methodSourceLabel(card.source)]));
  return shell(`<main class="content-page"><h1 class="list-title">方法库</h1>${filterRow(filters)}<div class="method-grid">${filtered.map(methodCard).join("") || emptyState("没有找到匹配的方法卡")}</div></main>`);
}

function calibrationPage() {
  const filters = ["全部", "工作", "学习", "面试", "人际", "决策", "生活", "其他", "健康", "未来"];
  const activeFilter = filters.includes(state.filter) ? state.filter : "全部";
  const cards = calibrationCardsForPage().filter((card) => (
    card.status === state.calibrationTab
    && (activeFilter === "全部" || card.scene === activeFilter)
    && matchesQuery([card.worry, card.scene, card.calibrationConclusion])
  ));
  return shell(`
    <main class="content-page">
      <h1 class="list-title">焦虑校准</h1>
      <div class="flow-tabs small-tabs"><button class="${state.calibrationTab === "pending" ? "active" : ""}" data-cal-tab="pending">待验证</button><button class="${state.calibrationTab === "verified" ? "active" : ""}" data-cal-tab="verified">已验证</button></div>
      ${filterRow(filters, activeFilter)}
      <div class="card-list">${cards.map(calibrationCard).join("") || emptyState("没有找到匹配的校准卡")}</div>
    </main>
  `);
}

function searchPage() {
  const query = state.query.trim();
  const records = query ? store.records.filter((record) => matchesQuery(searchRecordValues(record))) : [];
  const methods = query ? store.methods.filter((card) => matchesQuery(searchMethodValues(card))) : [];
  const calibrations = query ? store.calibrations.filter((card) => matchesQuery(searchCalibrationValues(card))) : [];
  const total = records.length + methods.length + calibrations.length;
  const emptyText = query ? "没有找到匹配的内容" : "输入关键词后按 Enter 搜索";

  return shell(`
    <main class="content-page">
      <h1 class="list-title">搜索结果</h1>
      ${query ? `<p class="record-meta">找到 ${total} 条与「${escapeHtml(query)}」相关的内容</p>` : ""}
      ${total ? `
        ${records.length ? `<section class="search-section"><h2>复盘记录</h2><div class="card-list">${records.map(recordCard).join("")}</div></section>` : ""}
        ${methods.length ? `<section class="search-section"><h2>方法卡</h2><div class="method-grid">${methods.map(methodCard).join("")}</div></section>` : ""}
        ${calibrations.length ? `<section class="search-section"><h2>校准卡</h2><div class="card-list">${calibrations.map(calibrationCard).join("")}</div></section>` : ""}
      ` : emptyState(emptyText)}
    </main>
  `);
}

function detailPage() {
  const record = store.records.find((item) => item.id === state.selectedRecordId) || store.records[0];
  const mode = record.type;
  if (state.editingRecordId === record.id) return detailEditPage(record);
  const titleParts = splitDetailTitle(record.title);
  return shell(`
    <main class="content-page detail-page">
      ${pageHeader("详情", "records")}
      <section class="detail-hero">
        <div class="detail-hero-title">
          <h1>${escapeHtml(titleParts.main)}</h1>
          ${titleParts.aside ? `<b>${escapeHtml(titleParts.aside)}</b>` : ""}
        </div>
        <p><span>${escapeHtml(record.scene)}</span><span>${displayDate(record.date, { full: true })}</span></p>
      </section>
      ${fieldGrid([
        ["原始输入", record.rawInput],
        ...detailHighlights(record, mode),
      ])}
      <div class="action-row wrap">
        <button class="ghost-button" data-edit-record="${record.id}">编辑复盘内容</button>
        <button class="ghost-button" data-reanalyze="${record.id}">重新分析</button>
        <button class="danger-button" data-delete-record="${record.id}">删除</button>
      </div>
    </main>
  `);
}

function splitDetailTitle(title) {
  const parts = String(title || "").split(/\s*[|｜]\s*/).filter(Boolean);
  return {
    main: parts[0] || title || "",
    aside: parts.slice(1).join(" | "),
  };
}

function detailHighlights(record, mode) {
  const summary = objectFields(record.summary, summaryTemplates[mode]);
  const resultCard = objectFields(record.resultCard, resultCards[mode].fields);
  const cardTitle = mode === "event" ? "行动卡" : "校准卡";
  if (mode === "event") {
    return [
      ...sectionedFields(cardTitle, [
        ...selectEditFields(summary, ["发生了什么", "需要改进的地方"]),
        ...selectEditFields(resultCard, ["下次怎么做", "提醒自己"]),
      ]),
    ];
  }
  return [
    ...sectionedFields(cardTitle, [
      ...selectEditFields(summary, ["我在担心什么", "现实检查"]),
      ...selectEditFields(resultCard, ["我能做什么", "提醒自己"]),
    ]),
  ];
}

function flowEditPage(record) {
  const mode = record.type;
  const compact = compactEditFields(record, mode);
  return shell(`
    <main class="content-page narrow-page">
      <div class="page-header"><h1>修改复盘内容</h1></div>
      ${flowTabs()}
      <section class="detail-hero detail-editor" data-record-editor="${record.id}">
        <label>标题<input data-record-title value="${escapeHtml(record.title)}" /></label>
        <label>场景${sceneSelect(record.scene, mode)}</label>
        <label>原始输入<textarea data-record-raw>${escapeHtml(record.rawInput)}</textarea></label>
        ${mergedEditableSection(mode === "event" ? "行动卡" : "校准卡", [
          ["summary", compact.summary],
          ["resultCard", compact.resultCard],
        ])}
      </section>
      <div class="action-row wrap">
        <button class="primary-button" data-save-record="${record.id}">保存修改</button>
        <button class="ghost-button" data-cancel-record-edit>取消</button>
      </div>
    </main>
  `);
}

function detailEditPage(record) {
  const mode = record.type;
  const compact = compactEditFields(record, mode);
  return shell(`
    <main class="content-page detail-page record-edit-page">
      ${pageHeader("编辑详情", "records")}
      <section class="detail-hero detail-editor" data-record-editor="${record.id}">
        <label>标题<input data-record-title value="${escapeHtml(record.title)}" /></label>
        <label>场景${sceneSelect(record.scene, mode)}</label>
        <label>原始输入<textarea data-record-raw>${escapeHtml(record.rawInput)}</textarea></label>
        ${mergedEditableSection(mode === "event" ? "行动卡" : "校准卡", [
          ["summary", compact.summary],
          ["resultCard", compact.resultCard],
        ])}
      </section>
      <div class="action-row wrap">
        <button class="primary-button" data-save-record="${record.id}">保存</button>
        <button class="ghost-button" data-cancel-record-edit>取消</button>
      </div>
    </main>
  `);
}

function compactEditFields(record, mode) {
  const summary = editableFields(record.summary, summaryTemplates[mode]);
  const resultCard = editableFields(record.resultCard, resultCards[mode].fields);
  if (mode === "event") {
    return {
      summary: selectEditFields(summary, ["发生了什么", "需要改进的地方"]),
      resultCard: selectEditFields(resultCard, ["下次怎么做", "提醒自己"]),
    };
  }
  return {
    summary: selectEditFields(summary, ["我在担心什么", "现实检查"]),
    resultCard: selectEditFields(resultCard, ["我能做什么", "提醒自己"]),
  };
}

function selectEditFields(fields, preferredLabels) {
  const selected = [];
  preferredLabels.forEach((preferred) => {
    const found = fields.find(([label]) => label === preferred || label.includes(preferred));
    if (found && !selected.some(([label]) => label === found[0])) selected.push(found);
  });
  return selected.length ? selected : fields.slice(0, Math.min(2, fields.length));
}

function editableSection(section, title, fields) {
  return `
    <fieldset class="edit-fieldset">
      <legend>${title}</legend>
      ${editableControls(section, fields)}
    </fieldset>
  `;
}

function mergedEditableSection(title, groups) {
  return `
    <fieldset class="edit-fieldset">
      <legend>${title}</legend>
      ${groups.map(([section, fields]) => editableControls(section, fields)).join("")}
    </fieldset>
  `;
}

function editableControls(section, fields) {
  return fields.map(([label, value], index) => `
    <label>${escapeHtml(label)}
      <textarea data-record-field data-section="${section}" data-label="${escapeHtml(label)}" data-index="${index}">${escapeHtml(Array.isArray(value) ? value.join("\n") : value)}</textarea>
    </label>
  `).join("");
}

function filterRow(filters, selected = state.filter) {
  return `<div class="filters">${filters.map((item) => `<button class="chip ${selected === item ? "selected" : ""}" data-filter="${item}">${item}</button>`).join("")}</div>`;
}

function recordCard(record) {
  const mode = record.type;
  const previewFields = recordPreviewFields(record, mode);
  return `
    <article class="list-card record-list-card" data-detail="${record.id}">
      <div class="card-title-row">
        <div class="record-title-stack"><h3>${escapeHtml(record.title)}</h3><p class="record-meta">${escapeHtml(record.scene)} · ${displayDate(record.date, { full: true })}</p></div>
        <button class="text-button danger-text" data-delete-record="${record.id}">删除</button>
      </div>
      <div class="record-preview">
        ${previewFields.map(([label, value]) => `
          <section class="record-preview-item">
            <h4>${escapeHtml(label)}</h4>
            ${fieldBody(value)}
          </section>
        `).join("")}
      </div>
      <span>${record.status}</span>
    </article>
  `;
}

function recordPreviewFields(record, mode) {
  const summary = objectFields(record.summary, summaryTemplates[mode]);
  const resultCard = objectFields(record.resultCard, resultCards[mode].fields);
  if (mode === "event") {
    return [
      ...selectEditFields(summary, ["需要改进的地方"]),
      ...selectEditFields(resultCard, ["下次怎么做", "提醒自己"]),
    ];
  }
  return [
    ...selectEditFields(summary, ["现实检查"]),
    ...selectEditFields(resultCard, ["我能做什么", "提醒自己"]),
  ];
}

function methodCard(card) {
  const source = methodSourceLabel(card.source);
  return `
    <article class="list-card method-card" data-edit-method="${card.id}" tabindex="0" title="点击编辑">
      <div class="card-title-row">
        <h3>${escapeHtml(card.title)}</h3>
        <div class="inline-actions">
          <button class="text-button danger-text" data-delete-method="${card.id}">删除</button>
        </div>
      </div>
      <div class="method-tags">${card.scenes.map((scene) => `<span>${escapeHtml(scene)}</span>`).join("")}</div>
      <strong>触发条件：${escapeHtml(card.trigger)}</strong>
      <ol>${card.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      ${source ? `<p>来自：${escapeHtml(source)}</p>` : ""}
    </article>
  `;
}

function methodEditCard(card) {
  return `
    <article class="list-card method-card method-editor" data-method-editor="${card.id}">
      <label>方法名<input data-method-title value="${escapeHtml(card.title)}" /></label>
      <label>标签${methodSceneSelect(card)}</label>
      <label>触发条件<textarea data-method-trigger>${escapeHtml(card.trigger)}</textarea></label>
      <label>行动步骤<textarea data-method-steps>${escapeHtml(card.steps.join("\n"))}</textarea></label>
      <div class="action-row compact">
        <button class="primary-button" data-save-method="${card.id}">保存</button>
        <button class="ghost-button" data-cancel-method-edit>取消</button>
      </div>
    </article>
  `;
}

function calibrationCard(card) {
  if (state.editingCalibrationId === card.id) return calibrationEditCard(card);
  const verified = card.status === "verified";
  return `
    <article class="list-card calibration-card" data-edit-calibration="${card.id}" tabindex="0" title="点击编辑">
      <div class="card-title-row">
        <h3>${escapeHtml(card.worry)}</h3>
        <div class="inline-actions">
          <button class="text-button danger-text" data-delete-calibration="${card.id}">删除</button>
        </div>
      </div>
      <p>${escapeHtml(card.scene)} · 当时预计概率：${escapeHtml(card.estimatedProbability)}</p>
      <strong>${verified ? `最终是否发生：${escapeHtml(card.finalResult)}` : `验证日期：${card.verificationDate || "未设置"}`}</strong>
      ${verified ? `<p>实际影响：${escapeHtml(card.actualImpact)}</p><p>${escapeHtml(card.calibrationConclusion)}</p>` : `<span>待验证</span>`}
    </article>
  `;
}

function calibrationEditCard(card) {
  return `
    <article class="list-card calibration-card method-editor" data-calibration-editor="${card.id}">
      <label>担心内容<textarea data-calibration-worry>${escapeHtml(card.worry)}</textarea></label>
      <label>场景<input data-calibration-scene value="${escapeHtml(card.scene)}" /></label>
      <label>当时预计概率<input data-calibration-probability value="${escapeHtml(card.estimatedProbability)}" /></label>
      <label>验证日期<input type="date" data-calibration-date value="${escapeHtml(card.verificationDate)}" /></label>
      <label>状态
        <select data-calibration-status>
          <option value="pending" ${card.status === "pending" ? "selected" : ""}>待验证</option>
          <option value="verified" ${card.status === "verified" ? "selected" : ""}>已验证</option>
        </select>
      </label>
      <label>最终是否发生<textarea data-calibration-final>${escapeHtml(card.finalResult)}</textarea></label>
      <label>实际影响<input data-calibration-impact value="${escapeHtml(card.actualImpact)}" /></label>
      <label>校准结论<textarea data-calibration-conclusion>${escapeHtml(card.calibrationConclusion)}</textarea></label>
      <div class="action-row compact">
        <button class="primary-button" data-save-calibration="${card.id}">保存</button>
        <button class="ghost-button" data-cancel-calibration-edit>取消</button>
      </div>
    </article>
  `;
}

function matchesFilter(record, filter) {
  if (filter === "全部") return true;
  if (filter === "事件") return record.type === "event";
  if (filter === "焦虑") return record.type === "anxiety";
  return record.scene === filter;
}

function matchesQuery(values) {
  if (!state.query.trim()) return true;
  const query = state.query.trim().toLowerCase();
  return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
}

function searchRecordValues(record) {
  return [
    record.title,
    record.scene,
    record.rawInput,
    record.conclusion,
    record.note,
    ...flattenSearchValues(record.summary),
    ...flattenSearchValues(record.resultCard),
  ];
}

function searchMethodValues(card) {
  return [
    card.title,
    card.trigger,
    card.reminder,
    methodSourceLabel(card.source),
    ...flattenSearchValues(card.scenes),
    ...flattenSearchValues(card.steps),
  ];
}

function searchCalibrationValues(card) {
  return [
    card.worry,
    card.scene,
    card.estimatedProbability,
    card.finalResult,
    card.actualImpact,
    card.calibrationConclusion,
    card.verificationDate,
  ];
}

function flattenSearchValues(value) {
  if (Array.isArray(value)) return value.flatMap(flattenSearchValues);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [key, ...flattenSearchValues(item)]);
  }
  return value === undefined || value === null ? [] : [value];
}

function emptyState(text) {
  return `<article class="list-card"><h3>${text}</h3><p>可以换一个筛选条件，或从首页开始一次新的复盘。</p></article>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ensureRuntimeStyles() {
  if (document.getElementById("runtime-notification-styles")) return;
  const style = document.createElement("style");
  style.id = "runtime-notification-styles";
  style.textContent = `
    .notification-wrap { position: relative !important; display: grid !important; place-items: center !important; }
    .notification-panel {
      position: fixed !important;
      top: 72px !important;
      right: 178px !important;
      z-index: 999 !important;
      width: 286px !important;
      padding: 14px !important;
      border: 1px solid oklch(0.874 0.026 76) !important;
      border-radius: 8px !important;
      background: #fffbf6 !important;
      box-shadow: 0 14px 36px oklch(0.34 0.044 55 / 0.09) !important;
      color: oklch(0.214 0.025 58) !important;
      text-align: left !important;
    }
    .notification-title { margin: 0 0 10px !important; font-size: 16px !important; font-weight: 800 !important; line-height: 1.4 !important; }
    .notification-panel p { margin: 0 !important; color: oklch(0.482 0.035 62) !important; font-size: 13px !important; line-height: 1.6 !important; }
    .notification-item {
      width: 100% !important;
      display: grid !important;
      gap: 5px !important;
      padding: 10px !important;
      border-radius: 8px !important;
      background: transparent !important;
      color: inherit !important;
      text-align: left !important;
    }
    .notification-item:hover, .notification-item:focus-visible { background: oklch(0.944 0.043 58) !important; }
    .notification-item strong { font-size: 14px !important; line-height: 1.4 !important; }
    .notification-item span, .notification-item small { color: oklch(0.482 0.035 62) !important; font-size: 12px !important; line-height: 1.5 !important; }
  `;
  document.head.appendChild(style);
}

function render() {
  ensureRuntimeStyles();
  if (!state.authToken) {
    app.classList.add("auth-shell");
    app.innerHTML = authPage();
    return;
  }
  app.classList.remove("auth-shell");
  const workspace = app.querySelector(".workspace");
  const scrollTop = workspace ? workspace.scrollTop : 0;
  const activeElement = document.activeElement;
  const activeField = activeElement?.matches?.("[data-search]") ? "search" : "";
  const activeSelectionStart = activeElement?.selectionStart ?? null;
  const activeSelectionEnd = activeElement?.selectionEnd ?? null;
  const routes = {
    home: homePage,
    eventInput: () => inputPage("event"),
    anxietyInput: () => inputPage("anxiety"),
    summary: summaryPage,
    result: resultPage,
    records: recordsPage,
    methods: methodsPage,
    calibration: calibrationPage,
    search: searchPage,
    detail: detailPage,
  };
  app.innerHTML = routes[state.route]();
  const nextWorkspace = app.querySelector(".workspace");
  if (nextWorkspace) nextWorkspace.scrollTop = scrollTop;
  if (activeField === "search") {
    const nextSearch = app.querySelector("[data-search]");
    if (nextSearch) {
      nextSearch.focus();
      if (activeSelectionStart !== null && activeSelectionEnd !== null) {
        nextSearch.setSelectionRange(activeSelectionStart, activeSelectionEnd);
      }
    }
  }
}

function submitSearch(value = state.query) {
  state.query = value.trim();
  setState(clearEditingState({ route: "search" }));
}

async function saveMethodCard(id) {
  const editor = app.querySelector(`[data-method-editor="${id}"]`);
  const card = store.methods.find((item) => item.id === id);
  if (!editor || !card) return;

  const title = editor.querySelector("[data-method-title]").value.trim();
  const trigger = editor.querySelector("[data-method-trigger]").value.trim();
  const steps = editor.querySelector("[data-method-steps]").value
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean);
  const selectedScene = editor.querySelector("[data-method-scene]").value;
  const scene = fixedSceneTags().includes(selectedScene) ? selectedScene : "其他";

  Object.assign(card, {
    title: title || card.title,
    scenes: [scene],
    trigger: trigger || card.trigger,
    steps: steps.length ? steps : card.steps,
    updatedAt: localDateTimeKey(),
  });
  try {
    const saved = await request(`/methods/${id}`, {
      method: "PUT",
      body: JSON.stringify(methodPayload(card)),
    });
    Object.assign(card, normalizeMethod(saved));
    state.apiOnline = true;
    notify("方法卡已保存");
  } catch (error) {
    if (handleAuthError(error)) return;
    state.apiOnline = false;
    notify("方法卡暂时只保存在当前页面");
  }
  setState({ editingMethodId: null });
}

async function saveRecord(id) {
  const editor = app.querySelector(`[data-record-editor="${id}"]`);
  const record = store.records.find((item) => item.id === id) || (state.currentBundle?.record?.id === id ? state.currentBundle.record : null);
  if (!editor || !record) return;

  const oldTitle = record.title;
  const oldScene = record.scene;
  const oldRawInput = record.rawInput;
  const title = editor.querySelector("[data-record-title]").value.trim() || record.title;
  const scene = editor.querySelector("[data-record-scene]").value.trim() || record.scene;
  const rawInput = editor.querySelector("[data-record-raw]").value.trim();
  const noteInput = editor.querySelector("[data-record-note]");
  const note = noteInput ? noteInput.value.trim() : record.note || "";

  syncFieldValue(oldTitle, title);
  syncFieldValue(oldScene, scene);
  syncFieldValue(oldRawInput, rawInput);

  record.title = title;
  record.scene = scene;
  record.rawInput = rawInput;
  record.note = note;
  record.updatedAt = localDateTimeKey();

  editor.querySelectorAll("[data-record-field]").forEach((field) => {
    const section = field.dataset.section;
    const label = field.dataset.label;
    const target = record[section] || {};
    const original = target[label];
    const next = parseEditableValue(field.value, original);
    syncFieldValue(original, next);
    target[label] = next;
    record[section] = target;
  });

  record.conclusion = firstValue(record.resultCard) || record.conclusion;
  try {
    const saved = await request(`/reviews/${id}`, {
      method: "PUT",
      body: JSON.stringify(recordPayload(record)),
    });
    Object.assign(record, normalizeRecord(saved));
    state.apiOnline = true;
    notify("复盘内容已保存");
  } catch (error) {
    if (handleAuthError(error)) return;
    state.apiOnline = false;
    notify("复盘内容暂时只保存在当前页面");
  }
  if (state.currentBundle?.record?.id === record.id) state.currentBundle.record = record;
  setState({ editingRecordId: null });
}

async function saveCalibration(id) {
  const editor = app.querySelector(`[data-calibration-editor="${id}"]`);
  const card = store.calibrations.find((item) => item.id === id);
  if (!editor || !card) return;

  const updates = {
    worry: editor.querySelector("[data-calibration-worry]").value.trim(),
    scene: editor.querySelector("[data-calibration-scene]").value.trim(),
    estimatedProbability: editor.querySelector("[data-calibration-probability]").value.trim(),
    verificationDate: editor.querySelector("[data-calibration-date]").value,
    status: editor.querySelector("[data-calibration-status]").value,
    finalResult: editor.querySelector("[data-calibration-final]").value.trim(),
    actualImpact: editor.querySelector("[data-calibration-impact]").value.trim(),
    calibrationConclusion: editor.querySelector("[data-calibration-conclusion]").value.trim(),
  };

  Object.entries(updates).forEach(([key, value]) => syncFieldValue(card[key], value));
  Object.assign(card, updates);
  try {
    const saved = await request(`/calibrations/${id}`, {
      method: "PUT",
      body: JSON.stringify(calibrationPayload(card)),
    });
    Object.assign(card, normalizeCalibration(saved));
    state.apiOnline = true;
    notify("校准卡已保存");
  } catch (error) {
    if (handleAuthError(error)) return;
    state.apiOnline = false;
    notify("校准卡暂时只保存在当前页面");
  }
  setState({ editingCalibrationId: null });
}

function localDeleteRecord(id) {
  const deletedRecord = store.records.find((item) => item.id === id);
  store.records = store.records.filter((item) => item.id !== id);
  store.methods = store.methods.filter((item) => item.sourceReviewId !== id && item.source !== id);
  store.calibrations = store.calibrations.filter((item) => (
    item.sourceReviewId !== id
    && (!deletedRecord || !calibrationMatchesRecord(item, deletedRecord, item.id))
  ));
  if (state.selectedRecordId === id) state.selectedRecordId = store.records[0]?.id || "";
  if (state.currentBundle?.record?.id === id) state.currentBundle = null;
}

function localDeleteMethod(id) {
  store.methods = store.methods.filter((item) => item.id !== id);
  if (state.editingMethodId === id) state.editingMethodId = null;
}

function localDeleteCalibration(id) {
  const deletedCard = store.calibrations.find((item) => item.id === id) || {};
  const sourceReviewId = deletedCard.sourceReviewId || String(id || "").replace(/^derived-calibration-/, "");
  const sourceRecord = findRecordForCalibration(deletedCard, id);
  if (sourceRecord) {
    localDeleteRecord(sourceRecord.id);
  } else {
    store.calibrations = store.calibrations.filter((item) => item.id !== id && item.sourceReviewId !== sourceReviewId);
  }
  if (state.editingCalibrationId === id) state.editingCalibrationId = null;
}

async function deleteResource(kind, id) {
  const linkedRecord = kind === "calibration"
    ? findRecordForCalibration(store.calibrations.find((item) => item.id === id) || {}, id)
    : null;
  const pathByKind = {
    record: `/reviews/${id}`,
    method: `/methods/${id}`,
    calibration: `/calibrations/${id}`,
  };
  const localDeleteByKind = {
    record: localDeleteRecord,
    method: localDeleteMethod,
    calibration: localDeleteCalibration,
  };
  try {
    await request(pathByKind[kind], { method: "DELETE" });
    if (kind === "calibration" && linkedRecord?.id) {
      await request(`/reviews/${linkedRecord.id}`, { method: "DELETE" });
    }
    state.apiOnline = true;
  } catch (error) {
    if (handleAuthError(error)) return;
    state.apiOnline = false;
  }
  localDeleteByKind[kind](id);
  const route = kind === "record" ? "records" : kind === "method" ? "methods" : "calibration";
  const tab = kind === "record" ? "records" : kind === "method" ? "methods" : "calibration";
  setState({ route, tab });
  notify(kind === "record" ? "记录已删除" : kind === "method" ? "方法卡已删除" : "校准卡和对应记录已删除");
}

async function requestFollowUp(reviewId) {
  if (!reviewId) return;
  setState({ followUpLoading: true });
  try {
    const response = await request(`/reviews/${reviewId}/follow-up`, {
      method: "POST",
      body: JSON.stringify({ stage: state.route, question: "" }),
    });
    setState({ followUp: response, followUpLoading: false, apiOnline: true });
    const warnings = response.warnings || [];
    notify(warnings.length ? warnings[0] : "已生成继续追问");
  } catch (error) {
    if (handleAuthError(error)) return;
    const record = currentRecord();
    const fallback = buildLocalFollowUp(record);
    setState({ followUp: fallback, followUpLoading: false, apiOnline: false });
    notify("后端未连接，已用本地追问继续");
  }
}

function buildLocalFollowUp(record) {
  if (record.type === "anxiety") {
    return {
      follow_up: {
        question: "这件事里，你现在能控制的最小一步是什么？",
        why: "把焦虑拆成可控动作后，校准卡才会更容易验证。",
        suggested_answer_shape: "写一个 30 分钟内能完成的动作，包含完成标准。",
        next_action: "完成这个动作后，再回来更新校准卡。",
      },
      warnings: ["本地追问建议"],
    };
  }
  return {
    follow_up: {
      question: "如果回到事情开始前，你最应该提前确认哪一个信息？",
      why: "这能把复盘从解释问题，推进到下次可复用的方法。",
      suggested_answer_shape: "写出具体问题、应该问谁、确认清楚的标准。",
      next_action: "把这个确认动作加入方法卡。",
    },
    warnings: ["本地追问建议"],
  };
}

app.addEventListener("click", async (event) => {
  const notificationArea = event.target.closest(".notification-wrap");
  if (state.notificationsOpen && !notificationArea) {
    setState({ notificationsOpen: false });
  }

  const target = event.target.closest("button, article[data-detail], article[data-edit-method], article[data-edit-calibration]");
  if (!target) {
    if (state.notificationsOpen && notificationArea) setState({ notificationsOpen: false });
    return;
  }

  if (target.dataset.authMode) {
    setState({ authMode: target.dataset.authMode });
    return;
  }

  if (target.dataset.logout !== undefined) {
    clearAuthSession();
    notify("已退出登录");
    return;
  }

  if (target.dataset.notifications !== undefined) {
    if (!notificationItems().length) {
      setState({ notificationsOpen: false });
      notify("暂无新的提醒");
      return;
    }
    setState({ notificationsOpen: !state.notificationsOpen });
    return;
  }

  if (target.dataset.openCalibration) {
    setState({
      notificationsOpen: false,
      route: "calibration",
      tab: "calibration",
      calibrationTab: "pending",
      editingCalibrationId: target.dataset.openCalibration,
    });
    return;
  }

  if (target.dataset.toast) {
    notify(target.dataset.toast);
  }

  if (target.dataset.searchSubmit !== undefined) {
    submitSearch(app.querySelector("[data-search]")?.value || "");
    return;
  }

  if (target.dataset.homeAnalyze !== undefined) {
    startManualReview();
    return;
  }

  if (target.dataset.startManual !== undefined) {
    startManualReview();
    return;
  }

  if (target.dataset.homeAi !== undefined) {
    analyzeDraft();
    return;
  }

  if (target.dataset.analyze !== undefined) {
    analyzeDraft();
    return;
  }

  if (target.dataset.editMethod) {
    setState({ editingMethodId: target.dataset.editMethod, tab: "methods", route: "methods" });
    return;
  }

  if (target.dataset.saveMethod) {
    await saveMethodCard(target.dataset.saveMethod);
    return;
  }

  if (target.dataset.saveRecord) {
    await saveRecord(target.dataset.saveRecord);
    return;
  }

  if (target.dataset.saveCalibration) {
    await saveCalibration(target.dataset.saveCalibration);
    return;
  }

  if (target.dataset.saveRecordAskMethod !== undefined) {
    await persistCurrentBundle("records", { askMethodLibrary: true });
    return;
  }

  if (target.dataset.skipMethodLibrary !== undefined) {
    setState({ saveDialogOpen: false, route: "records", tab: "records" });
    return;
  }

  if (target.dataset.saveRecordMethod !== undefined) {
    await persistCurrentBundle("methods");
    return;
  }

  if (target.dataset.saveBundle) {
    await persistCurrentBundle(target.dataset.saveBundle);
    return;
  }

  if (target.dataset.followUp) {
    requestFollowUp(target.dataset.followUp);
    return;
  }

  if (target.dataset.cancelMethodEdit !== undefined) {
    setState({ editingMethodId: null });
    return;
  }

  if (target.dataset.cancelRecordEdit !== undefined) {
    setState({ editingRecordId: null });
    return;
  }

  if (target.dataset.cancelCalibrationEdit !== undefined) {
    setState({ editingCalibrationId: null });
    return;
  }

  if (target.dataset.editRecord) {
    setState({ editingRecordId: target.dataset.editRecord });
    return;
  }

  if (target.dataset.editRecordMethod) {
    const record = store.records.find((item) => item.id === target.dataset.editRecordMethod);
    if (record) {
      const method = findMethodForRecord(record) || createMethodFromRecord(record);
      setState({ editingMethodId: method.id, route: "methods", tab: "methods", filter: "全部" });
      notify("已打开对应方法卡");
    }
    return;
  }

  if (target.dataset.editCalibration) {
    setState({ editingCalibrationId: target.dataset.editCalibration });
    return;
  }

  if (target.dataset.deleteRecord) {
    await deleteResource("record", target.dataset.deleteRecord);
    return;
  }

  if (target.dataset.deleteMethod) {
    await deleteResource("method", target.dataset.deleteMethod);
    return;
  }

  if (target.dataset.deleteCalibration) {
    await deleteResource("calibration", target.dataset.deleteCalibration);
    return;
  }

  if (target.dataset.reanalyze) {
    const record = store.records.find((item) => item.id === target.dataset.reanalyze);
    if (record) {
      state.mode = record.type;
      state.scene = record.scene;
      state.draft = record.rawInput;
      analyzeDraft();
    }
    return;
  }

  if (target.dataset.mode) {
    const mode = target.dataset.mode;
    const nextScene = scenes[mode].includes(state.scene) ? state.scene : scenes[mode][0];
    setState({ mode, scene: nextScene, tab: "review" });
    return;
  }

  if (target.dataset.route) {
    const tabByRoute = { home: "review", records: "records", methods: "methods", calibration: "calibration" };
    setState(clearEditingState({ route: target.dataset.route, tab: tabByRoute[target.dataset.route] || state.tab }));
    return;
  }

  if (target.dataset.tab) {
    const tab = target.dataset.tab;
    const routeByTab = { review: "home", records: "records", methods: "methods", calibration: "calibration" };
    setState(clearEditingState({ tab, route: routeByTab[tab], filter: "全部" }));
    return;
  }

  if (target.dataset.scene) {
    setState({ scene: target.dataset.scene });
    return;
  }

  if (target.dataset.filter) {
    setState({ filter: target.dataset.filter });
    return;
  }

  if (target.dataset.calTab) {
    setState({ calibrationTab: target.dataset.calTab });
    return;
  }

  if (target.dataset.calendarToggle !== undefined) {
    setState({ calendarExpanded: !state.calendarExpanded });
    return;
  }

  if (target.dataset.monthShift) {
    setState({ calendarMonth: shiftMonth(state.calendarMonth, Number(target.dataset.monthShift)), calendarExpanded: true });
    return;
  }

  if (target.dataset.calendarDay) {
    const record = store.records.find((item) => recordDateKey(item) === target.dataset.calendarDay);
    if (record) setState({ selectedRecordId: record.id, route: "detail" });
    return;
  }

  if (target.dataset.detail) {
    setState({ selectedRecordId: target.dataset.detail, route: "detail" });
  }
});

app.addEventListener("submit", async (event) => {
  if (!event.target.matches("[data-auth-form]")) return;
  event.preventDefault();
  await submitAuthForm(event.target);
});

app.addEventListener("keydown", (event) => {
  if (event.isComposing || event.keyCode === 229) return;

  const authForm = event.target.closest?.("[data-auth-form]");
  if (authForm && event.key === "Enter" && event.target.matches("input")) {
    event.preventDefault();
    authForm.requestSubmit();
    return;
  }

  if (event.target.matches("[data-search]") && event.key === "Enter") {
    event.preventDefault();
    submitSearch(event.target.value);
    return;
  }

  if (event.target.closest("button, input, textarea, select")) return;
  const target = event.target.closest("article[data-edit-method], article[data-edit-calibration]");
  if (!target || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  if (target.dataset.editMethod) {
    setState({ editingMethodId: target.dataset.editMethod, tab: "methods", route: "methods" });
    return;
  }
  setState({ editingCalibrationId: target.dataset.editCalibration });
});

app.addEventListener("input", (event) => {
  if (event.target.matches("[data-draft]")) {
    state.draft = event.target.value;
    const count = app.querySelector(".textarea-count");
    if (count) count.textContent = `${state.draft.length} / 2000`;
  }

  if (event.target.matches("[data-draft-field]")) {
    state.draftFields[state.mode][event.target.dataset.draftField] = event.target.value;
  }

  if (event.target.matches("[data-search]")) {
    state.query = event.target.value;
    if (state.searchComposing) return;
    render();
  }

  if (event.target.matches("[data-month-select]")) {
    state.calendarMonth = event.target.value;
    render();
  }
});

app.addEventListener("compositionstart", (event) => {
  if (event.target.matches("[data-search]")) {
    state.searchComposing = true;
  }
});

app.addEventListener("compositionend", (event) => {
  if (event.target.matches("[data-search]")) {
    state.searchComposing = false;
    state.query = event.target.value;
    render();
  }
});

render();
hydrateFromBackend();
