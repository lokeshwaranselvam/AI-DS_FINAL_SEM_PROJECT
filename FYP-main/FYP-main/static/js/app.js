// ════════════════════════════════════════════════════════
// THEME
// ════════════════════════════════════════════════════════
let isDark = true;
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('light', !isDark);
  document.querySelectorAll('.toggle-icon').forEach(e => e.textContent = isDark ? '🌙' : '☀️');
}

// ════════════════════════════════════════════════════════
// CHART DEFAULTS
// ════════════════════════════════════════════════════════
Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#2a3448';
const PALETTE = ['#00d9a3','#ff8c42','#ff4d4f','#a78bfa','#58a6ff','#ffd666','#34d399','#f472b6'];

function makeChart(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  if (ctx._chart) { ctx._chart.destroy(); }
  const c = new Chart(ctx, cfg);
  ctx._chart = c;
  return c;
}

// ════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════
let currentRole = '';

function selectRole(role) {
  currentRole = role;
  document.getElementById('roleSelector').style.display = 'none';
  const authForms = document.getElementById('authForms');
  authForms.style.display = 'block';
  authForms.setAttribute('data-role', role);
  document.getElementById('authRoleBadge').textContent = role === 'supermarket' ? '🛒 Supermarket Portal' : '🏛️ Government Portal';
  const authTabs = document.getElementById('authTabs');
  if (role === 'government') {
    document.getElementById('tabSignup').style.display = 'none';
    authTabs.style.display = 'none';
  } else {
    document.getElementById('tabSignup').style.display = '';
    authTabs.style.display = 'flex';
  }
}

function backToRoles() {
  document.getElementById('roleSelector').style.display = 'block';
  document.getElementById('authForms').style.display = 'none';
}

function switchTab(tab) {
  document.getElementById('loginForm').style.display  = tab === 'login'  ? 'block' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}

function clearAuthFields() {
  ['loginUser', 'loginPass', 'signupUser', 'signupOrg', 'signupEmail', 'signupPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['loginMsg', 'signupMsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.className = 'auth-msg'; }
  });
}

async function handleLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const msg = document.getElementById('loginMsg');
  msg.className = 'auth-msg'; msg.textContent = 'Signing in…';
  try {
    const r = await fetch('/api/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password, role: currentRole})
    });
    const d = await r.json();
    if (d.success) {
      msg.className = 'auth-msg success'; msg.textContent = '✓ Success';
      clearAuthFields();
      if (currentRole === 'supermarket') launchSupermarket(d);
      else launchGovernment(d);
    } else {
      msg.className = 'auth-msg error'; msg.textContent = d.message || 'Invalid credentials';
      document.getElementById('loginPass').value = '';
    }
  } catch(e) {
    msg.className = 'auth-msg error'; msg.textContent = 'Server error';
  }
}

async function handleSignup() {
  const username     = document.getElementById('signupUser').value.trim();
  const organization = document.getElementById('signupOrg').value.trim();
  const email        = document.getElementById('signupEmail').value.trim();
  const password     = document.getElementById('signupPass').value;
  const msg = document.getElementById('signupMsg');
  msg.className = 'auth-msg'; msg.textContent = 'Creating account…';
  try {
    const r = await fetch('/api/signup', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password, organization, email, role: 'supermarket'})
    });
    const d = await r.json();
    if (d.success) {
      msg.className = 'auth-msg success';
      msg.textContent = `✓ Account created (ID: ${d.supermarket_id}). You can now sign in.`;
      clearAuthFields();
      setTimeout(() => switchTab('login'), 1800);
    } else {
      msg.className = 'auth-msg error'; msg.textContent = d.message || 'Signup failed';
    }
  } catch(e) {
    msg.className = 'auth-msg error'; msg.textContent = 'Server error';
  }
}

function handleLogout() {
  clearSupermarketData();
  resetSupermarketUI();
  document.getElementById('appSupermarket').style.display = 'none';
  document.getElementById('appGovernment').style.display  = 'none';
  document.getElementById('authOverlay').style.display    = 'flex';
  clearAuthFields();
  backToRoles();
  switchTab('login');
}

// ════════════════════════════════════════════════════════
// SUPERMARKET
// ════════════════════════════════════════════════════════
let smData = null;

