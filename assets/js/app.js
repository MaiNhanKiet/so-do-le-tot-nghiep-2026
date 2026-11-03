/* UI layer: tabs, legend filter, tooltip, detail panel. Reads MAP_DATA, drives VenueMap. */
(function () {
  const D = window.MAP_DATA;
  const $ = s => document.querySelector(s);
  const svg = $('#map');
  const map = VenueMap.create(svg, D, { reference: null });

  const STEP_COLOR = ['#1f2a37', '#b8801a', '#2c62c8', '#d64545'];
  const GROUP = { g1: ['Cụm điều phối 1', '#d9651b'], g2: ['Cụm điều phối 2', '#2c62c8'] };
  const state = { step: 0, filter: null, selected: null, hovered: null };
  const areaEls = [...svg.querySelectorAll('.area')];
  const markEls = [...svg.querySelectorAll('.mark')];

  /* ───── tabs ───── */
  const tabs = $('#tabs');
  tabs.innerHTML = D.steps.map((s, i) => `
    <button class="tab" role="tab" data-i="${i}" style="--tab-c:${STEP_COLOR[i]}">
      <i class="dot"></i><i data-lucide="${s.icon}" style="width:15px;height:15px"></i><span>${s.name}</span>
    </button>`).join('');
  tabs.addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    if (seat.isOpen) leaveSeating();          // a step always belongs to the overview
    setStep(+b.dataset.i);
  });

  /* ───── legend ───── */
  const legend = $('#legend');
  const group = g => `<div class="lg-group"><span class="lg-title">${g.group}</span>
    ${g.items.map(it => `<button class="lg-item" data-tag="${it.tag}" aria-pressed="false">
      <i class="lg-sw skin-${it.skin}"></i>${it.label}</button>`).join('')}</div>`;
  // two tidy rows: who/where, then brands/routes
  legend.innerHTML = `<div class="lg-row">${D.legend.slice(0, 2).map(group).join('')}</div>
    <div class="lg-row">${D.legend.slice(2).map(group).join('')}<button class="lg-clear" hidden aria-label="Bỏ lọc">Bỏ lọc ✕</button></div>`;
  // swatch colours reuse the map skins
  const SW = {
    c1: ['#fde5d2', '#e08a45'], c2: ['#dce8fb', '#5d8ee0'], garden: ['#e2eedc', '#9cc08f'], lake: ['#f4cadf', '#d983b2'],
    statue: ['#f8eaa6', '#d3b035'], library: ['#f9dada', '#e48f8f'], ceremony: ['#f6d3b4', '#e29555'], med: ['#d94a4a', '#d94a4a'],
    tpb: ['#8a3fd1', '#8a3fd1'], seven: ['#ffffff', '#0d8a6a'], passion: ['#ffffff', '#9cc62f'], laha: ['#6fd592', '#6fd592'],
    'lane-arrive': ['#f7e3a6', '#e1bb52'], 'lane-tcn': ['#c3d9f7', '#8fb3ea'], nogo: ['#fde4e4', '#d64545'],
    stage: ['#d9651b', '#b04e0f'], drum: ['#fff7ee', '#e9a15f'], 'lane-exit': ['#f6c4c4', '#d64545'],
    entry: ['#ffb27d', '#e08a45'], gate: ['#fdecd9', '#e9a15f'], parents: ['#cdb8ee', '#8e67a6'],
  };
  legend.querySelectorAll('.lg-sw').forEach(sw => {
    const key = sw.className.match(/skin-(\S+)/)[1];
    sw.style.background = SW[key][0]; sw.style.borderColor = SW[key][1];
  });
  legend.addEventListener('click', e => {
    const b = e.target.closest('.lg-item'); if (!b) return;
    state.filter = state.filter === b.dataset.tag ? null : b.dataset.tag;
    legend.querySelectorAll('.lg-item').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tag === state.filter)));
    legend.querySelector('.lg-clear').hidden = !state.filter;
    applyFocus();
  });
  legend.querySelector('.lg-clear').addEventListener('click', e => {
    state.filter = null; e.currentTarget.hidden = true;
    legend.querySelectorAll('.lg-item').forEach(x => x.setAttribute('aria-pressed', 'false'));
    applyFocus();
  });
  // the seating plan has its own (static) legend in a second footer; only one footer shows at a time
  const sgLegend = $('#sgLegend');
  const SG_GROUPS = [['Chỗ ngồi', ['seat-b', 'seat-o', 'dai', 'par']], ['Lối đi', ['path-1', 'path-2']]];
  sgLegend.innerHTML = `<div class="lg-row">${SG_GROUPS.map(([title, keys]) => `<div class="lg-group"><span class="lg-title">${title}</span>
    ${SeatingView.legend.filter(l => keys.includes(l[0])).map(([, label, f, s]) =>
      `<span class="lg-item lg-static"><i class="lg-sw" style="background:${f};border-color:${s}"></i>${label}</span>`).join('')}</div>`).join('')}</div>`;
  let legendOn = innerWidth >= 640;
  function syncLegend() {
    legend.hidden = !legendOn || seat.isOpen;
    sgLegend.hidden = !legendOn || !seat.isOpen;
    $('#legendToggle').setAttribute('aria-pressed', String(legendOn));
  }
  $('#legendToggle').addEventListener('click', () => { legendOn = !legendOn; syncLegend(); });

  /* ───── step / focus ───── */
  function setStep(i) {
    state.step = i;
    tabs.querySelectorAll('.tab').forEach((t, n) => t.setAttribute('aria-selected', String(n === i)));
    const s = D.steps[i];
    svg.classList.toggle('no-entry-lbl', !!s.hideLabels);   // the entrance names would sit under the flows
    svg.classList.toggle('no-exit-lbl', !!s.hideExitLbl);
    svg.querySelectorAll('.flow').forEach(f => f.classList.toggle('on', s.flows.some(c => f.classList.contains(c))));
    svg.querySelectorAll('.badge').forEach(f => f.classList.toggle('on', s.badges.some(c => f.classList.contains(c))));
    markEls.forEach(m => m.classList.toggle('gone', (s.hideMarks || []).some(c => m.classList.contains(c))));
    applyFocus();
  }
  function applyFocus() {
    const tags = state.filter ? [state.filter] : D.steps[state.step].focus;
    const hit = el => !tags || tags.some(t => el.classList.contains('t-' + t));
    areaEls.forEach(a => { if (!a.classList.contains('static') || a.classList.contains('t-lanepart')) a.classList.toggle('dim', !hit(a)); });
    markEls.forEach(m => m.classList.toggle('dim', tags && !hit(m) && !(m.classList.contains('dir') && tags.length)));
    // no-go marks and arrows remain legible when their own filter is chosen
    if (state.filter === 'nogo') markEls.forEach(m => m.classList.toggle('dim', !m.classList.contains('t-nogo')));
  }

  /* ───── tooltip ───── */
  const tip = $('#tip'), stage = $('#stage');
  function tipHtml(a) {
    const grp = a.tags.find(t => GROUP[t]);
    return `<b>${a.label}${a.note && a.kind !== 'brand' ? '' : ''}</b><span>${D.kinds[a.kind] || ''}${grp ? ' · ' + GROUP[grp][0] : ''}${a.note ? ' · ' + a.note : ''}</span>`
      + (a.tags.includes('sanle') ? '<em>Xem sơ đồ chỗ ngồi →</em>' : '');
  }
  function placeTip(e) {
    const r = stage.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight, gap = 16;
    let x = e.clientX - r.left + gap, y = e.clientY - r.top + gap;
    if (x + tw > r.width - 8) x = e.clientX - r.left - tw - gap;
    if (y + th > r.height - 8) y = e.clientY - r.top - th - gap;
    tip.style.transform = `translate3d(${Math.max(8, x)}px,${Math.max(8, y)}px,0)`;
  }
  map.on('hover', (a, e) => {
    if (state.hovered && state.hovered !== a) map.byId[state.hovered.id].g.classList.remove('hot');
    state.hovered = a;
    svg.classList.toggle('hovering', !!a);
    if (!a) { tip.classList.remove('show'); return; }
    map.byId[a.id].g.classList.add('hot');
    tip.innerHTML = tipHtml(a); tip.classList.add('show');
    if (e) placeTip(e);
    else { const b = map.byId[a.id].g.getBoundingClientRect(), r = stage.getBoundingClientRect(); placeTip({ clientX: b.right, clientY: b.top }); }
  });

  /* ───── detail panel ───── */
  const panel = $('#panel');
  function panelOpen() { return panel.classList.contains('open'); }
  function rightInset() { return panelOpen() && innerWidth >= 640 ? 340 : 0; }
  function select(a) {
    if (state.selected) map.byId[state.selected.id].g.classList.remove('sel');
    state.selected = a;
    if (!a) { panel.classList.remove('open'); map.setInsets({ r: innerWidth < 640 ? 4 : 72 }); return; }
    map.byId[a.id].g.classList.add('sel');
    const grp = a.tags.find(t => GROUP[t]);
    const rows = [];
    rows.push(['Loại khu vực', D.kinds[a.kind] || '—']);
    if (grp) rows.push(['Cụm điều phối', GROUP[grp][0]]);
    if (a.note) rows.push(['Ghi chú', a.note]);
    $('#pTitle').textContent = a.label;
    $('#pSub').textContent = D.kinds[a.kind] || '';
    $('#pChips').innerHTML = grp ? `<span class="chip" style="--chip-c:${GROUP[grp][1]}"><i></i>${GROUP[grp][0]}</span>` : `<span class="chip"><i></i>${D.kinds[a.kind] || ''}</span>`;
    $('#pRows').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    panel.classList.add('open');
  }
  map.on('select', a => {
    if (a && a.tags.includes('sanle')) { enterSeating(); return; }   // the ceremony ground drills down
    select(a);
    if (a) map.focus(a.id, { rightInset: rightInset() || (innerWidth >= 640 ? 340 : 0) });
  });
  $('#pClose').addEventListener('click', () => select(null));

  /* ───── seating plan: drill-down from SÂN LỄ, with browser history ───── */
  const lvl = $('#zlvl');
  const HASH = '#so-do-cho-ngoi';
  const ceremony = D.areas.find(a => a.kind === 'ceremony');
  const seat = SeatingView.create(stage, { onBack: () => leaveSeating(), onView: r => (lvl.textContent = Math.round(r * 100) + '%') });
  window.lucide?.createIcons();
  function openSeating(animate = true) {
    if (seat.isOpen) return;
    select(null); tip.classList.remove('show');
    const r = map.screenRect(ceremony.id);
    svg.style.transformOrigin = `${r.x + r.w / 2}px ${r.y + r.h / 2}px`;   // the overview zooms toward SÂN LỄ as it fades
    stage.classList.add('drilled');
    seat.show(animate ? r : null);
    syncLegend();
  }
  function closeSeating() {
    if (!seat.isOpen) return;
    stage.classList.remove('drilled');
    seat.hide(map.screenRect(ceremony.id), () => map.byId[ceremony.id].g.focus({ preventScroll: true }));   // overview camera was never touched, so it is restored as it was
    syncLegend();
    lvl.textContent = Math.round(map.zoomRatio * 100) + '%';
  }
  function enterSeating() {
    if (seat.isOpen) return;
    history.pushState({ seating: true }, '', HASH);
    openSeating();
  }
  function leaveSeating() {
    if (history.state?.seating) history.back();   // popstate closes it, so browser Back and our button behave the same
    else closeSeating();
  }
  addEventListener('popstate', e => (e.state?.seating ? openSeating() : closeSeating()));

  /* ───── zoom controls & shortcuts (shared by both views) ───── */
  $('#zin').addEventListener('click', () => (seat.isOpen ? seat.zoomBy(1.5) : map.zoomBy(1.5)));
  $('#zout').addEventListener('click', () => (seat.isOpen ? seat.zoomBy(1 / 1.5) : map.zoomBy(1 / 1.5)));
  $('#fit').addEventListener('click', () => (seat.isOpen ? seat.fit() : map.fit()));
  $('#reset').addEventListener('click', () => {
    if (seat.isOpen) { seat.fit(); return; }
    select(null); state.filter = null;
    legend.querySelectorAll('.lg-item').forEach(x => x.setAttribute('aria-pressed', 'false'));
    legend.querySelector('.lg-clear').hidden = true;
    setStep(0); map.fit();
  });
  map.on('view', r => { if (!seat.isOpen) lvl.textContent = Math.round(r * 100) + '%'; });
  addEventListener('keydown', e => {
    if (e.target.matches('input')) return;
    const z = seat.isOpen ? seat : map;
    if (seat.isOpen && seat.key(e)) { e.preventDefault(); return; }
    if (e.key === '+' || e.key === '=') z.zoomBy(1.4);
    else if (e.key === '-') z.zoomBy(1 / 1.4);
    else if (e.key === '0') z.fit();
    else if (e.key === 'Escape') seat.isOpen ? leaveSeating() : select(null);
    else if (seat.isOpen) return;
    else if (e.key === 'ArrowRight') setStep((state.step + 1) % D.steps.length);
    else if (e.key === 'ArrowLeft') setStep((state.step + D.steps.length - 1) % D.steps.length);
  });

  setStep(Math.min(Math.max(parseInt(location.hash.slice(1)) || 0, 0), D.steps.length - 1));
  syncLegend();
  // deep link: index.html#so-do-cho-ngoi opens the plan; Back still lands on the overview
  if (location.hash === HASH) {
    history.replaceState(null, '', location.pathname + location.search);
    history.pushState({ seating: true }, '', HASH);
    openSeating(false);
  }
  window.lucide?.createIcons();
  window.__map = map; // handy for debugging in devtools
})();
