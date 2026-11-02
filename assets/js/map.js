/* Venue map: SVG rendering + camera (pan / zoom). No business logic here. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // Small pictograms for utilities, drawn in a 24x24 box.
  const ICONS = {
    stair: ['M4 20h4v-4h4v-4h4V8h4'],
    lift: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 10l3-3 3 3', 'M9 14l3 3 3-3'],  };
  const DIRS = {
    right: 'M-9 0H9M3 -6L9 0L3 6',
    down: 'M0 -9V9M-6 3L0 9L6 3',
    dr: 'M-9 -8V3H8M2 -3L8 3L2 9',
    ur: 'M-9 8V-3H8M2 -9L8 -3L2 3',
  };

  // Polygon -> path with rounded corners (radius clipped to half of the shorter adjacent edge).
  function rounded(pts, r, flatFromY = Infinity, radii = null) {   // vertices at or below flatFromY stay square
    const n = pts.length; let d = '';
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const rr = p[1] >= flatFromY ? 0 : Math.min(radii ? radii[i] : r, la / 2, lb / 2);
      const s = [p[0] + (a[0] - p[0]) * rr / la, p[1] + (a[1] - p[1]) * rr / la];
      const e = [p[0] + (b[0] - p[0]) * rr / lb, p[1] + (b[1] - p[1]) * rr / lb];
      d += (i ? 'L' : 'M') + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + 'Q' + p[0] + ' ' + p[1] + ' ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1);
    }
    return d + 'Z';
  }

  // Greedy text width estimate (px per unit font size) – good enough to decide rotation.
  const textW = (s, fs) => s.length * fs * 0.6;

  function create(svg, data, opts = {}) {
    const W = data.world;
    const handlers = { hover: () => {}, select: () => {}, view: () => {} };
    let autoFit = true;
    const view = { k: 1, x: 0, y: 0 };
    let fitK = 1, anim = 0;
    let insets = { l: 16, t: 16, r: 72, b: 16 };
    const byId = {};

    svg.textContent = '';
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <pattern id="p-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#c9843d" opacity=".35"/></pattern>
      <pattern id="p-grass" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0H0V12" stroke="#7fae72" stroke-width="1" opacity=".22"/></pattern>
      <pattern id="p-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e9e5da" stroke-width="1"/></pattern>
      <pattern id="p-wood" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 5H10" stroke="#fff" stroke-width="1" opacity=".35"/></pattern>`;

    const vp = el('g', { id: 'vp' }, svg);
    el('rect', { class: 'ground', x: W.x, y: W.y, width: W.w, height: W.h, rx: 28 }, vp);
    el('rect', { x: W.x, y: W.y, width: W.w, height: W.h, rx: 28, fill: 'url(#p-grid)' }, vp);

    // Layers share one coordinate system (floor-plan px) and the same camera transform.
    const L = {
      base: el('g', { class: 'layer-base' }, vp),
      event: el('g', { class: 'layer-event' }, vp),
      arch: el('g', { class: 'layer-arch' }, vp),
      marks: el('g', { class: 'layer-nav' }, vp),
      flows: el('g', { class: 'layer-nav' }, vp),
      badges: el('g', { class: 'layer-nav' }, vp),
    };

    /* ───── architecture base: outline + courtyard ───── */
    const A = data.arch;
    el('path', { class: 'bldg-sh', d: rounded(A.building, 10), transform: 'translate(0 6)' }, L.base);
    el('path', { class: 'bldg', d: rounded(A.building, 10) }, L.base);
    el('path', { class: 'court', d: rounded(A.courtyard, 8) }, L.base);

    /* ───── areas ───── */
    const shapeOf = a => {
      if (a.shape === 'poly') return { tag: 'path', at: { d: rounded(a.pts, Math.min(6, a.w / 6, a.h / 6), a.flatBottom ? Math.max(...a.pts.map(p => p[1])) - .5 : Infinity, a.radii) } };
      if (a.shape === 'path') return { tag: 'path', at: { d: a.d } };
      if (a.shape === 'circle') return { tag: 'circle', at: { cx: a.cx, cy: a.cy, r: a.r } };
      const rx = a.w > 300 && a.h > 300 ? 16 : 7;
      if (a.flatBottom) {
        // Rounded at the top, square at the bottom: the cell butts straight onto the walkway below it.
        const x0 = a.x + 2.5, y0 = a.y + 2.5, x1 = a.x + a.w - 2.5, y1 = a.y + a.h - 2.5, r = a.flatTop ? 0 : rx;
        return { tag: 'path', at: { d: `M${x0} ${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + r}V${y1}H${x0}Z` } };
      }
      return { tag: 'rect', at: { x: a.x + 2.5, y: a.y + 2.5, width: a.w - 5, height: a.h - 5, rx } };
    };
    for (const a of data.areas) {
      const g = el('g', {
        class: `area skin-${a.skin} k-${a.kind}` + (a.static ? ' static' : '') + a.tags.map(t => ' t-' + t).join(''),
        'data-id': a.id,
      }, L[a.layer] || L.arch);
      if (!a.static) {
        g.setAttribute('tabindex', ['room', 'lab', 'gate', 'library', 'brand', 'med', 'entry', 'hall'].includes(a.kind) ? '0' : '-1');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', `${a.label} – ${data.kinds[a.kind] || ''}`);
      }

      if (a.shape === 'lane') {
        // A walkway is a thick stroked polyline: outline + fill, plus a wide invisible hit area.
        const d = (a.paths || [a.pts]).map(pts => 'M' + pts.map(p => p.join(' ')).join(' L')).join(' ');
        el('path', { class: 'lane-o', d, style: `stroke-width:${a.width + 3}` }, g);
        el('path', { class: 'lane-f', d, style: `stroke-width:${a.width}` }, g);
        // Closed end(s): a thin bar in the outline colour caps a walkway that stops flush against a cell (facing east).
        (a.caps || []).forEach(([cx, cy]) => el('rect', { class: 'lane-cap', x: cx, y: cy - (a.width + 3) / 2, width: 1.5, height: a.width + 3 }, g));
        el('path', { class: 'hit', d, style: `stroke-width:${a.width + 14}` }, g);
        if (a.cut) {
          // Trim the walkway exactly at the edge of the areas it runs into (gates, hall), whatever their angle.
          const mask = el('mask', { id: `cut-${a.id}`, maskUnits: 'userSpaceOnUse', x: W.x, y: W.y, width: W.w, height: W.h }, defs);
          el('rect', { x: W.x, y: W.y, width: W.w, height: W.h, fill: '#fff' }, mask);
          data.areas.filter(o => [].concat(a.cut).some(t => o.tags.includes(t))).forEach(o => { const s = shapeOf(o); el(s.tag, { ...s.at, fill: '#000' }, mask); });
          g.setAttribute('mask', `url(#cut-${a.id})`);
        }
        byId[a.id] = { data: a, g };
        continue;
      }

      const { tag, at } = shapeOf(a);
      el(tag, { ...at, class: 'sh', transform: 'translate(0 3)' }, g);
      el(tag, { ...at, class: 'blk' }, g);

      // Surface detail per type – drawn with the same geometry so it never leaks outside the shape.
      const over = fill => el(tag, { ...at, fill, 'pointer-events': 'none' }, g);
      const cx = a.cx ?? a.x + a.w / 2, cy = a.cy ?? a.y + a.h / 2;
      if (a.kind === 'ceremony') over('url(#p-dots)');
      else if (a.kind === 'garden') over('url(#p-grass)');
      else if (a.kind === 'stage') over('url(#p-wood)');
      else if (a.kind === 'lake') {
        for (const s of [.82, .62]) el('path', { d: a.d, class: 'ripple', transform: `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`, 'stroke-width': 1.5 / s }, g);
      } else if (a.skin === 'drum' && a.shape === 'circle') {
        for (const r of [a.r - 8, a.r - 18]) el('circle', { cx: a.cx, cy: a.cy, r, class: 'ripple drum-ring' }, g);
      } else if (a.shape === 'rect' && !a.static && !a.flatBottom && a.w > 20 && a.h > 20) {
        el('rect', { class: 'inner', x: a.x + 4, y: a.y + 4, width: a.w - 8, height: a.h - 8, rx: 4 }, g);
      }

      const rot = a.rot ? `rotate(${a.rot} ${a.lx ?? cx} ${a.ly ?? cy})` : null;
      if (['stair', 'lift'].includes(a.kind)) {
        // Icon at overview zoom; the name fades in once zoomed.
        const s = Math.max(10, Math.min(22, Math.min(a.w, a.h) - 12));
        const pic = el('g', { class: 'ico swap', transform: `translate(${cx - s / 2} ${cy - s / 2}) scale(${s / 24})` }, g);
        ICONS[a.kind].forEach(d => el('path', { d }, pic));
        const vertical = textW(a.label, a.fs) > a.w - 6 && a.h > a.w;
        el('text', { class: 'lbl lod', x: cx, y: cy, 'font-size': a.fs, transform: vertical ? `rotate(-90 ${cx} ${cy})` : rot }, g).textContent = a.label;
      } else if (a.logo) {
        // Brand mark instead of a text label, centred and turned with the cell.
        const lx = a.lx ?? cx, ly = a.ly ?? cy, L = a.logo;
        el('image', { href: L.href, x: lx - L.w / 2, y: ly - L.h / 2, width: L.w, height: L.h, class: 'logo',
          preserveAspectRatio: 'xMidYMid meet', transform: rot }, g);
      } else if (a.label) {
        const lines = a.lines || [a.label];
        const lx = a.lx ?? cx, ly = a.ly ?? cy;
        const caption = a.kind === 'garden' || a.kind === 'ceremony';
        const vertical = !caption && !a.rot && Math.max(...lines.map(l => textW(l, a.fs))) > a.w - 8 && a.h > a.w * 1.2;
        const t = vertical ? `rotate(-90 ${lx} ${ly})` : rot;
        lines.forEach((l, i) => {
          const dy = (i - (lines.length - 1) / 2) * a.fs * 1.18;
          el('text', { class: 'lbl' + (caption ? ' cap' : ''), x: lx, y: ly + dy, 'font-size': a.fs, transform: t }, g).textContent = l;
        });
      }
      byId[a.id] = { data: a, g };
    }

    /* ───── marks from the sheet: direction arrows & no-go ───── */
    data.blocks.filter(b => b.h > 10 && b.w > 12).forEach(b => el('rect', { class: 'block mark t-nogo', x: b.x + 6, y: b.y + 5, width: b.w - 12, height: b.h - 10, rx: 4 }, L.marks));
    data.bars.forEach(b => {
      const g = el('g', { class: 'mark t-nogo', transform: `translate(${b.x + b.w / 2} ${b.y + b.h / 2})` }, L.marks);
      el('rect', { class: 'nogo-tag', x: -b.w / 2, y: -b.h / 2, width: b.w, height: b.h, rx: 6 }, g);
      el('circle', { class: 'nogo-c', r: 6.5, 'stroke-width': 2 }, g);
      el('path', { class: 'nogo-l', d: 'M-4.5 4.5L4.5 -4.5', 'stroke-width': 2 }, g);
    });
    data.nogo.forEach(n => {
      const g = el('g', { class: 'mark t-nogo' + (n.cls ? ' ' + n.cls : ''), transform: `translate(${n.x} ${n.y})` }, L.marks);
      if (n.label) {
        // A barrier cell across the corridor (perpendicular to the walking direction), styled like a room.
        el('rect', { class: 'sh', x: -n.w / 2, y: -10.5, width: n.w, height: 28, rx: 7 }, g);
        el('rect', { class: 'nogo-tag', x: -n.w / 2, y: -13.5, width: n.w, height: 28, rx: 7 }, g);
        // Icon scaled to fit narrow cells with even padding.
        const ic = el('g', { transform: `translate(0 1) scale(${Math.min(1, (n.w - 12) / 18).toFixed(2)})` }, g);
        el('circle', { class: 'nogo-c', r: 9, 'stroke-width': 2.6 }, ic);
        el('path', { class: 'nogo-l', d: 'M-6.3 6.3L6.3 -6.3', 'stroke-width': 2.6 }, ic);
        return;
      }
      el('circle', { class: 'nogo-c', r: 11 }, g);
      el('path', { class: 'nogo-l', d: 'M-7 7L7 -7' }, g);
    });

    /* ───── flows & step badges ───── */
    data.flows.forEach(f => {
      const g = el('g', { class: `flow ${f.color} ${f.id}` }, L.flows);
      const d = 'M' + f.pts.map(p => p.join(' ')).join(' L');
      el('path', { class: 'casing', d }, g);
      el('path', { class: 'line', d }, g);
      const [a, b] = f.pts.slice(-2), ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      // Destination: a slim open chevron on a white casing, tip exactly on the end point.
      const tip = `translate(${b[0]} ${b[1]}) rotate(${ang})`;
      el('path', { class: 'head-c', d: 'M-7 -6L0 0L-7 6', transform: tip }, g);
      el('path', { class: 'head', d: 'M-7 -6L0 0L-7 6', transform: tip }, g);
    });
    data.badges.forEach(b => {
      const g = el('g', { class: `badge ${b.color} ${b.cls}` }, L.badges), tw = b.text.length * 9 + 28;
      el('rect', { x: b.x - tw / 2, y: b.y - 16, width: tw, height: 32, rx: 16 }, g);
      el('text', { x: b.x, y: b.y }, g).textContent = b.text;
    });

    if (opts.reference) el('image', { href: opts.reference, x: 0, y: 0, width: 1920, height: 1080, opacity: .4, 'pointer-events': 'none' }, vp);

    /* ───── camera ───── */
    const size = () => ({ w: svg.clientWidth || 1, h: svg.clientHeight || 1 });
    function apply() {
      vp.setAttribute('transform', `translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.k.toFixed(4)})`);
      svg.classList.toggle('zoomed', view.k >= fitK * 1.7);
      handlers.view(view.k / fitK);
    }
    function clamp(v) {
      const s = size(), m = 140;
      const x0 = v.x + W.x * v.k, x1 = v.x + (W.x + W.w) * v.k, y0 = v.y + W.y * v.k, y1 = v.y + (W.y + W.h) * v.k;
      if (x1 < m) v.x += m - x1; if (x0 > s.w - m) v.x -= x0 - (s.w - m);
      if (y1 < m) v.y += m - y1; if (y0 > s.h - m) v.y -= y0 - (s.h - m);
      return v;
    }
    function fitTarget() {
      const s = size(), aw = s.w - insets.l - insets.r, ah = s.h - insets.t - insets.b;
      const whole = Math.min(aw / W.w, ah / W.h);
      fitK = whole;
      // Narrow portrait screens: keep text readable and let the user pan instead of shrinking everything.
      const k = s.w < 700 ? Math.max(whole, 0.55) : whole;
      return { k, x: k > whole ? insets.l - W.x * k : insets.l + (aw - W.w * k) / 2 - W.x * k,
               y: insets.t + (ah - W.h * k) / 2 - W.y * k };
    }
    const minK = () => fitK * 0.8, maxK = () => fitK * 6;

    function to(t, ms = 450) {
      cancelAnimationFrame(anim);
      t = clamp({ ...t, k: Math.min(maxK(), Math.max(minK(), t.k)) });
      if (reduceMotion() || ms === 0) { Object.assign(view, t); apply(); return; }
      const s = { ...view }, t0 = performance.now();
      const ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const step = now => {
        const u = Math.min(1, (now - t0) / ms), e = ease(u);
        // interpolate in log space for k so zoom feels linear
        view.k = s.k * Math.pow(t.k / s.k, e);
        view.x = s.x + (t.x - s.x) * e; view.y = s.y + (t.y - s.y) * e;
        apply();
        if (u < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }
    function fit(ms) {
      const t = fitTarget(); autoFit = true; to(t, ms ?? 450);
    }
    function zoomAt(factor, px, py, ms = 0) {
      autoFit = false;
      const k = Math.min(maxK(), Math.max(minK(), view.k * factor)), r = k / view.k;
      to({ k, x: px - (px - view.x) * r, y: py - (py - view.y) * r }, ms);
    }
    function zoomBy(factor) { const s = size(); zoomAt(factor, (s.w - insets.r + insets.l) / 2, (s.h + insets.t - insets.b) / 2, 220); }

    function focus(id, { rightInset = 0 } = {}) {
      const a = byId[id]?.data; if (!a) return;
      const s = size(), aw = s.w - rightInset, ah = s.h - (innerWidth < 640 ? s.h * .45 : 0);
      const k = Math.min(Math.max(Math.min(aw / (a.w * 3.2), ah / (a.h * 3.2)), fitK * 1.8), fitK * 4.2);
      autoFit = false;
      to({ k, x: aw / 2 - (a.x + a.w / 2) * k, y: ah / 2 - (a.y + a.h / 2) * k + (innerWidth < 640 ? 0 : 20) }, 600);
    }

    /* ───── input ───── */
    const ptrs = new Map();
    let drag = null, pinch = null, moved = false, suppress = false;
    const local = e => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      cancelAnimationFrame(anim);
      const [px, py] = local(e);
      const unit = e.deltaMode === 1 ? 16 : 1;
      const f = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(f, px, py, 0);
    }, { passive: false });

    svg.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(anim);
      ptrs.set(e.pointerId, local(e));
      moved = false;
      if (ptrs.size === 1) drag = { sx: view.x, sy: view.y, p: local(e) };
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k };
        drag = null;
      }
    });
    svg.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const p = local(e); ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
        zoomAt((pinch.k * d / pinch.d) / view.k, cx, cy, 0); moved = true; return;
      }
      if (drag) {
        const dx = p[0] - drag.p[0], dy = p[1] - drag.p[1];
        if (!moved && Math.hypot(dx, dy) > 5) { moved = true; svg.classList.add('dragging'); try { svg.setPointerCapture(e.pointerId); } catch (_) {} handlers.hover(null); }
        if (moved) { autoFit = false; const t = clamp({ k: view.k, x: drag.sx + dx, y: drag.sy + dy }); view.x = t.x; view.y = t.y; apply(); }
      }
    });
    const end = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) { drag = null; svg.classList.remove('dragging'); if (moved) { suppress = true; setTimeout(() => (suppress = false), 0); } }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    const areaOf = e => e.target.closest?.('.area:not(.static)');
    svg.addEventListener('click', e => {
      if (suppress) return;
      const a = areaOf(e); handlers.select(a ? byId[a.dataset.id].data : null, e);
    });
    svg.addEventListener('dblclick', e => {
      if (areaOf(e)) return;
      const [px, py] = local(e); zoomAt(2, px, py, 300);
    });
    svg.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' || drag?.moved || moved) return;
      const a = areaOf(e); handlers.hover(a ? byId[a.dataset.id].data : null, e);
    });
    svg.addEventListener('pointerleave', () => handlers.hover(null));
    svg.addEventListener('keydown', e => {
      const a = e.target.closest?.('.area');
      if (a && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handlers.select(byId[a.dataset.id].data, e); }
    });
    svg.addEventListener('focusin', e => {
      const a = areaOf(e); if (a && e.target.matches?.(':focus-visible')) handlers.hover(byId[a.dataset.id].data, null);
    });
    svg.addEventListener('focusout', () => handlers.hover(null));

    let last = size();
    new ResizeObserver(() => {
      const s = size(), prevK = fitK;
      if (autoFit) { Object.assign(view, fitTarget()); }
      else {
        // keep the world point at the centre of the stage where it was
        fitTarget();
        const r = fitK / prevK, wx = (last.w / 2 - view.x) / view.k, wy = (last.h / 2 - view.y) / view.k;
        view.k *= r; view.x = s.w / 2 - wx * view.k; view.y = s.h / 2 - wy * view.k;
        Object.assign(view, clamp(view));
      }
      last = s; apply();
    }).observe(svg);

    fit(0);

    return {
      on(ev, fn) { handlers[ev] = fn; },
      byId, fit, focus, zoomBy,
      setInsets(i) { insets = { ...insets, ...i }; if (autoFit) fit(300); },
      get zoomRatio() { return view.k / fitK; },
      // on-screen box of an area (svg-local px) from the camera, independent of any CSS transform on the svg
      screenRect(id) {
        const a = byId[id]?.data; if (!a) return null;
        return { x: view.x + a.x * view.k, y: view.y + a.y * view.k, w: a.w * view.k, h: a.h * view.k };
      },
      node: svg,
    };
  }

  window.VenueMap = { create };
})();
