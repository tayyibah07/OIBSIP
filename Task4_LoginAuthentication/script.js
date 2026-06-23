/* ============================================================
   AuthSphere — script.js
   Handles: auth, sessions, toasts, particles, themes,
            security score, streaks, badges, tips, timeline
   ============================================================ */

'use strict';

/* ── Storage helpers ─────────────────────────────────────── */
const Store = {
  get: (k, def = null) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  remove: (k) => localStorage.removeItem(k),
};

/* ── User DB helpers ─────────────────────────────────────── */
const DB = {
  getAll: () => Store.get('as_users', {}),
  save: (users) => Store.set('as_users', users),
  find: (email) => DB.getAll()[email.toLowerCase()] || null,
  create(name, email, pw, pwScore) {
    const users = DB.getAll();
    const key = email.toLowerCase();
    users[key] = {
      name, email: key, pw,
      pwScore,
      createdAt: Date.now(),
      totalLogins: 0,
      streak: 0,
      lastLoginDate: null,
      activity: [{ event: 'Account created', ts: Date.now() }],
    };
    DB.save(users);
    return users[key];
  },
  update(email, patch) {
    const users = DB.getAll();
    const key = email.toLowerCase();
    if (users[key]) { Object.assign(users[key], patch); DB.save(users); }
  },
};

/* ── Session helpers ─────────────────────────────────────── */
const Session = {
  KEY: 'as_session',
  start(email, remember) {
    Store.set(this.KEY, { email: email.toLowerCase(), startTime: Date.now(), remember });
  },
  get() { return Store.get(this.KEY); },
  end() { Store.remove(this.KEY); },
  user() {
    const s = this.get();
    return s ? DB.find(s.email) : null;
  },
  require() {
    if (!this.get()) { window.location.href = 'index.html'; return false; }
    return true;
  },
};

/* ── Toast system ────────────────────────────────────────── */
const Toast = (() => {
  const icons = { success: '✅', error: '❌', info: '💡', warn: '⚠️' };
  const titles = { success: 'Success', error: 'Error', info: 'Info', warn: 'Warning' };

  function show(type, msg, duration = 4000) {
    let root = document.getElementById('toast-root');
    if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="t-icon">${icons[type] || '💬'}</span>
      <div class="t-body">
        <div class="t-title">${titles[type] || type}</div>
        <div class="t-msg">${msg}</div>
      </div>
      <button class="t-close" aria-label="Close">✕</button>`;

    root.appendChild(el);
    el.querySelector('.t-close').onclick = () => dismiss(el);

    if (duration > 0) setTimeout(() => dismiss(el), duration);
    return el;
  }

  function dismiss(el) {
    if (!el.isConnected) return;
    el.classList.add('exit');
    setTimeout(() => el.remove(), 350);
  }

  return {
    success: (m, d) => show('success', m, d),
    error:   (m, d) => show('error', m, d),
    info:    (m, d) => show('info', m, d),
    warn:    (m, d) => show('warn', m, d),
  };
})();

/* ── Particles ───────────────────────────────────────────── */
function initParticles() {
  const canvas = document.getElementById('ptc');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];

  function resize() { canvas.width = W = innerWidth; canvas.height = H = innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // Get primary color from CSS var
  function getPrimaryRgb() {
    const v = getComputedStyle(document.body).getPropertyValue('--primary-rgb').trim();
    return v ? v.split(',').map(Number) : [16, 185, 129];
  }

  class Pt {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.45;
      this.vy = (Math.random() - 0.5) * 0.45;
      this.r = Math.random() * 1.6 + 0.5;
      this.a = Math.random() * 0.55 + 0.15;
    }
  }

  for (let i = 0; i < 85; i++) pts.push(new Pt());

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const [r, g, b] = getPrimaryRgb();

    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${p.a})`;
      ctx.fill();
    });

    // Draw connecting lines
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 115) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.08 * (1 - d / 115)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

/* ── Theme switcher ──────────────────────────────────────── */
function initThemes() {
  const saved = Store.get('as_theme', 'emerald');
  applyTheme(saved, false);

  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const t = dot.dataset.theme;
      applyTheme(t, true);
      Store.set('as_theme', t);
    });
  });
}

