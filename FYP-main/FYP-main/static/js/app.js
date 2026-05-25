/* ═══════════════════════════════════════════════
   CARBONLENS app.js  v3.0
   Auth · SPA Nav · Analysis · AI Reco · Gov Dashboard · Dark/Light Theme
═══════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────────── */
const THEME_KEY = "carbonlens_theme";

function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }
  // Update all toggle buttons
  const isDark = theme === "dark";
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    const icon = btn.querySelector(".toggle-icon");
    const label = btn.querySelector(".toggle-label");
    if (icon) icon.textContent = isDark ? "🌙" : "☀️";
    if (label) label.textContent = isDark ? "Dark" : "Light";
    // Auth toggle has no label span
    if (!label) btn.innerHTML = `<span class="toggle-icon">${isDark ? "🌙" : "☀️"}</span> ${isDark ? "Dark" : "Light"}`;
  });
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light");
  const next = isLight ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  // Redraw charts with updated colors
  if (currentRole === "supermarket" && allProductsData.length) {
    // Re-render only if data exists
  }
  if (currentRole === "government") {
    renderGovCharts();
  }
}

// Load saved theme on page load
(function() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
})();

/* ─────────────────────────────────────────────
   AUTH — persisted in localStorage
───────────────────────────────────────────── */
const STORAGE_KEY = "carbonlens_users_v2";
const SESSION_KEY = "carbonlens_session";

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = {
      demo: { password: "demo123", email: "demo@carbonlens.io", org: "Demo Supermarket", role: "supermarket" },
      gov:  { password: "gov123",  email: "gov@ministry.gov",   org: "Ministry of Environment", role: "government" }
    };
    if (!raw) return base;
    return Object.assign({}, base, JSON.parse(raw));
  } catch { return {}; }
}

function saveUsers(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch {}
}

function saveSession(username, role) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ username, role })); } catch {}
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

let USERS_DB = loadUsers();
let currentUser = null;
let currentRole = null;
let selectedRole = null;

/* ─────────────────────────────────────────────
   ROLE SELECTION
───────────────────────────────────────────── */
function selectRole(role) {
  selectedRole = role;
  document.getElementById("roleSelector").style.display = "none";
  document.getElementById("authForms").style.display = "block";
  const badge = document.getElementById("authRoleBadge");
  badge.textContent = role === "supermarket" ? "🛒 Supermarket Portal" : "🏛️ Government Portal";
  document.getElementById("orgGroup").querySelector("input").placeholder =
    role === "government" ? "Ministry / Department name" : "Organisation / Store name";
  switchTab("login");
}

function backToRoles() {
  selectedRole = null;
  document.getElementById("roleSelector").style.display = "block";
  document.getElementById("authForms").style.display = "none";
}

function switchTab(tab) {
  document.getElementById("tabLogin").classList.toggle("active", tab === "login");
  document.getElementById("tabSignup").classList.toggle("active", tab === "signup");
  document.getElementById("loginForm").style.display  = tab === "login"  ? "block" : "none";
  document.getElementById("signupForm").style.display = tab === "signup" ? "block" : "none";
}

function handleLogin() {
  const username = document.getElementById("loginUser").value.trim().toLowerCase();
  const password = document.getElementById("loginPass").value;
  const msg = document.getElementById("loginMsg");
  msg.className = "auth-msg";
  if (!username || !password) { msg.textContent = "Please fill in all fields."; return; }
  const user = USERS_DB[username];
  if (!user || user.password !== password) { msg.textContent = "Invalid username or password."; return; }
  if (user.role !== selectedRole) { msg.textContent = `This account is registered as ${user.role}, not ${selectedRole}.`; return; }
  msg.textContent = "";
  currentUser = username;
  currentRole = user.role;
  saveSession(username, user.role);
  launchApp(user);
}

