const {
  calibrationCards: fallbackCalibrationCards,
  deepReviewTemplates,
  methodCards: fallbackMethodCards,
  resultCards,
  reviewRecords: fallbackReviewRecords,
  scenes,
  summaryTemplates,
} = window.REVIEW_DATA;

const API_BASE = localStorage.getItem("review_api_base") || "http://127.0.0.1:8000/api";
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
  followUpLoading: false,
  apiOnline: false,
  toast: "",
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

function setState(next) {
  Object.assign(state, next);
  render();
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
  return state.apiOnline ? "后端已连接" : "后端未启动，当前使用本地 fallback";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || "请求失败");
  }
  return payload.data;
}

async function hydrateFromBackend() {
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
    state.apiOnline = false;
    render();
  }
}

async function analyzeDraft() {
  const rawInput = state.draft.trim();
  if (!rawInput) {
    notify("先写下一点内容，再开始整理");
    return;
  }

  setState({ loading: true });
  try {
    const bundle = await request("/reviews/analyze", {
      method: "POST",
      body: JSON.stringify({ type: state.mode, scene: state.scene, raw_input: rawInput }),
    });
    const normalized = normalizeBundle(bundle);
    state.currentBundle = normalized;
    state.followUp = null;
    upsertRecord(normalized.record);
    if (normalized.methodCard) upsertMethod(normalized.methodCard);
    if (normalized.calibrationCard) upsertCalibration(normalized.calibrationCard);
    setState({ loading: false, route: "summary", apiOnline: true });
    notify(normalized.warnings.length ? normalized.warnings[0] : "已调用 AI 生成整理结果");
  } catch (error) {
    const fallback = buildLocalBundle(rawInput, state.mode, state.scene);
    state.currentBundle = fallback;
    upsertRecord(fallback.record);
    if (fallback.methodCard) upsertMethod(fallback.methodCard);
    if (fallback.calibrationCard) upsertCalibration(fallback.calibrationCard);
    setState({ loading: false, route: "summary", apiOnline: false });
    notify("后端未连接，已用本地结果继续流程");
  }
}

