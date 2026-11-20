// Ignition dashboard. It reads window.RADAR (written beside dashboard/ by main.ts from the same
// board board.json carries) and renders the KPI strip, the filterable ranked board, a per-protocol
// detail view with the model's working and the farm plan, and the method section with the held-out
// test the model passed. No network: every byte it shows arrived in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', verdict: 'all', watchOnly: false, sort: 'rank', dir: 1, selected: null };

  var usdFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFull.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + (Math.abs(n) < 1 ? n.toFixed(2) : n.toFixed(1)) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(x) { return 'x' + Number(x).toFixed(2); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  var stats = DATA.stats;
  var model = DATA.model;
  var holdout = model.holdout;
  var rows = DATA.rows;

  // ---------------------------------------------------------- header and KPIs
  function renderHeader() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'radar-dot' }),
        el('div', null,
          el('h1', null, 'IGNI', el('span', { class: 'thin' }, 'TION')),
          el('p', { class: 'tagline', text: 'Token launch radar: pre-token protocols ranked by a fitted implied value, each with a costed farm plan and a verdict.' })
        )
      ),
      el('div', { class: 'meta' },
        el('div', null, 'model ', el('b', { text: DATA.model_version })),
        el('div', null, 'snapshot ', el('b', { text: DATA.as_of })),
        el('div', { text: DATA.source })
      )
    );
  }

  function kpi(label, value, sub, cls) {
    return el('div', { class: 'kpi' + (cls ? ' ' + cls : '') },
      el('div', { class: 'k-label', text: label }),
      el('div', { class: 'k-value', text: value }),
      el('div', { class: 'k-sub', text: sub })
    );
  }

  function renderKpis() {
    var verdicts = { FARM: 0, THIN: 0, SKIP: 0 };
    rows.forEach(function (r) { verdicts[r.verdict]++; });
    return el('section', { class: 'kpis' },
      kpi('Protocols accounted', String(stats.total), stats.priced_anchors + ' priced anchors, ' + stats.token_recorded_unpriced + ' token recorded unpriced, ' + stats.pretoken + ' pre-token'),
      kpi('Board rows ranked', String(stats.board_rows), stats.screened_out + ' pre-token screened out as products of traded tokens'),
      kpi('Watchlist covered', stats.watchlist_covered + ' / ' + stats.watchlist_size, 'the house floor at $' + (DATA.floor_usd / 1e6) + 'M TVL, all ranked', 'good'),
      kpi('Held-out median error', holdout.median_ape_pct + '%', 'naive median-multiple model: ' + holdout.naive_median_ape_pct + '%', 'warn'),
      kpi('Held-out log R2', String(holdout.log_r2), holdout.within_2x_pct + '% priced within 2x, ' + holdout.within_3x_pct + '% within 3x'),
      kpi('Verdicts', verdicts.FARM + ' / ' + verdicts.THIN + ' / ' + verdicts.SKIP, 'FARM / THIN / SKIP across the board')
    );
  }

  // ---------------------------------------------------------- controls
  function categories() {
    var seen = {};
    rows.forEach(function (r) { if (r.category) seen[r.category] = true; });
    return Object.keys(seen).sort();
  }

  function renderControls() {
    var search = el('input', { type: 'search', placeholder: 'Search name or slug', value: state.q });
    search.addEventListener('input', function () { state.q = search.value; refresh(); });
    var catSel = el('select', null,
      el('option', { value: 'all', text: 'All categories' }),
      categories().map(function (c) { return el('option', { value: c, text: c }); })
    );
    catSel.value = state.category;
    catSel.addEventListener('change', function () { state.category = catSel.value; refresh(); });
    var verSel = el('select', null,
      el('option', { value: 'all', text: 'All verdicts' }),
      el('option', { value: 'FARM', text: 'FARM' }),
      el('option', { value: 'THIN', text: 'THIN' }),
      el('option', { value: 'SKIP', text: 'SKIP' })
    );
    verSel.value = state.verdict;
    verSel.addEventListener('change', function () { state.verdict = verSel.value; refresh(); });
    var watchBox = el('input', { type: 'checkbox' });
    watchBox.checked = state.watchOnly;
    watchBox.addEventListener('change', function () { state.watchOnly = watchBox.checked; refresh(); });
    return el('section', { class: 'controls', id: 'controls' },
      el('label', null, 'Find ', search),
      el('label', null, 'Category ', catSel),
      el('label', null, 'Verdict ', verSel),
      el('label', null, watchBox, ' Watchlist only'),
      el('span', { class: 'count', id: 'row-count' })
    );
  }

  // ---------------------------------------------------------- the board
  var COLUMNS = [
    { key: 'rank', label: '#', get: function (r) { return r.rank; } },
    { key: 'name', label: 'Protocol', get: function (r) { return r.name.toLowerCase(); } },
    { key: 'category', label: 'Category', get: function (r) { return (r.category || '').toLowerCase(); } },
    { key: 'tvl', label: 'TVL', get: function (r) { return r.tvl_usd; } },
    { key: 'change', label: '7d', get: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; } },
    { key: 'age', label: 'Age', get: function (r) { return r.age_days === null ? -1 : r.age_days; } },
    { key: 'fitted', label: 'Fitted value', get: function (r) { return r.fitted_value_usd; } },
    { key: 'odds', label: 'Odds', get: function (r) { return r.launch_odds; } },
    { key: 'implied', label: 'Implied value', get: function (r) { return r.implied_value_usd; } },
    { key: 'verdict', label: 'Verdict', get: function (r) { return r.verdict; } }
  ];

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
    var col = COLUMNS.filter(function (c) { return c.key === state.sort; })[0] || COLUMNS[0];
    out.sort(function (a, b) {
      var va = col.get(a), vb = col.get(b);
      if (va < vb) return -1 * state.dir;
      if (va > vb) return 1 * state.dir;
      return a.rank - b.rank;
    });
    return out;
  }

  function renderBoard(list) {
    var head = el('tr', null, COLUMNS.map(function (c) {
      var label = c.label + (state.sort === c.key ? (state.dir === 1 ? ' ^' : ' v') : '');
      return el('th', { text: label, onclick: function () {
        if (state.sort === c.key) state.dir = -state.dir;
        else { state.sort = c.key; state.dir = c.key === 'name' || c.key === 'category' || c.key === 'verdict' ? 1 : -1; }
        if (c.key === 'rank') state.dir = 1;
        refresh();
      } });
    }));
    var body = list.map(function (r) {
      var change = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) });
      return el('tr', { class: r.slug === state.selected ? 'selected' : '', onclick: function () { state.selected = r.slug; refresh(); } },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', { class: 'name' },
          el('span', { class: 'pname', text: r.name }),
          r.watchlist ? el('span', { class: 'watch', text: 'WATCHLIST' }) : null,
          el('br'),
          el('span', { class: 'pslug', text: r.slug })
        ),
        el('td', { class: 'cat', text: r.category || 'Uncategorised' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        change,
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtUsd(r.fitted_value_usd) }),
        el('td', { class: 'num', text: Math.round(r.launch_odds * 100) + '%' }),
        el('td', { class: 'num implied', text: fmtUsd(r.implied_value_usd) }),
        el('td', null, el('span', { class: 'chip ' + r.verdict, text: r.verdict }))
      );
    });
    var table = el('table', { class: 'board' }, el('thead', null, head), el('tbody', null, body));
    if (list.length === 0) return el('div', { class: 'board-wrap' }, el('div', { class: 'empty', text: 'No protocol matches the current filters.' }));
    return el('div', { class: 'board-wrap' }, table);
  }

  // ---------------------------------------------------------- detail view
  function stat(label, value) {
    return el('div', null, el('div', { class: 's-label', text: label }), el('div', { class: 's-value', text: value }));
  }

  function renderDetail() {
    var row = rows.filter(function (r) { return r.slug === state.selected; })[0] || rows[0];
    if (!row) return el('aside', { class: 'detail' }, el('p', { text: 'No rows.' }));
    var cover = Math.round(row.implied_value_usd / Math.max(1, row.est_cost_usd));
    return el('aside', { class: 'detail', id: 'detail' },
      el('h2', { text: row.name }),
      el('div', { class: 'd-sub', text: '#' + row.rank + ' · ' + (row.category || 'Uncategorised') + ' · ' + row.slug + (row.watchlist ? ' · on the house watchlist' : ' · found below the watchlist floor') }),
      el('div', { class: 'stat-grid' },
        stat('TVL', fmtUsd(row.tvl_usd)),
        stat('TVL change, 7d', fmtPct(row.change_7d)),
        stat('Tracked since', row.listed_at || 'unknown'),
        stat('Age with no token', fmtAge(row.age_days)),
        stat('Chains', String(row.chains.length)),
        stat('Main chain', row.chains.length ? row.chains[0] : 'n/a')
      ),
      el('div', { class: 'model-box' },
        el('div', { class: 'm-row' }, el('span', { text: 'Fitted value at its TVL' }), el('b', { text: fmtUsd(row.fitted_value_usd) })),
        el('div', { class: 'm-row' }, el('span', { text: 'x momentum (7d TVL)' }), el('b', { text: fmtMult(row.growth_multiplier) })),
        el('div', { class: 'm-row' }, el('span', { text: 'x maturity (time running)' }), el('b', { text: fmtMult(row.maturity_multiplier) })),
        el('div', { class: 'm-row' }, el('span', { text: 'x launch odds (peers\' record)' }), el('b', { text: fmtMult(row.launch_odds) })),
        el('div', { class: 'm-total' }, el('span', { text: 'Implied value' }), el('b', { text: usdFull.format(row.implied_value_usd) }))
      ),
      el('div', { class: 'verdict-box' },
        el('span', { class: 'chip ' + row.verdict, text: row.verdict }),
        el('span', { class: 'v-text' },
          el('b', { text: 'Season cost about ' + fmtUsd(row.est_cost_usd) }),
          document.createTextNode(' in fees and gas, on ' + fmtUsd(row.capital_usd) + ' of recoverable capital: the implied value covers it about ' + cover.toLocaleString('en-US') + 'x.')
        )
      ),
      el('h3', { text: 'Farm plan: ' + row.farm_steps.length + ' steps' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) { return el('li', { text: s }); }))
    );
  }

  // ---------------------------------------------------------- method
  function miniTable(headers, bodyRows, hlFirst) {
    return el('table', { class: 'mini' },
      el('thead', null, el('tr', null, headers.map(function (h) { return el('th', { text: h }); }))),
      el('tbody', null, bodyRows.map(function (cells, i) {
        return el('tr', { class: hlFirst && i === 0 ? 'hl' : '' }, cells.map(function (c) { return el('td', { text: String(c) }); }));
      }))
    );
  }

  function renderMethod() {
    var holdRows = [
      ['Median error on held-out caps', holdout.median_ape_pct + '%', holdout.naive_median_ape_pct + '%'],
      ['Log-space R2', holdout.log_r2, holdout.naive_log_r2],
      ['Priced within 2x', holdout.within_2x_pct + '%', holdout.naive_within_2x_pct + '%'],
      ['Priced within 3x', holdout.within_3x_pct + '%', 'n/a']
    ];
    var catRows = model.categories.slice(0, 14).map(function (c) {
      return [c.category, c.anchors, c.median_multiple.toFixed(3), (c.offset >= 0 ? '+' : '') + c.offset.toFixed(2)];
    });
    var acctRows = [
      ['Protocols in the snapshot', stats.total],
      ['Priced anchors (token trades, cap recorded)', stats.priced_anchors],
      ['Token recorded, no price in the snapshot', stats.token_recorded_unpriced],
      ['Records no token', stats.pretoken],
      ['Ranked on this board', stats.board_rows],
      ['Pre-token but screened out as products', stats.screened_out]
    ];
    return el('section', { class: 'method', id: 'method' },
      el('h2', { text: 'How this radar works' }),
      el('p', null,
        'Every number on the board is fitted from the snapshot itself. Nothing is priced by hand, no protocol name is special-cased, and the model is ',
        el('b', { text: 'tested on anchors it never saw' }),
        ' before it is allowed to rank anything.'
      ),
      el('h3', { text: 'The model, in four steps' }),
      el('ol', { class: 'how' },
        el('li', null, el('b', { text: 'Fit on the traded. ' }), 'The ' + stats.priced_anchors + ' protocols whose token already trades with a recorded market cap are the anchors. On them, log(market cap) is fitted against log(TVL) by least squares (slope ' + model.slope + '), with one offset per category: the category\'s median residual, shrunk toward zero so thin categories barely move the line. The global median cap/TVL multiple is ' + model.global_median_multiple + '.'),
        el('li', null, el('b', { text: 'Test out of sample. ' }), 'Anchors are split by a hash of the slug: ' + holdout.train_n + ' train the fit, ' + holdout.test_n + ' are held out. The table below is the held-out report card, beside the naive model that prices everything at the median multiple. Token pricing off TVL alone is noisy, and the radar says so rather than hiding it.'),
        el('li', null, el('b', { text: 'Odds from the peers\' record. ' }), 'A launch is not certain. Across the whole snapshot, ' + Math.round(model.global_token_rate * 100) + '% of protocols record a token. Each candidate\'s odds blend its own category\'s record with its TVL band\'s record, each shrunk toward that global rate. Implied value = fitted value x momentum x maturity x odds.'),
        el('li', null, el('b', { text: 'Verdicts net of cost. ' }), 'Each farm plan is costed chain by chain (gas, bridges, a ten-week cadence). FARM means the implied value clears the season cost by a wide margin; THIN means the edge is real but modest; SKIP means the arithmetic does not justify the attention. The verdict and its numbers are the last step of every plan.')
      ),
      el('div', { class: 'method-grid' },
        el('div', null,
          el('h3', { text: 'Held-out test: ' + holdout.test_n + ' anchors the fit never saw' }),
          miniTable(['Metric', 'This fit', 'Naive'], holdRows, true)
        ),
        el('div', null,
          el('h3', { text: 'Every protocol accounted for' }),
          miniTable(['Disposition', 'Count'], acctRows, false)
        )
      ),
      el('h3', { text: 'Category fits (largest anchor sets)' }),
      miniTable(['Category', 'Anchors', 'Median cap / TVL', 'Offset (log)'], catRows, false),
      el('h3', { text: 'The screen: what is not ranked, and why' }),
      el('ul', { class: 'rules' },
        stats.screen_reasons.map(function (r) {
          return el('li', null, el('b', { text: r.count + ' protocols: ' }), r.reason + '.');
        }),
        el('li', null, el('b', { text: 'Every watchlist slug is ranked regardless' }), ', because the watchlist is the floor the house set, not a suggestion.')
      ),
      el('h3', { text: 'Already trades: kept apart, at the market\'s own values' }),
      el('div', { class: 'live-strip' },
        DATA.live.map(function (l) {
          return el('span', { class: 'live-item' }, el('b', { text: l.name }), ' ' + (l.symbol || '') + ' · cap ' + fmtUsd(l.mcap_usd) + ' · TVL ' + fmtUsd(l.tvl_usd));
        })
      ),
      el('p', null, 'Language matters: this board says a protocol ', el('b', { text: 'records no token' }), ' in the snapshot, never that it has none; a record can lag a launch. An implied value is this board\'s own fitted claim about what a token would be worth if the protocol\'s record stayed as it is. It is not a prediction that a token will be issued, or when.')
    );
  }

  // ---------------------------------------------------------- assembly
  var controlsEl = renderControls();
  var boardHost = el('div');
  var detailHost = el('div');
  var layout = el('div', { class: 'layout' }, boardHost, detailHost);
  app.appendChild(renderHeader());
  app.appendChild(renderKpis());
  app.appendChild(controlsEl);
  app.appendChild(layout);
  app.appendChild(renderMethod());
  app.appendChild(el('footer', { text: 'Ignition ' + DATA.model_version + ' · fitted on the snapshot of ' + DATA.as_of + ' · the board, the page and the farm plans are all written by the same run of the same model.' }));
  app.setAttribute('aria-busy', 'false');
  if (!state.selected && rows.length > 0) state.selected = rows[0].slug;

  function refresh() {
    var list = visibleRows();
    var count = document.getElementById('row-count');
    if (count) count.textContent = list.length + ' of ' + rows.length + ' protocols shown';
    var fresh = renderBoard(list);
    boardHost.replaceChildren(fresh);
    detailHost.replaceChildren(renderDetail());
  }
  refresh();
})();
