const ADMIN_USER = "admin";
const TOKEN_KEY = "monitor_admin_token";
const SESSION_KEY = "monitor_admin_session";
const MONITOR_TIME_ZONE = "Asia/Shanghai";
const MONITOR_SESSION_TTL_SECONDS = 8 * 60 * 60;
const MONITOR_REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60;
const app = document.querySelector("#monitor-app");

const icons = {
  shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 19 6v5.6c0 4.1-2.8 7.9-7 9.2-4.2-1.3-7-5.1-7-9.2V6z" fill="currentColor"/><path d="m8.4 12.2 2.1 2.1 5.1-5.4" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  user: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.8 20a7.2 7.2 0 0 1 14.4 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10.2" width="13" height="9.3" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 10.2V7.8a3.5 3.5 0 0 1 7 0v2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 12s3-5 8.2-5 8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="14" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="14" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  health: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6.2v5.2c0 4-2.7 7.6-7 8.9-4.3-1.3-7-4.9-7-8.9V6.2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 12h2.1l1.2-2.7 2 5.4 1.2-2.7H16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trend: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 9 12l4 3 6-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  api: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7 4 12l4 5M16 7l4 5-4 5M14 5l-4 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ai: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  content: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-1.9-1.1L14.3 3h-4.6l-.4 2.9A7.4 7.4 0 0 0 7.5 7L5 6 3 9.4l2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.9h4.6l.4-2.9c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1.1Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-13.5 5.8M4 12A8 8 0 0 1 17.5 6.2M17 3v3.7h3.7M7 21v-3.7H3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  db: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="6.5" ry="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 6v6c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8V6M5.5 12v5.2c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8V12" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  key: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="15.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m11 13 7-7 2 2-1.5 1.5 1.5 1.5-2 2-1.5-1.5-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
};

const navItems = [
  ["overview", "概览", icons.grid],
  ["health", "系统健康", icons.health],
  ["business", "业务概览", icons.shield],
  ["users", "用户列表", icons.user],
  ["trend", "趋势分析", icons.trend],
  ["api", "API 质量", icons.api],
  ["ai", "AI 补全质量", icons.ai],
  ["content", "内容洞察", icons.content],
  ["errors", "错误日志", icons.alert],
  ["config", "配置管理", icons.gear],
];

const sample = {
  users: 128,
  reviews: 1243,
  events: 856,
  anxiety: 387,
  methods: 214,
  calibrations: 163,
  pending: 38,
  verified: 125,
  deleted: 12,
  trend: [
    ["05-19", 60, 22, 18, 46],
    ["05-20", 45, 17, 11, 30],
    ["05-21", 61, 19, 15, 36],
    ["05-22", 45, 16, 11, 29],
    ["05-23", 58, 19, 14, 37],
    ["05-24", 56, 22, 16, 40],
    ["05-25", 60, 23, 15, 43],
    ["05-26", 59, 22, 14, 39],
  ],
};

function fallbackSummary() {
  return {
    environment: "local",
    database: { type: "postgres", connected: false, latency_ms: 0 },
    agent: { provider: "OpenAI", model: "gpt-5.2", api_key_configured: false },
    business: {
      users: 0,
      reviews: 0,
      events: 0,
      anxiety: 0,
      methods: 0,
      calibrations: 0,
      pending_calibrations: 0,
      verified_calibrations: 0,
      deleted_reviews: 0,
    },
    dependencies: [],
    trend: sample.trend.map(([day, reviews, methods, calibrations, activeUsers]) => ({
      date: day,
      reviews,
      methods,
      calibrations,
      active_users: activeUsers,
      save_rate: 0,
    })),
    api_quality: [],
    recent_errors: [],
    ai_quality: { total: 0, success: 0, success_rate: 100, fallback: 0, avg_latency_ms: 0, fallback_reasons: [], warnings: [] },
    content: { top_scenes: [], method_rate: 0, calibration_rate: 0 },
    pending: { overdue_calibrations: [], overdue_count: 0, recent_records: [] },
    users: [],
  };
}