function normalizeBundle(bundle) {
  return {
    record: normalizeRecord(bundle.record),
    methodCard: bundle.method_card ? normalizeMethod(bundle.method_card) : null,
    calibrationCard: bundle.calibration_card ? normalizeCalibration(bundle.calibration_card) : null,
    warnings: bundle.warnings || [],
  };
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
    shortDate: createdAt.slice(5),
    rawInput: record.raw_input || record.rawInput || "",
    summary: record.summary || {},
    deepReview: record.deep_review || record.deepReview || {},
    resultCard,
    conclusion: record.conclusion || firstValue(resultCard) || "已生成一张可执行的复盘卡。",
    note: record.note || record.myNote || "这次复盘让我意识到：确认步骤要前置。",
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
    source: card.source || card.source_review_id || "当前复盘",
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

function upsertRecord(record) {
  store.records = [record, ...store.records.filter((item) => item.id !== record.id)];
}

function upsertMethod(card) {
  store.methods = [card, ...store.methods.filter((item) => item.id !== card.id)];
}

function upsertCalibration(card) {
  store.calibrations = [card, ...store.calibrations.filter((item) => item.id !== card.id)];
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function recordDateKey(record) {
  return String(record.date || record.createdAt || "").slice(0, 10);
}

function monthDay(date) {
  return localDateKey(date).slice(5);
}

function buildLocalBundle(rawInput, mode, scene) {
  const today = localDateKey();
  const record = normalizeRecord({
    id: `local-${Date.now()}`,
    type: mode,
    scene,
    title: rawInput.slice(0, 22) || (mode === "event" ? "新的事件复盘" : "新的焦虑复盘"),
    rawInput,
    summary: Object.fromEntries(summaryTemplates[mode]),
    deepReview: Object.fromEntries(deepReviewTemplates[mode]),
    resultCard: Object.fromEntries(resultCards[mode].fields),
    createdAt: today,
    savedToMethodLibrary: mode === "event",
    savedToCalibration: mode === "anxiety",
  });
  return {
    record,
    methodCard: mode === "event" ? normalizeMethod({
      id: `local-method-${Date.now()}`,
      title: "开始前确认卡",
      scenes: [scene, "复盘"],
      trigger: "准备开始处理类似事情前",
      steps: ["复述理解", "确认目标和边界", "列出不确定点", "确认样例和验收标准"],
      source: record.title,
      updatedAt: today,
    }) : null,
    calibrationCard: mode === "anxiety" ? normalizeCalibration({
      id: `local-calibration-${Date.now()}`,
      worry: record.title,
      scene,
      estimatedProbability: "80%",
      verificationDate: "",
      status: "pending",
    }) : null,
  };
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
  const steps = record.resultCard?.行动步骤 || record.resultCard?.["行动步骤"] || [];
  const method = normalizeMethod({
    id: `local-method-${Date.now()}`,
    title: `${record.title.slice(0, 14)}方法卡`,
    scenes: [record.scene, "复盘"],
    trigger: record.resultCard?.问题提醒 || "再次遇到类似情况前",
    steps: Array.isArray(steps) && steps.length ? steps : ["复述当前情况", "确认目标和边界", "列出下一步行动"],
    source: record.title,
    updatedAt: localDateKey(),
  });
  upsertMethod(method);
  return method;
}

function findCalibrationForRecord(record) {
  return store.calibrations.find((card) => card.sourceReviewId === record.id || card.worry === record.title || card.worry === record.rawInput);
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
          ${icons.search}
        </label>
        <button class="header-icon" data-toast="暂时没有新的提醒" aria-label="通知">${icons.bell}<i></i></button>
        <button class="profile-button" data-toast="${apiStatusText()}" aria-label="连接状态">
          <span class="avatar"></span><span class="down">⌄</span>
        </button>
      </header>
      ${content}
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
            <textarea data-draft maxlength="2000" placeholder="${modePlaceholder(mode)}">${escapeHtml(state.draft)}</textarea>
            <div class="input-footer">
              <strong>${mode === "event" ? "整理事实槽位，沉淀方法卡" : "拆开担心槽位，生成校准卡"}</strong>
              <span>${state.draft.length} / 2000</span>
              <button class="primary-button" data-home-analyze ${state.loading ? "disabled" : ""}>${state.loading ? "整理中..." : "开始复盘"}</button>
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
        ${store.records.slice(0, 3).map((record, index) => `
          <button class="recent-item" data-detail="${record.id}">
            <span class="recent-icon tone-${index}">${record.type === "event" ? icons.note : "❤"}</span>
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
    if (weekKeys.has(key)) counts[key] = (counts[key] || 0) + 1;
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
  const reviewedDays = weekDays.filter((day) => day.count > 0).length;
  const weeklyRecordCount = Object.values(recordCountByDate).reduce((total, count) => total + count, 0);
  const ringProgress = Math.round((reviewedDays / 7) * 100);
  return `
    <article class="panel week-panel">
      <h2>本周回顾</h2>
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
    </article>
  `;
}

function inspirationPanel() {
  return `<article class="panel inspiration-panel"><h2>灵感卡片</h2>${quoteArt()}</article>`;
}

function pageHeader(title, back = "home") {
  return `<div class="page-header"><button class="back-button" data-route="${back}">${icons.back}</button><h1>${title}</h1></div>`;
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
      <button class="primary-button wide" data-analyze ${state.loading ? "disabled" : ""}>${state.loading ? "整理中..." : "开始整理"}</button>
    </main>
  `);
}

function flowTabs() {
  return `<div class="flow-tabs"><button class="${state.mode === "event" ? "active" : ""}" disabled>事件复盘</button><button class="${state.mode === "anxiety" ? "active" : ""}" disabled>焦虑复盘</button></div>`;
}

function summaryPage() {
  const record = currentRecord();
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader("AI 整理结果", "home")}
      ${flowTabs()}
      ${fieldGrid(objectFields(record.summary, summaryTemplates[state.mode]))}
      <div class="action-row">
        <button class="secondary-button" data-route="home">修改内容</button>
        <button class="primary-button" data-route="deep">开始复盘</button>
      </div>
    </main>
  `);
}

function deepPage() {
  const record = currentRecord();
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader("深度复盘", "summary")}
      ${flowTabs()}
      ${fieldGrid(objectFields(record.deepReview, deepReviewTemplates[state.mode]), true)}
      <div class="action-row">
        <button class="secondary-button" data-route="summary">上一步</button>
        <button class="primary-button" data-route="result">${state.mode === "event" ? "生成行动卡" : "生成校准卡"}</button>
      </div>
    </main>
  `);
}

function resultPage() {
  const record = currentRecord();
  const title = state.mode === "event" ? "下次行动卡" : "焦虑校准卡";
  const calibration = state.mode === "anxiety" ? findCalibrationForRecord(record) : null;
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader(title, "deep")}
      ${fieldGrid(objectFields(record.resultCard, resultCards[state.mode].fields))}
      <div class="action-row wrap">
        <button class="secondary-button" data-tab="records" data-toast="已保存到记录">保存到记录</button>
        <button class="secondary-button" data-tab="${state.mode === "event" ? "methods" : "calibration"}" data-toast="${state.mode === "event" ? "已保存到方法库" : "已保存到校准"}">${state.mode === "event" ? "保存到方法库" : "保存到校准"}</button>
        ${state.mode === "anxiety" ? `
          <label class="date-picker">验证日期
            <input type="date" data-result-verification-date value="${escapeHtml(calibration?.verificationDate || "")}" />
          </label>
          <button class="ghost-button" data-save-result-verification="${calibration?.id || ""}">保存验证日期</button>
        ` : ""}
        <button class="ghost-button" data-follow-up="${record.id}" ${state.followUpLoading ? "disabled" : ""}>${state.followUpLoading ? "追问中..." : "继续追问"}</button>
      </div>
      ${state.followUp ? followUpPanel(state.followUp) : ""}
    </main>
  `);
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
    .map(([key, item]) => `${key}：${displayValue(item)}`)
    .filter((line) => !line.endsWith("："))
    .join("\n");
}

function recordsPage() {
  const filters = ["全部", "事件", "焦虑", "工作", "学习", "面试", "人际", "决策", "健康", "未来", "生活", "其他"];
  const filtered = store.records.filter((record) => matchesFilter(record, state.filter) && matchesQuery([record.title, record.scene, record.conclusion]));
  return shell(`<main class="content-page"><h1 class="list-title">我的记录</h1>${filterRow(filters)}<div class="card-list">${filtered.map(recordCard).join("") || emptyState("没有找到匹配的记录")}</div></main>`);
}

function methodsPage() {
  const filters = ["全部", "工作", "学习", "面试", "人际", "决策", "生活", "其他"];
  const filtered = store.methods.filter((card) => (state.filter === "全部" || card.scenes.includes(state.filter)) && matchesQuery([card.title, card.trigger, methodSourceLabel(card.source)]));
  return shell(`<main class="content-page"><h1 class="list-title">方法库</h1>${filterRow(filters)}<div class="method-grid">${filtered.map(methodCard).join("") || emptyState("没有找到匹配的方法卡")}</div></main>`);
}

function calibrationPage() {
  const cards = store.calibrations.filter((card) => card.status === state.calibrationTab && matchesQuery([card.worry, card.scene, card.calibrationConclusion]));
  return shell(`
    <main class="content-page">
      <h1 class="list-title">焦虑校准</h1>
      <div class="flow-tabs small-tabs"><button class="${state.calibrationTab === "pending" ? "active" : ""}" data-cal-tab="pending">待验证</button><button class="${state.calibrationTab === "verified" ? "active" : ""}" data-cal-tab="verified">已验证</button></div>
      <div class="card-list">${cards.map(calibrationCard).join("") || emptyState("没有找到匹配的校准卡")}</div>
    </main>
  `);
}

function detailPage() {
  const record = store.records.find((item) => item.id === state.selectedRecordId) || store.records[0];
  const mode = record.type;
  if (state.editingRecordId === record.id) return detailEditPage(record);
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader("详情", "records")}
      <section class="detail-hero"><h1>${record.title}</h1><p>${typeText(mode)} · ${record.scene}<span>${record.date} 14:30</span></p></section>
      ${fieldGrid([
        ["原始输入", record.rawInput],
        ...objectFields(record.summary, summaryTemplates[mode]).slice(0, 2),
        ...objectFields(record.deepReview, deepReviewTemplates[mode]).slice(0, 2),
        ...objectFields(record.resultCard, resultCards[mode].fields).slice(0, 2),
        ["我的笔记", "这次复盘让我意识到：确认步骤要前置。"],
      ])}
      <div class="action-row wrap">
        <button class="ghost-button" data-edit-record="${record.id}">编辑复盘内容</button>
        ${mode === "event" ? `<button class="secondary-button" data-edit-record-method="${record.id}">编辑方法卡</button>` : ""}
        <button class="ghost-button" data-reanalyze="${record.id}">重新分析</button>
        <button class="${mode === "event" ? "ghost-button" : "secondary-button"}" data-toast="${mode === "event" ? "已保存为方法卡" : "已加入校准"}">${mode === "event" ? "保存为方法卡" : "加入校准"}</button>
        <button class="danger-button" data-delete-record="${record.id}">删除</button>
        <button class="ghost-button" data-toast="已归档，本地演示不删除数据">归档</button>
      </div>
    </main>
  `);
}