function handleSignup() {
  const username = document.getElementById("signupUser").value.trim().toLowerCase();
  const org      = document.getElementById("signupOrg").value.trim();
  const email    = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPass").value;
  const msg = document.getElementById("signupMsg");
  msg.className = "auth-msg";
  if (!username || !org || !email || !password) { msg.textContent = "All fields are required."; return; }
  if (password.length < 6) { msg.textContent = "Password must be at least 6 characters."; return; }
  if (USERS_DB[username]) { msg.textContent = "Username already taken."; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Enter a valid email."; return; }
  USERS_DB[username] = { password, email, org, role: selectedRole };
  saveUsers(USERS_DB);
  msg.className = "auth-msg success";
  msg.textContent = "✓ Account created! Signing you in…";
  currentUser = username;
  currentRole = selectedRole;
  saveSession(username, selectedRole);
  setTimeout(() => launchApp(USERS_DB[username]), 800);
}

function launchApp(user) {
  document.getElementById("authOverlay").style.display = "none";
  if (user.role === "supermarket") {
    document.getElementById("appSupermarket").style.display = "flex";
    document.getElementById("smAvatar").textContent = currentUser[0].toUpperCase();
    document.getElementById("smName").textContent = currentUser;
    document.getElementById("smOrg").textContent = user.org || "My Store";
    initSupermarketApp();
  } else {
    document.getElementById("appGovernment").style.display = "flex";
    document.getElementById("govAvatar").textContent = currentUser[0].toUpperCase();
    document.getElementById("govName").textContent = currentUser;
    document.getElementById("govOrg").textContent = user.org || "Ministry";
    initGovernmentApp();
  }
  const d = new Date();
  const dateStr = d.toLocaleDateString("en-GB", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
  document.querySelectorAll(".topbar-date").forEach(el => el.textContent = dateStr);

  // Re-apply theme labels after app mount
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
}

function handleLogout() {
  clearSession();
  currentUser = null; currentRole = null; selectedRole = null;
  document.getElementById("appSupermarket").style.display = "none";
  document.getElementById("appGovernment").style.display  = "none";
  document.getElementById("authOverlay").style.display    = "flex";
  document.getElementById("authForms").style.display      = "none";
  document.getElementById("roleSelector").style.display   = "block";
  document.getElementById("loginMsg").textContent = "";
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
}

/* ─────────────────────────────────────────────
   SESSION RESTORE ON LOAD
───────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  const session = restoreSession();
  if (session) {
    const user = USERS_DB[session.username];
    if (user && user.role === session.role) {
      currentUser = session.username;
      currentRole = session.role;
      launchApp(user);
      return;
    }
  }
});

/* ─────────────────────────────────────────────
   SUPERMARKET NAV
───────────────────────────────────────────── */
function smNavigate(page) {
  document.querySelectorAll("#appSupermarket .nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
  document.querySelectorAll("#appSupermarket .page-section").forEach(el => {
    el.classList.toggle("active", el.id === `sm-page-${page}`);
  });
  const titles = { dashboard:"Dashboard", upload:"Upload Data", products:"Products", recommendations:"AI Recommendations", compliance:"Compliance", reports:"Reports" };
  document.getElementById("smPageTitle").textContent = titles[page] || page;
}

/* ─────────────────────────────────────────────
   GOVERNMENT NAV
───────────────────────────────────────────── */
function govNavigate(page) {
  document.querySelectorAll("#appGovernment .nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
  document.querySelectorAll("#appGovernment .page-section").forEach(el => {
    el.classList.toggle("active", el.id === `gov-page-${page}`);
  });
  const titles = { overview:"National Overview", companies:"Companies", violations:"Violations", analytics:"Deep Analytics", policy:"Policy Insights" };
  document.getElementById("govPageTitle").textContent = titles[page] || page;
}

/* ─────────────────────────────────────────────
   FILE INPUT
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const fi = document.getElementById("fileInput");
  if (fi) {
    fi.addEventListener("change", function() {
      const btn = document.getElementById("analyzeBtn");
      if (this.files.length) {
        document.getElementById("fileName").textContent = this.files[0].name;
        btn.disabled = false;
      } else {
        document.getElementById("fileName").textContent = "No file selected";
        btn.disabled = true;
      }
    });
  }
});

/* ─────────────────────────────────────────────
   CHART THEME HELPERS
───────────────────────────────────────────── */
function isLight() {
  return document.body.classList.contains("light");
}

function chartTextColor() {
  return isLight() ? "#57606a" : "#8b949e";
}

function chartGridColor() {
  return isLight() ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
}

function chartBgColor() {
  return isLight() ? "#ffffff" : "#161b22";
}

const PALETTE_DARK  = ["#00c896","#ff5a35","#7c5cfc","#e3b341","#f85149","#22d3ee","#a3e635","#fb923c"];
const PALETTE_LIGHT = ["#007d5c","#d94f2b","#5a3fd0","#bf8700","#cf222e","#0969a6","#5a8a00","#c8521a"];

function getPalette() {
  return isLight() ? PALETTE_LIGHT : PALETTE_DARK;
}

/* ─────────────────────────────────────────────
   CHART HELPERS
───────────────────────────────────────────── */
const CHART_INSTANCES = {};

function destroyChart(id) {
  if (CHART_INSTANCES[id]) { CHART_INSTANCES[id].destroy(); delete CHART_INSTANCES[id]; }
}

function getLegendOpts() {
  return {
    position: "bottom",
    labels: {
      color: chartTextColor(),
      font: { size: 12, family: "'Nunito', sans-serif", weight: "600" },
      padding: 14,
      boxWidth: 10,
      boxHeight: 10
    }
  };
}

function getTickStyle() {
  return { color: chartTextColor(), font: { size: 11, family: "'Nunito', sans-serif", weight: "600" } };
}

function mkDoughnut(id, data) {
  destroyChart(id);
  const pal = getPalette();
  CHART_INSTANCES[id] = new Chart(document.getElementById(id), {
    type: "doughnut",
    data: {
      labels: Object.keys(data),
      datasets: [{ data: Object.values(data), backgroundColor: pal, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "68%",
      plugins: { legend: getLegendOpts() }
    }
  });
}

function mkBar(id, data, label = "", horizontal = false) {
  destroyChart(id);
  const pal = getPalette();
  CHART_INSTANCES[id] = new Chart(document.getElementById(id), {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{ label, data: Object.values(data), backgroundColor: pal[0], borderRadius: 6, borderSkipped: false }]
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: getTickStyle(), grid: horizontal ? { color: chartGridColor() } : { display: false } },
        y: { beginAtZero: true, ticks: getTickStyle(), grid: horizontal ? { display: false } : { color: chartGridColor() } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function mkPie(id, labels, values, colors) {
  destroyChart(id);
  CHART_INSTANCES[id] = new Chart(document.getElementById(id), {
    type: "pie",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: getLegendOpts() } }
  });
}

function mkIntensity(id, items) {
  destroyChart(id);
  const pal = getPalette();
  const sorted = [...items].sort((a, b) => b.total_emission - a.total_emission).slice(0, 8);
  CHART_INSTANCES[id] = new Chart(document.getElementById(id), {
    type: "bar",
    data: {
      labels: sorted.map(i => i.product.length > 14 ? i.product.slice(0, 14) + "…" : i.product),
      datasets: [{
        label: "Total Emission (kg)",
        data: sorted.map(i => i.total_emission),
        backgroundColor: sorted.map((_, idx) => pal[idx % pal.length]),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: getTickStyle(), grid: { color: chartGridColor() } },
        y: { ticks: getTickStyle(), grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function mkPareto(id, categoryData) {
  destroyChart(id);
  const pal = getPalette();
  const sorted = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  let cum = 0;
  const cumPct = sorted.map(([, v]) => { cum += v; return +(cum / total * 100).toFixed(1); });
  CHART_INSTANCES[id] = new Chart(document.getElementById(id), {
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [
        { type: "bar",  label: "Emission (kg)",  data: sorted.map(([, v]) => v), backgroundColor: pal[2], borderRadius: 6, yAxisID: "y" },
        { type: "line", label: "Cumulative %",    data: cumPct, borderColor: pal[1], backgroundColor: isLight() ? "rgba(217,79,43,0.07)" : "rgba(255,90,53,0.07)", borderWidth: 2, pointBackgroundColor: pal[1], pointRadius: 4, fill: true, tension: 0.35, yAxisID: "y2" }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y:  { beginAtZero: true, ticks: getTickStyle(), grid: { color: chartGridColor() } },
        y2: { position: "right", min: 0, max: 100, ticks: { ...getTickStyle(), color: pal[1], callback: v => v + "%" }, grid: { display: false } },
        x:  { ticks: getTickStyle(), grid: { display: false } }
      },
      plugins: { legend: { labels: { color: chartTextColor(), font: { size: 12, family: "'Nunito', sans-serif", weight: "600" }, boxWidth: 10 } } }
    }
  });
}

function mkLine(id, labels, datasets) {
  destroyChart(id);
  CHART_INSTANCES[id] = new Chart(document.getElementById(id), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: getTickStyle(), grid: { display: false } },
        y: { beginAtZero: true, ticks: getTickStyle(), grid: { color: chartGridColor() } }
      },
      plugins: { legend: getLegendOpts() }
    }
  });
}

/* ─────────────────────────────────────────────
   ANALYSIS
───────────────────────────────────────────── */
let currentReportData = [];
let allProductsData = [];

async function runAnalysis() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput.files.length) return;
  const btn = document.getElementById("analyzeBtn");
  btn.innerHTML = '<span class="spinner"></span>Analyzing…';
  btn.disabled = true;

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const response = await fetch("/upload-file", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Server error");
    populateSupermarketDashboard(data);
    btn.innerHTML = "✓ Analysis Complete";
    btn.disabled = false;
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
    btn.innerHTML = '<span class="btn-icon">▶</span> Analyze Emissions';
    btn.disabled = false;
  }
}

function populateSupermarketDashboard(data) {
  document.getElementById("sm-totalEmission").textContent = data.total_emission + " kg";
  document.getElementById("sm-totalUnits").textContent    = data.total_units;
  document.getElementById("sm-avgEmission").textContent   = data.avg_emission + " kg";
  document.getElementById("sm-highestImpact").textContent = data.highest_impact;

  mkDoughnut("sm-emissionChart", data.category_emissions);
  mkBar("sm-sourceChart", data.source_emissions);
  const rk = data.risk_breakdown;
  const pal = getPalette();
  mkPie("sm-riskChart", Object.keys(rk), Object.values(rk), [pal[0], pal[3], pal[4]]);
  mkIntensity("sm-intensityChart", data.high_risk_report);
  mkPareto("sm-paretoChart", data.category_emissions);

  currentReportData = data.high_risk_report;
  renderReport(data.high_risk_report);

  allProductsData = data.all_products || data.high_risk_report;
  renderFullProductTable(allProductsData);

  renderAIRecommendations(data.suggestions);
}

/* ─────────────────────────────────────────────
   AI RECOMMENDATIONS
───────────────────────────────────────────── */
function renderAIRecommendations(suggestions) {
  const container = document.getElementById("aiRecommendationsContainer");
  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = `<div class="empty-hero"><div class="empty-icon">✦</div><p>No high-risk products found — your store's emission profile looks healthy!</p></div>`;
    return;
  }

  const totalSavings = suggestions.reduce((s, r) => s + (parseFloat(r.reduction_potential) || 0), 0).toFixed(1);
  const criticalCount = suggestions.filter(s => s.risk_analysis && s.risk_analysis.includes("High")).length;

  let html = `
    <div class="ai-reco-intro">
      <div class="ai-reco-intro-header">
        <div class="ai-reco-badge">✦ CARBONLENS AI · ANALYSIS COMPLETE</div>
      </div>
      <div class="ai-reco-title">Emission Reduction Recommendations</div>
      <p class="ai-reco-summary" style="margin-top:12px">
        Based on your uploaded dataset, CarbonLens AI has identified <strong>${suggestions.length} products</strong>
        with above-threshold emission profiles. By adopting the recommended substitutions below, your store
        could achieve an estimated reduction of <strong>${totalSavings} kg CO₂e per sales cycle</strong>.
        ${criticalCount > 0 ? `<strong>${criticalCount} items</strong> carry elevated risk and are recommended for immediate review.` : "All flagged items are in the moderate risk range."}
      </p>
    </div>`;

  suggestions.forEach(s => {
    const riskClass = s.risk_analysis && s.risk_analysis.toLowerCase().includes("high") ? "risk-high"
                    : s.risk_analysis && s.risk_analysis.toLowerCase().includes("mod") ? "risk-mod"
                    : "risk-low";
    html += `
      <div class="reco-card">
        <div class="reco-card-header">
          <div class="reco-product-row">
            <span class="reco-product-name">${s.original_product}</span>
            <span class="reco-arrow">→</span>
            <span class="reco-alt-name">${s.alternative_product}</span>
          </div>
          <div class="reco-savings">↓ ${s.reduction_potential} kg/unit</div>
        </div>
        <div class="reco-body">${s.narrative}</div>
        <div class="reco-meta">
          <span class="reco-tag ${riskClass}">${s.risk_analysis}</span>
          <span class="reco-tag risk-low">Category: ${s.category}</span>
          ${s.confidence ? `<span class="reco-tag risk-mod">Confidence: ${s.confidence}</span>` : ""}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

/* ─────────────────────────────────────────────
   TABLE RENDERERS
───────────────────────────────────────────── */
function renderReport(items) {
  const tbody = document.getElementById("reportTableBody");
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No high-risk items found.</td></tr>'; return;
  }
  tbody.innerHTML = items.map(i => `<tr>
    <td>${i.id}</td><td>${i.product}</td><td>${i.source}</td><td>${i.total_emission}</td>
    <td><span class="badge-high">${i.risk_level}</span></td>
  </tr>`).join("");
}

function renderFullProductTable(items) {
  const tbody = document.getElementById("fullProductBody");
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No data.</td></tr>'; return;
  }
  tbody.innerHTML = items.map(i => {
    const badge = i.risk_level === "High-Risk" ? "badge-high" : i.risk_level === "Critical" ? "badge-critical" : "badge-ok";
    return `<tr>
      <td>${i.id}</td><td>${i.product}</td><td>${i.category || "—"}</td><td>${i.source}</td>
      <td>${i.units || "—"}</td><td>${i.emission_per_unit || "—"}</td><td>${i.total_emission}</td>
      <td><span class="${badge}">${i.risk_level}</span></td>
    </tr>`;
  }).join("");
}

function filterProductTable(query) {
  const rows = document.querySelectorAll("#fullProductTable tbody tr");
  const q = query.toLowerCase();
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

/* ─────────────────────────────────────────────
   EXPORT
───────────────────────────────────────────── */
function exportCSV() {
  if (!currentReportData || !currentReportData.length) { alert("No data to export. Run an analysis first."); return; }
  let csv = "Product ID,Product,Category,Source,Units,Total Emission (kg),Risk Level\n";
  currentReportData.forEach(r => {
    csv += `${r.id},${r.product},${r.category || ""},${r.source},${r.units || ""},${r.total_emission},${r.risk_level}\n`;
  });
  const link = document.createElement("a");
  link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  link.download = "carbonlens_compliance_report.csv";
  link.click();
}

function exportGovCSV() {
  const rows = govViolationsData;
  if (!rows.length) { alert("No violations data."); return; }
  let csv = "Company,Product,Category,CO2 (kg),Threshold,Excess,Status\n";
  rows.forEach(r => { csv += `${r.company},${r.product},${r.category},${r.co2},${r.threshold},${r.excess},${r.status}\n`; });
  const link = document.createElement("a");
  link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  link.download = "carbonlens_violations.csv";
  link.click();
}

/* ─────────────────────────────────────────────
   SUPERMARKET INIT
───────────────────────────────────────────── */
function initSupermarketApp() {
  smNavigate("dashboard");
}

/* ─────────────────────────────────────────────
   GOVERNMENT DASHBOARD — synthetic demo data
───────────────────────────────────────────── */
const GOV_COMPANIES = [
  { name:"FreshMart Pvt Ltd",      co2:"342,800", products:1240, compliance:"Non-Compliant", region:"Chennai",    score:42 },
  { name:"GreenBasket Retail",     co2:"198,500", products:980,  compliance:"Compliant",     region:"Mumbai",     score:88 },
  { name:"NaturalFood Co.",        co2:"275,100", products:1560, compliance:"Non-Compliant", region:"Bangalore",  score:51 },
  { name:"Metro Grocers",          co2:"148,200", products:870,  compliance:"Compliant",     region:"Delhi",      score:79 },
  { name:"EcoMart India",          co2:"88,400",  products:640,  compliance:"Compliant",     region:"Hyderabad",  score:93 },
  { name:"Sunrise Superstore",     co2:"401,600", products:1890, compliance:"Non-Compliant", region:"Pune",       score:38 },
  { name:"People's Grocery",       co2:"126,300", products:720,  compliance:"Compliant",     region:"Kolkata",    score:82 },
  { name:"Organic Circle",         co2:"54,800",  products:410,  compliance:"Compliant",     region:"Ahmedabad",  score:96 },
  { name:"WholeSale Depot",        co2:"312,900", products:2100, compliance:"Review",        region:"Surat",      score:61 },
];

let govViolationsData = [
  { company:"FreshMart Pvt Ltd",    product:"Imported Beef",       category:"Food",      co2:"94,200",  threshold:"50,000", excess:"44,200", status:"Warning" },
  { company:"FreshMart Pvt Ltd",    product:"PET Bottles (1L)",    category:"Plastic",   co2:"62,100",  threshold:"40,000", excess:"22,100", status:"Warning" },
  { company:"NaturalFood Co.",      product:"Dairy Cream (500g)",  category:"Dairy",     co2:"71,400",  threshold:"50,000", excess:"21,400", status:"Penalty" },
  { company:"Sunrise Superstore",   product:"Frozen Lamb",         category:"Food",      co2:"108,300", threshold:"50,000", excess:"58,300", status:"Critical" },
  { company:"Sunrise Superstore",   product:"Styrofoam Trays",     category:"Packaging", co2:"86,700",  threshold:"40,000", excess:"46,700", status:"Penalty" },
  { company:"WholeSale Depot",      product:"Nylon Bags (bulk)",   category:"Textile",   co2:"58,800",  threshold:"40,000", excess:"18,800", status:"Review" },
];

function initGovernmentApp() {
  govNavigate("overview");
  renderGovCharts();
  renderCompanyGrid();
  renderViolationsTable();
  renderGovInsights();
  renderGovPolicy();
}

function renderGovCharts() {
  const pal = getPalette();

  // Trend chart
  mkLine("gov-trendChart",
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    [{
      label: "National CO₂ (tonnes)",
      data: [198,185,210,202,188,175,182,195,201,178,165,158],
      borderColor: pal[0],
      backgroundColor: isLight() ? "rgba(0,125,92,0.07)" : "rgba(0,200,150,0.07)",
      borderWidth: 2, pointBackgroundColor: pal[0], pointRadius: 4, fill: true, tension: 0.4
    }]
  );

  mkDoughnut("gov-sectorChart", { Dairy:24, Plastic:18, Food:31, Electronics:12, Textile:9, Packaging:6 });

  const companyData = {};
  GOV_COMPANIES.slice(0, 6).forEach(c => { companyData[c.name.split(" ")[0]] = parseInt(c.co2.replace(/,/g,"")) / 1000; });
  mkBar("gov-companyChart", companyData, "CO₂ (tonnes)");

  const regionData = {};
  GOV_COMPANIES.forEach(c => { regionData[c.region] = (regionData[c.region] || 0) + parseInt(c.co2.replace(/,/g,"")) / 1000; });
  mkPie("gov-regionChart", Object.keys(regionData), Object.values(regionData).map(v => +v.toFixed(0)), pal);

  mkBar("gov-monthlyChart", { Jan:198, Feb:185, Mar:210, Apr:202, May:188, Jun:175 }, "Tonnes CO₂");
  mkDoughnut("gov-catBreakChart", { Food:31, Plastic:18, Dairy:24, Electronics:12, Textile:9, Packaging:6 });
  mkPie("gov-heatChart",
    ["Critical","High-Risk","Moderate","Compliant"],
    [3, 6, 12, 26],
    isLight()
      ? ["#cf222e","#bf8700","#5a3fd0","#1a7f37"]
      : ["#f85149","#e3b341","#7c5cfc","#3fb950"]
  );
}

function renderCompanyGrid() {
  const grid = document.getElementById("companyGrid");
  grid.innerHTML = GOV_COMPANIES.map(c => {
    const badge = c.compliance === "Compliant"     ? "badge-ok"
                : c.compliance === "Non-Compliant" ? "badge-high"
                : "badge-critical";
    return `<div class="company-card">
      <div class="cc-name">${c.name}</div>
      <div class="cc-stat-row"><span class="cc-label">Total CO₂ (kg)</span><span class="cc-value">${c.co2}</span></div>
      <div class="cc-stat-row"><span class="cc-label">Products</span><span class="cc-value">${c.products}</span></div>
      <div class="cc-stat-row"><span class="cc-label">Region</span><span class="cc-value">${c.region}</span></div>
      <div class="cc-stat-row"><span class="cc-label">Eco-Score</span><span class="cc-value">${c.score}/100</span></div>
      <div class="cc-status"><span class="${badge}">${c.compliance}</span></div>
    </div>`;
  }).join("");
}

function renderViolationsTable() {
  const tbody = document.getElementById("violationsBody");
  tbody.innerHTML = govViolationsData.map(r => {
    const badge = r.status === "Critical" ? "badge-high" : r.status === "Penalty" ? "badge-critical" : "badge-ok";
    return `<tr>
      <td>${r.company}</td><td>${r.product}</td><td>${r.category}</td>
      <td>${r.co2}</td><td>${r.threshold}</td><td>${r.excess}</td>
      <td><span class="${badge}">${r.status}</span></td>
    </tr>`;
  }).join("");
}

function renderGovInsights() {
  const insights = [
    { icon:"🔴", title:"Highest Emission Sector", text:"Food products account for 31% of national retail emissions — primarily driven by imported red meats and dairy with long cold-chain transport routes." },
    { icon:"📉", title:"Positive Trend", text:"National emissions fell 8% from Q1 to Q2 2025, partly attributed to the Plastic Levy introduced in March and supermarket eco-labelling mandates." },
    { icon:"⚠️", title:"Non-Compliance Hotspot", text:"Sunrise Superstore (Pune) has exceeded emission thresholds for 3 consecutive quarters. Regulatory intervention is recommended under Section 14(b) of the Carbon Act." },
    { icon:"🌱", title:"Best Practice", text:"EcoMart India and Organic Circle maintain eco-scores above 93, primarily through local sourcing, reusable packaging partnerships, and quarterly emission audits." },
  ];
  document.getElementById("govInsights").innerHTML = insights.map(i => `
    <div class="insight-card">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-title">${i.title}</div>
      <div class="insight-text">${i.text}</div>
    </div>
  `).join("");
}

function renderGovPolicy() {
  const container = document.getElementById("govPolicyContainer");
  container.innerHTML = `
    <div class="policy-intro">
      <div class="ai-reco-intro-header">
        <div class="ai-reco-badge" style="color:var(--gov-accent);background:rgba(61,158,255,0.08);border-color:rgba(61,158,255,0.2)">
          🏛️ AI POLICY ENGINE · NATIONAL DATA SYNTHESIS
        </div>
      </div>
      <div class="ai-reco-title">Policy Recommendations — FY 2025–26</div>
      <p class="ai-reco-summary" style="margin-top:12px">
        The following policy recommendations have been generated by CarbonLens AI based on aggregated emission data
        from 47 registered retailers across 9 regions. These insights are intended to support legislative planning,
        enforcement prioritisation, and incentive structuring for the upcoming fiscal cycle.
      </p>
    </div>
    ${[
      { title:"1. Mandatory Emission Ceiling for Red Meat Products", body:"Three retailers currently exceed the 50,000 kg CO₂ annual threshold for imported red meat categories. We recommend introducing a statutory emission ceiling of 45,000 kg CO₂/year per retailer for Beef and Lamb product lines, with a 12-month grace period and exemptions for small-format stores under 500 sq. metres. This aligns with EU Carbon Border Adjustment Mechanism precedents." },
      { title:"2. Expanded Plastic Levy to Cover Food Packaging", body:"Current data shows that food packaging (Styrofoam and single-use PET) collectively contributes 18% of measured retail emissions — second only to food products themselves. Extending the existing Plastic Levy framework to include in-store food packaging, with tiered rates based on recyclability ratings, is projected to reduce sector emissions by 11–14% within 18 months." },
      { title:"3. Preferential Procurement Incentives for High Eco-Score Retailers", body:"Retailers with eco-scores above 85 (currently EcoMart India, Organic Circle, GreenBasket Retail, People's Grocery, Metro Grocers) should receive GST rebates on eco-certified product lines and priority government contract consideration. This creates a market incentive to voluntarily reduce emissions rather than requiring punitive enforcement alone." },
      { title:"4. Mandatory Quarterly Emission Disclosure for Large-Format Retailers", body:"Retailers with over 1,000 SKUs (currently FreshMart, NaturalFood Co., WholeSale Depot, Sunrise Superstore) should be required to submit quarterly emission disclosures via the CarbonLens national portal. Disclosures should be made publicly accessible to enable civil society accountability and media scrutiny, consistent with Right to Information provisions." },
    ].map(p => `<div class="policy-card"><div class="policy-card-title">${p.title}</div><div class="policy-body">${p.body}</div></div>`).join("")}
  `;
}