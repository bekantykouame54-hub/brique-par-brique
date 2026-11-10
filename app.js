/* Brique par Brique — une brique par jour, 1 % du mur par brique. */
(() => {
  'use strict';

  const KEY = 'bpb:v1';
  const MAX_HABITS = 3;
  const WALL = 100; // briques par mur
  const COLORS = ['#c2553a', '#d39a3a', '#56708a', '#6b8f5e'];
  const $ = (s) => document.querySelector(s);

  /* ---------- Dates ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

  /* ---------- État ---------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.habits)) return s;
    } catch { /* données illisibles : on repart de zéro */ }
    return { habits: [], notified: {}, selected: null };
  }
  let state = load();
  state.notified ||= {};
  let currentDay = dateKey();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    mirrorToServiceWorker();
    updateBadge();
  }

  // Copie de l'état lisible par le service worker (rappels en arrière-plan).
  async function mirrorToServiceWorker() {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open('bpb-data');
      await cache.put(new Request('./__state'), new Response(JSON.stringify(state)));
    } catch { /* stockage indisponible */ }
  }

  function updateBadge() {
    if (!navigator.setAppBadge) return;
    const today = dateKey();
    const left = state.habits.filter((h) => !h.done[today]).length;
    (left ? navigator.setAppBadge(left) : navigator.clearAppBadge()).catch(() => {});
  }

  /* ---------- Calculs ---------- */
  const total = (h) => Object.keys(h.done).length;

  function streak(h) {
    let d = new Date();
    if (!h.done[dateKey(d)]) d = addDays(d, -1);
    let n = 0;
    while (h.done[dateKey(d)]) { n++; d = addDays(d, -1); }
    return n;
  }

  function rate30(h) {
    const today = new Date();
    const age = Math.round((fromKey(dateKey(today)) - fromKey(h.created)) / 864e5) + 1;
    const span = Math.max(1, Math.min(30, age));
    let done = 0;
    for (let i = 0; i < span; i++) if (h.done[dateKey(addDays(today, -i))]) done++;
    return Math.round((done / span) * 100);
  }

  function selectedHabit() {
    return state.habits.find((h) => h.id === state.selected) || state.habits[0] || null;
  }

  /* ---------- Mur ---------- */
  function renderWall(h, animate) {
    const wall = $('#wall');
    const count = total(h);
    const placed = count === 0 ? 0 : ((count - 1) % WALL) + 1;
    const level = count === 0 ? 1 : Math.floor((count - 1) / WALL) + 1;

    wall.style.setProperty('--c', h.color);
    wall.parentElement.style.setProperty('--c', h.color);
    $('#wall-pct').style.setProperty('--c', h.color);
    wall.classList.toggle('complete', placed === WALL);
    wall.setAttribute('aria-label', `${placed} briques posées sur ${WALL}`);
    wall.replaceChildren();

    const brick = (idx, half) => {
      const b = document.createElement('div');
      b.className = 'brick' + (half ? ' half' : '');
      if (idx < placed) {
        b.classList.add('on');
        b.style.setProperty('--s', (0.9 + ((idx * 37) % 7) / 35).toFixed(2));
        if (animate && idx === placed - 1) b.classList.add('drop');
      }
      return b;
    };
    for (let r = 0; r < 10; r++) {
      const row = document.createElement('div');
      row.className = 'row';
      const base = r * 10;
      if (r % 2 === 0) {
        for (let i = 0; i < 10; i++) row.append(brick(base + i));
      } else { // rang décalé : la première brique est coupée en deux demi-briques aux extrémités
        row.append(brick(base, true));
        for (let i = 1; i < 10; i++) row.append(brick(base + i));
        row.append(brick(base, true));
      }
      wall.append(row);
    }

    $('#wall-title').textContent = h.name;
    $('#wall-sub').textContent = `Mur n° ${level} · ${placed} brique${placed > 1 ? 's' : ''} sur ${WALL}`;
    $('#wall-pct').textContent = `${placed} %`;
    const s = streak(h);
    $('#stat-streak').textContent = `${s} jour${s > 1 ? 's' : ''}`;
    $('#stat-rate').textContent = `${rate30(h)} %`;
    $('#stat-total').textContent = count;
    $('#wall-msg').textContent = message(h, placed);

    if (animate) {
      const plus = document.createElement('div');
      plus.className = 'plus-one';
      plus.textContent = '+1 %';
      plus.addEventListener('animationend', () => plus.remove());
      wall.parentElement.append(plus);
    }
  }

  function message(h, placed) {
    const today = new Date();
    const doneToday = h.done[dateKey(today)];
    const doneYesterday = h.done[dateKey(addDays(today, -1))];
    if (doneToday && placed === WALL) return 'Mur terminé ! Cent briques, cent jours tenus. Le prochain mur commence demain.';
    if (doneToday) return 'Brique posée. Rien de plus à faire : reviens demain.';
    if (!doneYesterday && total(h) > 0 && h.created < dateKey(today)) {
      return 'Un jour manqué, ça arrive. La règle : jamais deux de suite. Pose ta brique aujourd\'hui.';
    }
    return h.mini
      ? `Une brique aujourd'hui = +1 %. Minimum pour la poser : ${h.mini}.`
      : 'Une brique aujourd\'hui = +1 % de ton mur.';
  }

  /* ---------- Vue Aujourd'hui ---------- */
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  function renderToday(animateId) {
    const has = state.habits.length > 0;
    $('#today-empty').hidden = has;
    $('#today-content').hidden = !has;
    if (!has) return;

    const sel = selectedHabit();
    const today = new Date();
    const todayKey = dateKey(today);
    const list = $('#habit-list');
    list.replaceChildren();

    for (const h of state.habits) {
      const li = document.createElement('li');
      li.className = 'habit' + (h.id === sel.id ? ' selected' : '');
      li.style.setProperty('--c', h.color);

      const info = document.createElement('div');
      info.className = 'col';
      const title = document.createElement('button');
      title.className = 'info';
      title.type = 'button';
      title.setAttribute('aria-label', `Afficher le mur : ${h.name}`);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = h.name;
      title.append(name);
      if (h.cue) {
        const cue = document.createElement('span');
        cue.className = 'cue';
        cue.textContent = h.cue;
        title.append(cue);
      }
      title.addEventListener('click', () => { state.selected = h.id; save(); renderToday(); });

      const week = document.createElement('div');
      week.className = 'week';
      for (let i = 6; i >= 0; i--) {
        const d = addDays(today, -i);
        const k = dateKey(d);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'day' + (h.done[k] ? ' on' : '') + (i === 0 ? ' today' : '');
        b.textContent = DAY_LETTERS[d.getDay()];
        b.setAttribute('aria-pressed', String(!!h.done[k]));
        b.setAttribute('aria-label', d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
        b.addEventListener('click', () => toggle(h, k));
        week.append(b);
      }
      info.append(title, week);

      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'check' + (h.done[todayKey] ? ' on' : '');
      check.innerHTML = CHECK_SVG;
      check.setAttribute('aria-pressed', String(!!h.done[todayKey]));
      check.setAttribute('aria-label', h.done[todayKey] ? `Retirer la brique du jour : ${h.name}` : `Poser la brique du jour : ${h.name}`);
      check.addEventListener('click', () => toggle(h, todayKey));

      li.append(info, check);
      list.append(li);
    }
    renderWall(sel, animateId === sel.id);
  }

  function toggle(h, key) {
    const adding = !h.done[key];
    if (adding) h.done[key] = 1; else delete h.done[key];
    state.selected = h.id;
    save();
    if (adding && navigator.vibrate) navigator.vibrate(25);
    renderToday(adding ? h.id : null);
  }

  /* ---------- Vue Plan ---------- */
  function renderPlan() {
    const list = $('#plan-list');
    list.replaceChildren();
    for (const h of state.habits) {
      const li = document.createElement('li');
      li.className = 'plan-item';
      li.style.setProperty('--c', h.color);
      const body = document.createElement('div');
      body.className = 'body';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = h.name;
      const dl = document.createElement('dl');
      const line = (label, value) => {
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = value || '—';
        dl.append(dt, dd);
      };
      line('Quand', h.cue);
      line('Minimum', h.mini);
      line('Rappel', h.time);
      body.append(name, dl);
      const edit = document.createElement('button');
      edit.className = 'btn';
      edit.type = 'button';
      edit.textContent = 'Modifier';
      edit.addEventListener('click', () => openForm(h));
      li.append(body, edit);
      list.append(li);
    }
    const full = state.habits.length >= MAX_HABITS;
    $('#add-habit').hidden = full;
    $('#plan-full').hidden = !full;
  }

  /* ---------- Formulaire ---------- */
  const dialog = $('#habit-dialog');
  const form = $('#habit-form');
  const f = form.elements; // form.name désignerait l'attribut du formulaire, pas le champ
  let editing = null;

  function openForm(h) {
    if (!h && state.habits.length >= MAX_HABITS) return toast('Trois habitudes maximum.');
    editing = h || null;
    $('#habit-form-title').textContent = h ? 'Modifier l\'habitude' : 'Nouvelle habitude';
    $('#habit-delete').hidden = !h;
    f.name.value = h?.name || '';
    f.cue.value = h?.cue || '';
    f.mini.value = h?.mini || '';
    f.time.value = h?.time || '';
    const used = state.habits.map((x) => x.color);
    const current = h?.color || COLORS.find((c) => !used.includes(c)) || COLORS[0];
    const box = $('#color-choices');
    box.replaceChildren();
    COLORS.forEach((c, i) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="color" value="${c}" aria-label="Couleur ${i + 1}"><span style="--c:${c}"></span>`;
      label.firstChild.checked = c === current;
      box.append(label);
    });
    dialog.showModal();
  }

  form.addEventListener('submit', () => {
    const data = {
      name: f.name.value.trim(),
      cue: f.cue.value.trim(),
      mini: f.mini.value.trim(),
      time: f.time.value,
      color: f.color.value || COLORS[0],
    };
    if (!data.name) return;
    if (editing) {
      if (editing.time !== data.time) delete state.notified[editing.id];
      Object.assign(editing, data);
    } else {
      const h = { id: Date.now().toString(36), created: dateKey(), done: {}, ...data };
      state.habits.push(h);
      state.selected = h.id;
    }
    save();
    renderAll();
    if (data.time && 'Notification' in window && Notification.permission === 'default') {
      toast('Pense à activer les notifications dans l\'onglet Rappels.');
    }
  });
  $('#habit-cancel').addEventListener('click', () => dialog.close());
  $('#habit-delete').addEventListener('click', () => {
    if (!editing || !confirm(`Supprimer « ${editing.name} » et son mur ?`)) return;
    state.habits = state.habits.filter((h) => h !== editing);
    dialog.close();
    save();
    renderAll();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="new-habit"]')) openForm();
  });

  /* ---------- Rappels ---------- */
  const canNotify = 'Notification' in window && 'serviceWorker' in navigator;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  async function notify(title, body, tag) {
    const reg = await navigator.serviceWorker.ready;
    return reg.showNotification(title, { body, tag, icon: './icons/icon-192.png', badge: './icons/badge-96.png' });
  }

  function checkReminders() {
    if (!canNotify || Notification.permission !== 'granted') return;
    const now = new Date();
    const today = dateKey(now);
    const minutes = now.getHours() * 60 + now.getMinutes();
    let changed = false;
    for (const h of state.habits) {
      if (!h.time || h.done[today] || state.notified[h.id] === today) continue;
      const [hh, mm] = h.time.split(':').map(Number);
      const late = minutes - (hh * 60 + mm);
      if (late < 0) continue;
      // Application sous les yeux et rappel déjà ancien : inutile de sonner.
      if (!(document.visibilityState === 'visible' && late > 2)) {
        notify(`C'est l'heure : ${h.name}`, h.cue ? `${h.cue} — une brique de plus sur ton mur.` : 'Pose ta brique du jour : +1 %.', `bpb-${h.id}`).catch(() => {});
      }
      state.notified[h.id] = today;
      changed = true;
    }
    if (changed) save();
  }

  async function registerBackgroundSync() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ('periodicSync' in reg) await reg.periodicSync.register('bpb-rappels', { minInterval: 60 * 60 * 1000 });
    } catch { /* non pris en charge ou refusé : rappels uniquement application ouverte */ }
  }

  function renderSettings() {
    const status = $('#notif-status');
    const enable = $('#notif-enable');
    const test = $('#notif-test');
    enable.hidden = test.hidden = true;
    if (!canNotify) {
      status.textContent = isIOS && !standalone
        ? 'Sur iPhone, les notifications ne fonctionnent qu\'une fois l\'application installée sur l\'écran d\'accueil. Installe-la, ouvre-la depuis son icône, puis reviens ici.'
        : 'Ce navigateur ne prend pas en charge les notifications.';
    } else if (Notification.permission === 'granted') {
      status.textContent = 'Notifications activées.';
      test.hidden = false;
    } else if (Notification.permission === 'denied') {
      status.textContent = 'Notifications bloquées. Autorise-les pour ce site dans les réglages du téléphone ou du navigateur.';
    } else {
      status.textContent = 'Reçois un rappel à l\'heure choisie pour chaque habitude.';
      enable.hidden = false;
    }

    $('#install-status').textContent = standalone
      ? 'L\'application est installée sur cet appareil.'
      : 'Installe l\'application pour l\'ouvrir depuis l\'écran d\'accueil, en plein écran et hors connexion.';
    $('#install-help').hidden = standalone;
    $('#install-btn').hidden = standalone || !installEvent;
  }

  $('#notif-enable').addEventListener('click', async () => {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      registerBackgroundSync();
      notify('Rappels activés', 'Tu recevras un rappel à l\'heure de chaque habitude.', 'bpb-test').catch(() => {});
    }
    renderSettings();
  });
  $('#notif-test').addEventListener('click', () => {
    notify('Brique par Brique', 'Les notifications fonctionnent.', 'bpb-test')
      .catch(() => toast('Impossible d\'afficher la notification.'));
  });

  /* ---------- Export calendrier (.ics) ---------- */
  const icsText = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

  $('#ics-export').addEventListener('click', () => {
    const timed = state.habits.filter((h) => h.time);
    if (!timed.length) return toast('Ajoute d\'abord une heure de rappel dans le plan.');
    const now = new Date();
    const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brique par Brique//FR', 'CALSCALE:GREGORIAN'];
    for (const h of timed) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${h.id}@brique-par-brique`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${day}T${h.time.replace(':', '')}00`,
        'DURATION:PT5M',
        'RRULE:FREQ=DAILY',
        `SUMMARY:${icsText(h.name)}`,
        `DESCRIPTION:${icsText([h.cue, h.mini && `Minimum : ${h.mini}`, 'Pose ta brique du jour.'].filter(Boolean).join('\n'))}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(h.name)}`, 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT'
      );
    }
    lines.push('END:VCALENDAR');
    download('brique-par-brique.ics', lines.join('\r\n'), 'text/calendar');
  });

  async function download(filename, text, type) {
    const file = new File([text], filename, { type });
    // Dans une PWA installée (iPhone surtout), le partage est plus fiable qu'un téléchargement.
    if (standalone && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  /* ---------- Sauvegarde ---------- */
  $('#data-export').addEventListener('click', () => {
    download(`brique-par-brique-${dateKey()}.json`, JSON.stringify(state, null, 2), 'application/json');
  });
  $('#data-import').addEventListener('click', () => $('#data-file').click());
  $('#data-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const habits = data.habits;
      if (!Array.isArray(habits) || habits.some((h) => !h || typeof h.name !== 'string' || typeof h.done !== 'object' || !h.done)) throw new Error('format');
      if (!confirm('Remplacer les données actuelles par cette sauvegarde ?')) return;
      state = {
        habits: habits.slice(0, MAX_HABITS).map((h, i) => ({
          id: String(h.id || Date.now().toString(36) + i),
          name: h.name.slice(0, 40),
          cue: String(h.cue || ''),
          mini: String(h.mini || ''),
          time: /^\d\d:\d\d$/.test(h.time) ? h.time : '',
          color: COLORS.includes(h.color) ? h.color : COLORS[i % COLORS.length],
          created: /^\d{4}-\d\d-\d\d$/.test(h.created) ? h.created : dateKey(),
          done: Object.fromEntries(Object.keys(h.done).filter((k) => /^\d{4}-\d\d-\d\d$/.test(k)).map((k) => [k, 1])),
        })),
        notified: {},
        selected: null,
      };
      save();
      renderAll();
      toast('Sauvegarde restaurée.');
    } catch {
      toast('Ce fichier n\'est pas une sauvegarde valide.');
    }
  });

  /* ---------- Installation ---------- */
  let installEvent = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    renderSettings();
  });
  addEventListener('appinstalled', () => { installEvent = null; renderSettings(); });
  $('#install-btn').addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    renderSettings();
  });

  /* ---------- Navigation, divers ---------- */
  function showTab(tab) {
    for (const v of ['today', 'plan', 'settings']) $(`#view-${v}`).hidden = v !== tab;
    document.querySelectorAll('.tabs button').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  let toastTimer;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  function renderAll() {
    $('#date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    renderToday();
    renderPlan();
    renderSettings();
  }

  function tick() {
    if (dateKey() !== currentDay) { currentDay = dateKey(); renderAll(); updateBadge(); }
    checkReminders();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
      if (canNotify && Notification.permission === 'granted') registerBackgroundSync();
    }).catch(() => {});
  }
  renderAll();
  mirrorToServiceWorker();
  updateBadge();
  tick();
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', tick);
})();