function detailEditPage(record) {
  const mode = record.type;
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader("编辑详情", "records")}
      <section class="detail-hero detail-editor" data-record-editor="${record.id}">
        <label>标题<input data-record-title value="${escapeHtml(record.title)}" /></label>
        <label>场景<input data-record-scene value="${escapeHtml(record.scene)}" /></label>
        <label>原始输入<textarea data-record-raw>${escapeHtml(record.rawInput)}</textarea></label>
        ${editableSection("summary", "AI 整理", editableFields(record.summary, summaryTemplates[mode]))}
        ${editableSection("deepReview", "深度复盘", editableFields(record.deepReview, deepReviewTemplates[mode]))}
        ${editableSection("resultCard", mode === "event" ? "行动卡" : "校准卡", editableFields(record.resultCard, resultCards[mode].fields))}
        <label>我的笔记<textarea data-record-note>${escapeHtml(record.note || "")}</textarea></label>
      </section>
      <div class="action-row wrap">
        <button class="primary-button" data-save-record="${record.id}">保存</button>
        <button class="ghost-button" data-cancel-record-edit>取消</button>
      </div>
    </main>
  `);
}

function editableSection(section, title, fields) {
  return `
    <fieldset class="edit-fieldset">
      <legend>${title}</legend>
      ${fields.map(([label, value], index) => `
        <label>${escapeHtml(label)}
          <textarea data-record-field data-section="${section}" data-label="${escapeHtml(label)}" data-index="${index}">${escapeHtml(Array.isArray(value) ? value.join("\n") : value)}</textarea>
        </label>
      `).join("")}
    </fieldset>
  `;
}

function filterRow(filters) {
  return `<div class="filters">${filters.map((item) => `<button class="chip ${state.filter === item ? "selected" : ""}" data-filter="${item}">${item}</button>`).join("")}</div>`;
}

function recordCard(record) {
  return `
    <article class="list-card" data-detail="${record.id}">
      <div class="card-title-row">
        <div><h3>${escapeHtml(record.title)}</h3><p>${typeText(record.type)} · ${escapeHtml(record.scene)} · ${record.date}</p></div>
        <button class="text-button danger-text" data-delete-record="${record.id}">删除</button>
      </div>
      <strong>${escapeHtml(record.conclusion)}</strong>
      <span>${record.status}</span>
    </article>
  `;
}

function methodCard(card) {
  if (state.editingMethodId === card.id) return methodEditCard(card);
  const source = methodSourceLabel(card.source);
  return `
    <article class="list-card method-card">
      <div class="card-title-row">
        <h3>${escapeHtml(card.title)}</h3>
        <div class="inline-actions">
          <button class="text-button" data-edit-method="${card.id}">编辑</button>
          <button class="text-button danger-text" data-delete-method="${card.id}">删除</button>
        </div>
      </div>
      <p>${card.scenes.map(escapeHtml).join("、")}</p>
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
      <label>适用场景<input data-method-scenes value="${escapeHtml(card.scenes.join("、"))}" /></label>
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
    <article class="list-card calibration-card">
      <div class="card-title-row">
        <h3>${escapeHtml(card.worry)}</h3>
        <div class="inline-actions">
          <button class="text-button" data-edit-calibration="${card.id}">编辑</button>
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

