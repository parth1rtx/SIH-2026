import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const REFRESH_INTERVAL = 20000;

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = null, raf;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      setValue(Math.floor(p * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('dayinbits-theme') !== 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dayinbits-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const accent = dark ? '#d4ff3f' : '#65a30d';
  const danger = dark ? '#ff4d4d' : '#dc2626';

  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(Date.now());
  const [nowTs, setNowTs] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('theft_probability');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const rowRefs = useRef({});

  const fetchAndPredict = useCallback(async () => {
    const res = await fetch('/houses.json');
    const data = await res.json();
    const results = await Promise.all(
      data.map(async (house) => {
        const r = await fetch('http://127.0.0.1:5000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avg_metered: house.avg_metered, std_metered: house.std_metered,
            max_metered: house.max_metered, min_metered: house.min_metered,
            avg_actual: house.avg_actual, theft_ratio: house.theft_ratio,
            zero_day_ratio: house.zero_day_ratio,
          }),
        });
        const pred = await r.json();
        return { ...house, ...pred };
      })
    );
    setHouses(results);
    setLastSynced(Date.now());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAndPredict(); }, [fetchAndPredict]);
  useEffect(() => {
    const id = setInterval(() => fetchAndPredict(), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAndPredict]);
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleManualRefresh = () => { setRefreshing(true); fetchAndPredict(); };

  const flagged = houses.filter(h => h.is_katiya === 1);
  const normal = houses.filter(h => h.is_katiya === 0);
  const total = useCountUp(houses.length);
  const flagCount = useCountUp(flagged.length);
  const normCount = useCountUp(normal.length);
  const rate = useCountUp(houses.length ? Math.round((flagged.length / houses.length) * 100) : 0);
  const secondsAgo = Math.max(0, Math.floor((nowTs - lastSynced) / 1000));

  if (loading) {
    return (
      <div className="min-h-screen bg-black dark:bg-black flex items-center justify-center text-neutral-500 font-mono text-sm">
        Loading predictions...
      </div>
    );
  }

  const pieData = [{ name: 'Normal', value: normal.length }, { name: 'Katiya', value: flagged.length }];
  const topFlagged = [...flagged].sort((a, b) => b.theft_probability - a.theft_probability).slice(0, 8)
    .map(h => ({ id: h.LCLid, name: h.LCLid.replace('MAC0', ''), confidence: +(h.theft_probability * 100).toFixed(1) }));

  const handleBarClick = (data) => {
    const id = data?.id;
    if (!id) return;
    setExpandedId(id);
    setHighlightId(id);
    setTimeout(() => rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    setTimeout(() => setHighlightId(null), 1600);
  };
  const handlePieClick = (entry) => setStatusFilter(entry.name === 'Katiya' ? 'katiya' : 'normal');
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  let visible = houses.filter(h =>
    h.LCLid.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === 'all' || (statusFilter === 'katiya' ? h.is_katiya === 1 : h.is_katiya === 0))
  );
  visible = [...visible].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const columns = [
    { key: 'LCLid', label: 'House ID' }, { key: 'avg_metered', label: 'Avg Metered' },
    { key: 'theft_ratio', label: 'Theft Ratio' }, { key: 'is_katiya', label: 'Status' },
    { key: 'theft_probability', label: 'Confidence' },
  ];
  const metrics = [
    { label: 'Total Houses', value: total, color: null },
    { label: 'Flagged', value: flagCount, color: danger },
    { label: 'Normal', value: normCount, color: accent },
    { label: 'Detection Rate', value: `${rate}%`, color: null },
  ];
  const chips = [
    { key: 'all', label: `All ${houses.length}` },
    { key: 'normal', label: `Normal ${normal.length}` },
    { key: 'katiya', label: `Katiya ${flagged.length}` },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white font-sans transition-colors">
      {/* Top bar */}
      <div className="fade-in flex items-center justify-between px-8 md:px-14 py-6 border-b border-neutral-200 dark:border-neutral-900">
        <div className="text-sm font-semibold tracking-tight">DayInBits</div>
        <div className="flex items-center gap-6 text-xs font-mono text-neutral-500">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full live-pulse" style={{ background: accent }}></span>
            Live · synced {secondsAgo}s ago
          </span>
          <button
            onClick={() => setDark(d => !d)}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            {dark ? '☀ Light' : '● Dark'}
          </button>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <span className={refreshing ? 'spin inline-block' : 'inline-block'}>↻</span> Sync
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="fade-in px-8 md:px-14 pt-16 pb-14 border-b border-neutral-200 dark:border-neutral-900">
        <div className="text-xs font-mono uppercase tracking-[0.2em] mb-6" style={{ color: accent }}>
          GLA University · SIH 2026 · Smart Automation
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] max-w-4xl">
          Grid theft, caught<br />before it spreads.
        </h1>
        <p className="mt-6 text-neutral-500 dark:text-neutral-400 text-lg max-w-xl">
          Live household-level katiya detection across the feeder — model v3, trained on real consumption data, 97.2% accuracy.
        </p>
      </div>

      {/* Stat grid */}
      <div className="fade-in grid grid-cols-2 md:grid-cols-4 gap-4 px-8 md:px-14 py-10">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-3xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-900 p-8 hover:border-neutral-400 dark:hover:border-neutral-700 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="text-xs text-neutral-500 mb-4 font-mono uppercase tracking-wide">{m.label}</div>
            <div className="text-5xl font-black tracking-tight" style={{ color: m.color || undefined }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="fade-in grid grid-cols-1 lg:grid-cols-5 gap-4 px-8 md:px-14 pb-10">
        <div className="lg:col-span-2 rounded-3xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-900 p-8 hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors">
          <div className="text-lg font-bold mb-1">Fleet split</div>
          <div className="text-xs text-neutral-500 mb-6">Click a segment to filter the ledger</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={5} cornerRadius={4} stroke="none" onClick={handlePieClick} className="cursor-pointer">
                <Cell fill={accent} /><Cell fill={danger} />
              </Pie>
              <Tooltip contentStyle={{ background: dark ? '#0a0a0a' : '#fff', border: `1px solid ${dark ? '#262626' : '#e5e5e5'}`, borderRadius: 12, fontSize: 12, fontFamily: 'Inter', color: dark ? '#fff' : '#000' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2 text-xs font-mono">
            <button onClick={() => setStatusFilter('normal')} style={{ color: accent }}>● Normal</button>
            <button onClick={() => setStatusFilter('katiya')} style={{ color: danger }}>● Katiya</button>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-3xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-900 p-8 hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors">
          <div className="text-lg font-bold mb-1">Top suspected</div>
          <div className="text-xs text-neutral-500 mb-6">Click a bar to inspect that house below</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topFlagged}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1a1a1a' : '#e5e5e5'} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#737373', fontSize: 10, fontFamily: 'JetBrains Mono' }} domain={[0, 100]} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: dark ? '#0a0a0a' : '#fff', border: `1px solid ${dark ? '#262626' : '#e5e5e5'}`, borderRadius: 12, fontSize: 12, fontFamily: 'Inter', color: dark ? '#fff' : '#000' }} />
              <Bar dataKey="confidence" fill={danger} radius={[8, 8, 0, 0]} onClick={handleBarClick} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ledger */}
      <div className="fade-in mx-8 md:mx-14 mb-16 rounded-3xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-900 overflow-hidden">
        <div className="p-8 border-b border-neutral-200 dark:border-neutral-900 flex flex-wrap items-center justify-between gap-4">
          <div className="text-lg font-bold">
            Household ledger <span className="text-neutral-500 font-normal text-sm">· {visible.length} of {houses.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {chips.map(c => (
              <button
                key={c.key}
                onClick={() => setStatusFilter(c.key)}
                className={`text-xs font-mono px-4 py-2 rounded-full border transition-colors ${
                  statusFilter === c.key
                    ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                    : 'border-neutral-300 dark:border-neutral-800 text-neutral-500 hover:border-neutral-500 dark:hover:border-neutral-600'
                }`}
              >{c.label}</button>
            ))}
            <input
              placeholder="Search house ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs font-mono px-4 py-2 rounded-full border border-neutral-300 dark:border-neutral-800 bg-transparent w-40 focus:outline-none focus:border-neutral-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
            />
          </div>
        </div>

        <div className="max-h-[460px] overflow-y-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="sticky top-0 bg-neutral-50 dark:bg-neutral-950">
                <th className="w-6"></th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`text-left px-6 py-4 text-xs font-sans font-medium uppercase tracking-wide cursor-pointer border-b border-neutral-200 dark:border-neutral-900 ${sortKey === col.key ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-600'}`}
                  >
                    {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => (
                <Fragment key={h.LCLid}>
                  <tr
                    ref={(el) => (rowRefs.current[h.LCLid] = el)}
                    onClick={() => setExpandedId(expandedId === h.LCLid ? null : h.LCLid)}
                    className={`border-b border-neutral-200 dark:border-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 cursor-pointer transition-colors ${highlightId === h.LCLid ? 'row-flash' : ''}`}
                  >
                    <td className="pl-6 py-3">
                      <span style={{ color: h.is_katiya === 1 ? danger : accent }}>●</span>
                    </td>
                    <td className="px-6 py-3 text-neutral-900 dark:text-white">{h.LCLid}</td>
                    <td className="px-6 py-3 text-neutral-500">{h.avg_metered.toFixed(2)} kWh</td>
                    <td className="px-6 py-3 text-neutral-500">{h.theft_ratio.toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span
                        className="text-xs font-sans font-medium px-3 py-1 rounded-full"
                        style={{
                          background: h.is_katiya === 1 ? `${danger}20` : `${accent}20`,
                          color: h.is_katiya === 1 ? danger : accent,
                        }}
                      >
                        {h.is_katiya === 1 ? 'Katiya suspected' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-neutral-900 dark:text-white font-semibold">{(h.theft_probability * 100).toFixed(1)}%</td>
                  </tr>
                  {expandedId === h.LCLid && (
                    <tr>
                      <td colSpan={6} className="bg-neutral-100 dark:bg-neutral-900/40 px-8 py-5 border-b border-neutral-200 dark:border-neutral-900">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-xs">
                          <div><div className="text-neutral-500 font-sans mb-1">Std metered</div>{h.std_metered?.toFixed(3)}</div>
                          <div><div className="text-neutral-500 font-sans mb-1">Max metered</div>{h.max_metered?.toFixed(2)}</div>
                          <div><div className="text-neutral-500 font-sans mb-1">Min metered</div>{h.min_metered?.toFixed(3)}</div>
                          <div><div className="text-neutral-500 font-sans mb-1">Avg actual</div>{h.avg_actual?.toFixed(2)}</div>
                          <div><div className="text-neutral-500 font-sans mb-1">Zero-day ratio</div>{h.zero_day_ratio?.toFixed(2)}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}