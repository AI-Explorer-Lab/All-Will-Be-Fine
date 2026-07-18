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
const THEME_KEY = "review_theme";
const CALIBRATION_CHECKINS_KEY = "review_calibration_checkins";
const DESIGN_WIDTH = 1180;
const app = document.querySelector("#app");
const HOME_REVIEW_TAGS = ["沟通问题", "目标偏差", "执行卡点", "情绪波动", "认知盲区", "关系边界", "习惯调整", "经验沉淀"];

const ADVANCED_METHODS = [
  {
    id: "5why",
    title: "5 Why 分析法",
    category: "复盘框架",
    tag: "复盘框架",
    art: "why",
    description: "连续追问原因，找到真正需要改变的环节。",
    prompts: [
      ["analysis", "问题的第一层原因", "先写下最直接、最表层的原因。"],
      ["action", "继续追问到根因，并写下行动", "把第 2 到第 5 个“为什么”写清楚，最后落到一个动作。"],
      ["reminder", "下次的检查问题", "下次开始前，最该先确认什么？"],
    ],
  },
  {
    id: "grow",
    title: "GROW 模型",
    category: "目标行动",
    tag: "目标与行动",
    art: "grow",
    description: "从目标、现实、选择到承诺，重新组织下一步。",
    prompts: [
      ["analysis", "目标与现实", "你真正想达成什么？现在的情况是什么？"],
      ["action", "可选路径与下一步", "列出可行选项，并选定最小的下一步行动。"],
      ["reminder", "行动承诺", "你准备在什么时间、以什么标准完成？"],
    ],
  },
  {
    id: "abc",
    title: "情绪 ABC 理论",
    category: "情绪管理",
    tag: "情绪管理",
    art: "abc",
    description: "区分事件、信念与情绪反应，松开自动化想法。",
    prompts: [
      ["analysis", "触发事件与自动想法", "发生了什么？你当时立刻相信了什么？"],
      ["action", "重新解释与可控行动", "有没有更平衡的解释？你能做的第一步是什么？"],
      ["reminder", "给自己的新提醒", "写一句更贴近事实、也能支持行动的话。"],
    ],
  },
  {
    id: "star",
    title: "STAR 法则",
    category: "结构表达",
    tag: "沟通协作",
    art: "star",
    description: "用情境、任务、行动、结果，复盘一次表达与执行。",
    prompts: [
      ["analysis", "情境、任务与行动", "当时的背景和目标是什么？你具体做了什么？"],
      ["action", "结果与下一次表达", "结果如何？下次要补足哪一个关键动作？"],
      ["reminder", "一句结构化提醒", "下次先说清哪四件事？"],
    ],
  },
  {
    id: "quadrant",
    title: "四象限法则",
    category: "思维模型",
    tag: "思维模型",
    art: "quadrant",
    description: "用重要与紧急重新排序，把精力留给真正重要的事。",
    prompts: [
      ["analysis", "重要性与紧急性", "这件事属于哪一象限？为什么会落到现在的状态？"],
      ["action", "重新安排与边界", "哪些事该提前安排、委托或拒绝？"],
      ["reminder", "优先级提醒", "下一周最该保护的时间是什么？"],
    ],
  },
  {
    id: "prep",
    title: "PREP 表达法",
    category: "结构表达",
    tag: "沟通协作",
    art: "prep",
    description: "先讲观点，再给理由、例子和重申，复盘一次关键沟通。",
    prompts: [
      ["analysis", "观点与理由", "你当时最想表达的观点是什么？理由足够清楚吗？"],
      ["action", "例子与重述", "补上哪个例子能让对方理解？下一次如何重述观点？"],
      ["reminder", "表达前的提纲", "写下你下次开口前要先说的一句话。"],
    ],
  },
  {
    id: "feynman",
    title: "费曼学习法",
    category: "学习成长",
    tag: "学习成长",
    art: "feynman",
    description: "用讲给外行听的方式，发现知识与理解中的空洞。",
    prompts: [
      ["analysis", "讲不清的部分", "如果讲给新人听，哪里最容易卡住？"],
      ["action", "补洞与输出", "要补哪块知识？下一次准备怎样讲出来？"],
      ["reminder", "学习检验", "用一句话写下真正理解的标准。"],
    ],
  },
  {
    id: "swot",
    title: "SWOT 分析法",
    category: "决策判断",
    tag: "决策判断",
    art: "swot",
    description: "看清优势、限制、机会和风险，再做更稳的选择。",
    prompts: [
      ["analysis", "优势、限制与机会", "此刻你手里有哪些资源？哪些限制最关键？"],
      ["action", "风险与应对动作", "最大的风险是什么？如何用一个动作降低它？"],
      ["reminder", "决策原则", "写下一条这次决策给你的原则。"],
    ],
  },
];

const store = {
  records: [],
  methods: [],
  calibrations: [],
};

let breathingTimer = null;
let breathingStartFrame = null;
let resetWorkspaceScroll = false;

const state = {
  tab: "review",
  route: "home",
  mode: "event",
  reviewStyle: "quick",
  advancedMethodId: "5why",
  scene: "工作",
  draft: "",
  homeMetaOpen: "",
  homeTags: [],
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
  advancedDraftFields: Object.fromEntries(ADVANCED_METHODS.map((method) => [method.id, {
    analysis: "",
    action: "",
    reminder: "",
  }])),
  filter: "全部",
  query: "",
  methodView: "templates",
  calibrationView: "checkin",
  calibrationTab: "pending",
  calibrationHistoryOpen: false,
  calibrationSession: {
    mood: "平静",
    feelings: [],
    note: "",
    extraOpen: false,
  },
  calibrationCheckins: safeJsonParse(localStorage.getItem(CALIBRATION_CHECKINS_KEY), []),
  breathingActive: false,
  breathingPhase: "吸气",
  breathingSeconds: 4,
  selectedRecordId: "",
  editingRecordId: null,
  editingMethodId: null,
  editingCalibrationId: null,
  currentBundle: null,
  followUp: null,
  loading: false,
  saving: false,
  followUpLoading: false,
  searchComposing: false,
  apiOnline: false,
  toast: "",
  authToken: localStorage.getItem(AUTH_TOKEN_KEY) || "",
  authUser: safeJsonParse(localStorage.getItem(AUTH_USER_KEY), null),
  authMode: "login",
  authSubmitting: false,
  credentialPrefillAttempted: false,
  authDraft: {
    username: "",
    password: "",
  },
  calendarMonth: localDateKey().slice(0, 7),
  calendarExpanded: false,
  notificationsOpen: false,
  theme: localStorage.getItem(THEME_KEY) || "system",
};

const navItems = [
  ["review", "复盘", "home"],
  ["records", "记录", "note"],
  ["methods", "方法库", "bookmark"],
  ["calibration", "校准", "gauge"],
];

const routeByTab = {
  review: "home",
  records: "records",
  methods: "methods",
  calibration: "calibration",
};

const tabByRoute = {
  home: "review",
  records: "records",
  methods: "methods",
  calibration: "calibration",
};

const pathByTab = {
  review: "/review",
  records: "/records",
  methods: "/methods",
  calibration: "/calibration",
};

const tabByPath = {
  "": "review",
  "/": "review",
  "/review": "review",
  "/records": "records",
  "/methods": "methods",
  "/calibration": "calibration",
};

const icons = {
  home: `<svg viewBox="0 0 24 24"><path d="M4 11.3 12 4.8l8 6.5v7.4a1 1 0 0 1-1 1h-5.1v-5.2H10v5.2H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  note: `<svg viewBox="0 0 24 24"><rect x="6.5" y="4.8" width="11" height="14.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.4 9h5.2M9.4 12h5.2M9.4 15h3.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24"><path d="M7 5.4c0-.8.6-1.4 1.4-1.4h7.2c.8 0 1.4.6 1.4 1.4v14l-5-3.1-5 3.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24"><path d="M5 16a7 7 0 1 1 14 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/><path d="m12 14 3-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16.1 16.1 3.9 3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M18 10.4a6 6 0 0 0-12 0v4.1l-1.8 2h15.6l-1.8-2zM9.8 19.5h4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><path d="M9 4.8h6M10 4.8l.6-1.3h2.8l.6 1.3M6.4 7.2h11.2M8 7.2l.7 12h6.6l.7-12M10.6 10.2v6M13.4 10.2v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  moon: `<svg viewBox="0 0 24 24"><path d="M19.4 15.1A7.4 7.4 0 0 1 8.9 4.6a7.8 7.8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.6v2M12 18.4v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M3.6 12h2M18.4 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  spark: `<svg viewBox="0 0 24 24"><path d="M12 3.8 13.8 9l5.4 1.8-5.4 1.8L12 18l-1.8-5.4-5.4-1.8L10.2 9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.8 15.5v3.3M17.2 17.2h3.3M5.2 4.8v2.6M3.9 6.1h2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
};

function resolvedTheme() {
  if (state.theme === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return state.theme;
}

function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
}

function updateViewportScale() {
  const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  // The previous fixed-canvas scaling made a large physical monitor look like a
  // zoomed-out 1180px mockup. Layout now uses real viewport dimensions; CSS
  // breakpoints handle narrow screens instead of shrinking the entire product.
  document.documentElement.style.setProperty("--app-scale", "1");
  document.documentElement.style.setProperty("--app-width", `${width}px`);
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function cycleTheme() {
  const nextTheme = resolvedTheme() === "dark" ? "light" : "dark";
  state.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme();
  render();
}

function defaultApiBase() {
  const { hostname, port, origin } = window.location;
  if ((hostname === "127.0.0.1" || hostname === "localhost") && port === "5173") {
    return "http://127.0.0.1:8000/api";
  }
  return `${origin}/api`;
}

function appBasePath() {
  const mountPath = "/all-will-be-fine";
  return window.location.pathname.startsWith(mountPath) ? mountPath : "";
}

function normalizedAppPath() {
  const hashPath = window.location.hash.replace(/^#/, "");
  if (tabByPath[hashPath]) return hashPath;
  const base = appBasePath();
  let path = window.location.pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

function routeStateFromLocation() {
  const tab = tabByPath[normalizedAppPath()] || "review";
  return { tab, route: routeByTab[tab] };
}

function urlForTab(tab) {
  const base = appBasePath();
  const root = base ? `${base}/` : "/";
  return `${root}#${pathByTab[tab] || pathByTab.review}`;
}

