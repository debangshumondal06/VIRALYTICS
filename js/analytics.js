// VIRALYTICS extra analytics. ADDITIVE: nothing in app.js / analyzer.js is replaced by this file.
// It adds an "Analytics" page and a data-quality snapshot under the Dashboard.
// Everything is measured from your own imported posts. Small samples are flagged, never dressed up as findings.
const Stats = {
  clean: a => a.filter(x => x != null && x !== '' && isFinite(x)).map(Number),
  med(a) { a = this.clean(a).sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; },
  mean(a) { a = this.clean(a); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
};

const VX = {
  MIN: 5, // fewer relative-score samples than this are labelled "low n"
  DAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  hasAny: p => [p.likes, p.comments, p.shares].some(v => v !== '' && v != null),
  // engagement rate = (likes + comments + shares) / views, only when views were entered
  rate(p) { const v = +p.views; if (!(v > 0) || !VX.hasAny(p)) return null; return ((+p.likes || 0) + (+p.comments || 0) + (+p.shares || 0)) / v * 100; },
  day(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : d; },
  nw: p => (p.caption || '').split(/\s+/).filter(Boolean).length,
  n2: v => v == null ? '—' : (+v).toFixed(2),
  n0: v => v == null ? '—' : Math.round(+v).toLocaleString(),
  // group posts and summarise each group by the MEDIAN of its relative scores (robust to one outlier post)
  grp(P, kf, r) {
    const g = {};
    P.forEach(p => { const k = kf(p); if (k == null || k === '') return; const o = g[k] ??= { n: 0, r: [] }; o.n++; const v = r[p.id]; if (v != null) o.r.push(v); });
    return Object.entries(g).map(([k, o]) => ({ k, n: o.n, m: o.r.length, med: Stats.med(o.r), avg: Stats.mean(o.r) }));
  },
  byMed: (a, b) => (b.med ?? -1) - (a.med ?? -1) || b.n - a.n,
  gRows: g => g.map(x => [esc(x.k), x.n, x.m,
    x.med == null ? '<span class=mut>not enough metrics</span>' : VX.n2(x.med) + '×' + (x.m < VX.MIN ? ' <span class=mut>(low n)</span>' : ''),
    x.avg == null ? '' : VX.n2(x.avg) + '×']),
  H: ['Group', 'Posts', 'With score', 'Median vs creator median', 'Mean'],

  async page() {
    const [C, P, R] = await Promise.all(['creators', 'posts', 'performance_records'].map(s => DB.all(s))), r = ratios(P);
    const withM = P.filter(VX.hasAny), withV = P.filter(p => VX.rate(p) != null), withD = P.filter(p => VX.day(p.postDate)), scored = P.filter(p => r[p.id] != null);
    const seen = new Set(); let dups = 0;
    P.forEach(p => { const c = norm(p.caption); if (!c) return; const k = p.platform + '|' + c; seen.has(k) ? dups++ : seen.add(k); });
    const perC = {}; withM.forEach(p => { const k = p.creatorId || ''; if (k) perC[k] = (perC[k] || 0) + 1; });
    const short = C.filter(c => (perC[c.id] || 0) < 3).map(c => esc(c.name));
    const pct = n => P.length ? Math.round(n / P.length * 100) + '%' : '—';

    const quality = `<div class=card><h3>Data quality</h3><p class=mut>Every number below is only as good as the data behind it.</p>
      ${tbl(['Check', 'Posts', 'Share'], [
        ['Posts imported', P.length, ''],
        ['Have engagement metrics', withM.length, pct(withM.length)],
        ['Have views (engagement rate possible)', withV.length, pct(withV.length)],
        ['Have a post date (timing analysis possible)', withD.length, pct(withD.length)],
        ['Have a relative score (creator has 3+ posts with metrics)', scored.length, pct(scored.length)],
        ['Possible duplicate captions', dups, dups ? '<span class=warn>check Collection</span>' : '<span class=ok>none</span>']])}
      ${short.length ? `<p class=mut>Creators with fewer than 3 posts with metrics (their posts get no relative score): ${short.join(', ')}</p>` : ''}</div>`;

    const plats = [...new Set(P.map(p => p.platform).filter(Boolean))];
    const platTbl = tbl(['Platform', 'Posts', 'With metrics', 'Median score', 'Median engagement rate'], plats.map(pl => {
      const x = P.filter(p => p.platform === pl), m = x.filter(VX.hasAny), rt = x.map(VX.rate).filter(v => v != null);
      return [esc(pl), x.length, m.length, VX.n0(Stats.med(m.map(eng))), rt.length ? VX.n2(Stats.med(rt)) + '% <span class=mut>(n=' + rt.length + ')</span>' : '<span class=mut>no views entered</span>'];
    }));

    const tt = (title, g, note) => `<div class=card><h3>${title}</h3>${note ? `<p class=mut>${note}</p>` : ''}${tbl(VX.H, VX.gRows(g))}</div>`;
    const wd = VX.grp(P, p => { const d = VX.day(p.postDate); return d ? VX.DAYS[d.getDay()] : null; }, r).sort((a, b) => VX.DAYS.indexOf(a.k) - VX.DAYS.indexOf(b.k));
    const len = VX.grp(P, p => { const w = VX.nw(p); return !w ? null : w < 40 ? 'short (<40 words)' : w <= 120 ? 'medium (40–120)' : 'long (>120)'; }, r).sort(VX.byMed);
    const med = VX.grp(P, p => p.mediaType, r).sort(VX.byMed);
    const mon = VX.grp(P, p => VX.day(p.postDate) ? p.postDate.slice(0, 7) : null, r).sort((a, b) => a.k < b.k ? -1 : 1);
    VX._m = mon.filter(x => x.med != null);

    const top = scored.sort((a, b) => r[b.id] - r[a.id]), row = p => [esc(Analyzer.hook(p.caption).slice(0, 90)), VX.n2(r[p.id]) + '×', esc(p.platform), p.url ? `<a href="${esc(p.url)}" target=_blank rel=noopener>link</a>` : '—'];
    const best = top.slice(0, 5), worst = top.length > 5 ? top.slice(-5).reverse() : [];

    const mine = R.filter(x => [x.likes, x.comments, x.shares].some(v => v !== '' && v != null)).sort((a, b) => String(a.date || '') < String(b.date || '') ? -1 : 1);
    const mineRows = [...new Set(mine.map(x => x.platform))].map(pl => {
      const x = mine.filter(z => z.platform === pl).map(eng), h = Math.floor(x.length / 2);
      const trend = x.length >= 6 ? (Stats.med(x.slice(h)) >= Stats.med(x.slice(0, h)) ? 'up' : 'down') + ' <span class=mut>(latest half vs earlier half)</span>' : '<span class=mut>needs 6+ posts</span>';
      return [esc(pl), x.length, VX.n0(Stats.med(x)), VX.n0(Stats.mean(x)), trend];
    });

    return `<h1>Analytics</h1><p class=mut>Relative score = a post's engagement (likes + 2×comments + 3×shares) divided by that creator's own median. 1.00× is typical for them. Groups with fewer than ${VX.MIN} scored posts are marked low n: treat them as anecdotes, not patterns.</p>
      ${quality}<div class=card><h3>By platform</h3>${platTbl}</div>
      ${tt('By weekday posted', wd, 'Uses the date you entered (no time of day is stored).')}${tt('By media type', med)}${tt('By caption length', len)}
      <div class=card><h3>Trend by month</h3>${mon.length ? '<canvas id=trend height=90></canvas>' : '<p class=mut>Add post dates to see a trend.</p>'}${tbl(['Month', 'Posts', 'With score', 'Median vs creator median', 'Mean'], VX.gRows(mon))}</div>
      <div class=card><h3>Strongest relative performers</h3>${tbl(['Hook', 'Score', 'Platform', 'Source'], best.map(row))}</div>
      ${worst.length ? `<div class=card><h3>Weakest relative performers</h3>${tbl(['Hook', 'Score', 'Platform', 'Source'], worst.map(row))}</div>` : ''}
      <div class=card><h3>My own posts</h3>${tbl(['Platform', 'Posts with metrics', 'Median score', 'Mean score', 'Trend'], mineRows)}</div>`;
  },

  async after() {
    if (!window.Chart || !$('#trend') || !VX._m.length) return;
    new Chart($('#trend'), { type: 'line', data: { labels: VX._m.map(x => x.k), datasets: [{ label: 'Median vs creator median', data: VX._m.map(x => +x.med.toFixed(2)), borderColor: '#7c9cff', tension: .25 }] }, options: { plugins: { legend: { display: false } } } });
  },

  // compact card appended under the original Dashboard (the original function is kept and called as-is)
  async snapshot() {
    const P = await DB.all('posts'), r = ratios(P), m = P.filter(VX.hasAny), rt = P.map(VX.rate).filter(v => v != null);
    if (!P.length) return '';
    const sc = Object.keys(r).length;
    return `<div class=card><h3>Analytics snapshot</h3><div class=grid>${[
      ['With metrics', m.length + ' / ' + P.length], ['Median score', VX.n0(Stats.med(m.map(eng)))],
      ['Median engagement rate', rt.length ? VX.n2(Stats.med(rt)) + '%' : 'n/a'], ['Scored vs creator', sc + ' / ' + P.length]
    ].map(x => `<div class=card><div class=mut>${x[0]}</div><div class=stat>${x[1]}</div></div>`).join('')}</div>
      <p class=mut>Open <b>Analytics</b> for weekday, media type, caption length, trend and data-quality checks.${sc < P.length ? ' Posts without a score need 3+ posts with metrics for their creator.' : ''}</p></div>`;
  },

  install() {
    if (typeof pages === 'undefined' || PAGES.includes('Analytics')) return;
    PAGES.splice(Math.max(0, PAGES.indexOf('Settings')), 0, 'Analytics');
    pages.Analytics = VX.page; AFTER.Analytics = VX.after;
    const d0 = pages.Dashboard; pages.Dashboard = async () => (await d0()) + await VX.snapshot();
  }
};