function resetSupermarketUI() {
  ['sm-totalEmission', 'sm-totalUnits', 'sm-avgEmission', 'sm-highestImpact'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  ['sm-emissionChart','sm-sourceChart','sm-riskChart','sm-intensityChart','sm-paretoChart'].forEach(id => {
    const ctx = document.getElementById(id);
    if (ctx && ctx._chart) { ctx._chart.destroy(); ctx._chart = null; }
  });

  const prodBody = document.getElementById('fullProductBody');
  if (prodBody) prodBody.innerHTML = '<tr><td colspan="8" class="table-empty">Upload data to view products.</td></tr>';

  const rptBody = document.getElementById('reportTableBody');
  if (rptBody) rptBody.innerHTML = '<tr><td colspan="5" class="table-empty">No data yet.</td></tr>';

  const recCont = document.getElementById('aiRecommendationsContainer');
  if (recCont) recCont.innerHTML = '<div class="empty-hero"><div class="empty-icon">✦</div><p>Upload and analyze data to generate AI-powered recommendations</p></div>';

  const fileName = document.getElementById('fileName');
  if (fileName) fileName.textContent = 'No file selected';
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) { analyzeBtn.disabled = true; analyzeBtn._file = null; }
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';

  smNavigate('dashboard');
  allProducts = [];
}

function clearSupermarketData() {
  smData = null;
}

async function launchSupermarket(user) {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('appSupermarket').style.display = 'flex';
  document.getElementById('smName').textContent  = user.username || 'User';
  document.getElementById('smOrg').textContent   = user.organization || '';
  document.getElementById('smAvatar').textContent = (user.username||'U')[0].toUpperCase();
  document.getElementById('smDate').textContent  = new Date().toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
  setupUploadZone();

  const userId = user.id;
  if (userId && !userId.startsWith('SM-DEMO')) {
    try {
      const r = await fetch(`/api/gov/supermarket/${userId}`);
      if (r.ok) {
        const saved = await r.json();
        if (saved.total_emission && saved.total_emission > 0 && saved.all_products && saved.all_products.length > 0) {
          smData = {
            total_emission:     saved.total_emission,
            total_units:        saved.total_units,
            avg_emission:       saved.avg_emission,
            highest_impact:     saved.highest_impact || '—',
            risk_breakdown:     saved.risk_breakdown || {},
            category_emissions: saved.category_emissions || {},
            source_emissions:   saved.source_emissions || {},
            high_risk_report:   saved.high_risk_products || [],
            suggestions:        saved.suggestions || [],
            all_products:       saved.all_products || []
          };
          renderSupermarketDashboard(smData);
        }
      }
    } catch(e) {
      console.warn('Could not restore user data:', e);
    }
  }
}

function setupUploadZone() {
  const zone = document.getElementById('uploadZone');

  const newZone = zone.cloneNode(true);
  zone.parentNode.replaceChild(newZone, zone);

  newZone.addEventListener('dragover', e => { e.preventDefault(); newZone.classList.add('drag-over'); });
  newZone.addEventListener('dragleave', () => newZone.classList.remove('drag-over'));
  newZone.addEventListener('drop', e => { e.preventDefault(); newZone.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) setFile(f); });

  const realFi = document.getElementById('fileInput');
  if (realFi) {
    realFi.addEventListener('change', () => { if (realFi.files[0]) setFile(realFi.files[0]); });
  }
}

function setFile(f) {
  document.getElementById('fileName').textContent = f.name;
  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('analyzeBtn')._file = f;
}

async function runAnalysis() {
  const btn = document.getElementById('analyzeBtn');
  const file = btn._file;
  if (!file) return;
  btn.textContent = '⏳ Analyzing…'; btn.disabled = true;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch('/upload-file', {method:'POST', body: fd});
    const d = await r.json();
    if (d.error) { alert('Error: ' + d.error); }
    else {
      smData = d;
      if (!smData.all_products) smData.all_products = d.high_risk_report || [];
      renderSupermarketDashboard(d);
      smNavigate('dashboard');
    }
  } catch(e) { alert('Server error'); }
  finally { btn.innerHTML = '<span class="btn-icon">▶</span> Analyze Emissions'; btn.disabled = false; }
}