function render() {
  const routes = {
    home: homePage,
    eventInput: () => inputPage("event"),
    anxietyInput: () => inputPage("anxiety"),
    summary: summaryPage,
    deep: deepPage,
    result: resultPage,
    records: recordsPage,
    methods: methodsPage,
    calibration: calibrationPage,
    detail: detailPage,
  };
  app.innerHTML = routes[state.route]();
}

function saveMethodCard(id) {
  const editor = app.querySelector(`[data-method-editor="${id}"]`);
  const card = store.methods.find((item) => item.id === id);
  if (!editor || !card) return;

  const title = editor.querySelector("[data-method-title]").value.trim();
  const sceneValue = editor.querySelector("[data-method-scenes]").value.trim();
  const trigger = editor.querySelector("[data-method-trigger]").value.trim();
  const steps = editor.querySelector("[data-method-steps]").value
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean);

  Object.assign(card, {
    title: title || card.title,
    scenes: sceneValue ? sceneValue.split(/[、,，]/).map((scene) => scene.trim()).filter(Boolean) : card.scenes,
    trigger: trigger || card.trigger,
    steps: steps.length ? steps : card.steps,
    updatedAt: localDateKey(),
  });
  setState({ editingMethodId: null });
  notify("方法卡已更新");
}

function saveRecord(id) {
  const editor = app.querySelector(`[data-record-editor="${id}"]`);
  const record = store.records.find((item) => item.id === id);
  if (!editor || !record) return;

  const oldTitle = record.title;
  const oldScene = record.scene;
  const oldRawInput = record.rawInput;
  const oldNote = record.note || "";
  const title = editor.querySelector("[data-record-title]").value.trim() || record.title;
  const scene = editor.querySelector("[data-record-scene]").value.trim() || record.scene;
  const rawInput = editor.querySelector("[data-record-raw]").value.trim();
  const note = editor.querySelector("[data-record-note]").value.trim();

  syncFieldValue(oldTitle, title);
  syncFieldValue(oldScene, scene);
  syncFieldValue(oldRawInput, rawInput);
  syncFieldValue(oldNote, note);

  record.title = title;
  record.scene = scene;
  record.rawInput = rawInput;
  record.note = note;
  record.updatedAt = localDateKey();

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
  if (state.currentBundle?.record?.id === record.id) state.currentBundle.record = record;
  setState({ editingRecordId: null });
  notify("复盘内容已更新");
}

