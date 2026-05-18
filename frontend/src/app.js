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
  records: [...fallbackReviewRecords],
  methods: [...fallbackMethodCards],
  calibrations: [...fallbackCalibrationCards],
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
  selectedRecordId: "r1",
  currentBundle: null,
  loading: false,
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
    upsertRecord(normalized.record);
    if (normalized.methodCard) upsertMethod(normalized.methodCard);
    if (normalized.calibrationCard) upsertCalibration(normalized.calibrationCard);
    setState({ loading: false, route: "summary", apiOnline: true });
    notify("已从后端生成整理结果");
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
    status: savedToMethodLibrary ? "已生成方法卡" : savedToCalibration ? "已加入校准" : "未沉淀",
    savedToMethodLibrary,
    savedToCalibration,
  };
}

function normalizeMethod(card) {
  return {
    id: card.id,
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
    worry: card.worry,
    scene: card.scene,
    estimatedProbability: card.estimated_probability || card.estimatedProbability || "80%",
    verificationDate: card.verification_date || card.verificationDate || "2026-05-25",
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

function buildLocalBundle(rawInput, mode, scene) {
  const today = new Date().toISOString().slice(0, 10);
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
      verificationDate: "2026-05-25",
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
  return shell(`
    <main class="home-page">
      <section class="hero">
        <div class="hero-copy">
          <h1>复盘一件事， 下一次会更好</h1>
          <div class="input-panel">
            <textarea data-draft maxlength="2000" placeholder="今天有什么事情值得复盘？">${escapeHtml(state.draft)}</textarea>
            <div class="input-footer">
              <span>${state.draft.length} / 2000</span>
              <button class="primary-button" data-home-analyze ${state.loading ? "disabled" : ""}>${state.loading ? "整理中..." : "开始复盘"}</button>
            </div>
          </div>
        </div>
        ${deskPlantArt()}
      </section>
      <section class="entry-row">
        <button class="entry-card event" data-start="event">
          <span class="entry-illustration paper-icon"></span>
          <span><strong>复盘一件事</strong><small>梳理事件，找到改进方法</small></span>
          ${icons.chevron}
        </button>
        <button class="entry-card anxiety" data-start="anxiety">
          <span class="entry-illustration flower-icon"></span>
          <span><strong>复盘一次焦虑</strong><small>看清担心，减少内耗</small></span>
          ${icons.chevron}
        </button>
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
  const reviewedDays = Math.min(7, store.records.length);
  return `
    <article class="panel week-panel">
      <h2>本周回顾</h2>
      <div class="week-content">
        <div class="ring"><span>${reviewedDays}<small>/7</small></span></div>
        <ul class="week-days">
          ${["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day, index) => `<li class="${index < reviewedDays ? "done" : ""}"><span>${day}</span><i>${index < reviewedDays ? "✓" : ""}</i></li>`).join("")}
        </ul>
      </div>
      <p>本周复盘 ${reviewedDays} 天<br />已完成 ${store.records.length} 件复盘</p>
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
      <textarea class="large-textarea" data-draft maxlength="2000" placeholder="${placeholder}">${escapeHtml(state.draft)}</textarea>
      <div class="textarea-count">${state.draft.length} / 2000</div>
      <h3 class="field-title">选择场景（可选）</h3>
      <div class="chips">${scenes[mode].map((scene) => `<button class="chip ${state.scene === scene ? "selected" : ""}" data-scene="${scene}">${scene}</button>`).join("")}</div>
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
      ${pageHeader("AI 整理结果", state.mode === "event" ? "eventInput" : "anxietyInput")}
      ${flowTabs()}
      ${fieldGrid(objectFields(record.summary, summaryTemplates[state.mode]))}
      <div class="action-row">
        <button class="secondary-button" data-route="${state.mode === "event" ? "eventInput" : "anxietyInput"}">修改内容</button>
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
  return shell(`
    <main class="content-page narrow-page">
      ${pageHeader(title, "deep")}
      ${fieldGrid(objectFields(record.resultCard, resultCards[state.mode].fields))}
      <div class="action-row wrap">
        <button class="secondary-button" data-tab="records" data-toast="已保存到记录">保存到记录</button>
        <button class="secondary-button" data-tab="${state.mode === "event" ? "methods" : "calibration"}" data-toast="${state.mode === "event" ? "已保存到方法库" : "已保存到校准"}">${state.mode === "event" ? "保存到方法库" : "保存到校准"}</button>
        ${state.mode === "anxiety" ? `<button class="ghost-button" data-toast="验证日期已记录为 2026-05-25">设置验证日期</button>` : ""}
        <button class="ghost-button" data-toast="继续追问会在接入真实 AI 后开放">继续追问</button>
      </div>
    </main>
  `);
}

function fieldGrid(fields, numbered = false) {
  return `
    <div class="field-grid">
      ${fields.map(([label, value], index) => {
        const body = Array.isArray(value) ? `<ol>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : `<p>${escapeHtml(String(value))}</p>`;
        return `<article class="field-card">${numbered ? `<span class="number">${index + 1}</span>` : ""}<h3>${label}</h3>${body}</article>`;
      }).join("")}
    </div>
  `;
}

function recordsPage() {
  const filters = ["全部", "事件", "焦虑", "工作", "学习", "面试", "人际", "决策", "健康", "未来", "生活", "其他"];
  const filtered = store.records.filter((record) => matchesFilter(record, state.filter) && matchesQuery([record.title, record.scene, record.conclusion]));
  return shell(`<main class="content-page"><h1 class="list-title">我的记录</h1>${filterRow(filters)}<div class="card-list">${filtered.map(recordCard).join("") || emptyState("没有找到匹配的记录")}</div></main>`);
}

function methodsPage() {
  const filters = ["全部", "工作", "学习", "面试", "人际", "决策", "生活", "其他"];
  const filtered = store.methods.filter((card) => (state.filter === "全部" || card.scenes.includes(state.filter)) && matchesQuery([card.title, card.trigger, card.source]));
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
        <button class="ghost-button" data-toast="编辑能力下一版接入">编辑</button>
        <button class="ghost-button" data-reanalyze="${record.id}">重新分析</button>
        <button class="secondary-button" data-toast="${mode === "event" ? "已保存为方法卡" : "已加入校准"}">${mode === "event" ? "保存为方法卡" : "加入校准"}</button>
        <button class="ghost-button" data-toast="已归档，本地演示不删除数据">归档</button>
      </div>
    </main>
  `);
}

function filterRow(filters) {
  return `<div class="filters">${filters.map((item) => `<button class="chip ${state.filter === item ? "selected" : ""}" data-filter="${item}">${item}</button>`).join("")}</div>`;
}

function recordCard(record) {
  return `<article class="list-card" data-detail="${record.id}"><div><h3>${record.title}</h3><p>${typeText(record.type)} · ${record.scene} · ${record.date}</p><strong>${record.conclusion}</strong></div><span>${record.status}</span></article>`;
}

function methodCard(card) {
  return `<article class="list-card method-card"><h3>${card.title}</h3><p>${card.scenes.join("、")}</p><strong>触发条件：${card.trigger}</strong><ol>${card.steps.map((step) => `<li>${step}</li>`).join("")}</ol><p>来源复盘：${card.source}</p></article>`;
}

function calibrationCard(card) {
  const verified = card.status === "verified";
  return `<article class="list-card"><h3>${card.worry}</h3><p>${card.scene} · 当时预计概率：${card.estimatedProbability}</p><strong>${verified ? `最终是否发生：${card.finalResult}` : `验证日期：${card.verificationDate}`}</strong>${verified ? `<p>实际影响：${card.actualImpact}</p><p>${card.calibrationConclusion}</p>` : `<span>待验证</span>`}</article>`;
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

app.addEventListener("click", (event) => {
  const target = event.target.closest("button, article[data-detail]");
  if (!target) return;

  if (target.dataset.toast) {
    notify(target.dataset.toast);
  }

  if (target.dataset.homeAnalyze !== undefined) {
    state.mode = "event";
    state.scene = "工作";
    analyzeDraft();
    return;
  }

  if (target.dataset.analyze !== undefined) {
    analyzeDraft();
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

  if (target.dataset.start) {
    const mode = target.dataset.start;
    setState({ mode, scene: scenes[mode][0], route: mode === "event" ? "eventInput" : "anxietyInput", tab: "review" });
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