function applyTheme(name, toast = true) {
  const classes = ['theme-red', 'theme-blue', 'theme-orange'];
  document.body.classList.remove(...classes);
  if (name !== 'emerald') document.body.classList.add(`theme-${name}`);

  document.querySelectorAll('.theme-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.theme === name);
  });
  if (toast) Toast.info(`${capitalize(name)} theme activated`);
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── Password strength ───────────────────────────────────── */
function measureStrength(pw) {
  if (!pw) return { score: 0, label: '', emoji: '' };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;

  const levels = [
    { score: 0, label: 'Too short', emoji: '🔴', color: '#EF4444' },
    { score: 1, label: 'Weak',      emoji: '🔴', color: '#EF4444' },
    { score: 2, label: 'Medium',    emoji: '🟡', color: '#F59E0B' },
    { score: 3, label: 'Strong',    emoji: '🟢', color: '#10B981' },
    { score: 4, label: 'Strong',    emoji: '🟢', color: '#10B981' },
    { score: 5, label: 'Very Strong', emoji: '🔥', color: '#FBBF24' },
  ];
  return { ...levels[Math.min(s, 5)], raw: s };
}

function renderStrength(pw, barsEl, textEl) {
  const { raw = 0, label, emoji, color } = measureStrength(pw);
  const bars = barsEl.querySelectorAll('.sbar');
  const barColors = ['#EF4444', '#F59E0B', '#10B981', '#FBBF24'];
  bars.forEach((b, i) => {
    b.style.background = i < raw ? (barColors[Math.min(raw - 1, 3)] || '#10B981') : 'rgba(255,255,255,.09)';
  });
  textEl.textContent = pw ? `${emoji} ${label}` : '';
  return raw;
}

/* ── Field validation helpers ────────────────────────────── */
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function setErr(input, msgEl, msg) {
  input.classList.add('err'); msgEl.textContent = msg; msgEl.classList.add('show');
}
function clearErr(input, msgEl) {
  input.classList.remove('err'); msgEl.classList.remove('show');
}

/* ── Security score calculation ──────────────────────────── */
function calcSecurityScore(user) {
  let s = 0;
  // Password strength (0-40)
  s += Math.min(user.pwScore || 0, 5) * 8;
  // Profile complete (20): has name + email
  if (user.name && user.email) s += 20;
  // Streak (0-25)
  s += Math.min((user.streak || 0) * 5, 25);
  // Login frequency (0-15): 5+ logins
  if ((user.totalLogins || 0) >= 5) s += 15;
  return Math.min(Math.round(s), 100);
}