function saveCalibration(id) {
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
  setState({ editingCalibrationId: null });
  notify("校准卡已更新");
}

function saveResultVerification(calibrationId) {
  const input = app.querySelector("[data-result-verification-date]");
  const record = currentRecord();
  const card = store.calibrations.find((item) => item.id === calibrationId) || findCalibrationForRecord(record);
  if (!input || !card) return;
  syncFieldValue(card.verificationDate, input.value);
  card.verificationDate = input.value;
  notify(input.value ? "验证日期已更新" : "已清空验证日期");
}

function localDeleteRecord(id) {
  store.records = store.records.filter((item) => item.id !== id);
  store.methods = store.methods.filter((item) => item.sourceReviewId !== id && item.source !== id);
  store.calibrations = store.calibrations.filter((item) => item.sourceReviewId !== id);
  if (state.selectedRecordId === id) state.selectedRecordId = store.records[0]?.id || "";
  if (state.currentBundle?.record?.id === id) state.currentBundle = null;
}

function localDeleteMethod(id) {
  store.methods = store.methods.filter((item) => item.id !== id);
  if (state.editingMethodId === id) state.editingMethodId = null;
}

function localDeleteCalibration(id) {
  store.calibrations = store.calibrations.filter((item) => item.id !== id);
  if (state.editingCalibrationId === id) state.editingCalibrationId = null;
}

async function deleteResource(kind, id) {
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
    state.apiOnline = true;
  } catch (error) {
    state.apiOnline = false;
  }
  localDeleteByKind[kind](id);
  const route = kind === "record" ? "records" : kind === "method" ? "methods" : "calibration";
  const tab = kind === "record" ? "records" : kind === "method" ? "methods" : "calibration";
  setState({ route, tab });
  notify(kind === "record" ? "记录已删除" : kind === "method" ? "方法卡已删除" : "校准卡已删除");
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
  const target = event.target.closest("button, article[data-detail]");
  if (!target) return;

  if (target.dataset.toast) {
    notify(target.dataset.toast);
  }

  if (target.dataset.homeAnalyze !== undefined) {
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
    saveMethodCard(target.dataset.saveMethod);
    return;
  }

  if (target.dataset.saveRecord) {
    saveRecord(target.dataset.saveRecord);
    return;
  }

  if (target.dataset.saveCalibration) {
    saveCalibration(target.dataset.saveCalibration);
    return;
  }

  if (target.dataset.saveResultVerification !== undefined) {
    saveResultVerification(target.dataset.saveResultVerification);
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
    setState({ route: target.dataset.route, tab: target.dataset.route === "home" ? "review" : state.tab });
    return;
  }

  if (target.dataset.tab) {
    const tab = target.dataset.tab;
    const routeByTab = { review: "home", records: "records", methods: "methods", calibration: "calibration" };
    setState({ tab, route: routeByTab[tab], filter: "全部" });
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

  if (target.dataset.detail) {
    setState({ selectedRecordId: target.dataset.detail, route: "detail" });
  }
});

app.addEventListener("input", (event) => {
  if (event.target.matches("[data-draft]")) {
    state.draft = event.target.value;
    const count = app.querySelector(".textarea-count, .input-footer span");
    if (count) count.textContent = `${state.draft.length} / 2000`;
  }

  if (event.target.matches("[data-search]")) {
    state.query = event.target.value;
    render();
  }
});

render();
hydrateFromBackend();
