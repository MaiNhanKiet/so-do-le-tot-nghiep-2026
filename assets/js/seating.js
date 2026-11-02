/* Seating detail view (sheet "SƠ ĐỒ CHỖ NGỒI"), shown inside the same stage as the overview map.
   Reads SEATING; app.js drives it (open/close, zoom controls, history). Seat numbers come from tools/build_seating.py. */
(() => {
  const RAW = window.SEATING;
  if (!RAW) return;
  const KX = 1.07;   // the whole plan is stretched sideways by this much, so the cells (and the gaps between them) get bigger
  const OFFX = 127.3;   // extra room on the west, so the row letters sit as far from the west rail as from the east rail
  const S = { ...RAW, W: RAW.W * KX + OFFX, cells: RAW.cells.map(c => [c[0] * KX + OFFX, c[1], c[2] * KX, c[3], c[4], c[5]]),
    texts: RAW.texts.map(t => (t.length > 5 ? [t[0] * KX + OFFX, t[1], t[2], t[3], t[4], t[5] * KX, t[6]] : [t[0] * KX + OFFX, ...t.slice(1)])) };


  /* ───── geometry (sheet px, seat band stretched so every seat can carry its number) ───── */
  // one pitch for every seat and parents' cell, sideways and downwards: the parents' columns (aisle = 2 columns) fill the zone evenly
  const PITCH = (() => { const u = [...new Set(RAW.cells.filter(c => c[4] === 'par').map(c => c[0]))].sort((a, b) => a - b);
    return (u[u.length - 1] - u[1]) * KX / (u.length - 2 + 2); })();
  const STRETCH = PITCH / 21;   // row pitch = column pitch, so the cells come out square
  const isSeatKind = k => k === 'seat-b' || k === 'seat-o';
  const bandOf = f => { const cs = S.cells.filter(c => f(c[4])); return [Math.min(...cs.map(c => c[1])), Math.max(...cs.map(c => c[1] + c[3]))]; };
  const BANDS = [bandOf(isSeatKind), bandOf(k => k === 'par'), bandOf(k => k === 'tbl-b' || k === 'tbl-o' || k === 'dai')];   // parents, table and guest rows are stretched like the TCN seats so all cells are the same size
  const CS = 36.5;   // every seat / parents' cell is drawn as the same CS x CS square, centred in its slot of the sheet grid
  const sq = (x, y, w, h, r, extra = '') => rr(x + w / 2 - CS / 2, y + h / 2 - CS / 2, CS, CS, r, extra);
  const INS = 9;   // gap between the side walkways and the plate's outer edge
  const T = 56;   // one width for the entrances and the side walkways
  const GAP = 22;   // breathing room between the TCN blocks and the parents' zone
  const fyAt = (y, st) => BANDS.reduce((o, [b0, b1]) => o + (y >= b1 ? (b1 - b0) : y > b0 ? y - b0 : 0) * (st - 1), y) + (y >= BANDS[1][0] ? GAP : 0) + (y > 63 ? 14 : 0);   // +14: room under the taller stage
  const fy = y => fyAt(y, STRETCH);
  // lane / door heights were tuned at a row stretch of 1.7; keep them on the same rows
  const keepRow = v => { let lo = 0, hi = 400; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fyAt(m, 1.7) < v) lo = m; else hi = m; } return fy(lo); };
  // the parents' zone drops its outermost column on each side, and the first-aid cells are not drawn
  const PX = S.cells.filter(c => c[4] === 'par').map(c => c[0]), PX0 = Math.min(...PX), PX1 = Math.max(...PX);
  // the parents' zone sits on one regular grid: the columns are re-spaced evenly (the middle aisle counts as two columns)
  const PXS = [...new Set(S.cells.filter(c => c[4] === 'par' && c[0] !== PX0 && c[0] !== PX1).map(c => c[0]))].sort((a, b) => a - b);
  const AISLE_X = Math.min(...S.cells.filter(c => c[4] === 'aisle2').map(c => c[0]));
  const PU = (PX1 - PXS[0]) / (PXS.length + 2);
  const pux = x => PXS[0] + PU * (PXS.indexOf(x) + (x > AISLE_X ? 2 : 0));
  // the TCN seats sit in the very same columns as the parents' cells (every seat column exists in the parents' grid)
  const SEATX = { get: x => pux(x) };
  const CELLS = S.cells.filter(c => c[4] !== 'med' && (c[4] !== 'par' || (c[0] !== PX0 && c[0] !== PX1))).map(([x, y, w, h, k, l]) => k === 'par' ? [pux(x), fy(y), PU, fy(y + h) - fy(y), k, l] : isSeatKind(k) ? [SEATX.get(x), fy(y), PITCH, fy(y + h) - fy(y), k, l] : [x, fy(y), w, fy(y + h) - fy(y), k, l]);
  const TEXTS = S.texts.map(t => (t.length > 5 ? [t[0], fy(t[1]), t[2], t[3], t[4], t[5], fy(t[1] + t[6] / 2) - fy(t[1] - t[6] / 2)] : [t[0], fy(t[1]), ...t.slice(2)]));
  const AX = PXS[0] + PU * (PXS.filter(x => x < AISLE_X).length + 1);   // x of the middle aisle (two columns wide on the parents' grid); the stage, Lối vào cụm 2 and Tượng titles are centred on it
  // four more parents' rows under Lối vào cụm 2, right of the statue: same columns as the last row above, top aligned with the statue
  const STAT = CELLS.find(c => c[4] === 'statue'), PROW = CELLS.filter(c => c[4] === 'par' && c[1] === Math.max(...CELLS.filter(q => q[4] === 'par').map(q => q[1])));
  const STAT_X0 = 1028 * KX + OFFX, STAT_X1 = 1590 * KX + OFFX;   // the statue spans sheet columns 28-42 (15 columns); the extra seats start at column 43 and run to the outer edge
  const PAR_ROWS = 4, PAR_H = PROW[0][3];   // 4 rows x 18 columns = 72 seats (outermost column dropped)
  const PAR_CELLS = S.cells.filter(c => c[4] === 'par' && c[1] === 728 && c[0] >= STAT_X1 && c[0] !== PX1).sort((p, q) => p[0] - q[0]).map(c => [pux(c[0]), c[1], PU]);
  const W = S.W, EXT = 150, EXTL = 165, EXTT = 110;   // EXT / EXTL: cells hanging off the right / left edge of the plan (014–016, 7-Eleven + Cổng 711)
  const PAR_BOX = (() => {   // purple frame round the rows beside the statue, same as the zone above
    const x = Math.min(...PAR_CELLS.map(c => c[0])), w = Math.max(...PAR_CELLS.map(c => c[0] + c[2])) - x, h = PAR_ROWS * PAR_H;
    return y => `${rr(x - 10, y - 10, w + 20, h + 20, 14)}${rr(x - 10, y - 10, w + 20, h + 20, 14, 'fill="url(#sgPar)" stroke="none"')}`;
  })();
  const CONG_Y = (() => { const w = CELLS.find(c => c[4] === 'wall'); return w[1] + w[3] / 2 - 72.5; })();   // top of Cổng 711
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
    return { x: b.x - 22, y: b.y - 16, w: b.w + 44, h: b.h + 38 };   // 22 below the parents' cells = the same 12 of orange as at the sides, outside the zone's 10 padding
  })();
  const STAT_Y = SURF.y + SURF.h + T + 30;   // the statue and the rows beside it sit just under Lối vào cụm 2 (their purple frame starts 10 above)
  const H = Math.max(fy(S.H) + 16, STAT_Y + PAR_ROWS * PAR_H + 40);

  const INFO = {
    'tbl-b': ['Bàn', 'Phía khối ghế xanh'], 'tbl-o': ['Bàn', 'Phía khối ghế cam'],
    'path-1': ['Lối vào cụm 1', 'Barie đặt dọc theo lối'],
    'path-2': ['Lối vào cụm 2', 'Barie đặt dọc theo lối'],
    'path-p': ['Lối Vào Phụ Huynh', 'Barie đặt dọc theo lối'],
  };
  const LEGEND = [
    ['seat-b', `Tân cử nhân`, 'var(--c2-fill)', 'var(--c2-stroke)'],
    ['seat-o', `Tân cử nhân`, 'var(--c1-fill)', 'var(--c1-stroke)'],
    ['dai', 'Đại biểu', '#f8eaa6', '#d3b035'],
    ['par', 'Phụ huynh', '#efe9fb', '#b9a3e6'],
    ['path-1', 'Lối vào cụm 1', '#ffd9bd', 'var(--c1-stroke)'],
    ['path-2', 'Lối vào cụm 2', 'var(--c2-fill)', 'var(--c2-stroke)'],
  ];

  /* ───── check-in rooms (briefing): seats 01-24 use P.010-013, seats 25-50 use P.005-007 and the library, rows I, J go to the Seminar room ───── */
  const CHECKIN = {
    low: { A: 'P.013', B: 'P.013', C: 'P.012', D: 'P.012', E: 'P.011', F: 'P.011', G: 'P.010', H: 'P.010' },
    high: { A: 'P.007', B: 'P.007', C: 'P.006', D: 'P.006', E: 'P.005', F: 'P.005', G: 'P.LB01 (Thư viện)', H: 'P.LB02 (Thư viện)' },
  };
  const checkIn = (row, n) => {
    const low = n <= 24;
    if (row === 'I' || row === 'J') return `Check-in: phòng Seminar (Thư viện) · cụm cánh tay ${low ? 'trái (1–24)' : 'phải (25–50)'}`;
    return `Check-in: ${CHECKIN[low ? 'low' : 'high'][row]}`;
  };

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
    h += rr(0, 6, W, H, 22, 'class="bldg-sh"') + rr(0, 0, W, H, 22, 'class="bldg"') + rr(0, 0, W, H, 22, 'fill="url(#sgDots)" stroke="none"');

    // walkways (on top of the plate, under the furniture)
    // entrances: Check-in 2 (blue L hugging the ground's west and south edges) and Check-in 1 (orange, from the east rail into the ground)
    const LANE1_Y = Math.min(...seats.map(c => c[1])) + (PITCH - CS) / 2;   // Lối vào cụm 1 starts at the top of row A, no higher
    const bx0 = SURF.x - T, bx1 = W - INS - T + 20, by0 = Math.min(...seats.map(c => c[1])),   // the west arm of Lối vào cụm 2 runs up to row A
       by1 = SURF.y + SURF.h + T + 4;   // T: both entrances share one width
    // the west arm of Lối vào cụm 2: square at the top, rounded only where it turns into the south bar
    const arm = (kind, i) => kind === 'path-2' && i === 0;
    const armPath = (x, y, w, ht, r, cls) => `<path class="${cls}" d="M${f1(x)} ${f1(y)}H${f1(x + w)}V${f1(y + ht - r)}Q${f1(x + w)} ${f1(y + ht)} ${f1(x + w - r)} ${f1(y + ht)}H${f1(x + r)}Q${f1(x)} ${f1(y + ht)} ${f1(x)} ${f1(y + ht - r)}Z"/>`;
    // rounded inner (concave) corner where the west arm turns into the south bar
    const fillet = (x, y, r) => `<path class="o" d="M${f1(x)} ${f1(y - r)}A${r} ${r} 0 0 0 ${f1(x + r)} ${f1(y)}V${f1(y - 1.5)}A${r - 1.5} ${r - 1.5} 0 0 1 ${f1(x + 1.5)} ${f1(y - r)}Z"/><path class="f" d="M${f1(x - 1)} ${f1(y - r)}V${f1(y + 1)}H${f1(x + r)}V${f1(y)}A${r} ${r} 0 0 1 ${f1(x)} ${f1(y - r)}Z"/>`;
    // Lối vào cụm 2 is one L: square top (row A), square east end under the walkway, big rounded outer corner
    const R2 = 44;
    const l2Path = ([arm, bar], g, cls) => {
      const x0 = arm[0], xr = arm[0] + arm[2], y0 = arm[1], yt = bar[1], yb = bar[1] + bar[3], xe = bar[0] + bar[2];
      return `<path class="${cls}" d="M${f1(x0 - g)} ${f1(y0 - g)}H${f1(xr + g)}V${f1(yt - g)}H${f1(xe)}V${f1(yb + g)}H${f1(x0 + R2)}A${R2 + g} ${R2 + g} 0 0 1 ${f1(x0 - g)} ${f1(yb - R2)}Z"/>`;
    };
    const lanes = (kind, rects, cap, cx, cy) => `<g class="c lane k-${kind}" data-k="${kind}" data-t="${esc(INFO[kind][0])}" data-s="${esc(INFO[kind][1])}">`
      + (kind === 'path-1'   // square ends; only the west end has a border, the east end runs straight into the walkway
        ? rects.map(([x, y, w, ht]) => rr(x - 1.5, y - 1.5, w + 4.5, ht + 3, 0, 'class="o"')).join('') + rects.map(([x, y, w, ht]) => rr(x, y, w + 3, ht, 0, 'class="f"')).join('')
        : kind === 'path-2' ? l2Path(rects, 1.5, 'o') + l2Path(rects, 0, 'f')
        : rects.map(([x, y, w, ht]) => rr(x - 1.5, y - 1.5, w + 3, ht + 3, 26, 'class="o"')).join('') + rects.map(([x, y, w, ht]) => rr(x, y, w, ht, 24, 'class="f"')).join('')) + (kind === 'path-2' ? fillet(SURF.x, by1 - T, 22) : '') + `</g><text class="lane-cap k-${kind}" x="${f1(cx)}" y="${f1(cy)}">${cap}</text>`;
    h += lanes('path-2', [[bx0, by0, SURF.x - bx0, by1 - by0], [bx0, by1 - T, bx1 - bx0, T]], 'LỐI VÀO CỤM 2', AX, by1 - T / 2)
      + lanes('path-1', [[SURF.x + SURF.w, LANE1_Y, bx1 - SURF.x - SURF.w, T]], 'LỐI VÀO CỤM 1', (SURF.x + SURF.w + bx1) / 2, LANE1_Y + T / 2 + 1);
    const ROOM030_Y = by1 - R2 - 145 - 90, EXIT_H = 112, EXIT1_Y = CONG_Y + 72.5 - EXIT_H / 2, EXIT2_Y = ROOM030_Y + 72.5 - EXIT_H / 2;   // the two red exit lanes, level with Cổng 711 and room 030
    h += [EXIT1_Y, EXIT2_Y].map(y => `<g class="c lane k-exit" data-k="exit" data-t="Lối ra" data-s="Tân cử nhân ra khỏi sân lễ">${rr(INS + T - 1.5, y - 1.5, bx0 - INS - T, EXIT_H + 3, 0, 'class="o"')}${rr(INS + T - 1.5, y, bx0 - INS - T, EXIT_H, 0, 'class="f"')}</g><text class="lane-cap k-exit" x="${f1((INS + T + bx0) / 2)}" y="${f1(y + EXIT_H / 2 + 1)}">LỐI RA</text>`).join('');
    // Lối Vào Phụ Huynh: drops from under Lối vào cụm 1, then turns west into the first parents' rows
    {
      const PZ = bbox(by('par')), PT = T, vx = SURF.x + SURF.w + 96, vy = LANE1_Y + T, barY = PZ.y + (PITCH - CS) / 2, px = PZ.x + PZ.w;   // both bars as thick as the other lanes, the horizontal one starts level with the top of the first row of cells
      // one L-shaped path: square where it hangs from Lối vào cụm 1 and where it runs under the zone, rounded at the outer corner (44) and the inner one (22)
      const R = 44, ri = 22, X = vx + PT, B = barY + PT;
      const L = (g, top) => `M${f1(vx - g)} ${f1(top)}H${f1(X + g)}V${f1(B + g - (R + g))}A${R + g} ${R + g} 0 0 1 ${f1(X + g - (R + g))} ${f1(B + g)}H${f1(px)}V${f1(barY - g)}H${f1(vx - ri)}A${ri - g} ${ri - g} 0 0 0 ${f1(vx - g)} ${f1(barY - ri)}Z`;
      h += `<g class="c lane k-path-p" data-k="path-p" data-t="${esc(INFO['path-p'][0])}" data-s="${esc(INFO['path-p'][1])}"><path class="o" d="${L(1.5, vy)}"/><path class="f" d="${L(0, vy - 1.5)}"/>`
        + `</g><text class="lane-cap k-path-p" transform="translate(${f1(vx + PT / 2)} ${f1((vy + barY) / 2)}) rotate(-90)" x="0" y="1">LỐI VÀO PHỤ HUYNH</text>`;
    }
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
        + rr(b.x - 10, b.y - 10, b.w + 20, b.h + 20, 14) + rr(b.x - 10, b.y - 10, b.w + 20, b.h + 20, 14, 'fill="url(#sgPar)" stroke="none"')
        + par.map(([x, y, w, ht]) => sq(x, y, w, ht, 4, `class="pcell" data-cl="${x + w / 2 < AX ? 1 : 2}"`)).join('')
        + '</g>';
    }

    // seat blocks: tray, table, guest row, seats
    const tblOf = { 'seat-b': by('tbl-b')[0], 'seat-o': by('tbl-o')[0] }, dai = by('dai')[0];
    for (const b of blocks) {
      const tbl = tblOf[b.kind], top = (tbl || dai)[1] - 8, bottom = Math.max(...b.seats.map(c => c[1] + c[3])) + 8;
      const cls = b.kind === 'seat-b' ? 'c2' : 'c1';
      h += `<g class="block ${cls}" data-block="${b.no}">` + rr(b.x0 - 8, top + 3, b.x1 - b.x0 + 16, bottom - top, 12, 'class="tray-sh"') + rr(b.x0 - 8, top, b.x1 - b.x0 + 16, bottom - top, 12, 'class="tray"');
      if (tbl) h += `<g class="c tbl" data-k="${tbl[4]}" data-t="Bàn" data-s="${esc(INFO[tbl[4]][1])}">${rr(b.x0 + 1, tbl[1] + 3, b.x1 - b.x0 - 2, tbl[3] - 6, 5)}<text x="${f1((b.x0 + b.x1) / 2)}" y="${f1(tbl[1] + tbl[3] / 2 + 1)}">BÀN</text></g>`;
      if (dai) h += `<g class="c dai" data-k="dai" data-t="Đại biểu" data-s="Hàng ghế đại biểu">${rr(b.x0 + 1, dai[1] + 3, b.x1 - b.x0 - 2, dai[3] - 6, 5)}<text x="${f1((b.x0 + b.x1) / 2)}" y="${f1(dai[1] + dai[3] / 2 + 1)}">ĐẠI BIỂU</text></g>`;
      h += b.seats.map(([x, y, w, ht, k, l]) =>
        `<g class="seat" data-k="${k}" data-seat="${l}" data-block="${b.no}" role="img" aria-label="Ghế ${l[0]}-${l.slice(1)}">${sq(x, y, w, ht, 6)}<text x="${f1(x + w / 2)}" y="${f1(y + ht / 2 + 1)}">${l.slice(1)}</text></g>`).join('');
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
      if (k === 'seven') [x, y, w, ht] = [-138, 0, 130, CONG_Y - 12];   // same width as Cổng 711, from the top of the plan down to just above the gate
      if (k === 'wall') [x, w] = [1, 72];   // exit: same height as Cổng 711, centred on the walkway
      if (k === 'stage') { [y, ht] = [y - 12, ht + 36]; STG = { y: y + 4, h: ht - 6 }; }   // taller stage
      if (k === 'statue') [x, y, w, ht] = [pux(STAT_X0), STAT_Y - 10, pux(STAT_X1) - pux(STAT_X0) - 12, PAR_ROWS * PAR_H + 20];   // sheet columns 18-43
      if (k === 'tpb') [x, y, w, ht] = [x + w / 2 - 45, -100, 90, 90];   // same 90px width as 7-Eleven, Cổng 711 and 014–016   // 7-Eleven stands outside the west rail, above the exit
      const cx = x + w / 2, cy = y + ht / 2 + 1;
      if (k === 'stage') h += `<g class="c poi stage" data-k="stage" data-t="Sân khấu chính" data-s="Lễ tốt nghiệp 2026">${rr(x, y + 4, w, ht - 6, 10)}${rr(x, y + 4, w, ht - 6, 10, 'fill="url(#sgWood)" stroke="none"')}<text x="${f1(AX)}" y="${f1(cy + 1)}">SÂN KHẤU CHÍNH</text></g>`;
      else if (k === 'seven') h += `<g class="c poi seven" data-k="seven" data-t="7-Eleven" data-s="">${rr(x + 3, y + 3, w - 6, ht - 6, 8)}<image href="assets/img/711-logo.png" x="${f1(cx - Math.min(ht - 22, 400) / 2)}" y="${f1(cy - Math.min(ht - 22, 400) * .0885 - 1)}" width="${f1(Math.min(ht - 22, 400))}" height="${f1(Math.min(ht - 22, 400) * .177)}" transform="rotate(-90 ${f1(cx)} ${f1(cy)})"/></g>`;
      else if (k === 'tpb') h += `<g class="c poi tpb" data-k="tpb" data-t="TP Bank" data-s="">${rr(x, y + 2, w, ht - 4, 7)}<text x="${f1(cx)}" y="${f1(cy)}">TPBANK</text></g>`;
      else if (k === 'statue') h += `<g class="c zone k-par" data-ex="1" data-k="par" data-t="Khu vực phụ huynh" data-s="Phụ huynh ngồi theo hướng dẫn của BTC">${PAR_BOX(STAT_Y)}${PAR_CELLS.flatMap(c => Array.from({ length: PAR_ROWS }, (_, i) => sq(c[0], STAT_Y + i * PAR_H, c[2], PAR_H, 4, 'class="pcell" data-cl="3"'))).join('')}</g><g class="c poi statue" data-k="statue" data-t="Tượng" data-s="Tượng Self-made man">${rr(x + 2, y + 2, w - 4, ht - 4, 8)}<text x="${f1(AX)}" y="${f1(cy)}">TƯỢNG</text></g>`;
    }
    // landmarks from the overview that frame the ceremony ground: Cổng 711 beside 7-Eleven, rooms 014–016 on the south edge
    h += [['CỔNG 711', 'Cổng', -138, CONG_Y, 130, 145, 'cong']]
      .map(([lbl, t, x, a, w, b, cls]) => {
        const y = a, ht = b, cx = x + w / 2, cy = y + ht / 2 + 1;
        const label = cls === 'cong' ? `<text x="${f1(cx)}" y="${f1(cy - 17)}">CỔNG</text><text x="${f1(cx)}" y="${f1(cy + 17)}">711</text>` : `<text x="${f1(cx)}" y="${f1(cy)}">${lbl}</text>`;
        return `<g class="c poi ${cls}" data-k="${cls}" data-t="${t}" data-s="">${rr(x + 2, y + 2, w - 4, ht - 4, 10)}${label}</g>`;
      }).join('');
    h += [['016', LANE1_Y + T / 2 - 72.5], ['011', by1 - T / 2 - 72.5], ['030', ROOM030_Y, -138]].map(([n, y, x = W + 8]) =>
      `<g class="c poi room" data-k="room" data-t="Phòng ${n}" data-s="">${rr(x, y, 130, 145, 10)}<text x="${f1(x + 65)}" y="${f1(y + 73)}">${n}</text></g>`).join('');
    for (const [x, y, txt, kind, dir, w, ht] of TEXTS) {
      if (kind === 'arrow') {
        // the right-angle arrows turn in at the stage's vertical middle; the straight ones drift up / down to show the walking direction
        const turn = txt === '↱' || txt === '↰', tY = STG.y + STG.h / 2 + 9, lowY = Math.max(...TEXTS.filter(t => t[3] === 'arrow' && t[2] === txt && t[1] < 400).map(t => t[1]));
        // stage-level reference, upper arrow and lower arrow are spaced evenly (↑ sides and ↓ between blocks alike)
        const ay = turn ? tY : ((txt === '↑' || txt === '↓') && y < 400 && y < lowY) ? (tY + lowY) / 2 : y;
        const gaps = blocks.slice(1).map((b, i) => (blocks[i].x1 + b.x0) / 2);   // the ↓ arrows sit dead centre in the aisle between two blocks
        const ax = (txt === '↑' || turn) && y < 200 ? (x < W / 2 ? lx : rx) : txt === '↓' ? gaps.reduce((best, g) => Math.abs(g - x) < Math.abs(best - x) ? g : best, gaps[0]) : x, adx = turn ? (txt === '↱' ? 9 : -9) : 0;   // turn arrows: shift so their vertical shaft lines up with the straight arrows   // side arrows sit in the middle of the margin, like the row letters
        h += `<g class="arrow-b${ax < AX ? ' west' : ''}" transform="translate(${f1(ax + adx)} ${f1(ay)})"><path class="arrow " d="${ARROW[txt]}"/></g>`;
      }
      else if (kind === 'rail') continue;   // railings are drawn below as proper fences
    }
    // railings just inside the side walkways: two rails, posts every ~40px, name in the middle; full height with gaps at the doors
    const doorY = LANE1_Y, ex = by('wall')[0];   // gaps: exit (west), Check-in 1 and Check-in 2 doors (east)
    h += [[T + 18, 4, EXIT1_Y - 4], [T + 18, EXIT1_Y + EXIT_H + 4, EXIT2_Y - 4], [T + 18, EXIT2_Y + EXIT_H + 4, H - 4], [W - T - 18, 4, doorY - 4], [W - T - 18, doorY + T + 4, by1 - T - 4], [W - T - 18, by1 + 4, H - 4]].map(([x, a, b]) => {
      const y0 = a + 6, y1 = b - 6, n = Math.max(1, Math.round((y1 - y0) / 40)), mid = (y0 + y1) / 2;
      let posts = '';
      for (let i = 0; i <= n; i++) posts += `<circle cx="${f1(x)}" cy="${f1(y0 + (y1 - y0) * i / n)}" r="3.4"/>`;
      return `<g class="fence"><path class="fr" d="M${f1(x)} ${f1(y0)}V${f1(y1)}"/><path class="fr2" d="M${f1(x)} ${f1(y0)}V${f1(y1)}"/>${posts}`
        + '</g>';
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
    // seats that check in at the same room(s) light up together when one of them is hovered
    const groups = new Map();
    seatById.forEach((g, id) => { const k = checkIn(id[0], +id.slice(1)); (groups.get(k) || groups.set(k, []).get(k)).push(g); });
    const PCL = { P1: 'Cụm 1 · bên trái', P2: 'Cụm 2 · bên phải', P3: 'Cụm 3 · cạnh Tượng' };
    [1, 2, 3].forEach(n => groups.set('P' + n, [...vp.querySelectorAll(`.pcell[data-cl="${n}"]`)]));
    let lit = null;
    const light = key => {
      if (key === lit) return;
      if (lit) groups.get(lit).forEach(g => g.classList.remove('hl'));
      lit = key;
      svg.classList.toggle('grouping', !!key);
      if (key) groups.get(key).forEach(g => g.classList.add('hl'));
    };
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
        if (moved) { autoFit = false; svg.classList.add('dragging'); cam.x += dx; cam.y += dy; clamp(cam); apply(); tip.classList.remove('show'); light(null); }
        last = [e.clientX, e.clientY];
        return;
      }
      // hover tooltip (absolutely positioned, so nothing shifts)
      const g = e.target.closest?.('.seat, .c');
      if (!g) { tip.classList.remove('show'); light(null); return; }
      // any point of the parents' frame (cells, gaps, padding) belongs to the cluster under it
      const zone = e.target.closest?.('.zone.k-par'), pc = zone ? { dataset: { cl: zone.dataset.ex ? 3 : ((e.clientX - svg.getBoundingClientRect().left - cam.x) / cam.k < AX ? 1 : 2) } } : null;
      light(pc ? 'P' + pc.dataset.cl : g.classList.contains('seat') ? checkIn(g.dataset.seat[0], +g.dataset.seat.slice(1)) : null);
      if (pc) tip.innerHTML = `<b>Phụ huynh · ${PCL['P' + pc.dataset.cl]}</b><span>${groups.get('P' + pc.dataset.cl).length} ghế</span>`;
      else if (g.classList.contains('seat')) { const id = g.dataset.seat; tip.innerHTML = `<b>Ghế ${id[0]}-${id.slice(1)}</b><span>${checkIn(id[0], +id.slice(1))}</span>`; }
      else tip.innerHTML = `<b>${g.dataset.t}</b>${g.dataset.s ? `<span>${g.dataset.s}</span>` : ''}`;
      tip.classList.add('show');
      const host = stage.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      const x = Math.min(host.width - tw - 8, Math.max(8, e.clientX - host.left + 14));
      const y = e.clientY - host.top + 18 + th > host.height ? e.clientY - host.top - th - 12 : e.clientY - host.top + 18;
      tip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
    const up = e => {
      const wasDrag = moved;
      ptrs.delete(e.pointerId); pinch = 0; svg.classList.remove('dragging');
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', () => { tip.classList.remove('show'); light(null); });

    new ResizeObserver(() => { if (open && !entering) { if (autoFit) fit(0); else { clamp(cam); apply(); } } }).observe(svg);

    /* keyboard: arrows walk the seat grid, Escape clears the seat first. Returns true when handled. */
    function key(e) {
      if (!open) return false;
      return false;   // seats are not selectable any more
      const k = e.key;
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