function syncUrlForState(mode = "push") {
  if (!window.history?.pushState) return;
  const tab = tabByRoute[state.route] || state.tab || "review";
  const nextUrl = urlForTab(tab);
  if (`${window.location.pathname}${window.location.hash}` === nextUrl) return;
  window.history[mode === "replace" ? "replaceState" : "pushState"]({ tab, route: routeByTab[tab] }, "", nextUrl);
}

function applyRouteFromLocation({ shouldRender = false } = {}) {
  const next = routeStateFromLocation();
  resetWorkspaceScroll = next.route !== state.route;
  Object.assign(state, clearEditingState({ ...next, filter: "全部" }));
  if (shouldRender) render();
}

function setState(next, options = {}) {
  if ("route" in next && next.route !== state.route) resetWorkspaceScroll = true;
  Object.assign(state, next);
  render();
  if (options.syncUrl !== false && ("route" in next || "tab" in next)) {
    syncUrlForState(options.replaceUrl ? "replace" : "push");
  }
}

function resizeTextareaToContent(textarea) {
  textarea.style.height = "0px";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function resizeDraftTextareas() {
  app.querySelectorAll(".structured-draft textarea").forEach(resizeTextareaToContent);
}

function clearEditingState(next = {}) {
  return {
    editingRecordId: null,
    editingMethodId: null,
    editingCalibrationId: null,
    ...next,
  };
}

function clearCompletedReview() {
  state.draft = "";
  state.homeTags = [];
  state.homeMetaOpen = "";
  state.currentBundle = null;
  state.followUp = null;
  state.reviewStyle = "quick";
  state.draftFields = {
    event: { improvement: "", next: "", reminder: "" },
    anxiety: { reality: "", action: "", reminder: "", verificationDate: "" },
  };
  state.advancedDraftFields = Object.fromEntries(ADVANCED_METHODS.map((method) => [method.id, {
    analysis: "",
    action: "",
    reminder: "",
  }]));
}

function beginNewReview(mode = state.mode) {
  clearCompletedReview();
  state.mode = mode;
  state.scene = scenes[mode][0];
  setState(clearEditingState({ route: "home", tab: "review", filter: "全部" }));
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

function methodIcon(kind) {
  const iconsByKind = {
    why: `<svg viewBox="0 0 80 80"><circle cx="34" cy="34" r="18" fill="none" stroke="currentColor" stroke-width="4"/><path d="m48 48 18 18M25 30h18M25 37h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    grow: `<svg viewBox="0 0 80 80"><path d="M41 65V31M41 42C26 41 20 31 21 20c13 1 20 9 20 22M42 52c15-1 21-10 20-21-13 1-20 8-20 21" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M25 66h36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    abc: `<svg viewBox="0 0 80 80"><path d="M12 61c12-10 21-21 29-39 9 16 16 25 27 34" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="61" cy="22" r="7" fill="currentColor" opacity=".7"/></svg>`,
    star: `<svg viewBox="0 0 80 80"><path d="M29 65h22M33 65V39h14v26M40 15l18 22H22z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M17 65h46" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    quadrant: `<svg viewBox="0 0 80 80"><rect x="18" y="18" width="44" height="44" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M40 18v44M18 40h44" stroke="currentColor" stroke-width="3"/></svg>`,
    prep: `<svg viewBox="0 0 80 80"><path d="M20 18h35v44H20zM28 30h19M28 39h19M28 48h12M54 56l12 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="m58 52 8 8-5 5-8-8z" fill="currentColor"/></svg>`,
    feynman: `<svg viewBox="0 0 80 80"><path d="M18 22h22c7 0 12 5 12 12v26H30c-7 0-12-5-12-12zM62 20v42" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M28 34h15M28 42h15" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    swot: `<svg viewBox="0 0 80 80"><path d="M18 26h44M26 26v32M40 26v32M54 26v32M18 58h44" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M26 26 20 18M40 26v-9M54 26l6-8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  };
  return iconsByKind[kind] || iconsByKind.why;
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
  state.authDraft.username = username;
  state.authDraft.password = password;
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
    await storeBrowserCredential(form, username, password);
    setAuthSession(data);
    state.authDraft.password = "";
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

async function storeBrowserCredential(form, username = "", password = "") {
  if (!window.isSecureContext || !window.PasswordCredential || !navigator.credentials?.store) return;
  const id = String(username || form?.querySelector("[data-auth-username]")?.value || "").trim();
  const secret = String(password || form?.querySelector("[data-auth-password]")?.value || "");
  if (!id || !secret) return;
  try {
    await navigator.credentials.store(new PasswordCredential({ id, name: id, password: secret }));
  } catch (_error) {
    try {
      await navigator.credentials.store(new PasswordCredential(form));
    } catch (_fallbackError) {
      // Browser password saving is optional and may be disabled by the user or context.
    }
  }
}

async function maybePrefillBrowserCredential() {
  if (
    state.authMode !== "login"
    || state.credentialPrefillAttempted
    || !window.isSecureContext
    || !window.PasswordCredential
    || !navigator.credentials?.get
  ) {
    return;
  }
  state.credentialPrefillAttempted = true;
  try {
    const credential = await navigator.credentials.get({ password: true, mediation: "silent" });
    if (!credential || credential.type !== "password") return;
    const form = app.querySelector("[data-auth-form]");
    const usernameInput = form?.querySelector("[data-auth-username]");
    const passwordInput = form?.querySelector("[data-auth-password]");
    if (!usernameInput || !passwordInput || usernameInput.value || passwordInput.value) return;
    usernameInput.value = credential.id || credential.name || "";
    passwordInput.value = credential.password || "";
    state.authDraft.username = usernameInput.value;
    state.authDraft.password = passwordInput.value;
  } catch (_error) {
    // Silent credential lookup should never block the normal login form.
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
  const rawInput = state.draft.trim();
  const providedFields = composeDraftFields();
  if (!state.draft.trim()) {
    notify("先写下一点内容，再开始整理");
    return;
  }

  setState({ loading: true });
  try {
    const bundle = await request("/reviews/analyze", {
      method: "POST",
      body: JSON.stringify({
        type: state.mode,
        scene: state.scene,
        tags: state.homeTags,
        raw_input: rawInput,
        provided_fields: providedFields,
        persist: false,
      }),
    });
    const normalized = normalizeBundle(bundle);
    state.currentBundle = normalized;
    state.followUp = null;
    setState({ loading: false, route: "result", apiOnline: true });
    notify(normalized.warnings.length ? normalized.warnings[0] : "已生成行动卡");
  } catch (error) {
    if (handleAuthError(error)) return;
    const fallback = buildManualBundle(rawInput, state.mode, state.scene, submissionDraftFields());
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
  state.currentBundle = buildManualBundle(rawInput, state.mode, state.scene, submissionDraftFields());
  state.followUp = null;
  setState({ route: "result", tab: "review" });
}

function startReviewSetup() {
  if (!state.draft.trim()) {
    notify("先写下一点内容，再开始复盘");
    return;
  }
  setState({ route: "reviewSetup", tab: "review" });
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
    scene: normalizeScene(record.scene, type),
    title: record.title || (type === "event" ? "新的事件复盘" : "新的焦虑复盘"),
    date: createdAt,
    createdAt,
    shortDate: displayDate(createdAt),
    rawInput: record.raw_input || record.rawInput || "",
    tags: (record.tags || []).filter((tag) => HOME_REVIEW_TAGS.includes(tag)),
    summary: record.summary || {},
    resultCard,
    conclusion: record.conclusion || firstValue(resultCard) || "已生成一张可执行的复盘卡。",
    note: record.note || record.myNote || "",
    status: savedToCalibration ? "已加入校准" : savedToMethodLibrary ? "已沉淀方法" : "已保存",
    savedToMethodLibrary,
    savedToCalibration,
  };
}

function normalizeMethod(card) {
  const validScenes = (card.scenes || []).filter((scene) => fixedSceneTags("event").includes(scene));
  return {
    id: card.id,
    sourceReviewId: card.source_review_id || card.sourceReviewId || "",
    title: card.title,
    scenes: validScenes.length ? validScenes : ["其他"],
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
    scene: normalizeScene(card.scene, "anxiety"),
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
  const effective = effectiveFieldValue(value);
  return Array.isArray(effective) ? effective[0] : effective;
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
    tags: record.tags || [],
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
      tags: bundle.record.tags || [],
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

async function persistCurrentBundle(destination = "records") {
  if (!state.currentBundle?.record || state.saving) return;
  const previousBundle = state.currentBundle;
  const saveToMethod = destination === "methods";
  const saveToCalibration = destination === "calibration";
  const targetRoute = saveToCalibration ? "calibration" : saveToMethod ? "methods" : "records";
  const targetTab = saveToCalibration ? "calibration" : saveToMethod ? "methods" : "records";
  state.currentBundle.includeMethodCard = saveToMethod;
  state.currentBundle.includeCalibrationCard = saveToCalibration;
  state.currentBundle.record.savedToMethodLibrary = saveToMethod;
  state.currentBundle.record.savedToCalibration = saveToCalibration;
  state.currentBundle.record.status = saveToCalibration ? "已加入校准" : saveToMethod ? "已沉淀方法" : "已保存";
  setState({ saving: true });
  try {
    const saved = await request("/reviews/save", {
      method: "POST",
      body: JSON.stringify(bundlePayload(state.currentBundle)),
    });
    const normalized = normalizeBundle(saved);
    if (!normalized.methodCard && previousBundle.methodCard) normalized.methodCard = previousBundle.methodCard;
    if (!normalized.calibrationCard && previousBundle.calibrationCard) normalized.calibrationCard = previousBundle.calibrationCard;
    normalized.record.status = saveToCalibration ? "已加入校准" : saveToMethod ? "已沉淀方法" : "已保存";
    normalized.record.savedToMethodLibrary = saveToMethod;
    normalized.record.savedToCalibration = saveToCalibration;
    state.currentBundle = normalized;
    upsertRecord(normalized.record);
    if (saveToMethod && normalized.methodCard) upsertMethod(normalized.methodCard);
    if (saveToCalibration && normalized.calibrationCard) upsertCalibration(normalized.calibrationCard);
    clearCompletedReview();
    setState({
      saving: false,
      route: targetRoute,
      tab: targetTab,
      methodView: saveToMethod ? "mine" : state.methodView,
      calibrationView: saveToCalibration ? "cards" : state.calibrationView,
      calibrationTab: "pending",
      apiOnline: true,
    });
    notify(saveToCalibration ? "已保存，并创建待验证的焦虑卡" : saveToMethod ? "已保存，并沉淀为个人方法" : "记录已保存");
  } catch (error) {
    if (handleAuthError(error)) return;
    const normalized = state.currentBundle;
    upsertRecord(normalized.record);
    if (saveToMethod && normalized.methodCard) upsertMethod(normalized.methodCard);
    if (saveToCalibration && normalized.calibrationCard) upsertCalibration(normalized.calibrationCard);
    clearCompletedReview();
    setState({
      saving: false,
      route: targetRoute,
      tab: targetTab,
      methodView: saveToMethod ? "mine" : state.methodView,
      calibrationView: saveToCalibration ? "cards" : state.calibrationView,
      calibrationTab: "pending",
      apiOnline: false,
    });
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

function normalizedCalibrationCheckins() {
  return Array.isArray(state.calibrationCheckins)
    ? state.calibrationCheckins.filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || "")))
    : [];
}

function calibrationWeekState() {
  const start = weekStartMonday();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const key = localDateKey(date);
    return {
      key,
      label: ["一", "二", "三", "四", "五", "六", "日"][index],
      completed: normalizedCalibrationCheckins().some((item) => item.date === key),
    };
  });
  return { days, completed: days.filter((day) => day.completed).length };
}

function persistCalibrationCheckins() {
  localStorage.setItem(CALIBRATION_CHECKINS_KEY, JSON.stringify(normalizedCalibrationCheckins()));
}

function completeCalibrationCheckin() {
  const today = localDateKey();
  const entry = {
    date: today,
    mood: state.calibrationSession.mood,
    feelings: [...state.calibrationSession.feelings],
    note: state.calibrationSession.note.trim(),
    completedAt: localDateTimeKey(),
  };
  state.calibrationCheckins = [
    entry,
    ...normalizedCalibrationCheckins().filter((item) => item.date !== today),
  ];
  persistCalibrationCheckins();
  notify("本次焦虑校准已记录");
}

function stopBreathingExercise({ reset = false } = {}) {
  if (breathingStartFrame) window.cancelAnimationFrame(breathingStartFrame);
  breathingStartFrame = null;
  if (breathingTimer) window.clearInterval(breathingTimer);
  breathingTimer = null;
  state.breathingActive = false;
  if (reset) {
    state.breathingPhase = "吸气";
    state.breathingSeconds = 4;
  }
}

function breathingPhaseToken(phase = state.breathingPhase) {
  return { "吸气": "inhale", "屏息": "hold", "呼气": "exhale" }[phase] || "inhale";
}

function breathingPhaseCopy(phase = state.breathingPhase) {
  return { "吸气": "慢慢吸气", "屏息": "轻轻停留", "呼气": "缓缓呼气" }[phase] || "慢慢吸气";
}

function syncBreathingUi({ phaseChanged = false } = {}) {
  const card = app.querySelector(".breathing-card");
  if (!card) return;

  card.classList.toggle("active", state.breathingActive);
  card.dataset.breathingPhase = breathingPhaseToken();

  const phaseLabel = card.querySelector("[data-breathing-phase-label]");
  const helper = card.querySelector("[data-breathing-helper]");
  const summary = app.querySelector("[data-breathing-summary]");
  const controlIcon = app.querySelector("[data-breathing-control-icon]");
  const controlLabel = state.breathingActive ? "暂停呼吸练习" : "开始呼吸练习";

  if (phaseLabel) {
    phaseLabel.textContent = breathingPhaseCopy();
    if (phaseChanged) {
      phaseLabel.classList.remove("phase-changing");
      window.requestAnimationFrame(() => phaseLabel.classList.add("phase-changing"));
    }
  }
  if (helper) helper.textContent = state.breathingActive ? "跟随圆环的节奏，不用数秒" : "点击呼吸环开始练习";
  if (summary) summary.textContent = state.breathingActive ? breathingPhaseCopy() : "约 8 分钟";
  if (controlIcon) controlIcon.textContent = state.breathingActive ? "Ⅱ" : "▶";
  app.querySelectorAll("[data-breathing-toggle]").forEach((button) => button.setAttribute("aria-label", controlLabel));
}

function startBreathingExercise() {
  stopBreathingExercise({ reset: true });
  render();
  const phases = [
    ["吸气", 4],
    ["屏息", 7],
    ["呼气", 8],
  ];
  breathingStartFrame = window.requestAnimationFrame(() => {
    breathingStartFrame = null;
    state.breathingActive = true;
    syncBreathingUi();
    breathingTimer = window.setInterval(() => {
      if (!state.breathingActive) return;
      let phaseChanged = false;
      if (state.breathingSeconds > 1) {
        state.breathingSeconds -= 1;
      } else {
        const currentIndex = phases.findIndex(([phase]) => phase === state.breathingPhase);
        const [nextPhase, nextSeconds] = phases[(currentIndex + 1) % phases.length];
        state.breathingPhase = nextPhase;
        state.breathingSeconds = nextSeconds;
        phaseChanged = true;
      }
      syncBreathingUi({ phaseChanged });
    }, 1000);
  });
}

function toggleBreathingExercise() {
  if (state.breathingActive) {
    stopBreathingExercise({ reset: true });
    render();
    return;
  }
  startBreathingExercise();
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

function normalizeScene(scene, mode) {
  return fixedSceneTags(mode).includes(scene) ? scene : "其他";
}

function sceneSelect(currentScene, mode, attr = "data-record-scene") {
  const options = fixedSceneTags(mode);
  const value = options.includes(currentScene) ? currentScene : "其他";
  return `<select ${attr}>${options.map((scene) => `<option value="${escapeHtml(scene)}" ${value === scene ? "selected" : ""}>${escapeHtml(scene)}</option>`).join("")}</select>`;
}

function methodSelectedTag(card) {
  const options = fixedSceneTags("event");
  const direct = (card.scenes || []).filter((scene) => options.includes(scene));
  if (direct.length) return direct[0];
  const sourceRecord = store.records.find((record) => record.id === card.sourceReviewId || record.title === card.source);
  if (sourceRecord && options.includes(sourceRecord.scene)) return sourceRecord.scene;
  return "其他";
}

function methodSceneSelect(card) {
  return sceneSelect(methodSelectedTag(card), "event", "data-method-scene");
}

function currentDraftFields() {
  return state.draftFields[state.mode];
}

function currentAdvancedMethod() {
  return ADVANCED_METHODS.find((method) => method.id === state.advancedMethodId) || ADVANCED_METHODS[0];
}

function currentAdvancedFields() {
  const method = currentAdvancedMethod();
  if (!state.advancedDraftFields[method.id]) {
    state.advancedDraftFields[method.id] = { analysis: "", action: "", reminder: "" };
  }
  return state.advancedDraftFields[method.id];
}

function submissionDraftFields() {
  if (state.reviewStyle !== "advanced") return currentDraftFields();
  const fields = currentAdvancedFields();
  if (state.mode === "anxiety") {
    return {
      reality: fields.analysis,
      action: fields.action,
      reminder: fields.reminder,
      verificationDate: currentDraftFields().verificationDate,
    };
  }
  return {
    improvement: fields.analysis,
    next: fields.action,
    reminder: fields.reminder,
  };
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
    .map(stripMarkdownListMarker)
    .filter(Boolean);
}

function markdownText(value) {
  return String(value || "").trim();
}

function hasMarkdownListMarker(value) {
  return String(value || "")
    .split(/\r?\n/)
    .some((line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line));
}

function editableMultilineValue(value) {
  const effective = effectiveFieldValue(value);
  if (Array.isArray(effective)) return effective.join("\n");
  return String(effective || "");
}

function stripMarkdownListMarker(value) {
  return String(value || "")
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function hasDraftValue(value) {
  return Array.isArray(value)
    ? value.some((item) => String(item || "").trim())
    : Boolean(String(value || "").trim());
}

function composeDraftFields() {
  const base = state.draft.trim();
  const fields = submissionDraftFields();
  const lines = state.mode === "event"
    ? [
        ["发生了什么", base],
        ["需要改进的地方", fields.improvement],
        ["下次怎么做", markdownText(fields.next)],
        ["提醒自己", fields.reminder],
      ]
    : [
        ["我在担心什么", base],
        ["现实检查", fields.reality],
        ["我能做什么", markdownText(fields.action)],
        ["提醒自己", fields.reminder],
      ];
  const provided = Object.fromEntries(lines
    .filter(([, value]) => hasDraftValue(value))
    .map(([label, value]) => [label, Array.isArray(value) ? value : String(value).trim()]));
  if (state.reviewStyle === "advanced") {
    const method = currentAdvancedMethod();
    provided["复盘方法"] = method.title;
    method.prompts.forEach(([key, label]) => {
      const value = currentAdvancedFields()[key];
      if (hasDraftValue(value)) provided[label] = String(value).trim();
    });
  }
  return provided;
}

function buildLocalBundle(rawInput, mode, scene, tags = state.homeTags) {
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
    tags,
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

function buildManualBundle(rawInput, mode, scene, fields = submissionDraftFields()) {
  const bundle = buildLocalBundle(rawInput, mode, scene);
  if (mode === "event") {
    const nextText = markdownText(fields.next);
    const nextSteps = splitLines(nextText);
    const improvement = fields.improvement.trim();
    const reminder = fields.reminder.trim();
    bundle.record.summary = {
      发生了什么: rawInput,
      需要改进的地方: improvement,
      下次怎么做: nextText || bundle.record.summary.下次怎么做,
      提醒自己: reminder,
    };
    bundle.record.resultCard = {
      需要改进的地方: improvement,
      下次怎么做: nextText || bundle.record.resultCard.下次怎么做,
      提醒自己: reminder,
    };
    if (bundle.methodCard) {
      if (nextSteps.length) bundle.methodCard.steps = nextSteps;
      if (improvement) bundle.methodCard.trigger = improvement;
      if (reminder) bundle.methodCard.reminder = reminder;
    }
  } else {
    const actionText = markdownText(fields.action);
    const actionSteps = splitLines(actionText);
    const reminder = fields.reminder.trim();
    bundle.record.summary = {
      我在担心什么: rawInput,
      现实检查: fields.reality.trim(),
      我能做什么: actionText || bundle.record.summary.我能做什么,
      提醒自己: reminder,
    };
    bundle.record.resultCard = {
      我能做什么: actionText || bundle.record.resultCard.我能做什么,
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

function methodSourceRecord(card = {}) {
  const sourceId = String(card.sourceReviewId || card.source_review_id || "").trim();
  if (sourceId) {
    const direct = store.records.find((record) => record.id === sourceId);
    if (direct) return direct;
  }
  const source = String(card.source || "").trim();
  return store.records.find((record) => record.id === source || record.title === source) || null;
}

function methodSourceLabel(cardOrSource) {
  if (cardOrSource && typeof cardOrSource === "object") {
    const record = methodSourceRecord(cardOrSource);
    if (record) return record.title;
    const sourceValue = String(cardOrSource.source || "").trim();
    if (!sourceValue || /^event-[a-z0-9-]+$/i.test(sourceValue) || /^local-\d+$/i.test(sourceValue)) return "";
    return sourceValue;
  }
  const value = String(cardOrSource || "").trim();
  if (!value || /^event-[a-z0-9-]+$/i.test(value) || /^local-\d+$/i.test(value)) return "";
  return value;
}

function findMethodForRecord(record) {
  return store.methods.find((method) => method.sourceReviewId === record.id || method.source === record.title || method.source === record.id);
}

function createMethodFromRecord(record) {
  const steps = effectiveFieldValue(record.resultCard?.下次怎么做 || record.resultCard?.["下次怎么做"] || []);
  const parsedSteps = Array.isArray(steps) ? steps : splitLines(steps);
  const method = normalizeMethod({
    id: `local-method-${Date.now()}`,
    sourceReviewId: record.id,
    title: `${record.title.slice(0, 14)}方法卡`,
    scenes: [record.scene],
    trigger: effectiveFieldValue(record.summary?.需要改进的地方) || "再次遇到类似情况前",
    steps: parsedSteps.length ? parsedSteps : ["复述当前情况", "确认目标和边界", "列出下一步行动"],
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
    worry: effectiveFieldValue(summary.我在担心什么) || record.rawInput || record.title,
    scene: record.scene,
    estimatedProbability: "待校准",
    verificationDate: "",
    status: "pending",
    finalResult: "",
    actualImpact: "",
    calibrationConclusion: effectiveFieldValue(resultCard.提醒自己) || effectiveFieldValue(summary.现实检查) || "",
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
  return objectFields(object, fallback).map(([label, value]) => {
    return [label, editableMultilineValue(value)];
  });
}

function parseEditableValue(value, originalValue) {
  const effective = effectiveFieldValue(originalValue);
  if (!Array.isArray(effective)) return markdownText(value);
  if (hasMarkdownListMarker(value)) return markdownText(value);
  return splitLines(value);
}

function shell(content) {
  const username = state.authUser?.username || "已登录";
  const notifications = notificationItems();
  const theme = resolvedTheme();
  const weekStart = weekStartMonday();
  const weekEnd = addDays(weekStart, 6);
  const weeklyReviews = store.records.filter((record) => {
    const date = new Date(record.date || record.createdAt || "");
    return !Number.isNaN(date.getTime()) && date >= weekStart && date <= addDays(weekEnd, 1);
  }).length;
  const pendingCalibrations = store.calibrations.filter((card) => card.status === "pending").length;
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
      <div class="growth-card sidebar-progress-card">
        <span>本周进展</span>
        <strong>${weeklyReviews}<small> 次复盘</small></strong>
        <div><span>${store.methods.length} 张方法</span><span>${pendingCalibrations} 张待验证</span></div>
        <button class="outline-button" data-tab="records">查看成长轨迹</button>
      </div>
    </aside>
    <section class="workspace workspace-${state.route}">
      <header class="top-header">
        <label class="search-box">
          <input data-search value="${escapeHtml(state.query)}" placeholder="搜索记录、方法与校准卡..." />
          <button type="button" data-search-submit aria-label="搜索">${icons.search}</button>
        </label>
        <button class="header-icon theme-toggle" data-theme-toggle type="button" aria-label="${theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}" title="${theme === "dark" ? "浅色模式" : "深色模式"}">
          ${theme === "dark" ? icons.sun : icons.moon}
        </button>
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
  const theme = resolvedTheme();
  return `
    <section class="auth-page">
      <div class="auth-panel">
        <button class="header-icon theme-toggle auth-theme-toggle" data-theme-toggle type="button" aria-label="${theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}" title="${theme === "dark" ? "浅色模式" : "深色模式"}">
          ${theme === "dark" ? icons.sun : icons.moon}
        </button>
        <div class="brand auth-brand">${leafLogo()}<div><div class="brand-name">复盘</div></div></div>
        <form id="auth-form" name="auth-form" class="auth-form" data-auth-form method="post" action="/api/auth/${isRegister ? "register" : "login"}" autocomplete="on">
          <h1>${isRegister ? "创建账号" : "登录账号"}</h1>
          <p>登录后才能使用复盘、方法库和校准功能。</p>
          <label for="auth-username">账号<input id="auth-username" name="username" data-auth-username type="text" inputmode="text" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escapeHtml(state.authDraft.username)}" placeholder="${isRegister ? "例如 zhangsan" : ""}" /></label>
          <label for="auth-password">密码<input id="auth-password" name="password" data-auth-password type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required value="${escapeHtml(state.authDraft.password)}" placeholder="${isRegister ? "至少 8 位，包含字母和数字" : ""}" /></label>
          <button class="primary-button auth-submit" type="submit" ${state.authSubmitting ? "disabled" : ""}>
            ${state.authSubmitting ? "处理中..." : isRegister ? "创建并登录" : "登录"}
          </button>
          <div class="auth-links">
            ${isRegister ? "" : `<span class="text-link auth-help-text">忘记账号密码请联系管理员</span>`}
            <button class="text-link" type="button" data-auth-mode="${isRegister ? "login" : "register"}">
              ${isRegister ? "已有账号，去登录" : "没有账号，创建一个"}
            </button>
          </div>
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
  return `<img class="desk-art ${size}" src="./assets/reflective-desk.png" alt="" aria-hidden="true" loading="lazy" decoding="async" />`;
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
  const tagsLabel = homeTagsLabel();
  const sceneLabel = state.scene || "选择情境";
  const isEvent = mode === "event";
  return shell(`
    <main class="home-page home-landing-page editorial-home-page">
      <header class="home-titlebar"><div><h1>复盘</h1><p>把经历整理成下一次能用的行动</p></div></header>
      <section class="home-start-card">
        <div class="home-start-copy">
          <div class="home-start-heading">
            <h2>${isEvent ? "复盘一件事" : "安放一次焦虑"} <span>⌁</span></h2>
            <div class="home-mode-switch" role="tablist" aria-label="复盘类型">
              <button class="${isEvent ? "active" : ""}" data-mode="event" role="tab" aria-selected="${isEvent}">事件复盘</button>
              <button class="${!isEvent ? "active" : ""}" data-mode="anxiety" role="tab" aria-selected="${!isEvent}">焦虑复盘</button>
            </div>
          </div>
          <label class="home-draft-field"><textarea data-draft maxlength="1200" placeholder="${escapeHtml(modePlaceholder(mode))}">${escapeHtml(state.draft)}</textarea></label>
          <div class="home-start-meta">
            <div class="home-meta-control">
              <button class="home-meta-trigger ${state.homeTags.length ? "selected" : ""}" type="button" data-home-meta="tags" aria-expanded="${state.homeMetaOpen === "tags"}">◇ ${escapeHtml(tagsLabel)}</button>
              ${state.homeMetaOpen === "tags" ? homeTagsPopover() : ""}
            </div>
            <div class="home-meta-control">
              <button class="home-meta-trigger selected" type="button" data-home-meta="scene" aria-expanded="${state.homeMetaOpen === "scene"}">◎ ${escapeHtml(sceneLabel)}</button>
              ${state.homeMetaOpen === "scene" ? homeScenePopover(mode) : ""}
            </div>
            <button class="home-start-button" data-home-analyze>✎ ${isEvent ? "开始复盘" : "开始校准"}</button>
          </div>
        </div>
        <div class="home-start-art"><span>⌁</span><i></i><i></i></div>
      </section>
      <section class="home-insight-grid">
        ${weekPanel()}
        ${homeInsightPanel()}
        ${recentPanel()}
        ${inspirationPanel()}
      </section>
    </main>
  `);
}

function homeTagsLabel() {
  if (!state.homeTags.length) return "添加标签";
  if (state.homeTags.length <= 2) return state.homeTags.join("、");
  return `${state.homeTags.slice(0, 2).join("、")}等${state.homeTags.length}项`;
}

function homeTagsPopover() {
  return `
    <section class="home-meta-popover tags-popover" aria-label="选择标签">
      <div class="home-meta-popover-head"><strong>添加标签</strong><small>可多选</small></div>
      <div class="home-meta-options">${HOME_REVIEW_TAGS.map((tag) => `<button type="button" class="${state.homeTags.includes(tag) ? "selected" : ""}" data-home-tag="${escapeHtml(tag)}" aria-pressed="${state.homeTags.includes(tag)}">${escapeHtml(tag)}</button>`).join("")}</div>
      <button class="home-meta-done" type="button" data-home-meta-done>完成</button>
    </section>
  `;
}

function homeScenePopover(mode) {
  return `
    <section class="home-meta-popover scene-popover" aria-label="选择情境">
      <div class="home-meta-popover-head"><strong>选择情境</strong><small>用于匹配复盘结构</small></div>
      <div class="home-meta-options">${scenes[mode].map((scene) => `<button type="button" class="${state.scene === scene ? "selected" : ""}" data-home-scene="${escapeHtml(scene)}" aria-pressed="${state.scene === scene}">${escapeHtml(scene)}</button>`).join("")}</div>
    </section>
  `;
}

function homeReviewContextSummary() {
  const parts = [`情境：${state.scene}`];
  if (state.homeTags.length) parts.push(`标签：${state.homeTags.join("、")}`);
  return parts.join(" · ");
}

function reviewSetupPage() {
  const method = currentAdvancedMethod();
  return shell(`
    <main class="content-page review-setup-page">
      ${pageHeader("选择复盘方式", "home")}
      <p class="setup-intro">先确认复盘类型和场景，再选择适合的整理方式。</p>
      ${reviewContextControls(state.mode)}
      <div class="review-context-summary">${escapeHtml(homeReviewContextSummary())}</div>
      ${reviewStyleControls()}
      ${state.reviewStyle === "advanced" ? advancedMethodPicker() : ""}
      <section class="input-panel review-workbench">
        <div class="workbench-head">
          <div><span>${state.reviewStyle === "quick" ? "快速复盘" : `高级复盘 · ${escapeHtml(method.title)}`}</span><p>${state.reviewStyle === "quick" ? "用四个基本问题，把经历变成下一次可执行的行动。" : escapeHtml(method.description)}</p></div>
          <button class="text-button" data-route="home">编辑原始描述</button>
        </div>
        ${structuredDraftForm(state.mode)}
        <div class="input-footer">
          <strong>${state.reviewStyle === "quick" ? "默认模板会生成你的行动卡。" : `将以「${escapeHtml(method.title)}」整理本次复盘。`}</strong>
          <button class="ghost-button" data-home-ai ${state.loading ? "disabled" : ""}>${state.loading ? "整理中..." : "AI 生成"}</button>
          <button class="primary-button" data-start-manual>生成行动卡 ${icons.chevron}</button>
        </div>
      </section>
    </main>
  `);
}

function reviewStyleControls() {
  return `
    <div class="review-style-switch" role="tablist" aria-label="复盘方式">
      <button class="${state.reviewStyle === "quick" ? "active" : ""}" data-review-style="quick" role="tab" aria-selected="${state.reviewStyle === "quick"}">
        <span class="style-mark">01</span><span><b>快速复盘</b><small>默认模板 · 4 个关键问题</small></span>
      </button>
      <button class="${state.reviewStyle === "advanced" ? "active" : ""}" data-review-style="advanced" role="tab" aria-selected="${state.reviewStyle === "advanced"}">
        <span class="style-mark">02</span><span><b>高级复盘</b><small>选择一个方法，换一种视角看问题</small></span>
      </button>
    </div>
  `;
}

function advancedMethodPicker() {
  return `
    <section class="advanced-method-picker" aria-label="高级复盘方法">
      <div class="picker-head"><span>选择方法</span><p>不同方法只改变提问方式，原始描述始终保留。</p></div>
      <div class="method-choice-grid">
        ${ADVANCED_METHODS.map((method) => `
          <button class="method-choice ${state.advancedMethodId === method.id ? "selected" : ""}" data-advanced-method="${method.id}">
            <span class="method-choice-art ${method.art}" aria-hidden="true">${methodIcon(method.art)}</span>
            <span><b>${escapeHtml(method.title)}</b><small>${escapeHtml(method.tag)}</small></span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function structuredDraftForm(mode) {
  if (state.reviewStyle === "advanced") return advancedStructuredDraftForm();
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

function advancedStructuredDraftForm() {
  const method = currentAdvancedMethod();
  const fields = currentAdvancedFields();
  return `
    <div class="structured-draft advanced-draft">
      <label class="draft-field draft-field-main source-summary">
        <span>本次描述</span>
        <textarea data-draft maxlength="1200" placeholder="写下发生了什么。">${escapeHtml(state.draft)}</textarea>
      </label>
      <div class="draft-field-grid">
        ${method.prompts.map(([key, label, placeholder]) => `
          <label class="draft-field">
            <span>${escapeHtml(label)}</span>
            <textarea data-advanced-field="${key}" maxlength="800" placeholder="${escapeHtml(placeholder)}">${escapeHtml(fields[key] || "")}</textarea>
          </label>
        `).join("")}
      </div>
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
  const recent = store.records.slice(0, 3);
  return `
    <article class="panel recent-panel">
      <div class="panel-head"><h2>最近复盘</h2><button data-tab="records">查看全部 ${icons.chevron}</button></div>
      <div class="recent-list">
        ${recent.length ? recent.map((record, index) => `
          <button class="recent-item" data-detail="${record.id}">
            <span class="recent-icon tone-${index % 2}">${record.type === "event" ? icons.note : "❤"}</span>
            <span><strong>${record.title}</strong><small>${typeText(record.type)} · ${record.scene}</small></span>
            <em>${record.shortDate}</em>
          </button>
        `).join("") : `
          <div class="panel-empty-state">
            <span>✦</span><strong>还没有复盘记录</strong>
            <small>写下第一件值得回看的事。</small>
            <button data-new-review>开始第一次复盘</button>
          </div>
        `}
      </div>
    </article>
  `;
}

function homeInsightPanel() {
  const start = weekStartMonday();
  const end = addDays(start, 7);
  const weekRecords = store.records.filter((record) => {
    const date = new Date(record.date || record.createdAt || "");
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  }).length;
  const pending = store.calibrations.filter((card) => card.status === "pending").length;
  const metrics = [
    ["本周复盘", `${weekRecords} 次`, Math.min(100, weekRecords * 25)],
    ["方法沉淀", `${store.methods.length} 张`, Math.min(100, store.methods.length * 20)],
    ["焦虑待验证", `${pending} 张`, pending ? Math.min(100, 35 + pending * 15) : 0],
  ];
  return `
    <article class="panel home-mood-panel">
      <h2>成长概览 <span>⌁</span></h2>
      ${metrics.map(([label, value, progress]) => `
        <div class="mood-insight-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b><i style="--insight-progress:${progress}%"></i></div>
      `).join("")}
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
          ? `<button class="ghost-button" data-save-bundle="records" ${state.saving ? "disabled" : ""}>仅保存记录</button>
             <button class="primary-button" data-save-bundle="methods" ${state.saving ? "disabled" : ""}>${state.saving ? "保存中..." : "保存并沉淀方法"}</button>`
          : `<button class="primary-button" data-save-bundle="calibration" ${state.saving ? "disabled" : ""}>${state.saving ? "保存中..." : "保存并创建验证卡"}</button>`}
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
        return `<article class="field-card">${numbered ? `<span class="number">${index + 1}</span>` : ""}<h3>${escapeHtml(label)}</h3>${body}</article>`;
      }).join("")}
    </div>
  `;
}

function sectionedFields(title, fields) {
  return fields.map(([label, value]) => [`${title} · ${label}`, value]);
}

function fieldBody(value) {
  if (isAssistedField(value)) {
    const userContent = value.user_content;
    const suggestion = value.ai_suggestion;
    return `
      <div class="assisted-field">
        <section class="field-source user-source">
          <span>你的记录</span>
          ${basicFieldBody(userContent)}
        </section>
        ${displayValue(suggestion) ? `
          <section class="field-source ai-source">
            <span>AI 补充</span>
            ${basicFieldBody(suggestion)}
          </section>
        ` : ""}
      </div>
    `;
  }
  return basicFieldBody(value);
}

function basicFieldBody(value) {
  if (Array.isArray(value)) {
    return `<ol>${value.map((item) => `<li>${renderInlineMarkdown(displayValue(item))}</li>`).join("")}</ol>`;
  }
  const text = displayValue(value);
  return renderMarkdown(text);
}

function isAssistedField(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "user_content" in value);
}

function effectiveFieldValue(value) {
  if (!isAssistedField(value)) return value;
  return value.user_content || value.ai_suggestion || "";
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

function renderMarkdown(value) {
  const text = normalizeInlineOrderedLists(String(value || "").replace(/\r\n/g, "\n")).trim();
  if (!text) return "<p></p>";

  const html = [];
  const paragraph = [];
  let list = null;
  let quoteLines = [];
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join("\n"))}</p>`);
    paragraph.length = 0;
  };
  const flushList = () => {
    if (!list) return;
    const classAttr = list.task ? ` class="task-list"` : "";
    const items = list.items.map((item) => {
      if (item && typeof item === "object") {
        const checked = item.checked ? " checked" : "";
        return `<li><input type="checkbox" disabled${checked} aria-label="${item.checked ? "已完成" : "未完成"}" /><span>${renderInlineMarkdown(item.text)}</span></li>`;
      }
      return `<li>${renderInlineMarkdown(item)}</li>`;
    }).join("");
    html.push(`<${list.type}${classAttr}>${items}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    html.push(`<blockquote>${quoteLines.map((line) => `<p>${renderInlineMarkdown(line)}</p>`).join("")}</blockquote>`);
    quoteLines = [];
  };
  const flushBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  const splitTableRow = (line) => line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
  const isTableSeparator = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const isTableStart = (lines, index) => (
    index + 1 < lines.length
    && lines[index].includes("|")
    && isTableSeparator(lines[index + 1])
  );
  const renderTable = (tableLines) => {
    const header = splitTableRow(tableLines[0]);
    const rows = tableLines.slice(2).map(splitTableRow);
    return `
      <div class="markdown-table-wrap">
        <table>
          <thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${header.map((_, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  };

  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^```([a-z0-9_-]*)\s*$/i);
    if (fence) {
      if (inCodeBlock) {
        const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
        html.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCodeBlock = false;
        codeLanguage = "";
        codeLines = [];
      } else {
        flushBlocks();
        inCodeBlock = true;
        codeLanguage = fence[1] || "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushBlocks();
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushBlocks();
      html.push("<hr />");
      continue;
    }

    if (isTableStart(lines, index)) {
      flushBlocks();
      const tableLines = [line, lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      html.push(renderTable(tableLines));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushBlocks();
      const level = Math.min(6, heading[1].length + 2);
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }

    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (task || unordered || ordered) {
      flushParagraph();
      flushQuote();
      const type = ordered ? "ol" : "ul";
      const taskList = Boolean(task);
      if (!list || list.type !== type || Boolean(list.task) !== taskList) flushList();
      if (!list) list = { type, task: taskList, items: [] };
      list.items.push(task ? { checked: task[1].toLowerCase() === "x", text: task[2] } : (unordered || ordered)[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  if (inCodeBlock) {
    const languageClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : "";
    html.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushBlocks();
  return html.join("");
}

function normalizeInlineOrderedLists(value) {
  return String(value || "")
    .split("\n")
    .map((line) => (
      /^\s*1[.)]\s+/.test(line)
        ? line.replace(/\s+((?:[2-9]|[1-9]\d+)[.)]\s+)/g, "\n$1")
        : line
    ))
    .join("\n");
}

function renderInlineMarkdown(value) {
  const codeTokens = [];
  let html = escapeHtml(value).replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });
  html = html.replace(/!\[([^\]\n]*)\]\(((?:https?:\/\/)[^\s)]+)\)/g, (_match, alt, src) => (
    `<img src="${src}" alt="${alt}" loading="lazy" />`
  ));
  html = html.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, (_match, label, href) => (
    `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`
  ));
  html = html.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br />");
  codeTokens.forEach((code, index) => {
    html = html.replaceAll(`@@CODE${index}@@`, code);
  });
  return html;
}

function pageIntro(title, subtitle) {
  return `
    <header class="library-page-head">
      <h1 class="list-title">${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </header>
  `;
}

function compactSearch(placeholder) {
  return `
    <label class="compact-page-search">
      <input data-search value="${escapeHtml(state.query)}" placeholder="${escapeHtml(placeholder)}" />
      <button type="button" data-search-submit aria-label="搜索">${icons.search}</button>
    </label>
  `;
}

function libraryToolbar(title, actionLabel = "新建复盘", mode = "") {
  return `
    <header class="library-toolbar">
      <h1>${escapeHtml(title)}</h1>
      <div class="library-toolbar-actions">
        <button class="library-cta" data-new-review ${mode ? `data-new-review-mode="${mode}"` : ""}>${escapeHtml(actionLabel)} ${icons.chevron}</button>
      </div>
    </header>
  `;
}

function recordsPage() {
  const timelineFilters = ["全部", "工作", "学习", "生活", "人际", "情感", "面试"];
  const filtered = store.records.filter((record) => matchesFilter(record, state.filter) && matchesQuery(searchRecordValues(record)));
  return shell(`
    <main class="content-page library-page records-library-page">
      ${libraryToolbar("我的记录")}
      <div class="records-filter-row">${filterRow(timelineFilters)}</div>
      <section class="record-timeline">${filtered.map(timelineRecord).join("") || emptyState("没有找到匹配的记录")}</section>
    </main>
  `);
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
  const templateFilters = ["全部", "复盘框架", "思维模型", "情绪管理", "目标行动", "结构表达", "学习成长", "沟通协作", "决策判断"];
  const personalFilters = ["全部", ...fixedSceneTags("event")];
  const filters = state.methodView === "mine" ? personalFilters : templateFilters;
  const selected = filters.includes(state.filter) ? state.filter : "全部";
  const templates = ADVANCED_METHODS.filter((method) => (
    selected === "全部" || method.category === selected || method.tag === selected
  ) && matchesQuery([method.title, method.category, method.tag, method.description]));
  const personalMethods = store.methods.filter((method) => (
    selected === "全部" || method.scenes.includes(selected)
  ) && matchesQuery(searchMethodValues(method)));
  return shell(`
    <main class="content-page library-page methods-library-page">
      ${libraryToolbar("方法库", "开始事件复盘", "event")}
      <div class="library-view-tabs" role="tablist" aria-label="方法库内容">
        <button class="${state.methodView === "templates" ? "active" : ""}" data-method-view="templates" role="tab" aria-selected="${state.methodView === "templates"}">复盘方法 <span>${ADVANCED_METHODS.length}</span></button>
        <button class="${state.methodView === "mine" ? "active" : ""}" data-method-view="mine" role="tab" aria-selected="${state.methodView === "mine"}">我的方法 <span>${store.methods.length}</span></button>
      </div>
      <div class="method-library-filters">${filterRow(filters, selected)}</div>
      ${state.methodView === "templates"
        ? `<div class="method-template-grid">${templates.map(methodTemplateCard).join("") || emptyState("没有找到匹配的方法")}</div>`
        : `<div class="method-grid personal-method-grid">${personalMethods.map(methodCard).join("") || personalMethodsEmptyState()}</div>`}
    </main>
  `);
}

function personalMethodsEmptyState() {
  return `
    <article class="library-empty-state">
      <span>✦</span><h2>还没有沉淀个人方法</h2>
      <p>完成一次事件复盘后，选择“保存并沉淀方法”，可复用的方法会出现在这里。</p>
      <button class="primary-button" data-new-review data-new-review-mode="event">开始事件复盘</button>
    </article>
  `;
}

function calibrationPage() {
  const cards = calibrationCardsForPage();
  const pending = cards.filter((card) => card.status === "pending");
  const verified = cards.filter((card) => card.status === "verified");
  const week = calibrationWeekState();
  const coreFeelings = ["紧张不安", "思绪纷乱", "压力较大", "胸闷烦躁", "身体疲惫"];
  const extraFeelings = ["难以入睡", "心跳加快", "注意涣散", "害怕失败"];
  const feelings = state.calibrationSession.extraOpen ? [...coreFeelings, ...extraFeelings] : coreFeelings;
  const checkins = normalizedCalibrationCheckins();
  return shell(`
    <main class="content-page calibration-visual-page">
      <header class="calibration-toolbar">
        <div><h1>情绪与焦虑校准 <span>⌁</span></h1><p>先照顾此刻的感受，再用事实验证担心。</p></div>
        <div class="calibration-view-switch" role="tablist" aria-label="校准内容">
          <button class="${state.calibrationView === "checkin" ? "active" : ""}" data-calibration-view="checkin" role="tab" aria-selected="${state.calibrationView === "checkin"}">此刻安定</button>
          <button class="${state.calibrationView === "cards" ? "active" : ""}" data-calibration-view="cards" role="tab" aria-selected="${state.calibrationView === "cards"}">焦虑验证 <span>${pending.length}</span></button>
        </div>
      </header>
      ${state.calibrationView === "checkin"
        ? calibrationCheckinView({ week, feelings, checkins })
        : calibrationCardsView(pending, verified)}
    </main>
  `);
}

function moodFaceIcon(mood) {
  const expressions = {
    "很平静": `
      <path d="M4.5 8c1.2 1.2 2.4 1.2 3.6 0" />
      <path d="M15.9 8c1.2 1.2 2.4 1.2 3.6 0" />
      <path d="M7 13.5c2.6 3.2 7.4 3.2 10 0" />
    `,
    "平静": `
      <circle cx="7" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="8" r="1" fill="currentColor" stroke="none" />
      <path d="M8 14c2.2 2.2 5.8 2.2 8 0" />
    `,
    "一般": `
      <circle cx="7" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="8" r="1" fill="currentColor" stroke="none" />
      <path d="M8 15h8" />
    `,
    "焦虑": `
      <path d="M4.5 6.5 8.5 7.5" />
      <path d="m15.5 7.5 4-1" />
      <circle cx="7" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <path d="M8 17c2.2-2.2 5.8-2.2 8 0" />
    `,
    "很焦虑": `
      <path d="M4.5 7 8.5 5.8" />
      <path d="m15.5 5.8 4 1.2" />
      <circle cx="7" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="9.5" r="1" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="16" rx="3.2" ry="2.2" />
    `,
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${expressions[mood] || expressions["一般"]}</svg>`;
}

function calibrationCheckinView({ week, feelings, checkins }) {
  const moods = ["很平静", "平静", "一般", "焦虑", "很焦虑"];
  return `
      <section class="calibration-hero-grid">
        <article class="calibration-checkin-card">
          <h2>此刻的你</h2>
          <div class="mood-scale" role="group" aria-label="当前情绪">
            ${moods.map((label) => `<button type="button" class="${state.calibrationSession.mood === label ? "selected" : ""}" data-mood="${label}" aria-label="当前情绪：${label}" aria-pressed="${state.calibrationSession.mood === label}"><i>${moodFaceIcon(label)}</i><span>${label}</span></button>`).join("")}
          </div>
          <h3>我感受到</h3>
          <div class="feeling-tags">${feelings.map((item) => `<button class="${state.calibrationSession.feelings.includes(item) ? "selected" : ""}" data-feeling="${item}" aria-pressed="${state.calibrationSession.feelings.includes(item)}">${item}</button>`).join("")}<button class="${state.calibrationSession.extraOpen ? "selected" : ""}" data-calibration-more aria-label="${state.calibrationSession.extraOpen ? "收起更多感受" : "查看更多感受"}">${state.calibrationSession.extraOpen ? "收起" : "···"}</button></div>
          <textarea class="calibration-note" data-calibration-note placeholder="写下此刻的感受（可选）…">${escapeHtml(state.calibrationSession.note)}</textarea>
          <div class="calibration-checkin-actions"><span>${state.calibrationSession.feelings.length ? `已选择 ${state.calibrationSession.feelings.length} 项感受` : "选择感受后完成本次校准"}</span><button data-complete-calibration>完成本次校准</button></div>
        </article>
        <article class="breathing-card ${state.breathingActive ? "active" : ""}" data-breathing-phase="${breathingPhaseToken()}">
          <p>深呼吸</p><button class="breathing-ring" data-breathing-toggle aria-label="${state.breathingActive ? "暂停呼吸练习" : "开始呼吸练习"}"><span class="breathing-ring-copy"><span data-breathing-phase-label>${breathingPhaseCopy()}</span></span></button><small data-breathing-helper>${state.breathingActive ? "跟随圆环的节奏，不用数秒" : "点击呼吸环开始练习"}</small>
        </article>
      </section>
      <section class="calibration-bottom-grid">
        <article class="calibration-progress-card"><h3>本周校准进度</h3><p>已完成 <b>${week.completed}</b> / 7 天</p><div class="progress-week">${week.days.map((day) => `<span class="${day.completed ? "done" : ""}" title="${day.key}">${day.completed ? "✓" : day.label}</span>`).join("")}</div></article>
        <article class="calibration-advice-card"><h3>建议练习</h3><strong>舒缓呼吸</strong><p data-breathing-summary>${state.breathingActive ? breathingPhaseCopy() : "约 8 分钟"}</p><button data-breathing-toggle data-breathing-control-icon aria-label="${state.breathingActive ? "暂停呼吸练习" : "开始呼吸练习"}">${state.breathingActive ? "Ⅱ" : "▶"}</button><span>⌁</span></article>
      </section>
      <div class="calibration-history-actions"><button class="history-button ${state.calibrationHistoryOpen ? "active" : ""}" data-calibration-history-toggle>◴ ${state.calibrationHistoryOpen ? "收起历史" : "查看情绪记录"}</button></div>
      ${state.calibrationHistoryOpen ? `<section class="calibration-history-panel"><div class="panel-head"><h2>情绪记录</h2><span>${checkins.length} 次校准</span></div>${checkins.length ? `<div class="checkin-history-list">${checkins.map((item) => `<article><time>${escapeHtml(item.date)}</time><strong>${escapeHtml(item.mood || "未记录")}</strong><p>${escapeHtml((item.feelings || []).join("、") || "未选择感受")}</p>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}</article>`).join("")}</div>` : emptyState("还没有完成过情绪校准")}</section>` : ""}
  `;
}

function calibrationCardsView(pending, verified) {
  const showingPending = state.calibrationTab === "pending";
  const cards = showingPending ? pending : verified;
  return `
    <section class="calibration-cards-view">
      <header class="calibration-cards-head">
        <div class="calibration-status-tabs" role="tablist" aria-label="焦虑卡状态">
          <button class="${showingPending ? "active" : ""}" data-cal-tab="pending" role="tab" aria-selected="${showingPending}">待验证 <span>${pending.length}</span></button>
          <button class="${!showingPending ? "active" : ""}" data-cal-tab="verified" role="tab" aria-selected="${!showingPending}">已验证 <span>${verified.length}</span></button>
        </div>
        <button class="primary-button" data-new-review data-new-review-mode="anxiety">记录一次焦虑</button>
      </header>
      <p class="calibration-cards-intro">${showingPending ? "到期后回来看事实是否发生，以及实际影响有多大。" : "回看过去的担心，逐步校准对概率和后果的判断。"}</p>
      <div class="calibration-card-grid">
        ${cards.map(calibrationCard).join("") || `<article class="library-empty-state"><span>◎</span><h2>${showingPending ? "没有待验证的焦虑卡" : "还没有已验证的记录"}</h2><p>${showingPending ? "从一次焦虑复盘开始，给担心设置验证日期。" : "完成待验证卡后，校准结论会沉淀在这里。"}</p>${showingPending ? `<button class="primary-button" data-new-review data-new-review-mode="anxiety">开始焦虑复盘</button>` : ""}</article>`}
      </div>
    </section>
  `;
}

function searchPage() {
  const query = state.query.trim();
  const records = query ? store.records.filter((record) => matchesQuery(searchRecordValues(record))) : [];
  const templates = query ? ADVANCED_METHODS.filter((method) => matchesQuery([method.title, method.category, method.tag, method.description])) : [];
  const methods = query ? store.methods.filter((card) => matchesQuery(searchMethodValues(card))) : [];
  const calibrations = query ? store.calibrations.filter((card) => matchesQuery(searchCalibrationValues(card))) : [];
  const total = records.length + templates.length + methods.length + calibrations.length;
  const emptyText = query ? "没有找到匹配的内容" : "输入关键词后按 Enter 搜索";

  return shell(`
    <main class="content-page">
      <h1 class="list-title">搜索结果</h1>
      ${query ? `<p class="record-meta">找到 ${total} 条与「${escapeHtml(query)}」相关的内容</p>` : ""}
      ${total ? `
        ${records.length ? `<section class="search-section"><h2>复盘记录</h2><div class="card-list">${records.map(recordCard).join("")}</div></section>` : ""}
        ${templates.length ? `<section class="search-section"><h2>复盘方法</h2><div class="method-template-grid search-template-grid">${templates.map(methodTemplateCard).join("")}</div></section>` : ""}
        ${methods.length ? `<section class="search-section"><h2>我的方法</h2><div class="method-grid">${methods.map(methodCard).join("")}</div></section>` : ""}
        ${calibrations.length ? `<section class="search-section"><h2>校准卡</h2><div class="card-list">${calibrations.map(calibrationCard).join("")}</div></section>` : ""}
      ` : emptyState(emptyText)}
    </main>
  `);
}

function detailPage() {
  const record = store.records.find((item) => item.id === state.selectedRecordId) || store.records[0];
  if (!record) {
    return shell(`<main class="content-page narrow-page">${pageHeader("详情", "records")}${emptyState("这条记录不存在或已被删除")}</main>`);
  }
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
        <p><span>${escapeHtml(record.scene)}</span>${record.tags.length ? `<span>${escapeHtml(record.tags.join(" · "))}</span>` : ""}<span>${displayDate(record.date, { full: true })}</span></p>
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

function cardTypeLabel(record) {
  return record.type === "anxiety" ? "焦虑复盘" : "事件复盘";
}

function recordMainLabel(record) {
  return record.type === "anxiety" ? "当时担心" : "当时发生";
}

function cardMeta(items) {
  return items.filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function cardBadge(label, tone = "") {
  return `<span class="card-badge ${tone}">${escapeHtml(label)}</span>`;
}

function librarySection(label, body, options = {}) {
  const className = options.className ? ` ${options.className}` : "";
  return `
    <section class="record-preview-item library-section${className}">
      <h4>${escapeHtml(label)}</h4>
      ${body}
    </section>
  `;
}

function fieldSection(label, value, options = {}) {
  return librarySection(label, fieldBody(value), options);
}

function textSection(label, value, options = {}) {
  return librarySection(label, renderMarkdown(displayValue(value) || "未填写"), options);
}

function statusPill(status) {
  return `<span class="status-pill">${escapeHtml(status)}</span>`;
}

function scenesSection(label, scenes = []) {
  const tags = (scenes.length ? scenes : ["其他"]).map((scene) => `<span>${escapeHtml(scene)}</span>`).join("");
  return librarySection(label, `<div class="method-tags compact-tags">${tags}</div>`);
}

function methodStepChips(steps = []) {
  return `
    <div class="method-step-chips">
      ${(steps.length ? steps : ["确认目标", "明确下一步"]).map((step, index) => `
        <span><b>${index + 1}</b>${renderInlineMarkdown(step)}</span>
      `).join("")}
    </div>
  `;
}

function timelineRecord(record, index) {
  const iconName = record.type === "anxiety" ? "♡" : index % 3 === 0 ? "▣" : "▤";
  const date = displayDate(record.date || record.createdAt, { full: true }) || "今天";
  const tagSummary = record.tags.length ? ` · ${record.tags.slice(0, 2).join("、")}` : "";
  return `
    <article class="timeline-record" data-detail="${record.id}">
      <time>${escapeHtml(date)}</time>
      <span class="timeline-node"></span>
      <button class="timeline-record-card" data-detail="${record.id}">
        <span class="timeline-record-icon">${iconName}</span>
        <span class="timeline-record-copy"><b>${escapeHtml(record.title)}</b><small>${escapeHtml(record.scene)} · ${record.type === "event" ? "复盘" : "校准"}${escapeHtml(tagSummary)}</small></span>
        <span class="timeline-status">${escapeHtml(record.status)}</span>
        <span class="timeline-arrow">${icons.chevron}</span>
      </button>
    </article>
  `;
}

function recordCard(record) {
  const mode = record.type;
  return `
    <article class="list-card library-card record-list-card" data-detail="${record.id}">
      <div class="card-title-row">
        <div class="record-title-stack">
          <div class="library-card-kicker">
            ${cardBadge(cardTypeLabel(record), mode === "anxiety" ? "soft" : "")}
            <p class="record-meta">${cardMeta([record.scene, ...(record.tags || []), displayDate(record.date, { full: true })])}</p>
          </div>
          <h3>${escapeHtml(record.title)}</h3>
        </div>
        <div class="library-card-tools">
          <p class="record-meta">${cardMeta([displayDate(record.date, { full: true }), record.scene])}</p>
          <button class="card-delete-button danger-text" data-delete-record="${record.id}" aria-label="删除记录" title="删除记录">${icons.trash}</button>
        </div>
      </div>
      <div class="record-preview library-card-sections">
        ${textSection(recordMainLabel(record), record.rawInput)}
        ${textSection("复盘结论", record.conclusion)}
      </div>
      <footer class="library-card-footer">
        <span>状态</span>
        ${statusPill(record.status)}
        <button class="library-arrow" type="button" data-detail="${record.id}" aria-label="查看详情">${icons.chevron}</button>
      </footer>
      <button class="library-card-hit" type="button" data-detail="${record.id}" aria-label="查看详情"></button>
    </article>
  `;
}

function methodSourceFooter(source, date) {
  return `
    <footer class="library-card-footer source-footer">
      <span class="source-icon">${icons.note}</span>
      <p>${escapeHtml(source || "当前复盘")}</p>
      <time>${escapeHtml(displayDate(date, { full: true }))}</time>
      <span class="library-arrow">${icons.chevron}</span>
    </footer>
  `;
}

function methodCard(card) {
  const source = methodSourceLabel(card);
  return `
    <article class="list-card library-card method-card" data-edit-method="${card.id}" tabindex="0" title="点击编辑">
      <div class="card-title-row">
        <div class="record-title-stack">
          <div class="library-card-kicker">
            ${cardBadge("可复用方法")}
          </div>
          <h3>${escapeHtml(card.title)}</h3>
        </div>
        <div class="library-card-tools">
          <p class="record-meta">${cardMeta([card.scenes[0] || "其他"])}</p>
          <button class="card-delete-button danger-text" data-delete-method="${card.id}" aria-label="删除方法" title="删除方法">${icons.trash}</button>
        </div>
      </div>
      <div class="record-preview library-card-sections">
        ${textSection("适用场景", source ? `从「${source}」这类场景中复用。` : `${card.scenes.join("、") || "类似情况"}中复用。`)}
        ${librarySection("行动步骤", methodStepChips(card.steps))}
      </div>
      ${methodSourceFooter(source, card.updatedAt || card.createdAt)}
      <button class="library-card-hit" type="button" data-edit-method="${card.id}" aria-label="编辑方法卡"></button>
    </article>
  `;
}

function methodTemplateCard(method) {
  return `
    <button class="method-template-card ${method.art}" data-select-advanced-method="${method.id}" title="使用${escapeHtml(method.title)}进行高级复盘">
      <span class="template-card-top"><b>${escapeHtml(method.title)}</b><i>✧</i></span>
      <span class="template-card-lines"><i></i><i></i><i></i></span>
      <span class="template-card-tag">${escapeHtml(method.tag)}</span>
      <span class="template-card-art" aria-hidden="true">${methodIcon(method.art)}</span>
    </button>
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

function methodEditCard(card) {
  return `
    <article class="list-card method-card method-editor" data-method-editor="${card.id}">
      <label>方法名<input data-method-title value="${escapeHtml(card.title)}" /></label>
      <label>标签${methodSceneSelect(card)}</label>
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
  const dateLabel = card.verificationDate ? displayDate(card.verificationDate, { full: true }) : "未设置日期";
  return `
    <article class="list-card calibration-card calibration-library-card" data-edit-calibration="${card.id}" tabindex="0" title="点击编辑">
      <div class="calibration-card-meta"><span class="status-pill ${verified ? "verified" : "pending"}">${verified ? "已验证" : "待验证"}</span><time>${escapeHtml(dateLabel)}</time></div>
      <h3>${escapeHtml(card.worry)}</h3>
      <div class="calibration-facts"><span>${escapeHtml(card.scene)}</span><span>当时预计 ${escapeHtml(card.estimatedProbability || "未填写")}</span></div>
      ${verified
        ? `<div class="calibration-result"><strong>${escapeHtml(card.finalResult || "已完成验证")}</strong><p>${escapeHtml(card.calibrationConclusion || "暂未填写校准结论")}</p></div>`
        : `<div class="calibration-result pending"><strong>等待事实验证</strong><p>到期后记录真实结果和实际影响。</p></div>`}
      <footer><button class="text-button" data-edit-calibration="${card.id}">${verified ? "查看结论" : "去验证"}</button><button class="text-button danger-text" data-delete-calibration="${card.id}">删除卡片</button></footer>
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
  if (filter === "全部" || filter === "全部场景") return true;
  if (filter === "事件" || filter === "事件复盘") return record.type === "event";
  if (filter === "焦虑" || filter === "焦虑复盘") return record.type === "anxiety";
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
    ...flattenSearchValues(record.tags || []),
    ...flattenSearchValues(record.summary),
    ...flattenSearchValues(record.resultCard),
  ];
}

function searchMethodValues(card) {
  return [
    card.title,
    card.trigger,
    card.reminder,
    methodSourceLabel(card),
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
      border: 1px solid var(--line) !important;
      border-radius: 8px !important;
      background: var(--paper) !important;
      box-shadow: var(--shadow-soft) !important;
      color: var(--ink) !important;
      text-align: left !important;
    }
    .notification-title { margin: 0 0 10px !important; font-size: 16px !important; font-weight: 800 !important; line-height: 1.4 !important; }
    .notification-panel p { margin: 0 !important; color: var(--muted) !important; font-size: 13px !important; line-height: 1.6 !important; }
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
    .notification-item:hover, .notification-item:focus-visible { background: var(--orange-soft) !important; }
    .notification-item strong { font-size: 14px !important; line-height: 1.4 !important; }
    .notification-item span, .notification-item small { color: var(--muted) !important; font-size: 12px !important; line-height: 1.5 !important; }
  `;
  document.head.appendChild(style);
}

function render() {
  ensureRuntimeStyles();
  if (!state.authToken) {
    app.classList.add("auth-shell");
    app.innerHTML = authPage();
    window.queueMicrotask(maybePrefillBrowserCredential);
    return;
  }
  app.classList.remove("auth-shell");
  const workspace = app.querySelector(".workspace");
  const scrollTop = resetWorkspaceScroll ? 0 : workspace ? workspace.scrollTop : 0;
  resetWorkspaceScroll = false;
  const activeElement = document.activeElement;
  const activeField = activeElement?.matches?.("[data-search]") ? "search" : "";
  const activeSelectionStart = activeElement?.selectionStart ?? null;
  const activeSelectionEnd = activeElement?.selectionEnd ?? null;
  const routes = {
    home: homePage,
    reviewSetup: reviewSetupPage,
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
  resizeDraftTextareas();
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
  const steps = editor.querySelector("[data-method-steps]").value
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean);
  const selectedScene = editor.querySelector("[data-method-scene]").value;
  const scene = fixedSceneTags("event").includes(selectedScene) ? selectedScene : "其他";

  Object.assign(card, {
    title: title || card.title,
    scenes: [scene],
    trigger: card.trigger || "",
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
  setState({ editingCalibrationId: null, calibrationView: "cards", calibrationTab: card.status === "verified" ? "verified" : "pending" });
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
  const deletedCard = store.methods.find((item) => item.id === id);
  store.methods = store.methods.filter((item) => item.id !== id);
  const sourceRecord = deletedCard ? store.records.find((record) => record.id === deletedCard.sourceReviewId) : null;
  if (sourceRecord) {
    sourceRecord.savedToMethodLibrary = false;
    sourceRecord.status = sourceRecord.savedToCalibration ? "已加入校准" : "已保存";
  }
  if (state.editingMethodId === id) state.editingMethodId = null;
}

function localDeleteCalibration(id) {
  const deletedCard = store.calibrations.find((item) => item.id === id) || {};
  const sourceReviewId = deletedCard.sourceReviewId || String(id || "").replace(/^derived-calibration-/, "");
  store.calibrations = store.calibrations.filter((item) => item.id !== id && item.sourceReviewId !== sourceReviewId);
  const sourceRecord = store.records.find((record) => record.id === sourceReviewId);
  if (sourceRecord) {
    sourceRecord.savedToCalibration = false;
    sourceRecord.status = sourceRecord.savedToMethodLibrary ? "已沉淀方法" : "已保存";
  }
  if (state.editingCalibrationId === id) state.editingCalibrationId = null;
}

function confirmDeleteResource(kind) {
  const label = kind === "record" ? "这条记录" : kind === "method" ? "这张方法卡" : "这张校准卡";
  const extra = kind === "record"
    ? "删除记录也会移除它沉淀出的关联方法卡或校准卡。"
    : kind === "method" || kind === "calibration"
      ? "源复盘记录会保留。"
      : "";
  return window.confirm(`确定要删除${label}吗？${extra ? `\n${extra}` : ""}`);
}

async function deleteResource(kind, id) {
  if (!confirmDeleteResource(kind)) return;
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
    if (handleAuthError(error)) return;
    state.apiOnline = false;
  }
  localDeleteByKind[kind](id);
  const route = kind === "record" ? "records" : kind === "method" ? "methods" : "calibration";
  const tab = kind === "record" ? "records" : kind === "method" ? "methods" : "calibration";
  setState({ route, tab, methodView: kind === "method" ? "mine" : state.methodView, calibrationView: kind === "calibration" ? "cards" : state.calibrationView });
  notify(kind === "record" ? "记录及关联卡片已删除" : kind === "method" ? "方法卡已删除，源记录已保留" : "校准卡已删除，源记录已保留");
}

async function requestFollowUp(reviewId) {
  if (!reviewId) return;
  setState({ followUpLoading: true });
  if (String(reviewId).startsWith("local-")) {
    const fallback = buildLocalFollowUp(currentRecord());
    setState({ followUp: fallback, followUpLoading: false, apiOnline: false });
    notify("当前记录尚未同步到服务器，已使用本地追问继续");
    return;
  }
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
  const homeMetaArea = event.target.closest(".home-meta-control");
  const shouldCloseHomeMeta = Boolean(state.homeMetaOpen && !homeMetaArea);
  if (state.notificationsOpen && !notificationArea) {
    setState({ notificationsOpen: false });
  }

  if (shouldCloseHomeMeta) {
    state.homeMetaOpen = "";
  }

  const target = event.target.closest("button, article[data-detail], article[data-edit-method], article[data-edit-calibration]");
  if (!target) {
    if (state.notificationsOpen && notificationArea) setState({ notificationsOpen: false });
    if (shouldCloseHomeMeta) render();
    return;
  }

  if (target.dataset.authMode) {
    setState({ authMode: target.dataset.authMode, credentialPrefillAttempted: false });
    return;
  }

  if (target.dataset.themeToggle !== undefined) {
    cycleTheme();
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
      calibrationView: "cards",
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

  if (target.dataset.newReview !== undefined) {
    beginNewReview(target.dataset.newReviewMode || state.mode);
    return;
  }

  if (target.dataset.homeAnalyze !== undefined) {
    state.homeMetaOpen = "";
    startReviewSetup();
    return;
  }

  if (target.dataset.homeMeta) {
    setState({ homeMetaOpen: state.homeMetaOpen === target.dataset.homeMeta ? "" : target.dataset.homeMeta });
    return;
  }

  if (target.dataset.homeTag) {
    const tag = target.dataset.homeTag;
    const selected = state.homeTags.includes(tag);
    setState({ homeTags: selected ? state.homeTags.filter((item) => item !== tag) : [...state.homeTags, tag] });
    return;
  }

  if (target.dataset.homeScene) {
    setState({ scene: target.dataset.homeScene, homeMetaOpen: "" });
    return;
  }

  if (target.dataset.homeMetaDone !== undefined) {
    setState({ homeMetaOpen: "" });
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

  if (target.dataset.mood) {
    setState({ calibrationSession: { ...state.calibrationSession, mood: target.dataset.mood } });
    return;
  }

  if (target.dataset.feeling) {
    const feeling = target.dataset.feeling;
    const selected = state.calibrationSession.feelings.includes(feeling);
    const feelings = selected
      ? state.calibrationSession.feelings.filter((item) => item !== feeling)
      : [...state.calibrationSession.feelings, feeling];
    setState({ calibrationSession: { ...state.calibrationSession, feelings } });
    return;
  }

  if (target.dataset.calibrationMore !== undefined) {
    setState({ calibrationSession: { ...state.calibrationSession, extraOpen: !state.calibrationSession.extraOpen } });
    return;
  }

  if (target.dataset.completeCalibration !== undefined) {
    completeCalibrationCheckin();
    return;
  }

  if (target.dataset.breathingToggle !== undefined) {
    toggleBreathingExercise();
    return;
  }

  if (target.dataset.calibrationHistoryToggle !== undefined) {
    setState({ calibrationHistoryOpen: !state.calibrationHistoryOpen });
    return;
  }

  if (target.dataset.calibrationView) {
    if (target.dataset.calibrationView !== "checkin") stopBreathingExercise({ reset: true });
    setState({ calibrationView: target.dataset.calibrationView, editingCalibrationId: null });
    return;
  }

  if (target.dataset.reviewStyle) {
    setState({ reviewStyle: target.dataset.reviewStyle });
    return;
  }

  if (target.dataset.advancedMethod) {
    setState({ reviewStyle: "advanced", advancedMethodId: target.dataset.advancedMethod });
    return;
  }

  if (target.dataset.selectAdvancedMethod) {
    if (state.route === "methods" || state.route === "search") clearCompletedReview();
    setState({ reviewStyle: "advanced", advancedMethodId: target.dataset.selectAdvancedMethod, route: "reviewSetup", tab: "review" });
    return;
  }

  if (target.dataset.methodView) {
    setState({ methodView: target.dataset.methodView, filter: "全部", editingMethodId: null });
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
      state.homeTags = [...(record.tags || [])];
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
    if (target.dataset.route !== "calibration") stopBreathingExercise({ reset: true });
    setState(clearEditingState({ route: target.dataset.route, tab: tabByRoute[target.dataset.route] || state.tab }));
    return;
  }

  if (target.dataset.tab) {
    const tab = target.dataset.tab;
    if (tab !== "calibration") stopBreathingExercise({ reset: true });
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
    setState({ calibrationView: "cards", calibrationTab: target.dataset.calTab, editingCalibrationId: null });
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

  if (event.target.matches("[data-advanced-field]")) {
    currentAdvancedFields()[event.target.dataset.advancedField] = event.target.value;
  }

  if (event.target.matches("[data-calibration-note]")) {
    state.calibrationSession.note = event.target.value;
  }

  if (event.target.matches(".structured-draft textarea")) {
    resizeTextareaToContent(event.target);
  }

  if (event.target.matches("[data-auth-username]")) {
    state.authDraft.username = event.target.value;
  }

  if (event.target.matches("[data-auth-password]")) {
    state.authDraft.password = event.target.value;
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

updateViewportScale();
applyTheme();
applyRouteFromLocation();
window.addEventListener("resize", updateViewportScale);
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
  if (state.theme === "system") {
    applyTheme();
    render();
  }
});
window.addEventListener("popstate", () => applyRouteFromLocation({ shouldRender: true }));
window.addEventListener("hashchange", () => applyRouteFromLocation({ shouldRender: true }));

render();
hydrateFromBackend();