function renderSupermarketDashboard(d) {
  const products = smData?.all_products || d.all_products || d.high_risk_report || [];

  // Stats
  document.getElementById('sm-totalEmission').textContent = d.total_emission?.toLocaleString() ?? '—';
  document.getElementById('sm-totalUnits').textContent    = d.total_units?.toLocaleString()    ?? '—';
  document.getElementById('sm-avgEmission').textContent   = d.avg_emission ?? '—';
  document.getElementById('sm-highestImpact').textContent = d.highest_impact ?? '—';

  // Category doughnut
  const cats = Object.keys(d.category_emissions || {});
  const catVals = cats.map(k => d.category_emissions[k]);
  makeChart('sm-emissionChart', {
    type: 'doughnut',
    data: { labels: cats, datasets: [{ data: catVals, backgroundColor: PALETTE, borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: {size:11} } } }, cutout: '65%' }
  });

  // Source bar
  const srcs = Object.keys(d.source_emissions || {});
  const srcVals = srcs.map(k => d.source_emissions[k]);
  makeChart('sm-sourceChart', {
    type: 'bar',
    data: { labels: srcs, datasets: [{ data: srcVals, backgroundColor: PALETTE[1], borderRadius: 4 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#2a3448' } } } }
  });

  // Risk pie
  const rb = d.risk_breakdown || {};
  makeChart('sm-riskChart', {
    type: 'pie',
    data: { labels: Object.keys(rb), datasets: [{ data: Object.values(rb), backgroundColor: ['#00d9a3','#ff8c42','#ff4d4f'], borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: {size:11} } } } }
  });

  // Intensity bar (top 8)
  const sorted = [...products].sort((a,b) => b.total_emission - a.total_emission).slice(0,8);
  makeChart('sm-intensityChart', {
    type: 'bar',
    data: {
      labels: sorted.map(p => p.product.length > 14 ? p.product.slice(0,14)+'…' : p.product),
      datasets: [{ data: sorted.map(p => p.total_emission), backgroundColor: sorted.map(p => p.risk_level === 'High-Risk' ? '#ff4d4f' : p.risk_level === 'Critical' ? '#ff8c42' : '#00d9a3'), borderRadius: 4 }]
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#2a3448' } }, y: { grid: { display: false } } } }
  });

  // Pareto
  const paretoSorted = [...products].sort((a,b) => b.total_emission - a.total_emission);
  const totalE = paretoSorted.reduce((s,p) => s + p.total_emission, 0);
  let cumul = 0;
  const cumPct = paretoSorted.map(p => { cumul += p.total_emission; return Math.round(cumul / totalE * 100); });
  makeChart('sm-paretoChart', {
    type: 'bar',
    data: {
      labels: paretoSorted.map((p,i) => i + 1),
      datasets: [
        { type:'bar', data: paretoSorted.map(p => p.total_emission), backgroundColor: '#58a6ff', borderRadius: 3, yAxisID: 'y' },
        { type:'line', data: cumPct, borderColor: '#ff8c42', borderWidth: 2, pointRadius: 2, fill: false, yAxisID: 'y1' }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y:  { grid: { color: '#2a3448' }, title: { display: true, text: 'CO₂ (kg)', font: {size:10} } },
        y1: { position: 'right', max: 100, grid: { display: false }, ticks: { callback: v => v+'%' } }
      }
    }
  });

  // Products table
  renderProductTable(products);
  // Compliance table
  renderComplianceTable(d.high_risk_report || []);

  // ── AI Recommendations: merge backend suggestions + any risky products not yet covered ──
  const baseSuggestions = d.suggestions || [];
  const allRisky = products.filter(p => p.risk_level === 'High-Risk' || p.risk_level === 'Critical');
  const suggestedNames = new Set(baseSuggestions.map(s => s.original_product));
  const missingSugs = allRisky
    .filter(p => !suggestedNames.has(p.product))
    .map(p => ({
      original_product:    p.product,
      alternative_product: 'Lower-emission alternative',
      category:            p.category,
      risk_level:          p.risk_level,
      reduction_pct:       '15–30',
      reduction_potential: Math.round(p.total_emission * 0.2),
      confidence:          'Moderate',
      narrative:           `${p.product} contributes ${p.total_emission} kg CO₂ and is flagged as ${p.risk_level}. Consider sourcing a lower-emission alternative in the ${p.category} category to meaningfully reduce your store's carbon footprint for this product line.`
    }));
  renderRecommendations([...baseSuggestions, ...missingSugs]);
}

let allProducts = [];
function renderProductTable(products) {
  allProducts = products;
  const tbody = document.getElementById('fullProductBody');
  if (!products.length) { tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No products.</td></tr>'; return; }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><code>${p.id}</code></td>
      <td>${p.product}</td>
      <td>${p.category}</td>
      <td>${p.source}</td>
      <td>${p.units}</td>
      <td>${p.emission_per_unit}</td>
      <td><strong>${p.total_emission}</strong></td>
      <td><span class="risk-badge ${p.risk_level}">${p.risk_level}</span></td>
    </tr>`).join('');
}

function filterProductTable(q) {
  const lower = q.toLowerCase();
  const filtered = allProducts.filter(p => p.product.toLowerCase().includes(lower) || p.category.toLowerCase().includes(lower) || p.source.toLowerCase().includes(lower));
  renderProductTable(filtered);
}

function renderComplianceTable(items) {
  const tbody = document.getElementById('reportTableBody');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No high-risk items. ✓</td></tr>'; return; }
  tbody.innerHTML = items.map(p => `
    <tr>
      <td><code>${p.id}</code></td>
      <td>${p.product}</td>
      <td>${p.source}</td>
      <td><strong>${p.total_emission}</strong></td>
      <td><span class="risk-badge ${p.risk_level}">${p.risk_level}</span></td>
    </tr>`).join('');
}

// ════════════════════════════════════════════════════════
// AI RECOMMENDATIONS — LLM-style UI
// ════════════════════════════════════════════════════════
function renderRecommendations(sugs) {
  const cont = document.getElementById('aiRecommendationsContainer');
  if (!sugs.length) {
    cont.innerHTML = '<div class="empty-hero"><div class="empty-icon">✦</div><p>No high-risk items — no recommendations needed.</p></div>';
    return;
  }

  const riskColor  = r => r === 'High-Risk' ? 'var(--danger)' : r === 'Critical' ? 'var(--warn)' : 'var(--success)';
  const riskBg     = r => r === 'High-Risk' ? 'rgba(248,81,73,0.08)' : r === 'Critical' ? 'rgba(227,179,65,0.08)' : 'rgba(63,185,80,0.08)';
  const riskBorder = r => r === 'High-Risk' ? 'rgba(248,81,73,0.25)' : r === 'Critical' ? 'rgba(227,179,65,0.25)' : 'rgba(63,185,80,0.25)';

  cont.innerHTML = `
    <div class="ai-reco-intro">
      <div class="ai-reco-intro-header">
        <span class="ai-reco-badge">✦ AI Analysis</span>
        <span class="ai-reco-title">CarbonLens Recommendations</span>
      </div>
      <p class="ai-reco-summary">
        Identified <strong>${sugs.length} product${sugs.length !== 1 ? 's' : ''}</strong> with elevated emission risk.
        Switching to the recommended alternatives below could significantly reduce your store's carbon footprint.
      </p>
    </div>

    ${sugs.map((s, i) => `
      <div class="reco-card" style="animation-delay:${i * 0.06}s">

        <div class="reco-card-header">
          <div class="reco-product-row">
            <span class="reco-product-name">${s.original_product}</span>
            <span class="reco-arrow">→</span>
            <span class="reco-alt-name">${s.alternative_product}</span>
          </div>
          <span class="reco-savings">↓ ~${s.reduction_pct}% CO₂</span>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          <span style="
            display:inline-flex;align-items:center;gap:5px;
            font-size:11px;font-weight:700;padding:3px 10px;
            border-radius:5px;
            border:1px solid ${riskBorder(s.risk_level)};
            color:${riskColor(s.risk_level)};
            background:${riskBg(s.risk_level)};
            font-family:var(--font-body);
          ">⚠ ${s.risk_level}</span>

          <span style="
            display:inline-flex;align-items:center;gap:5px;
            font-size:11px;font-weight:700;padding:3px 10px;
            border-radius:5px;
            border:1px solid var(--border2);
            color:var(--muted);
            background:var(--surface2);
            font-family:var(--font-body);
          ">📦 ${s.category}</span>

          <span style="
            display:inline-flex;align-items:center;gap:5px;
            font-size:11px;font-weight:700;padding:3px 10px;
            border-radius:5px;
            border:1px solid var(--border2);
            color:var(--muted);
            background:var(--surface2);
            font-family:var(--font-body);
          ">📉 Save ~${s.reduction_potential} kg CO₂</span>

          <span style="
            display:inline-flex;align-items:center;gap:5px;
            font-size:11px;font-weight:700;padding:3px 10px;
            border-radius:5px;
            border:1px solid rgba(0,200,150,0.2);
            color:var(--accent);
            background:rgba(0,200,150,0.07);
            font-family:var(--font-body);
          ">✦ Confidence: ${s.confidence}</span>
        </div>

        <div style="
          border-left:3px solid var(--accent);
          padding:12px 16px;
          border-radius:0 8px 8px 0;
          background:var(--surface2);
          margin-bottom:0;
        ">
          <p class="reco-body" style="margin:0;line-height:1.8;">${s.narrative}</p>
        </div>

      </div>`).join('')}`;
}

function smNavigate(page) {
  document.querySelectorAll('#appSupermarket .page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#appSupermarket .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`sm-page-${page}`).classList.add('active');
  document.querySelector(`#appSupermarket [data-page="${page}"]`).classList.add('active');
  const titles = {dashboard:'Dashboard',upload:'Upload Data',products:'Products',recommendations:'AI Recommendations',compliance:'Compliance',reports:'Reports'};
  document.getElementById('smPageTitle').textContent = titles[page] || page;
}

function exportCSV() { window.location = '/download-compliance-report'; }
function downloadReport(type) {
  if (type === 'full') window.location = '/download-full-emission-report';
  else window.location = '/download-ai-recommendations-report';
}

// ════════════════════════════════════════════════════════
// GOVERNMENT
// ════════════════════════════════════════════════════════
let govStats = null;

async function launchGovernment(user) {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('appGovernment').style.display = 'flex';
  document.getElementById('govName').textContent = user.username || 'Officer';
  document.getElementById('govOrg').textContent  = user.organization || 'Ministry';
  document.getElementById('govAvatar').textContent = (user.username || 'G')[0].toUpperCase();
  await loadGovStats();
}

async function loadGovStats() {
  try {
    const r = await fetch('/api/gov/statistics');
    govStats = await r.json();
    renderGovOverview(govStats);
    renderGovCompanies(govStats);
    renderGovViolations(govStats);
    renderGovAnalytics(govStats);
    renderGovPolicy(govStats);
    const nc = govStats.non_compliant_count || 0;
    document.getElementById('govAlertBanner').textContent =
      nc > 0 ? `⚡ ${nc} compan${nc===1?'y':'ies'} exceed emission thresholds` : '✓ All companies within threshold';
    document.getElementById('govAlertBanner').style.color = nc > 0 ? 'var(--red)' : 'var(--teal)';
    document.getElementById('govAlertBanner').style.borderColor = nc > 0 ? 'rgba(255,77,79,.25)' : 'rgba(0,217,163,.25)';
    document.getElementById('govAlertBanner').style.background = nc > 0 ? 'rgba(255,77,79,.08)' : 'rgba(0,217,163,.08)';
  } catch(e) {
    console.error('Gov stats error', e);
  }
}

function govNavigate(page) {
  document.querySelectorAll('#appGovernment .page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#appGovernment .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`gov-page-${page}`).classList.add('active');
  document.querySelector(`#appGovernment [data-page="${page}"]`).classList.add('active');
  const titles = {overview:'National Overview',companies:'Companies',violations:'Violations',analytics:'Deep Analytics',policy:'Policy Insights'};
  document.getElementById('govPageTitle').textContent = titles[page] || page;
  if (page === 'companies' && govStats) renderGovCompanies(govStats);
  if (page === 'analytics' && govStats) renderGovAnalytics(govStats);
}

function renderGovOverview(d) {
  document.getElementById('gov-totalEmission').textContent = (d.total_emission||0).toLocaleString();
  document.getElementById('gov-totalStores').textContent   = d.total_stores || 0;
  document.getElementById('gov-nonCompliant').textContent  = d.non_compliant_count || 0;
  document.getElementById('gov-compliant').textContent     = d.compliant_count || 0;

  const top = (d.top_emitters || []).slice(0,8);
  makeChart('gov-companyChart', {
    type: 'bar',
    data: {
      labels: top.map(s => s.organization),
      datasets: [{
        data: top.map(s => s.total_emission),
        backgroundColor: top.map(s => s.compliance_status === 'Non-Compliant' ? '#ff4d4f' : '#58a6ff'),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString()} kg CO₂` } } },
      scales: { x: { grid: { color: '#2a3448' } }, y: { grid: { display: false } } }
    }
  });

  const cats = Object.keys(d.category_emissions || {});
  makeChart('gov-sectorChart', {
    type: 'doughnut',
    data: { labels: cats, datasets: [{ data: cats.map(k => d.category_emissions[k]), backgroundColor: PALETTE, borderWidth: 0 }] },
    options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font:{size:11} } } } }
  });

  const cCount  = d.compliant_count || 0;
  const ncCount = d.non_compliant_count || 0;
  makeChart('gov-complianceChart', {
    type: 'doughnut',
    data: {
      labels: ['Compliant', 'Non-Compliant'],
      datasets: [{ data: [cCount, ncCount], backgroundColor: ['#00d9a3', '#ff4d4f'], borderWidth: 0 }]
    },
    options: { cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font:{size:11} } } } }
  });

  let totRisk = {Normal:0, Critical:0, 'High-Risk':0};
  (d.gov_stores || []).forEach(store => {
    const rb = store.risk_breakdown || {};
    Object.keys(rb).forEach(k => { totRisk[k] = (totRisk[k]||0) + (rb[k]||0); });
  });
  makeChart('gov-riskChart', {
    type: 'bar',
    data: {
      labels: Object.keys(totRisk),
      datasets: [{ data: Object.values(totRisk), backgroundColor: ['#00d9a3','#ff8c42','#ff4d4f'], borderRadius: 4 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#2a3448' } } } }
  });
}

function renderGovCompanies(d) {
  const grid = document.getElementById('companyGrid');
  const stores = d.gov_stores || [];
  if (!stores.length) {
    grid.innerHTML = '<div style="color:var(--text2);padding:40px;grid-column:1/-1;text-align:center">No supermarkets registered yet.</div>';
    return;
  }
  grid.innerHTML = stores.map(s => `
    <div class="company-card" onclick="openStoreModal('${s.store_id}')">
      <div class="cc-header">
        <div>
          <div class="cc-org">${s.organization}</div>
          <div class="cc-id">${s.store_id}</div>
        </div>
        <span class="risk-badge ${s.compliance_status}">${s.compliance_status}</span>
      </div>
      <div class="cc-emission">${(s.total_emission||0).toLocaleString()}</div>
      <div class="cc-unit">kg CO₂ emitted</div>
      <div class="cc-footer">
        <div class="cc-date">📋 Reports: ${s.reports_submitted||0}</div>
        <div class="cc-date">🕐 ${s.last_upload ? new Date(s.last_upload).toLocaleDateString() : 'No upload'}</div>
      </div>
    </div>`).join('');
}

async function openStoreModal(storeId) {
  if (!storeId || storeId === 'undefined') return;
  document.getElementById('storeModal').style.display = 'flex';
  document.getElementById('storeModalBox').innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const r = await fetch(`/api/gov/supermarket/${storeId}`);
    if (!r.ok) throw new Error('Not found');
    const sm = await r.json();
    renderStoreModal(sm);
  } catch(e) {
    document.getElementById('storeModalBox').innerHTML = '<div style="padding:40px;color:var(--text2)">Could not load store details.</div>';
  }
}

function closeStoreModal(e) {
  if (e.target === document.getElementById('storeModal')) document.getElementById('storeModal').style.display = 'none';
}

function renderStoreModal(sm) {
  const cats = Object.keys(sm.category_emissions || {});
  const rb   = sm.risk_breakdown || {};
  document.getElementById('storeModalBox').innerHTML = `
    <div class="modal-header">
      <div>
        <div class="modal-title">${sm.organization}</div>
        <div style="font-size:12px;color:var(--text2);font-family:monospace">${sm.id} · ${sm.email}</div>
      </div>
      <button class="modal-close" onclick="document.getElementById('storeModal').style.display='none'">✕</button>
    </div>
    <div class="modal-stats">
      <div class="modal-stat"><div class="modal-stat-val" style="color:var(--orange)">${(sm.total_emission||0).toLocaleString()}</div><div class="modal-stat-lbl">Total CO₂ (kg)</div></div>
      <div class="modal-stat"><div class="modal-stat-val" style="color:var(--blue)">${(sm.total_units||0).toLocaleString()}</div><div class="modal-stat-lbl">Units Tracked</div></div>
      <div class="modal-stat"><div class="modal-stat-val" style="color:${sm.compliance_status==='Compliant'?'var(--teal)':'var(--red)'}">${sm.compliance_status||'—'}</div><div class="modal-stat-lbl">Compliance</div></div>
    </div>
    <div class="modal-section-title">Emission by Category</div>
    ${cats.length ? `<div style="height:180px;margin-bottom:20px"><canvas id="modalCatChart"></canvas></div>` : '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">No category data yet.</div>'}
    <div class="modal-section-title">Risk Breakdown</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
      ${Object.entries(rb).map(([k,v]) => `<div style="background:var(--bg3);border-radius:8px;padding:12px 20px;text-align:center"><div style="font-size:22px;font-weight:800">${v}</div><div style="font-size:11px;color:var(--text2);margin-top:4px">${k}</div></div>`).join('')}
    </div>
    <div class="modal-section-title">High-Risk Products (${(sm.high_risk_products||[]).length})</div>
    <div class="report-table-wrap">
      <table class="report-table">
        <thead><tr><th>Product</th><th>Category</th><th>CO₂ (kg)</th><th>Risk</th></tr></thead>
        <tbody>
          ${(sm.high_risk_products||[]).length ? (sm.high_risk_products||[]).map(p=>`
            <tr><td>${p.product}</td><td>${p.category}</td><td><strong>${p.total_emission}</strong></td><td><span class="risk-badge ${p.risk_level}">${p.risk_level}</span></td></tr>
          `).join('') : '<tr><td colspan="4" class="table-empty">No high-risk products</td></tr>'}
        </tbody>
      </table>
    </div>`;
  if (cats.length) {
    setTimeout(() => {
      makeChart('modalCatChart', {
        type: 'bar',
        data: { labels: cats, datasets: [{ data: cats.map(k=>sm.category_emissions[k]), backgroundColor: PALETTE, borderRadius: 4 }] },
        options: { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{grid:{color:'#2a3448'}}} }
      });
    }, 50);
  }
}

function renderGovViolations(d) {
  const tbody = document.getElementById('violationsBody');
  const viols = d.violations || [];
  if (!viols.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">✓ No violations detected.</td></tr>';
    return;
  }
  tbody.innerHTML = viols.map(v => `
    <tr>
      <td><strong>${v.company}</strong><br><code style="font-size:10px;color:var(--text2)">${v.store_id}</code></td>
      <td>${v.product}</td>
      <td>${v.category}</td>
      <td><strong>${v.total_emission}</strong></td>
      <td><span class="risk-badge ${v.risk_level}">${v.risk_level}</span></td>
      <td><span class="risk-badge Non-Compliant">Flagged</span></td>
    </tr>`).join('');
}

function renderGovAnalytics(d) {
  const cats = Object.keys(d.category_emissions || {});
  makeChart('gov-catBreakChart', {
    type: 'bar',
    data: { labels: cats, datasets: [{ data: cats.map(k=>d.category_emissions[k]), backgroundColor: PALETTE, borderRadius: 4 }] },
    options: { plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{grid:{color:'#2a3448'}}} }
  });

  const top5 = (d.top_emitters||[]).slice(0,5);
  makeChart('gov-top5Chart', {
    type: 'polarArea',
    data: {
      labels: top5.map(s=>s.organization),
      datasets: [{ data: top5.map(s=>s.total_emission), backgroundColor: PALETTE.map(c=>c+'aa'), borderWidth: 0 }]
    },
    options: { plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, font:{size:10} } } } }
  });

  let totRisk = {Normal:0, Critical:0, 'High-Risk':0};
  (d.gov_stores||[]).forEach(s=>{
    const rb = s.risk_breakdown||{};
    Object.keys(rb).forEach(k=>{ totRisk[k]=(totRisk[k]||0)+(rb[k]||0); });
  });
  makeChart('gov-heatChart', {
    type: 'doughnut',
    data: {
      labels: Object.keys(totRisk),
      datasets: [{ data: Object.values(totRisk), backgroundColor: ['#00d9a3','#ff8c42','#ff4d4f'], borderWidth: 0 }]
    },
    options: { cutout:'60%', plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}} }
  });

  const totalE = d.total_emission || 0;
  const totalS = d.total_stores  || 0;
  const nc     = d.non_compliant_count || 0;
  const topE   = (d.top_emitters||[])[0];
  document.getElementById('govInsights').innerHTML = `
    <div class="insight-item"><div class="insight-num">${totalE.toLocaleString()} kg</div><div class="insight-txt">Total national CO₂ from all registered supermarkets</div></div>
    <div class="insight-item"><div class="insight-num">${totalS}</div><div class="insight-txt">Supermarkets registered on the gov portal</div></div>
    <div class="insight-item"><div class="insight-num">${nc}</div><div class="insight-txt">Companies currently exceeding emission thresholds</div></div>
    <div class="insight-item"><div class="insight-num">${topE ? topE.organization : '—'}</div><div class="insight-txt">Highest-emitting company this reporting period</div></div>
  `;
}

function renderGovPolicy(d) {
  const nc = d.non_compliant_count || 0;
  const cats = Object.keys(d.category_emissions || {}).sort((a,b)=>(d.category_emissions[b]-d.category_emissions[a]));
  const topCat = cats[0] || 'N/A';

  const policies = [
    {
      tag: 'IMMEDIATE ACTION',
      title: `${nc} non-compliant retailer${nc!==1?'s require':'requires'} intervention`,
      body: `${nc} registered supermarket${nc!==1?'s have':'has'} exceeded the emission threshold of 200 kg CO₂. Immediate inspection and corrective-action notices should be issued to these entities under Article 12 of the Carbon Reduction Act.`
    },
    {
      tag: 'CATEGORY PRIORITY',
      title: `${topCat} products drive the highest national emissions`,
      body: `${topCat} is the single largest emission category across all retailers, accounting for a disproportionate share of national CO₂. The ministry should consider mandatory emission reduction targets and alternative-product incentives for this category.`
    },
    {
      tag: 'REPORTING COMPLIANCE',
      title: 'Mandatory quarterly emission reporting recommended',
      body: `Currently ${d.total_stores||0} retailers submit emission reports. Enforcing quarterly mandatory reporting with standardised CSV templates will improve national data quality and enable earlier detection of threshold breaches.`
    },
    {
      tag: 'INCENTIVE SCHEME',
      title: 'Carbon credit scheme for compliant retailers',
      body: `Retailers consistently maintaining emissions below 100 kg CO₂ should be eligible for government-backed carbon credits. This market-based incentive has been shown to accelerate voluntary emission reductions by up to 30% in comparable programmes.`
    }
  ];

  document.getElementById('govPolicyContainer').innerHTML = policies.map(p => `
    <div class="policy-card">
      <div class="policy-tag">${p.tag}</div>
      <div class="policy-title">${p.title}</div>
      <div class="policy-body">${p.body}</div>
    </div>`).join('');
}

function exportGovCSV() {
  if (!govStats) return;
  const viols = govStats.violations || [];
  const rows  = [['Company','StoreID','Product','Category','CO2_kg','RiskLevel']];
  viols.forEach(v => rows.push([v.company, v.store_id, v.product, v.category, v.total_emission, v.risk_level]));
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `gov_violations_${Date.now()}.csv`; a.click();
}