let runtime = {
  loggedIn: hasSession(),
  apiBase: defaultApiBase(),
  health: "检查中",
  healthOk: false,
  healthLatency: "-",
  lastRefresh: new Date(),
  summary: null,
  section: "overview",
  error: "",
  passwordVisible: false,
  composing: false,
  loginDraft: {
    username: "",
    password: "",
    remember: true,
  },
};

function defaultApiBase() {
  const { hostname, port, origin } = window.location;
  if ((hostname === "127.0.0.1" || hostname === "localhost") && port === "5173") {
    return "http://127.0.0.1:8000/api";
  }
  return `${origin}/api`;
}

function hasSession() {
  const value = localStorage.getItem(SESSION_KEY);
  const token = localStorage.getItem(TOKEN_KEY);
  if (!value || !token) return false;
  try {
    const session = JSON.parse(value);
    return session.user === ADMIN_USER && Number(session.expiresAt) > Date.now();
  } catch (_error) {
    return false;
  }
}

async function monitorRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${runtime.apiBase}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || "监控接口请求失败");
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function markSvg(className = "brand-mark") {
  return `<span class="${className}" aria-hidden="true">
    <svg viewBox="0 0 64 72">
      <path d="M32 3 58 15v22c0 15-10.2 27.8-26 32C16.2 64.8 6 52 6 37V15z" fill="url(#monitorMark)"/>
      <path d="M17 43c5.2-2.2 8.4-8.4 10.4-15.3L34 48l6.4-17.6c1.7 5.2 4.2 9.4 7.6 12.6" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <defs><linearGradient id="monitorMark" x1="12" x2="52" y1="9" y2="63"><stop stop-color="#4b8dff"/><stop offset="1" stop-color="#244ee8"/></linearGradient></defs>
    </svg>
  </span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function render() {
  app.innerHTML = runtime.loggedIn ? dashboardView() : loginView();
}

function loginView() {
  return `<section class="monitor-login">
    <div class="login-frame">
      <div class="login-sky"></div>
      <div class="login-sea"></div>
      <div class="login-cliff"></div>
      <div class="lighthouse"><span class="lamp"></span></div>
      <section class="login-panel">
        ${markSvg()}
        <h1>系统监控中心</h1>
        <p class="subtitle">仅限管理员访问</p>
        <form class="login-card" data-login-form>
          <label class="field">用户名
            <span class="input-row">${icons.user}<input name="username" autocomplete="username" value="${escapeHtml(runtime.loginDraft.username)}" placeholder="请输入管理员账号" /></span>
          </label>
          <label class="field">密码
            <span class="input-row">${icons.lock}<input name="password" autocomplete="current-password" type="${runtime.passwordVisible ? "text" : "password"}" value="${escapeHtml(runtime.loginDraft.password)}" placeholder="请输入管理员密码" /><button class="reveal-button" type="button" data-reveal aria-label="显示或隐藏密码">${icons.eye}</button></span>
          </label>
          <div class="login-options">
            <label class="checkbox"><input type="checkbox" name="remember" ${runtime.loginDraft.remember ? "checked" : ""} />保持登录</label>
            <button class="linklike" type="button" data-forgot>忘记密码?</button>
          </div>
          <button class="login-submit" type="submit">登 录</button>
          <div class="login-error">${runtime.error}</div>
        </form>
        <div class="login-note">
          <span>盾牌页面为独立管理员认证</span>
          <span>所有操作已记录审计日志</span>
        </div>
      </section>
      <footer class="login-footer">© 2025 复盘应用 · Monitor Center v1.0.0</footer>
    </div>
  </section>`;
}

function dashboardView() {
  const data = runtime.summary || fallbackSummary();
  const ok = runtime.healthOk;
  const nowText = formatDateTime(runtime.lastRefresh);
  const currentNav = navItems.find(([key]) => key === runtime.section) || navItems[0];
  return `<section class="dashboard">
    <aside class="sidebar">
      <div class="side-brand">${markSvg("mini-mark")}<strong>监控中心</strong></div>
      <nav class="side-nav">${navItems.map(([key, label, svg]) => `<button class="${runtime.section === key ? "active" : ""}" type="button" data-section="${key}">${svg}<span>${label}</span></button>`).join("")}</nav>
      <button class="logout-button" type="button" data-logout>${icons.logout}<span>退出登录</span></button>
    </aside>
    <section class="main">
      <header class="topbar">
        <div class="title-row"><h1>${currentNav[1]}</h1><span class="shield-ok">✓</span></div>
        <div class="top-meta">
          <span>最后刷新： ${nowText}</span>
          <span class="auto-pill">自动刷新中 (30s)</span>
          <button class="refresh-button" type="button" data-refresh>${icons.refresh} 立即刷新</button>
        </div>
      </header>
      ${sectionView(data, ok)}
      <footer class="monitor-footer">监控中心 v1.0.0  |  仅供管理员使用  |  数据每 30 秒自动刷新</footer>
    </section>
  </section>`;
}

function sectionView(data, ok) {
  const views = {
    overview: () => overviewSection(data, ok),
    health: () => healthSection(data, ok),
    business: () => businessSection(data),
    users: () => usersSection(data),
    trend: () => trendSection(data),
    api: () => apiSection(data),
    ai: () => aiSection(data),
    content: () => contentSection(data),
    errors: () => errorsSection(data),
    config: () => configSection(data),
  };
  return (views[runtime.section] || views.overview)();
}

function statusTiles(data, ok) {
  const database = data.database;
  const agent = data.agent;
  return `<section class="status-grid">
    ${statusTile("后端健康", ok ? "正常" : runtime.health, ok ? "/health 可用" : "等待服务响应", ok ? "ok" : "warn", icons.health)}
    ${statusTile("环境", data.environment || "local", data.environment === "local" ? "本地环境" : "线上环境", "", icons.gear)}
    ${statusTile("数据库", database.type, database.connected ? "连接正常" : "连接异常", database.connected ? "" : "warn", icons.db)}
    ${statusTile("大模型 Provider", data.agent.provider || "unknown", `模型：${agent.model || "unknown"}`, "", icons.ai, "blue")}
    ${statusTile("OPENAI_API_KEY", agent.api_key_configured ? "已配置" : "未配置", agent.api_key_configured ? "密钥已正确配置" : "将使用本地兜底", agent.api_key_configured ? "ok" : "warn", icons.key)}
  </section>`;
}

function overviewSection(data, ok) {
  return `${statusTiles(data, ok)}
    <section class="dashboard-grid overview-grid">
      <div class="panel wide-panel">
        <div class="panel-head"><h2>业务数据概览</h2><button class="panel-link" data-section="business">查看详情 〉</button></div>
        ${businessOverview(data)}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>依赖健康</h2><button class="panel-link" data-section="health">查看详情 〉</button></div>
        ${healthTable((data.dependencies || []).slice(0, 7))}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>最近错误</h2><button class="panel-link" data-section="errors">查看全部 〉</button></div>
        ${errorList((data.recent_errors || []).slice(0, 5))}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>待处理 / 最近记录</h2><button class="panel-link" data-section="content">查看详情 〉</button></div>
        <div class="two-columns">${pendingList(data.pending)}${recordList(data.pending)}</div>
      </div>
    </section>`;
}

function healthSection(data, ok) {
  return `${statusTiles(data, ok)}
    <section class="single-grid">
      <div class="panel"><h2>依赖健康</h2>${healthTable(data.dependencies || [])}</div>
    </section>`;
}

function businessSection(data) {
  return `<section class="single-grid">
    <div class="panel"><h2>业务数据概览</h2>${businessOverview(data)}</div>
  </section>`;
}

function usersSection(data) {
  return `<section class="single-grid">
    <div class="panel"><h2>用户列表</h2>${usersTable(data.users || [])}</div>
  </section>`;
}

function trendSection(data) {
  return `<section class="single-grid">
    <div class="panel tall-panel"><h2>近 7 天趋势</h2>${trendChart(data.trend || [])}</div>
  </section>`;
}

function apiSection(data) {
  return `<section class="single-grid">
    <div class="panel"><h2>API 运行质量 <span class="muted">(Top 10 接口)</span></h2>${apiTable(data.api_quality || [])}</div>
  </section>`;
}

function aiSection(data) {
  return `<section class="single-grid">
    <div class="panel"><h2>AI 补全质量</h2>${aiQuality(data.ai_quality)}</div>
  </section>`;
}

function contentSection(data) {
  return `<section class="dashboard-grid content-page-grid">
    <div class="panel"><h2>内容运营 / 使用洞察</h2>${contentInsight(data.content, data.business)}</div>
    <div class="panel"><h2>待处理 / 最近记录</h2><div class="two-columns">${pendingList(data.pending)}${recordList(data.pending)}</div></div>
  </section>`;
}

function errorsSection(data) {
  return `<section class="single-grid">
    <div class="panel"><h2>最近 20 条错误请求</h2>${errorList(data.recent_errors || [])}</div>
  </section>`;
}

function configSection(data) {
  return `<section class="single-grid">
    <div class="panel"><h2>配置管理</h2>${configTable(data)}</div>
  </section>`;
}

function businessOverview(data) {
  const business = data.business || data;
  const eventPercent = business.reviews ? Math.round((business.events / business.reviews) * 100) : 0;
  const anxietyPercent = business.reviews ? 100 - eventPercent : 0;
  return `<div class="business-overview">
    <div class="metric-grid">
      ${metric("用户数", business.users, "", "users")}
      ${metric("复盘记录总数", Number(business.reviews || 0).toLocaleString())}
      ${metric("事件复盘数", business.events)}
      ${metric("焦虑复盘数", business.anxiety)}
      ${metric("方法卡数量", business.methods)}
      ${metric("校准卡数量", business.calibrations)}
      ${metric("待验证校准卡", business.pending_calibrations, "orange")}
      ${metric("已验证校准卡", business.verified_calibrations, "green")}
      ${metric("已软删除记录", business.deleted_reviews, "red")}
    </div>
    <div class="split-summary">
      <h3>复盘类型分布</h3>
      <div class="split-bar" aria-label="复盘类型分布">
        <span class="event" style="width:${eventPercent}%"></span>
        <span class="anxiety" style="width:${anxietyPercent}%"></span>
      </div>
      <div class="split-rows">
        <div><span><i class="swatch"></i>事件复盘</span><strong class="event-text">${eventPercent}%</strong><small>${business.events} 条</small></div>
        <div><span><i class="swatch violet"></i>焦虑复盘</span><strong class="anxiety-text">${anxietyPercent}%</strong><small>${business.anxiety} 条</small></div>
      </div>
    </div>
  </div>`;
}

function statusTile(label, value, sub, tone, svg, iconTone = "") {
  return `<article class="status-tile">
    <div class="tile-label"><span class="dot ${iconTone === "blue" ? "blue" : ""}"></span>${label}</div>
    <div class="tile-value ${tone || ""}">${value}</div>
    <div class="tile-sub">${sub}</div>
    <span class="tile-icon ${iconTone}">${svg}</span>
  </article>`;
}

function metric(label, value, tone = "", section = "") {
  const content = `<div class="metric-label">${label}</div><div class="metric-value ${tone}">${value}</div>`;
  if (section) {
    return `<button class="metric-box metric-button" type="button" data-section="${section}" aria-label="查看${label}详情">${content}</button>`;
  }
  return `<div class="metric-box">${content}</div>`;
}

function healthTable(rows = []) {
  const displayRows = rows.length ? rows.map((row) => [
    row.component,
    row.status,
    row.latency_ms === null || row.latency_ms === undefined ? "-" : `${row.latency_ms}ms`,
    row.error || "-",
    row.checked_at ? formatTime(parseMonitorDate(row.checked_at)) : formatTime(runtime.lastRefresh),
  ]) : [["后端服务", runtime.healthOk ? "正常" : "异常", runtime.healthLatency, runtime.healthOk ? "-" : runtime.health, formatTime(runtime.lastRefresh)]];
  return `<table class="health-table"><thead><tr><th>组件</th><th>状态</th><th>延迟</th><th>最近错误</th><th>检查时间</th></tr></thead><tbody>
    ${displayRows.map((row) => `<tr><td>${row[0]}</td><td class="${row[1] === "异常" || row[1] === "缺失" ? "bad-text" : "ok-text"}">● ${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td></tr>`).join("")}
  </tbody></table>`;
}

function trendChart(rows = []) {
  const displayRows = rows.length ? rows : fallbackSummary().trend;
  const maxValue = Math.max(1, ...displayRows.flatMap((row) => [row.reviews, row.methods, row.calibrations, row.active_users]));
  return `<div class="chart-legend">
    <span><i class="swatch"></i>新增复盘数</span>
    <span><i class="swatch violet"></i>新增方法卡数</span>
    <span><i class="swatch" style="background: var(--cyan)"></i>新增校准卡数</span>
    <span><i class="swatch" style="background: var(--orange)"></i>活跃用户数</span>
    <span><i class="swatch" style="background: oklch(74% 0.18 350)"></i>复盘保存率 (%)</span>
  </div>
  <div class="chart">
    <div class="axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
    <div class="bars">${displayRows.map((row) => `<div class="bar-group">
      <span class="bar" style="height:${Math.max(4, (row.reviews / maxValue) * 100)}%"></span>
      <span class="bar violet" style="height:${Math.max(4, (row.methods / maxValue) * 100)}%"></span>
      <span class="bar cyan" style="height:${Math.max(4, (row.calibrations / maxValue) * 100)}%"></span>
      <span class="bar orange" style="height:${Math.max(4, (row.active_users / maxValue) * 100)}%"></span>
    </div>`).join("")}</div>
    <div class="axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
    <div class="trend-labels">${displayRows.map((row) => `<span>${String(row.date).slice(5)}</span>`).join("")}</div>
  </div>`;
}

function apiTable(rows = []) {
  const displayRows = rows.map((row) => [
    `${row.method} ${row.path}`,
    row.requests,
    row.errors,
    `${row.error_rate}%`,
    row.p50_ms,
    row.p95_ms,
    row.unauthorized,
  ]);
  if (!displayRows.length) displayRows.push(["暂无请求指标", "-", "-", "-", "-", "-", "-"]);
  return `<table class="api-table"><thead><tr><th>接口</th><th>请求次数</th><th>错误次数</th><th>错误率</th><th>P50 (ms)</th><th>P95 (ms)</th><th>401 次数</th></tr></thead><tbody>
    ${displayRows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index === 3 && Number.parseFloat(cell) > 5 ? "bad-text" : ""}">${cell}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
}

