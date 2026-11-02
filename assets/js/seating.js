/* Seating detail view (sheet "SƠ ĐỒ CHỖ NGỒI"), shown inside the same stage as the overview map.
   Reads SEATING; app.js drives it (open/close, zoom controls, history). Seat numbers come from tools/build_seating.py. */
(() => {
  const S = window.SEATING;
  if (!S) return;

  /* ───── geometry (sheet px, seat band stretched so every seat can carry its number) ───── */
  const STRETCH = 1.7;
  const isSeatKind = k => k === 'seat-b' || k === 'seat-o';
  const bandOf = f => { const cs = S.cells.filter(c => f(c[4])); return [Math.min(...cs.map(c => c[1])), Math.max(...cs.map(c => c[1] + c[3]))]; };
  const BANDS = [bandOf(isSeatKind), bandOf(k => k === 'par'), bandOf(k => k === 'tbl-b' || k === 'tbl-o' || k === 'dai')];   // parents, table and guest rows are stretched like the TCN seats so all cells are the same size
  const INS = 9;   // gap between the side walkways and the plate's outer edge
  const T = 56;   // one width for the entrances and the side walkways
  const GAP = 22;   // breathing room between the TCN blocks and the parents' zone
  const fy = y => BANDS.reduce((o, [b0, b1]) => o + (y >= b1 ? (b1 - b0) : y > b0 ? y - b0 : 0) * (STRETCH - 1), y) + (y >= BANDS[1][0] ? GAP : 0) + (y > 63 ? 14 : 0);   // +14: room under the taller stage
  const CELLS = S.cells.map(([x, y, w, h, k, l]) => [x, fy(y), w, fy(y + h) - fy(y), k, l]);
  const TEXTS = S.texts.map(t => (t.length > 5 ? [t[0], fy(t[1]), t[2], t[3], t[4], t[5], fy(t[1] + t[6] / 2) - fy(t[1] - t[6] / 2)] : [t[0], fy(t[1]), ...t.slice(2)]));
  const AX = (() => { const a = S.cells.filter(c => c[4] === 'aisle2'); return (Math.min(...a.map(c => c[0])) + Math.max(...a.map(c => c[0] + c[2]))) / 2; })();   // x of the middle aisle
  const W = S.W, H = fy(S.H) + 16, EXT = 110, EXTL = 125, EXTT = 110;   // EXT / EXTL: cells hanging off the right / left edge of the plan (014–016, 7-Eleven + Cổng 711)
  const by = k => CELLS.filter(c => c[4] === k);
  const bbox = cs => {
    const x0 = Math.min(...cs.map(c => c[0])), y0 = Math.min(...cs.map(c => c[1]));
    return { x: x0, y: y0, w: Math.max(...cs.map(c => c[0] + c[2])) - x0, h: Math.max(...cs.map(c => c[1] + c[3])) - y0 };
  };

  /* ───── seat blocks: left to right Khối 1..4, clustered by the aisles between them ───── */
  const seats = CELLS.filter(c => isSeatKind(c[4])).sort((p, q) => p[0] - q[0]);
  const blocks = [];
  for (const c of seats) {
    const b = blocks[blocks.length - 1];
    if (b && b.kind === c[4] && c[0] - b.x1 <= 6) { b.x1 = Math.max(b.x1, c[0] + c[2]); b.seats.push(c); }
    else blocks.push({ kind: c[4], x0: c[0], x1: c[0] + c[2], seats: [c] });
  }
  blocks.forEach((b, i) => {
    const n = b.seats.map(c => +c[5].slice(1));
    b.no = i + 1;
    b.range = `${String(Math.min(...n)).padStart(2, '0')}–${String(Math.max(...n)).padStart(2, '0')}`;
  });
  const COUNT = { b: seats.filter(c => c[4] === 'seat-b').length, o: seats.filter(c => c[4] === 'seat-o').length };
  const ROWS = [...new Set(seats.map(c => c[5][0]))].sort();

  // the ceremony ground: everything that sits on the sân lễ surface (lanes, gates and POIs stay around it)
  const SURF = (() => {
    const b = bbox(CELLS.filter(c => ['stage', 'tbl-b', 'tbl-o', 'dai', 'seat-b', 'seat-o', 'par', 'med', 'aisle', 'aisle2'].includes(c[4])
      || (c[4] === 'rowl' && c[5])));
    return { x: b.x - 22, y: b.y - 16, w: b.w + 44, h: b.h + 26 };
  })();

  const INFO = {
    'tbl-b': ['Bàn', 'Phía khối ghế xanh'], 'tbl-o': ['Bàn', 'Phía khối ghế cam'],
    'path-1': ['Lối vào cụm 1', 'Barie đặt dọc theo lối'],
    'path-2': ['Lối vào cụm 2', 'Barie đặt dọc theo lối'],
    'path-p': ['Lối vào phụ huynh', 'Barie đặt dọc theo lối'],
  };
  const LEGEND = [
    ['seat-b', `Tân cử nhân`, 'var(--c2-fill)', 'var(--c2-stroke)'],
    ['seat-o', `Tân cử nhân`, 'var(--c1-fill)', 'var(--c1-stroke)'],
    ['dai', 'Đại biểu', '#f8eaa6', '#d3b035'],
    ['par', 'Phụ huynh', '#efe9fb', '#b9a3e6'],
    ['path-1', 'Lối vào cụm 1', '#ffd9bd', 'var(--c1-stroke)'],
    ['path-2', 'Lối vào cụm 2', '#c3d9f7', '#8fb3ea'],
    ['med', 'Y tế', '#d94a4a', '#d94a4a'],
  ];

  /* ───── render (once) ───── */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const f1 = n => (+n).toFixed(1);
  const rr = (x, y, w, h, r, extra = '') => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${r}" ${extra}/>`;
  const ARROW = { '↑': 'M0 10V-10M-6 -4L0 -10L6 -4', '↓': 'M0 -10V10M-6 4L0 10L6 4',
    '↱': 'M-9 10V-3Q-9 -8 -4 -8H9M3 -14L9 -8L3 -2', '↰': 'M9 10V-3Q9 -8 4 -8H-9M-3 -14L-9 -8L-3 -2' };

  function lane(kind, caption) {
    const cs = by(kind); if (!cs.length) return '';
    const [t, s] = INFO[kind];
    // outline pass then fill pass, so adjacent cells read as one walkway (same trick as the overview lanes)
    let h = `<g class="c lane k-${kind}" data-k="${kind}" data-t="${esc(t)}" data-s="${esc(s)}">`
      + cs.map(([x, y, w, ht]) => rr(x - 1.5, y - 1.5, w + 3, ht + 3, 6, 'class="o"')).join('')
      + cs.map(([x, y, w, ht]) => rr(x, y, w, ht, 5, 'class="f"')).join('') + '</g>';
    const rows = {};
    cs.forEach(c => (rows[c[1]] ||= []).push(c));
    let best = null, len = 0;
    for (const r of Object.values(rows)) {
      const x0 = Math.min(...r.map(c => c[0])), x1 = Math.max(...r.map(c => c[0] + c[2]));
      if (x1 - x0 > len) { len = x1 - x0; best = [(x0 + x1) / 2, r[0][1] + r[0][3] / 2]; }
    }
    if (best && len > 160) h += `<text class="lane-cap k-${kind}" x="${f1(best[0])}" y="${f1(best[1] + 1)}">${esc(caption)}</text>`;
    return h;
  }

  let STG = { y: 0, h: 0 };   // stage rect as drawn (set while drawing the cells, read by the arrows)
  function render() {
    let h = `<defs>
      <pattern id="sgGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e9e5da" stroke-width="1"/></pattern>
      <pattern id="sgDots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#c9843d" opacity=".3"/></pattern>
      <pattern id="sgPar" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#9c86d6" opacity=".28"/></pattern>
      <pattern id="sgWood" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 5H10" stroke="#fff" stroke-width="1" opacity=".35"/></pattern>
    </defs>`;
    // ground + plan outline, exactly like the overview (grid ground, white floor plate with a slate border)
    h += rr(-EXTL - 20, -EXTT - 30, W + EXT + EXTL + 100, H + EXTT + 90, 28, 'class="ground"') + rr(-EXTL - 20, -EXTT - 30, W + EXT + EXTL + 100, H + EXTT + 90, 28, 'fill="url(#sgGrid)"');
    h += rr(0, 6, W, H, 22, 'class="bldg-sh"') + rr(0, 0, W, H, 22, 'class="bldg"');

    // walkways (on top of the plate, under the furniture)
    // entrances: Check-in 2 (blue L hugging the ground's west and south edges) and Check-in 1 (orange, from the east rail into the ground)
    const bx0 = SURF.x - T, bx1 = W - INS - T + 20, by0 = 281, by1 = SURF.y + SURF.h + T;   // T: both entrances share one width
    const lanes = (kind, rects, cap, cx, cy) => `<g class="c lane k-${kind}" data-k="${kind}" data-t="${esc(INFO[kind][0])}" data-s="${esc(INFO[kind][1])}">`
      + (kind === 'path-1'   // cut square at both ends, no end border: it runs straight into the ground and the walkway
        ? rects.map(([x, y, w, ht]) => rr(x, y - 1.5, w + 3, ht + 3, 0, 'class="o"')).join('') + rects.map(([x, y, w, ht]) => rr(x, y, w + 3, ht, 0, 'class="f"')).join('')
        : rects.map(([x, y, w, ht]) => rr(x - 1.5, y - 1.5, w + 3, ht + 3, 26, 'class="o"')).join('') + rects.map(([x, y, w, ht]) => rr(x, y, w, ht, 24, 'class="f"')).join('')) + `</g><text class="lane-cap k-${kind}" x="${f1(cx)}" y="${f1(cy)}">${cap}</text>`;
    h += lanes('path-2', [[bx0, by0, SURF.x - bx0, by1 - by0], [bx0, by1 - T, bx1 - bx0, T]], 'LỐI VÀO CỤM 2', AX, by1 - T / 2)
      + lanes('path-1', [[SURF.x + SURF.w - 20, 291 + (79 - T) / 2, bx1 - SURF.x - SURF.w + 20, T]], 'LỐI VÀO CỤM 1', (SURF.x + SURF.w + bx1) / 2, 331);
    // the ceremony ground itself, same skin as "SÂN LỄ" on the overview
    h += `<g class="surf">${rr(SURF.x, SURF.y, SURF.w, SURF.h, 18)}${rr(SURF.x, SURF.y, SURF.w, SURF.h, 18, 'fill="url(#sgDots)" stroke="none"')}</g>`;
    // each walkway follows the plate's rounded outer corners (r = 22 minus the inset)
    const rrp = (x, y, w, ht, [a, b, c, d]) => `<path d="M${f1(x + a)} ${f1(y)}H${f1(x + w - b)}Q${f1(x + w)} ${f1(y)} ${f1(x + w)} ${f1(y + b)}V${f1(y + ht - c)}Q${f1(x + w)} ${f1(y + ht)} ${f1(x + w - c)} ${f1(y + ht)}H${f1(x + d)}Q${f1(x)} ${f1(y + ht)} ${f1(x)} ${f1(y + ht - d)}V${f1(y + a)}Q${f1(x)} ${f1(y)} ${f1(x + a)} ${f1(y)}Z"`;
    h += [[INS, [22 - INS, 7, 7, 22 - INS]], [W - INS - T, [7, 22 - INS, 22 - INS, 7]]].map(([x, r]) =>
      `<g class="c lane k-walk" data-k="walk" data-t="Lối đi" data-s="Nằm ngoài lan can">${rrp(x - 1.5, INS - 1.5, T + 3, H - 2 * INS + 3, r.map(v => v + 1.5))} class="o"/>${rrp(x, INS, T, H - 2 * INS, r)} class="f"/></g>`).join('');
    h += by('aisle').concat(by('aisle2')).map(([x, y, w, ht]) => rr(x + 2, y, w - 4, ht, 4, 'class="aisle"')).join('');

    // parents zone
    const par = by('par');
    if (par.length) {
      const b = bbox(par);
      h += `<g class="c zone k-par" data-k="par" data-t="Khu vực phụ huynh" data-s="Phụ huynh ngồi theo hướng dẫn của BTC">`
        + rr(b.x - 10, b.y - 8, b.w + 20, b.h + 10, 14) + rr(b.x - 10, b.y - 8, b.w + 20, b.h + 10, 14, 'fill="url(#sgPar)" stroke="none"')
        + par.map(([x, y, w, ht]) => rr(x + 1.5, y + 1.5, w - 3, ht - 3, 3, 'class="pcell"')).join('')
        + '</g>';
    }

    // seat blocks: tray, table, guest row, seats
    const tblOf = { 'seat-b': by('tbl-b')[0], 'seat-o': by('tbl-o')[0] }, dai = by('dai')[0];
    for (const b of blocks) {
      const tbl = tblOf[b.kind], top = (tbl || dai)[1] - 8, bottom = Math.max(...b.seats.map(c => c[1] + c[3])) + 8;
      const cls = b.kind === 'seat-b' ? 'c2' : 'c1';
      h += `<g class="block ${cls}" data-block="${b.no}">` + rr(b.x0 - 8, top + 3, b.x1 - b.x0 + 16, bottom - top, 12, 'class="tray-sh"') + rr(b.x0 - 8, top, b.x1 - b.x0 + 16, bottom - top, 12, 'class="tray"');
      h += `<text class="block-cap" x="${f1((b.x0 + b.x1) / 2)}" y="${f1(top - 17)}">KHỐI ${b.no} · GHẾ ${b.range}</text>`;
      if (tbl) h += `<g class="c tbl" data-k="${tbl[4]}" data-t="Bàn" data-s="${esc(INFO[tbl[4]][1])}">${rr(b.x0 + 1, tbl[1] + 3, b.x1 - b.x0 - 2, tbl[3] - 6, 5)}<text x="${f1((b.x0 + b.x1) / 2)}" y="${f1(tbl[1] + tbl[3] / 2 + 1)}">BÀN</text></g>`;
      if (dai) h += `<g class="c dai" data-k="dai" data-t="Đại biểu" data-s="Hàng ghế đại biểu">${rr(b.x0 + 1, dai[1] + 3, b.x1 - b.x0 - 2, dai[3] - 6, 5)}<text x="${f1((b.x0 + b.x1) / 2)}" y="${f1(dai[1] + dai[3] / 2 + 1)}">ĐẠI BIỂU</text></g>`;
      h += b.seats.map(([x, y, w, ht, k, l]) =>
        `<g class="seat" data-k="${k}" data-seat="${l}" data-block="${b.no}" role="img" aria-label="Ghế ${l[0]}-${l.slice(1)}">${rr(x + 2.5, y + 2.5, w - 5, ht - 5, 5)}<text x="${f1(x + w / 2)}" y="${f1(y + ht / 2 + 1)}">${l.slice(1)}</text></g>`).join('');
      h += '</g>';
    }
    // row letters, centred in the margin between the ground's edge and the first / last tray
    const lx = (SURF.x + blocks[0].x0 - 8) / 2, rx = (blocks[blocks.length - 1].x1 + 8 + SURF.x + SURF.w) / 2;
    h += by('rowl').filter(c => c[5]).map(([x, y, w, ht, , l]) => {
      const cx = x + w / 2 < W / 2 ? lx : rx, cy = y + ht / 2;
      return `<text class="rowl" x="${f1(cx)}" y="${f1(cy + 1)}">${l}</text>`;
    }).join('');
    h += by('med').map(([x, y, w, ht]) => {
      const cx = x + w / 2, cy = y + ht / 2;
      return `<g class="c poi med" data-k="med" data-t="Y tế" data-s="">${rr(x + 3, y + 3, w - 6, ht - 6, 5)}<path d="M${f1(cx)} ${f1(cy - 5)}V${f1(cy + 5)}M${f1(cx - 5)} ${f1(cy)}H${f1(cx + 5)}"/></g>`;
    }).join('');

    // stage and the landmarks around the plan
    for (let [x, y, w, ht, k] of CELLS) {
      if (k === 'seven') [x, y, w, ht] = [-98, 122, 90, 362];
      if (k === 'wall') [x, w] = [1, 72];   // exit: same height as Cổng 711, centred on the walkway
      if (k === 'stage') { [y, ht] = [y - 12, ht + 36]; STG = { y: y + 4, h: ht - 6 }; }   // taller stage
      if (k === 'statue') [x, y, w, ht] = [AX - 80, y, 160, ht + 16];   // bigger, centred on the middle aisle
      if (k === 'tpb') [x, y, w, ht] = [x + w / 2 - 45, -100, 90, 90];   // same 90px width as 7-Eleven, Cổng 711 and 014–016   // 7-Eleven stands outside the west rail, above the exit
      const cx = x + w / 2, cy = y + ht / 2 + 1;
      if (k === 'stage') h += `<g class="c poi stage" data-k="stage" data-t="Sân khấu chính" data-s="Lễ tốt nghiệp 2026">${rr(x, y + 4, w, ht - 6, 10)}${rr(x, y + 4, w, ht - 6, 10, 'fill="url(#sgWood)" stroke="none"')}<text x="${f1(cx)}" y="${f1(cy + 1)}">SÂN KHẤU CHÍNH</text></g>`;
      else if (k === 'seven') h += `<g class="c poi seven" data-k="seven" data-t="7-Eleven" data-s="">${rr(x + 3, y + 3, w - 6, ht - 6, 8)}<image href="assets/img/711-logo.png" x="${f1(cx - (ht - 22) / 2)}" y="${f1(cy - (ht - 22) * .0885 - 1)}" width="${f1(ht - 22)}" height="${f1((ht - 22) * .177)}" transform="rotate(-90 ${f1(cx)} ${f1(cy)})"/></g>`;
      else if (k === 'tpb') h += `<g class="c poi tpb" data-k="tpb" data-t="TP Bank" data-s="">${rr(x, y + 2, w, ht - 4, 7)}<text x="${f1(cx)}" y="${f1(cy)}">TPBANK</text></g>`;
      else if (k === 'wall') h += `<g class="c poi exit" data-k="exit" data-t="Lối ra" data-s="">${rr(x + 3, y + 3, w - 6, ht - 6, 8)}<text x="${f1(cx)}" y="${f1(cy)}">LỐI RA</text></g>`;
      else if (k === 'statue') h += `<g class="c poi statue" data-k="statue" data-t="Tượng" data-s="Tượng Self-made man">${rr(x + 2, y + 2, w - 4, ht - 4, 8)}<text x="${f1(cx)}" y="${f1(cy)}">TƯỢNG</text></g>`;
    }
    // landmarks from the overview that frame the ceremony ground: Cổng 711 beside 7-Eleven, rooms 014–016 on the south edge
    h += [['CỔNG 711', 'Cổng', -98, by('wall')[0][1] + 1, 90, by('wall')[0][3] - 2, 'cong']]
      .map(([lbl, t, x, a, w, b, cls]) => {
        const y = a, ht = b, cx = x + w / 2, cy = y + ht / 2 + 1;
        const label = cls === 'cong' ? `<text x="${f1(cx)}" y="${f1(cy - 12)}">CỔNG</text><text x="${f1(cx)}" y="${f1(cy + 12)}">711</text>` : `<text x="${f1(cx)}" y="${f1(cy)}">${lbl}</text>`;
        return `<g class="c poi ${cls}" data-k="${cls}" data-t="${t}" data-s="">${rr(x + 2, y + 2, w - 4, ht - 4, 8)}${label}</g>`;
      }).join('');
    h += [['016', 143], ['015', 267], ['014', 391]].map(([n, y]) =>
      `<g class="c poi room" data-k="room" data-t="Phòng ${n}" data-s="">${rr(W + 8, y, 90, 115, 8)}<text x="${f1(W + 53)}" y="${f1(y + 58)}">${n}</text></g>`).join('');
    for (const [x, y, txt, kind, dir, w, ht] of TEXTS) {
      if (kind === 'arrow') {
        // the right-angle arrows turn in at the stage's vertical middle; the straight ones drift up / down to show the walking direction
        const turn = txt === '↱' || txt === '↰', tY = STG.y + STG.h / 2 + 9, lowY = Math.max(...TEXTS.filter(t => t[3] === 'arrow' && t[2] === txt && t[1] < 400).map(t => t[1]));
        // stage-level reference, upper arrow and lower arrow are spaced evenly (↑ sides and ↓ between blocks alike)
        const ay = turn ? tY : ((txt === '↑' || txt === '↓') && y < 400 && y < lowY) ? (tY + lowY) / 2 : y;
        const ax = (txt === '↑' || turn) && y < 200 ? (x < W / 2 ? lx : rx) : x, adx = turn ? (txt === '↱' ? 9 : -9) : 0;   // turn arrows: shift so their vertical shaft lines up with the straight arrows   // side arrows sit in the middle of the margin, like the row letters
        h += `<g class="arrow-b" transform="translate(${f1(ax + adx)} ${f1(ay)})"><path class="arrow " d="${ARROW[txt]}"/></g>`;
      }
      else if (kind === 'rail') continue;   // railings are drawn below as proper fences
    }
    // railings just inside the side walkways: two rails, posts every ~40px, name in the middle; full height with gaps at the doors
    const doorY = 291 + (79 - T) / 2, ex = by('wall')[0];   // gaps: exit (west), Check-in 1 and Check-in 2 doors (east)
    h += [[T + 18, 4, ex[1] - 4], [T + 18, ex[1] + ex[3] + 4, H - 4], [W - T - 18, 4, doorY - 4], [W - T - 18, doorY + T + 4, by1 - T - 4], [W - T - 18, by1 + 4, H - 4]].map(([x, a, b]) => {
      const y0 = a + 6, y1 = b - 6, n = Math.max(1, Math.round((y1 - y0) / 40)), mid = (y0 + y1) / 2;
      let posts = '';
      for (let i = 0; i <= n; i++) posts += `<circle cx="${f1(x)}" cy="${f1(y0 + (y1 - y0) * i / n)}" r="3.4"/>`;
      return `<g class="fence"><path class="fr" d="M${f1(x)} ${f1(y0)}V${f1(y1)}"/><path class="fr2" d="M${f1(x)} ${f1(y0)}V${f1(y1)}"/>${posts}`
        + (y1 - y0 > 120 ? `<text x="${f1(x)}" y="${f1(mid)}" transform="rotate(-90 ${f1(x)} ${f1(mid)})">LAN CAN</text>` : '') + '</g>';
    }).join('');
    return h;
  }

  /* ───── view ───── */
  function create(stage, { onBack, onView } = {}) {
    const view = document.createElement('section');
    view.className = 'seat-view';
    view.hidden = true;
    view.setAttribute('aria-label', 'Sơ đồ chỗ ngồi');
    view.innerHTML = `
      <svg class="seat-map" role="application" aria-label="Sơ đồ chỗ ngồi sân lễ. Dùng phím mũi tên để chọn ghế."><g></g></svg>
      <button class="float card seat-exit" type="button" aria-label="Thoát ra bản đồ tổng quan"><i data-lucide="arrow-left"></i><span>Thoát</span></button>
      <aside class="float panel card seat-panel" aria-live="polite" aria-label="Thông tin ghế">
        <div class="panel-head">
          <div><h2 class="sp-title"></h2><p class="sub sp-sub"></p></div>
          <button class="iconbtn sp-close" aria-label="Bỏ chọn ghế"><i data-lucide="x"></i></button>
        </div>
        <div class="chips sp-chips"></div>
        <dl class="rows sp-rows"></dl>
      </aside>
      <div class="tip sp-tip" role="tooltip"></div>`;
    stage.appendChild(view);
    const svg = view.querySelector('svg'), vp = svg.firstElementChild, tip = view.querySelector('.sp-tip'), panel = view.querySelector('.seat-panel');
    vp.innerHTML = render();

    const seatById = new Map([...vp.querySelectorAll('.seat')].map(g => [g.dataset.seat, g]));
    // keyboard grid: rows A..J, each row left→right as drawn
    const grid = ROWS.map(r => seats.filter(c => c[5][0] === r).sort((p, q) => p[0] - q[0]).map(c => c[5]));

    /* camera */
    const cam = { k: 1, x: 0, y: 0 };
    let fitK = 1, raf = 0, entering = false, open = false, selected = null, autoFit = true;
    const insets = { l: 72, t: 16, r: 72, b: 16 };   // symmetric so the plan sits dead centre
    const size = () => ({ w: svg.clientWidth || stage.clientWidth || 1, h: svg.clientHeight || stage.clientHeight || 1 });
    const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const apply = () => {
      vp.setAttribute('transform', `translate(${cam.x.toFixed(2)} ${cam.y.toFixed(2)}) scale(${cam.k.toFixed(4)})`);
      if (open) onView?.(cam.k / fitK);
    };
    function fitTarget() {
      const s = size(), aw = s.w - insets.l - insets.r, ah = s.h - insets.t - insets.b;
      fitK = Math.min(aw / (W + EXT + EXTL), ah / (H + EXTT));
      // phones: don't shrink seats into specks – start readable on the first block and let the user pan
      const k = s.w < 700 ? Math.max(fitK, .5) : fitK;
      return { k, x: k > fitK ? insets.l - (blocks[0].x0 - 40) * k : insets.l + (aw - (W + EXT + EXTL) * k) / 2 + EXTL * k, y: insets.t + Math.max(0, (ah - (H + EXTT) * k) / 2) + EXTT * k };
    }
    const rectTarget = r => {       // camera that puts the ceremony ground exactly on screen rect r
      const k = Math.min(r.w / SURF.w, r.h / SURF.h);
      return { k, x: r.x + (r.w - SURF.w * k) / 2 - SURF.x * k, y: r.y + (r.h - SURF.h * k) / 2 - SURF.y * k };
    };
    function clamp(t) {
      const s = size(), m = 120;
      t.x = Math.min(s.w - m + EXTL * t.k, Math.max(m - (W + EXT) * t.k, t.x));
      t.y = Math.min(s.h - m + EXTT * t.k, Math.max(m - H * t.k, t.y));
      return t;
    }
    function go(t, ms = 260, done) {
      cancelAnimationFrame(raf); clearTimeout(go.guard);
      if (reduce() || !ms) { Object.assign(cam, t); apply(); done?.(); return; }
      const s = { ...cam }, t0 = performance.now(), ease = ms >= 400 ? (u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2) : (u => 1 - Math.pow(1 - u, 3));   // long moves ease in and out
      let finished = false;
      const finish = () => { if (finished) return; finished = true; cancelAnimationFrame(raf); Object.assign(cam, t); apply(); done?.(); };
      const step = now => {
        if (finished) return;
        const u = Math.min(1, (now - t0) / ms), e = ease(u);
        cam.k = s.k * Math.pow(t.k / s.k, e); cam.x = s.x + (t.x - s.x) * e; cam.y = s.y + (t.y - s.y) * e;
        apply();
        if (u < 1) raf = requestAnimationFrame(step); else finish();
      };
      raf = requestAnimationFrame(step);
      clearTimeout(go.guard);
      go.guard = setTimeout(finish, ms + 120);   // background tabs throttle rAF – never leave the camera half-way
    }
    const fit = ms => { autoFit = true; go(fitTarget(), ms ?? 300); };
    function zoomAt(f, px, py, ms = 0) {
      autoFit = false;
      const k = Math.min(fitK * 7, Math.max(fitK * .85, cam.k * f)), r = k / cam.k;
      go(clamp({ k, x: px - (px - cam.x) * r, y: py - (py - cam.y) * r }), ms);
    }
    const zoomBy = f => { const s = size(); zoomAt(f, (s.w - insets.r + insets.l) / 2, (s.h + insets.t - insets.b) / 2, 200); };

    /* seat selection – only the touched seat changes class, nothing is re-rendered */
    function selectSeat(id, { reveal = false } = {}) {
      if (selected) seatById.get(selected)?.classList.remove('sel');
      selected = id;
      if (!id) { panel.classList.remove('open'); return; }
      const g = seatById.get(id); g.classList.add('sel');
      const b = blocks[+g.dataset.block - 1], blue = b.kind === 'seat-b';
      view.querySelector('.sp-title').textContent = `Ghế ${id[0]}-${id.slice(1)}`;
      view.querySelector('.sp-sub').textContent = 'Tân cử nhân';
      view.querySelector('.sp-chips').innerHTML = `<span class="chip" style="--chip-c:var(${blue ? '--c2' : '--c1'})"><i></i>Khối ghế ${blue ? 'xanh' : 'cam'}</span>`;
      view.querySelector('.sp-rows').innerHTML = [['Hàng', id[0]], ['Số ghế', id.slice(1)], ['Khối', `Khối ${b.no} · ghế ${b.range}`]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      panel.classList.add('open');
      if (reveal) {          // keep a keyboard-selected seat on screen
        const c = seats.find(s => s[5] === id), s = size();
        const sx = cam.x + (c[0] + c[2] / 2) * cam.k, sy = cam.y + (c[1] + c[3] / 2) * cam.k;
        if (sx < 60 || sx > s.w - 380 || sy < 100 || sy > s.h - 60) { autoFit = false; go(clamp({ k: cam.k, x: cam.x + (s.w / 2 - 160 - sx), y: cam.y + (s.h / 2 - sy) }), 200); }
      }
    }
    view.querySelector('.seat-exit').addEventListener('click', () => onBack?.());
    view.querySelector('.sp-close').addEventListener('click', () => selectSeat(null));

    /* input: wheel / drag / pinch / click */
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    const ptrs = new Map(); let last = null, pinch = 0, moved = false;
    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      last = [e.clientX, e.clientY]; moved = false; cancelAnimationFrame(raf); clearTimeout(go.guard);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
    });
    svg.addEventListener('pointermove', e => {
      if (ptrs.has(e.pointerId)) {
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = svg.getBoundingClientRect();
          if (pinch) zoomAt(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
          pinch = d; moved = true; return;
        }
        const dx = e.clientX - last[0], dy = e.clientY - last[1];
        if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) { autoFit = false; svg.classList.add('dragging'); cam.x += dx; cam.y += dy; clamp(cam); apply(); tip.classList.remove('show'); }
        last = [e.clientX, e.clientY];
        return;
      }
      // hover tooltip (absolutely positioned, so nothing shifts)
      const g = e.target.closest?.('.seat, .c');
      if (!g) { tip.classList.remove('show'); return; }
      if (g.classList.contains('seat')) {
        const b = blocks[+g.dataset.block - 1], id = g.dataset.seat;
        tip.innerHTML = `<b>${id[0]}-${id.slice(1)}</b><span>Khối ${b.no} · khối ghế ${b.kind === 'seat-b' ? 'xanh' : 'cam'}</span>`;
      } else tip.innerHTML = `<b>${g.dataset.t}</b>${g.dataset.s ? `<span>${g.dataset.s}</span>` : ''}`;
      tip.classList.add('show');
      const host = stage.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      const x = Math.min(host.width - tw - 8, Math.max(8, e.clientX - host.left + 14));
      const y = e.clientY - host.top + 18 + th > host.height ? e.clientY - host.top - th - 12 : e.clientY - host.top + 18;
      tip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
    const up = e => {
      const wasDrag = moved;
      ptrs.delete(e.pointerId); pinch = 0; svg.classList.remove('dragging');
      if (e.type === 'pointerup' && !wasDrag && ptrs.size === 0) {
        const g = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.seat');   // pointer capture retargets e.target to the svg
        selectSeat(g ? (g.dataset.seat === selected ? null : g.dataset.seat) : null);
      }
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', () => tip.classList.remove('show'));

    new ResizeObserver(() => { if (open && !entering) { if (autoFit) fit(0); else { clamp(cam); apply(); } } }).observe(svg);

    /* keyboard: arrows walk the seat grid, Escape clears the seat first. Returns true when handled. */
    function key(e) {
      if (!open) return false;
      const k = e.key;
      if (k === 'Escape') { if (selected) { selectSeat(null); return true; } return false; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return false;
      let r = 0, c = 0;
      if (selected) {
        r = ROWS.indexOf(selected[0]); c = grid[r].indexOf(selected);
        if (k === 'ArrowLeft') c = Math.max(0, c - 1);
        if (k === 'ArrowRight') c = Math.min(grid[r].length - 1, c + 1);
        if (k === 'ArrowUp') r = Math.max(0, r - 1);
        if (k === 'ArrowDown') r = Math.min(grid.length - 1, r + 1);
        c = Math.min(c, grid[r].length - 1);
      }
      selectSeat(grid[r][c], { reveal: true });
      return true;
    }

    /* open / close with a shared-bounds transition: the plan grows out of (and shrinks back into) the
       on-screen box of SÂN LỄ on the overview */
    function show(fromRect) {
      open = true; view.hidden = false; view.classList.remove('leaving');
      const target = fitTarget(); autoFit = true;
      if (fromRect && !reduce()) {
        Object.assign(cam, rectTarget(fromRect)); apply();
        svg.classList.add('intro');                      // everything outside the ground waits, slightly further out
        view.classList.add('entering'); void view.offsetWidth; view.classList.remove('entering');
        entering = true;   // the ResizeObserver fires as the view un-hides: it must not snap the camera to the end
        go(target, 760, () => { entering = false; });
        setTimeout(() => svg.classList.remove('intro'), 160);   // …then drifts in while the camera pulls back
      } else { Object.assign(cam, target); apply(); }
    }
    function hide(toRect, done) {
      open = false; tip.classList.remove('show'); selectSeat(null);
      const end = () => { view.hidden = true; view.classList.remove('leaving'); done?.(); };
      if (toRect && !reduce()) { view.classList.add('leaving'); go(rectTarget(toRect), 380, end); }
      else end();
    }

    return { show, hide, fit, zoomBy, key, node: view, get isOpen() { return open; } };
  }

  window.SeatingView = { create, legend: LEGEND };
})();