/* ── Streak updater ──────────────────────────────────────── */
function updateStreak(user) {
  const now = new Date();
  const today = now.toDateString();
  const last = user.lastLoginDate;

  if (!last) {
    return { streak: 1, lastLoginDate: today };
  }
  if (last === today) {
    return { streak: user.streak, lastLoginDate: today };
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (last === yesterday.toDateString()) {
    return { streak: (user.streak || 0) + 1, lastLoginDate: today };
  }
  // Streak broken
  return { streak: 1, lastLoginDate: today };
}

/* ── Badge definitions ───────────────────────────────────── */
const BADGES = [
  { id: 'first_login',   icon: '🥇', name: 'First Login',     cond: 'Log in for the first time',  check: u => u.totalLogins >= 1 },
  { id: 'strong_pw',     icon: '🛡️', name: 'Strong Password', cond: 'Use a strong/very strong password', check: u => u.pwScore >= 4 },
  { id: 'streak_7',      icon: '🔥', name: '7-Day Streak',    cond: 'Log in 7 days in a row',     check: u => u.streak >= 7 },
  { id: 'sec_master',    icon: '👑', name: 'Security Master', cond: 'Reach 90+ security score',   check: u => calcSecurityScore(u) >= 90 },
];

/* ── Activity log helper ─────────────────────────────────── */
function addActivity(email, event) {
  const user = DB.find(email);
  if (!user) return;
  const log = user.activity || [];
  log.unshift({ event, ts: Date.now() });
  if (log.length > 20) log.length = 20;
  DB.update(email, { activity: log });
}

/* ── Security tips ───────────────────────────────────────── */
const TIPS = [
  { icon: '🔑', headline: 'Use unique passwords', body: 'Never reuse passwords across sites. A unique password for every account significantly limits damage if one service is breached.' },
  { icon: '📱', headline: 'Enable two-factor auth', body: 'Two-factor authentication adds a second layer of verification, making unauthorised access dramatically harder.' },
  { icon: '🔄', headline: 'Update passwords regularly', body: 'Change your passwords every 3–6 months, especially for critical accounts like email and banking.' },
  { icon: '🕵️', headline: 'Beware phishing attacks', body: 'Always check the sender\'s email and URL before clicking links. Legitimate services never ask for your password via email.' },
  { icon: '💾', headline: 'Use a password manager', body: 'Tools like Bitwarden or 1Password generate and store strong, unique passwords so you only need to remember one master password.' },
];

/* ── Date formatting ─────────────────────────────────────── */
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(ts) {
  const now = new Date(), d = new Date(ts);
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtAccountAge(ts) {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

/* ── Session timer ───────────────────────────────────────── */
function startSessionTimer(startTime) {
  const el = document.getElementById('session-time');
  if (!el) return;
  function update() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    el.textContent = `${m}m ${s}s`;
  }
  update();
  setInterval(update, 1000);
}

/* ── Security ring animation ─────────────────────────────── */
function animateRing(score) {
  const fill = document.querySelector('.ring-fill');
  const numEl = document.getElementById('ring-score-num');
  if (!fill || !numEl) return;

  const circ = 283;
  const offset = circ - (circ * score / 100);

  setTimeout(() => {
    fill.style.strokeDashoffset = offset;
  }, 300);

  // Count up animation
  let cur = 0;
  const step = Math.ceil(score / 60);
  const iv = setInterval(() => {
    cur = Math.min(cur + step, score);
    numEl.textContent = cur;
    if (cur >= score) clearInterval(iv);
  }, 20);
}

/* ── Score bars animation ────────────────────────────────── */
function animateBars(user) {
  const score = calcSecurityScore(user);
  const pwPct  = Math.min((user.pwScore || 0) / 5 * 100, 100);
  const strPct = Math.min((user.streak || 0) / 7 * 100, 100);
  const acPct  = Math.min((user.totalLogins || 0) / 10 * 100, 100);

  setTimeout(() => {
    const bars = document.querySelectorAll('.sb-fill');
    if (bars[0]) bars[0].style.width = pwPct + '%';
    if (bars[1]) bars[1].style.width = strPct + '%';
    if (bars[2]) bars[2].style.width = acPct + '%';
  }, 400);
}

/* ── Tips carousel ───────────────────────────────────────── */
function initTips() {
  let idx = 0;

  function render() {
    const tip = TIPS[idx];
    const card = document.getElementById('tip-card');
    const dots = document.getElementById('tip-dots');
    if (!card || !dots) return;

    card.innerHTML = `
      <span class="tip-icon">${tip.icon}</span>
      <div>
        <div class="tip-headline">${tip.headline}</div>
        <div class="tip-body">${tip.body}</div>
      </div>`;
    card.className = 'tip-card'; // re-trigger animation

    dots.innerHTML = TIPS.map((_, i) =>
      `<div class="tip-dot${i === idx ? ' active' : ''}" data-i="${i}"></div>`
    ).join('');

    dots.querySelectorAll('.tip-dot').forEach(d => {
      d.onclick = () => { idx = +d.dataset.i; render(); };
    });
  }

  const nextBtn = document.getElementById('tip-next');
  if (nextBtn) nextBtn.onclick = () => { idx = (idx + 1) % TIPS.length; render(); };

  render();
  setInterval(() => { idx = (idx + 1) % TIPS.length; render(); }, 8000);
}

/* ── Badges render ───────────────────────────────────────── */
function renderBadges(user) {
  const grid = document.getElementById('badges-grid');
  if (!grid) return;
  grid.innerHTML = BADGES.map(b => {
    const unlocked = b.check(user);
    return `
      <div class="badge-card ${unlocked ? 'unlocked' : 'locked'}" title="${unlocked ? 'Unlocked!' : 'Locked'}">
        <div class="badge-icon">${b.icon}</div>
        <div>
          <div class="badge-name">${b.name}</div>
          <div class="badge-cond">${unlocked ? '✓ Unlocked' : b.cond}</div>
        </div>
      </div>`;
  }).join('');
}

/* ── Timeline render ─────────────────────────────────────── */
function renderTimeline(user) {
  const el = document.getElementById('timeline');
  if (!el) return;

  const activities = user.activity || [];
  if (!activities.length) { el.innerHTML = '<p class="tl-empty">No activity yet.</p>'; return; }

  // Group by day label
  const grouped = {};
  activities.forEach(a => {
    const key = fmtDateShort(a.ts);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  el.innerHTML = Object.entries(grouped).map(([day, items]) => `
    <div class="tl-day">${day}</div>
    ${items.map(a => `
      <div class="tl-entry">
        <div>
          <div class="tl-event">${a.event}</div>
          <div class="tl-time">${fmtDate(a.ts)}</div>
        </div>
      </div>`).join('')}
  `).join('');
}

/* ── Dashboard population ────────────────────────────────── */
function populateDashboard() {
  const session = Session.get();
  if (!session) return;

  const user = DB.find(session.email);
  if (!user) return;

  const score = calcSecurityScore(user);
  const streak = user.streak || 0;
  const initials = user.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const now = new Date();

  // Welcome banner
  const wbName = document.getElementById('wb-name');
  if (wbName) wbName.textContent = user.name.split(' ')[0];
  const wbDate = document.getElementById('wb-date');
  if (wbDate) wbDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const avLg = document.getElementById('avatar-lg');
  if (avLg) avLg.textContent = initials;

  // Topbar
  const avSm = document.getElementById('avatar-sm');
  if (avSm) avSm.textContent = initials;
  const upName = document.getElementById('up-name');
  if (upName) upName.textContent = user.name.split(' ')[0];

  // Stats
  const sLogins = document.getElementById('stat-logins');
  if (sLogins) sLogins.textContent = user.totalLogins || 0;
  const sAge = document.getElementById('stat-age');
  if (sAge) sAge.textContent = fmtAccountAge(user.createdAt);
  const sScore = document.getElementById('stat-score');
  if (sScore) sScore.textContent = score + '%';
  const sStreak = document.getElementById('stat-streak');
  if (sStreak) sStreak.textContent = streak + ' day' + (streak !== 1 ? 's' : '');

  // Streak display
  const sNum = document.getElementById('streak-num');
  if (sNum) sNum.textContent = streak;

  // Ring
  animateRing(score);
  animateBars(user);

  // Session timer
  startSessionTimer(session.startTime);

  // Render panels
  renderBadges(user);
  renderTimeline(user);
  initTips();
}

/* ── Logout ──────────────────────────────────────────────── */
function logout() {
  Session.end();
  window.location.href = 'index.html';
}

/* ── Page-specific boot ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initThemes();

  const page = document.body.dataset.page;

  /* ───────── LOGIN PAGE ───────── */
  if (page === 'login') {
    // Redirect if already logged in
    if (Session.get()) { window.location.href = 'dashboard.html'; return; }

    // Pre-fill remembered email
    const rem = Store.get('as_remember');
    if (rem) {
      document.getElementById('login-email').value = rem;
      document.getElementById('remember-me').checked = true;
    }

    const form  = document.getElementById('login-form');
    const emailI  = document.getElementById('login-email');
    const pwI     = document.getElementById('login-pw');
    const emailE  = document.getElementById('email-err');
    const pwE     = document.getElementById('pw-err');
    const btn     = document.getElementById('login-btn');
    const pwToggle = document.getElementById('pw-toggle');

    // Show/hide password
    pwToggle.addEventListener('click', () => {
      const show = pwI.type === 'password';
      pwI.type = show ? 'text' : 'password';
      pwToggle.textContent = show ? '🙈' : '👁️';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;

      clearErr(emailI, emailE); clearErr(pwI, pwE);

      const email = emailI.value.trim();
      const pw    = pwI.value;

      if (!email) { setErr(emailI, emailE, 'Email is required'); ok = false; }
      else if (!validateEmail(email)) { setErr(emailI, emailE, 'Enter a valid email address'); ok = false; }

      if (!pw) { setErr(pwI, pwE, 'Password is required'); ok = false; }

      if (!ok) return;

      btn.classList.add('loading');

      setTimeout(() => {
        btn.classList.remove('loading');
        const user = DB.find(email);

        if (!user || user.pw !== pw) {
          Toast.error('Invalid email or password. Please try again.');
          setErr(pwI, pwE, 'Incorrect credentials');
          return;
        }

        // Update streak + stats
        const { streak, lastLoginDate } = updateStreak(user);
        DB.update(email, {
          streak,
          lastLoginDate,
          totalLogins: (user.totalLogins || 0) + 1,
        });
        addActivity(email, 'Signed in successfully');

        // Remember me
        if (document.getElementById('remember-me').checked) {
          Store.set('as_remember', email);
        } else {
          Store.remove('as_remember');
        }

        Session.start(email, document.getElementById('remember-me').checked);
        Toast.success('Login successful! Welcome back.');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
      }, 900);
    });
  }

  /* ───────── REGISTER PAGE ───────── */
  if (page === 'register') {
    if (Session.get()) { window.location.href = 'dashboard.html'; return; }

    const form    = document.getElementById('reg-form');
    const nameI   = document.getElementById('reg-name');
    const emailI  = document.getElementById('reg-email');
    const pwI     = document.getElementById('reg-pw');
    const cpwI    = document.getElementById('reg-cpw');
    const nameE   = document.getElementById('name-err');
    const emailE  = document.getElementById('email-err');
    const pwE     = document.getElementById('pw-err');
    const cpwE    = document.getElementById('cpw-err');
    const btn     = document.getElementById('reg-btn');
    const barsEl  = document.getElementById('pw-bars');
    const textEl  = document.getElementById('pw-strength-txt');
    const pwToggle  = document.getElementById('pw-toggle');
    const cpwToggle = document.getElementById('cpw-toggle');

    let currentPwScore = 0;

    pwI.addEventListener('input', () => {
      currentPwScore = renderStrength(pwI.value, barsEl, textEl);
    });

    pwToggle.addEventListener('click', () => {
      const show = pwI.type === 'password';
      pwI.type = show ? 'text' : 'password';
      pwToggle.textContent = show ? '🙈' : '👁️';
    });

    cpwToggle.addEventListener('click', () => {
      const show = cpwI.type === 'password';
      cpwI.type = show ? 'text' : 'password';
      cpwToggle.textContent = show ? '🙈' : '👁️';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;

      [nameE, emailE, pwE, cpwE].forEach(el => el.classList.remove('show'));
      [nameI, emailI, pwI, cpwI].forEach(el => el.classList.remove('err'));

      const name  = nameI.value.trim();
      const email = emailI.value.trim();
      const pw    = pwI.value;
      const cpw   = cpwI.value;

      if (!name || name.length < 2) { setErr(nameI, nameE, 'Full name must be at least 2 characters'); ok = false; }
      if (!email) { setErr(emailI, emailE, 'Email is required'); ok = false; }
      else if (!validateEmail(email)) { setErr(emailI, emailE, 'Enter a valid email address'); ok = false; }
      else if (DB.find(email)) { setErr(emailI, emailE, 'An account with this email already exists'); ok = false; }
      if (!pw || pw.length < 6) { setErr(pwI, pwE, 'Password must be at least 6 characters'); ok = false; }
      if (pw !== cpw) { setErr(cpwI, cpwE, 'Passwords do not match'); ok = false; }

      if (!ok) return;

      btn.classList.add('loading');

      setTimeout(() => {
        btn.classList.remove('loading');
        DB.create(name, email, pw, currentPwScore);
        Toast.success('Account created! You can now sign in.', 5000);
        setTimeout(() => { window.location.href = 'index.html'; }, 1200);
      }, 900);
    });
  }

  /* ───────── DASHBOARD PAGE ───────── */
  if (page === 'dashboard') {
    if (!Session.require()) return;

    populateDashboard();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }
});