function errorList(rows = []) {
  const displayRows = rows.map((row) => [row.method, row.path, row.status_code, row.error, row.created_at ? formatTime(parseMonitorDate(row.created_at)) : "-"]);
  if (!displayRows.length) return `<div class="empty-panel muted">暂无错误请求</div>`;
  return `<div class="error-list">${displayRows.map(([method, path, code, text, time]) => `<div class="error-item">
    <span class="method-tag ${method === "PATCH" ? "patch" : ""}">${method}</span>
    <span><strong>${path}</strong><br><span class="muted">${text}</span></span>
    <span><span class="error-code">${code}</span><br><span class="muted">${time}</span></span>
  </div>`).join("")}</div>`;
}

function aiQuality(data = fallbackSummary().ai_quality) {
  const avgSeconds = data.avg_latency_ms ? `${(data.avg_latency_ms / 1000).toFixed(2)}s` : "0s";
  const reasons = data.fallback_reasons && data.fallback_reasons.length ? data.fallback_reasons : [{ reason: "暂无 fallback", count: 0 }];
  const totalReasonCount = Math.max(1, reasons.reduce((sum, item) => sum + item.count, 0));
  const warnings = data.warnings && data.warnings.length ? data.warnings : [{ message: "暂无 AI 警告信息", created_at: "" }];
  return `<div class="quality-grid">
    <div class="quality-kpis">
      ${metric("调用次数", data.total)}
      ${metric("AI 成功次数", data.success)}
      ${metric("成功率", `${data.success_rate}%`, data.success_rate >= 80 ? "green" : "orange")}
      ${metric("Fallback 次数", data.fallback, data.fallback ? "red" : "green")}
      ${metric("平均耗时", avgSeconds)}
    </div>
    <div class="split">
      <div class="subpanel">
        <h3>Fallback 原因分布</h3>
        <div class="mini-donut-row"><div class="mini-donut"></div><div class="legend">
          ${reasons.map((item, index) => `<span><i class="swatch ${index === 1 ? "violet" : ""}" style="${index === 2 ? "background: var(--yellow)" : index === 3 ? "background: var(--cyan)" : ""}"></i>${item.reason} ${item.count} (${Math.round(item.count / totalReasonCount * 100)}%)</span>`).join("")}
        </div></div>
      </div>
      <div class="subpanel">
        <h3>最近 AI 警告信息</h3>
        <div class="warning-list">
          ${warnings.map((item) => `<div class="warning-item"><span class="bad-text">△</span><span>${item.message}</span><span class="muted">${item.created_at ? formatTime(parseMonitorDate(item.created_at)) : "-"}</span></div>`).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

function contentInsight(content = fallbackSummary().content, business = fallbackSummary().business) {
  const scenes = content.top_scenes && content.top_scenes.length ? content.top_scenes : [{ scene: "暂无数据", percent: 0 }];
  return `<div class="content-grid">
    <div class="subpanel">
      <h3>高频复盘场景 Top 5</h3>
      <div class="progress-list">${scenes.map((item) => `<div class="progress-row"><span>${item.scene}</span><span class="track"><i class="fill" style="width:${item.percent}%"></i></span><strong>${item.percent}%</strong></div>`).join("")}</div>
    </div>
    <div class="ops-grid">
      <div class="subpanel"><h3>方法卡沉淀率</h3><div class="number">${content.method_rate}%</div><span class="muted">${business.methods} / ${business.events} 事件复盘</span></div>
      <div class="subpanel"><h3>校准卡沉淀率</h3><div class="number">${content.calibration_rate}%</div><span class="muted">${business.calibrations} / ${business.anxiety} 焦虑复盘</span></div>
      <div class="subpanel"><h3>逾期未验证校准卡</h3><div class="number red">${runtime.summary?.pending?.overdue_count || 0}</div><span class="muted">已超过 7 天未验证</span></div>
    </div>
  </div>`;
}

function configTable(data) {
  const rows = [
    ["环境", data.environment || "local"],
    ["API 基础地址", runtime.apiBase],
    ["数据库类型", data.database?.type || "-"],
    ["数据库连接", data.database?.connected ? "正常" : "异常"],
    ["大模型 Provider", data.agent?.provider || "-"],
    ["大模型模型", data.agent?.model || "-"],
    ["OPENAI_API_KEY", data.agent?.api_key_configured ? "已配置" : "未配置"],
  ];
  return `<table class="api-table config-table"><tbody>${rows.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join("")}</tbody></table>`;
}

function usersTable(users = []) {
  if (!users.length) return `<div class="empty-panel muted">暂无用户数据</div>`;
  return `<table class="api-table users-table"><thead><tr><th>用户名</th><th>用户 ID</th><th>创建时间</th></tr></thead><tbody>
    ${users.map((user) => `<tr><td>${user.username || "-"}</td><td>${user.id || "-"}</td><td>${user.created_at ? formatDateTime(parseMonitorDate(user.created_at)) : "-"}</td></tr>`).join("")}
  </tbody></table>`;
}

function pendingList(pending = fallbackSummary().pending) {
  const rows = pending?.overdue_calibrations?.length ? pending.overdue_calibrations : [{ title: "暂无逾期校准卡", days: 0 }];
  return `<div class="subpanel"><h3>逾期未验证校准卡（超 7 天）</h3><div class="pending-list">${rows.map((item) => `<div class="pending-item"><span>${item.title}</span><span></span><strong class="bad-text">${item.days ? `逾期 ${item.days} 天` : "-"}</strong></div>`).join("")}</div></div>`;
}

function recordList(pending = fallbackSummary().pending) {
  const rows = pending?.recent_records?.length ? pending.recent_records : [{ title: "暂无复盘记录", type: "event", created_at: "" }];
  return `<div class="subpanel"><h3>最近创建的复盘记录</h3><div class="record-list">${rows.map((item) => {
    const kind = item.type === "anxiety" ? "焦虑" : "事件";
    const user = item.username || item.user_id || "-";
    return `<div class="record-item record-item-detailed">
      <div class="record-title-stack">
        <span class="record-title">${escapeHtml(item.title || "-")}</span>
        <span class="record-subtitle">${escapeHtml(user)} · ${escapeHtml(item.scene || "其他")}</span>
      </div>
      <span class="record-meta">
        <span class="record-kind ${kind === "焦虑" ? "anxiety" : ""}">${kind}</span>
        <span class="record-time-stack"><span>创建 ${formatRecordDateTime(item.created_at)}</span><span>更新 ${formatRecordDateTime(item.updated_at || item.created_at)}</span></span>
      </span>
    </div>`;
  }).join("")}</div></div>`;
}

async function refreshHealth({ shouldRender = true } = {}) {
  const started = performance.now();
  try {
    const data = await monitorRequest("/monitor/summary", { method: "GET", cache: "no-store" });
    runtime.summary = data;
    runtime.healthLatency = `${Math.round(performance.now() - started)}ms`;
    runtime.healthOk = true;
    runtime.health = "正常";
  } catch (error) {
    runtime.healthLatency = "-";
    runtime.healthOk = false;
    runtime.health = error.status === 401 ? "登录过期" : "未连接";
    if (error.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
      runtime.loggedIn = false;
    }
  }
  runtime.lastRefresh = new Date();
  if (shouldRender) render();
}

function formatTime(date) {
  return date.toLocaleTimeString("zh-CN", { hour12: false, timeZone: MONITOR_TIME_ZONE });
}

function formatDateTime(date) {
  const datePart = date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: MONITOR_TIME_ZONE }).replace(/\//g, "-");
  return `${datePart} ${formatTime(date)}`;
}

function parseMonitorDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}+08:00`);
}

function formatRecordTime(value) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(5);
  return formatTime(parseMonitorDate(value));
}

function formatRecordDateTime(value) {
  if (!value) return "-";
  return formatDateTime(parseMonitorDate(value));
}

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-login-form]");
  if (!form) return;
  if (runtime.composing) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  const username = form.username.value.trim();
  const password = form.password.value;
  runtime.loginDraft.username = username;
  runtime.loginDraft.password = password;
  runtime.loginDraft.remember = Boolean(form.remember?.checked);
  try {
    const data = await monitorRequest("/monitor/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const serverTtlSeconds = Number(data.expires_in) || MONITOR_REMEMBER_TTL_SECONDS;
    const ttlSeconds = runtime.loginDraft.remember
      ? serverTtlSeconds
      : Math.min(serverTtlSeconds, MONITOR_SESSION_TTL_SECONDS);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: ADMIN_USER, expiresAt }));
    runtime.loggedIn = true;
    runtime.error = "";
    runtime.loginDraft.password = "";
    await refreshHealth({ shouldRender: false });
    render();
    return;
  } catch (error) {
    runtime.error = error.message || "账号或密码不正确";
    render();
  }
});

app.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.section) {
    event.preventDefault();
    runtime.section = target.dataset.section;
    render();
    return;
  }
  if (target.dataset.reveal !== undefined) {
    event.preventDefault();
    runtime.passwordVisible = !runtime.passwordVisible;
    render();
    return;
  }
  if (target.dataset.forgot !== undefined) {
    event.preventDefault();
    runtime.error = "请联系管理员重置监控密码";
    render();
    return;
  }
  if (target.dataset.logout !== undefined) {
    event.preventDefault();
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    runtime.loggedIn = false;
    runtime.summary = null;
    render();
    return;
  }
  if (target.dataset.refresh !== undefined) {
    event.preventDefault();
    await refreshHealth();
    return;
  }
});

app.addEventListener("input", (event) => {
  const form = event.target.closest?.("[data-login-form]");
  if (!form) return;
  if (event.target.name === "username") runtime.loginDraft.username = event.target.value;
  if (event.target.name === "password") runtime.loginDraft.password = event.target.value;
  if (event.target.name === "remember") runtime.loginDraft.remember = Boolean(event.target.checked);
});

app.addEventListener("keydown", (event) => {
  if (event.isComposing || event.keyCode === 229) return;
});

app.addEventListener("compositionstart", (event) => {
  if (event.target.closest?.("[data-login-form]")) runtime.composing = true;
});

app.addEventListener("compositionend", (event) => {
  if (event.target.closest?.("[data-login-form]")) runtime.composing = false;
});

if (runtime.loggedIn) refreshHealth();
render();
window.setInterval(() => {
  if (runtime.loggedIn) refreshHealth();
}, 30000);
