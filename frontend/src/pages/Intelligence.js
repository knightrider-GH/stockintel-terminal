import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { announcementsAPI, watchlistAPI, alertsAPI } from '../services/api';
import { useTheme } from '../App';
import { useMarket } from '../context/MarketContext';
import { Brain, FileText, Search, RefreshCw, TrendingUp, TrendingDown, ExternalLink, Activity, AlertCircle, ChevronDown, ChevronUp, BarChart3, Bell, Pin, GitCompare, Shield, Zap, Target, Eye } from 'lucide-react';

// Frontend safety fallback for any remaining mojibake
const cleanText = (t) => {
  if (typeof t !== 'string') return t;
  return t
    .replace(/\xc3\xa2\xc2\x80\xc2\xa2/g, '\u2022')
    .replace(/\xc3\xa2\xc2\x80\xc2\x94/g, '\u2014')
    .replace(/\xc3\xa2\xc2\x80\xc2\x93/g, '\u2013')
    .replace(/\xc3\xa2\xc2\x80\xc2\x99/g, '\u2019')
    .replace(/\xc3\xa2\xc2\x80\xc2\x98/g, '\u2018')
    .replace(/\xc3\xa2\xc2\x80\xc2\x9c/g, '\u201c')
    .replace(/\xc3\xa2\xc2\x80\xc2\x9d/g, '\u201d')
    .replace(/\xc3\xa2\xc2\x80\xc2\xba/g, '\u203a')
    .replace(/\xc3\xa2\xc2\x86\xc2\x92/g, '\u2192')
    .replace(/\xc3\xa2\xc2\x86\xc2\x93/g, '\u2193')
    .replace(/\xc3\xa2\xc2\x86\xc2\x91/g, '\u2191')
    .replace(/\xc3\xa2\xc2\x82\xc2\xb9/g, '\u20b9')
    .replace(/\xc3\xa2\xc2\x80\xc2\xa6/g, '\u2026')
    .replace(/\xc3\x82\xc2\xa0/g, ' ')
    .replace(/\xc3\x82/g, '');
};

const T = {
  dark: { bg: '#000000', card: '#090b0f', text: '#e6edf3', sub: '#7d8590', border: '#30363d', accent: '#58a6ff', up: '#3fb950', down: '#f85149', hover: '#161b22', highlight: '#d2a8ff', selBg: '#1f2937', warn: '#d29922', info: '#58a6ff' },
  light: { bg: '#ffffff', card: '#f6f8fa', text: '#1f2328', sub: '#656d76', border: '#d0d7de', accent: '#0969da', up: '#1a7f37', down: '#cf222e', hover: '#f3f4f6', highlight: '#8250df', selBg: '#e0e7ff', warn: '#9a6700', info: '#0969da' },
};

const parseAnnDate = (str) => {
  if (!str) return new Date();
  const dateStr = str.split(' ')[0];
  const monthNames = { "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5, "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11 };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date();
  return new Date(parseInt(parts[2]), monthNames[parts[1]], parseInt(parts[0]));
};

const CATEGORIES = {
  Earnings: ['earning', 'result', 'financial', 'q1', 'q2', 'q3', 'q4', 'profit', 'loss', 'revenue', 'income'],
  'Board Meeting': ['board meeting', 'agm', 'egm', 'director', 'board of directors'],
  Dividend: ['dividend', 'interim dividend', 'final dividend'],
  Acquisition: ['acquisition', 'merger', 'amalgamation', 'stake', 'takeover', 'buyout'],
  'Promoter Activity': ['promoter', 'pledg', 'insider', 'shareholding pattern'],
  'Fund Raising': ['fund rais', 'ipo', 'fpo', 'rights issue', 'qip', 'preferential', 'warrant'],
  'Debt Warning': ['debt', 'default', 'npa', 'downgrade', 'credit rating'],
  'Legal Risk': ['legal', 'litigation', 'penalty', 'sebi', 'fraud', 'investigation', 'order'],
  Expansion: ['expansion', 'capex', 'new plant', 'capacity', 'greenfield', 'brownfield', 'joint venture'],
  'Compliance Update': ['compliance', 'regulation', 'listing', 'disclosure', 'governance', 'annual report'],
  'Split / Bonus': ['split', 'bonus'],
};

const categorize = (title) => {
  const t = title.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => t.includes(k))) return cat;
  }
  return 'General';
};

const catColor = (cat, c) => {
  const map = { Earnings: c.up, Dividend: c.up, Expansion: c.up, 'Fund Raising': c.accent, Acquisition: c.accent, 'Board Meeting': c.highlight, 'Promoter Activity': c.warn, 'Debt Warning': c.down, 'Legal Risk': c.down, 'Compliance Update': c.sub, 'Split / Bonus': c.up };
  return map[cat] || c.sub;
};

const priorityColor = (p, c) => ({ Critical: c.down, High: '#e3b341', Medium: c.accent, Low: c.sub }[p] || c.sub);
const sentimentIcon = (s) => s === 'bullish' ? '↑' : s === 'bearish' ? '↓' : '→';

export default function Intelligence() {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const c = dark ? T.dark : T.light;

  const { 
    announcements, 
    watchlist: watchlistData, 
    loading: contextLoading,
    fetchAnnouncements 
  } = useMarket();

  const [selectedAnn, setSelectedAnn] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('7D');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [rangeSummary, setRangeSummary] = useState('');
  const [loadingRangeSummary, setLoadingRangeSummary] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertModal, setAlertModal] = useState(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDir, setAlertDir] = useState('above');
  const [compareData, setCompareData] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  // Convert watchlist objects to simple symbols list for the dropdown
  const watchlistSymbols = useMemo(() => {
    return watchlistData.map(s => ({ id: s.id, symbol: s.symbol }));
  }, [watchlistData]);

  useEffect(() => {
    if (announcements.length > 0 && !selectedAnn) {
      setSelectedAnn(announcements[0]);
    }
  }, [announcements, selectedAnn]);

  const fetchSummary = async (id) => {
    setLoadingSummary(true); setSummary(null);
    try { const res = await announcementsAPI.getSummary(id); setSummary(res.data); }
    catch (e) { setSummary({ summary: 'Failed to generate summary.', sentiment: 'neutral', impact_score: 5, priority: 'Medium', why_it_matters: [], market_reaction: '→ Neutral / Wait & Watch', investor_action: [] }); }
    finally { setLoadingSummary(false); }
  };

  useEffect(() => { if (selectedAnn) fetchSummary(selectedAnn.id); }, [selectedAnn]);

  const handleSync = async () => {
    setIsSyncing(true);
    try { 
      await announcementsAPI.sync(); 
      // Give it a moment for scraper to run, then refresh context
      setTimeout(fetchAnnouncements, 2000); 
    }
    catch (e) { alert("Sync failed"); }
    finally { setIsSyncing(false); }
  };

  const loading = contextLoading.announcements;

  const handleAddAlert = async () => {
    if (!alertModal || !alertPrice) return;
    try { await alertsAPI.create({ symbol: alertModal, target_price: parseFloat(alertPrice), direction: alertDir }); alert(`Alert set for ${alertModal}`); setAlertModal(null); setAlertPrice(''); }
    catch (e) { alert('Failed to create alert'); }
  };

  const handlePin = async (symbol) => {
    try { await watchlistAPI.togglePin(symbol); alert(`${symbol} pin toggled`); }
    catch (e) { alert('Failed'); }
  };

  const handleCompare = async () => {
    if (!selectedAnn) return;
    setLoadingCompare(true);
    setCompareData(null);
    try {
      const res = await announcementsAPI.getComparison(selectedAnn.id);
      setCompareData(res.data);
    } catch (e) {
      alert('Failed to generate comparison');
    } finally {
      setLoadingCompare(false);
    }
  };

  const presentDate = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    return announcements.filter(a => {
      const matchSymbol = filterSymbol === 'ALL' || a.symbol === filterSymbol;
      const matchSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      let matchDate = true;
      const annDate = parseAnnDate(a.announcement_date);
      const pd = new Date(presentDate); pd.setHours(0,0,0,0); annDate.setHours(0,0,0,0);
      const diffDays = Math.ceil(Math.abs(pd - annDate) / 86400000);
      if (dateRange === 'Today') matchDate = diffDays === 0;
      else if (dateRange === 'Yesterday') matchDate = diffDays === 1;
      else if (dateRange === '7D') matchDate = diffDays <= 7;
      else if (dateRange === '30D') matchDate = diffDays <= 30;
      else if (dateRange === 'Custom' && customRange.start && customRange.end) {
        const sd = new Date(customRange.start); sd.setHours(0,0,0,0);
        const ed = new Date(customRange.end); ed.setHours(0,0,0,0);
        matchDate = annDate >= sd && annDate <= ed;
      }
      return matchSymbol && matchSearch && matchDate;
    });
  }, [announcements, filterSymbol, searchTerm, dateRange, customRange, presentDate]);

  const insights = useMemo(() => {
    if (filtered.length === 0) return null;
    const counts = {}, catCounts = {}; let highPriority = 0; const affected = new Set();
    filtered.forEach(a => {
      counts[a.symbol] = (counts[a.symbol] || 0) + 1; affected.add(a.symbol);
      const cat = categorize(a.title); catCounts[cat] = (catCounts[cat] || 0) + 1;
      if (['Earnings', 'Dividend', 'Acquisition'].includes(cat)) highPriority++;
    });
    const mostActive = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0];
    return { total: filtered.length, mostActive, topCat, highPriority, affected: affected.size };
  }, [filtered]);

  const timeline = useMemo(() => {
    const groups = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Older': [] };
    filtered.forEach(a => {
      const annDate = parseAnnDate(a.announcement_date);
      const pd = new Date(presentDate); pd.setHours(0,0,0,0); annDate.setHours(0,0,0,0);
      const diffDays = Math.ceil(Math.abs(pd - annDate) / 86400000);
      if (diffDays === 0) groups['Today'].push(a);
      else if (diffDays === 1) groups['Yesterday'].push(a);
      else if (diffDays <= 7) groups['This Week'].push(a);
      else groups['Older'].push(a);
    });
    return groups;
  }, [filtered, presentDate]);

  useEffect(() => {
    if (filtered.length > 0 && dateRange !== 'Custom') generateRangeSummary();
  }, [dateRange, filterSymbol]);

  const generateRangeSummary = async () => {
    setLoadingRangeSummary(true); setRangeSummary('');
    try { const res = await announcementsAPI.getRangeSummary(filtered.slice(0, 30)); setRangeSummary(res.data.summary); }
    catch (e) { setRangeSummary('AI Summary unavailable.'); }
    finally { setLoadingRangeSummary(false); }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
      <Activity size={40} color={c.accent} className="animate-pulse" />
    </div>
  );

  const s = summary || {};
  const impactScore = s.impact_score ?? 5;
  const priority = s.priority || 'Medium';
  const whyMatters = (s.why_it_matters || []).map(cleanText);
  const marketReaction = cleanText(s.market_reaction || '→ Neutral / Wait & Watch');
  const investorActions = (s.investor_action || []).map(cleanText);
  const sentiment = s.sentiment || 'neutral';
  const sentColor = sentiment === 'bullish' ? c.up : sentiment === 'bearish' ? c.down : c.sub;

  return (
    <div style={{ height: '100vh', background: c.bg, display: 'flex', flexDirection: 'column', color: c.text }}>

      {/* HEADER */}
      <div style={{ padding: '15px 25px', borderBottom: `1px solid ${c.border}`, background: dark ? '#0a0d14' : '#f8fafd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: `linear-gradient(135deg, ${c.accent}, #8250df)`, padding: '8px', borderRadius: '8px' }}><Brain size={20} color="white" /></div>
            <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '0.5px' }}>INTEL TERMINAL</span>
          </div>
          <div style={{ width: '1px', height: '24px', background: c.border }}></div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {['Today', 'Yesterday', '7D', '30D', 'Custom'].map(r => (
              <button key={r} onClick={() => setDateRange(r)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', border: 'none', background: dateRange === r ? c.accent : 'transparent', color: dateRange === r ? '#fff' : c.sub, cursor: 'pointer', transition: 'all 0.2s' }}>{r.toUpperCase()}</button>
            ))}
            {dateRange === 'Custom' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '10px' }}>
                <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.card, color: c.text, fontSize: '13px', outline: 'none', fontFamily: 'monospace' }} />
                <span style={{ color: c.sub, fontSize: '14px' }}>-</span>
                <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.card, color: c.text, fontSize: '13px', outline: 'none', fontFamily: 'monospace' }} />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <select value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.card, color: c.text, fontSize: '13px', fontWeight: '700', outline: 'none', cursor: 'pointer' }}>
            <option value="ALL">ALL ASSETS</option>
            {watchlistSymbols.map(s => <option key={s.id} value={s.symbol}>{s.symbol}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: c.sub }} />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.card, color: c.text, fontSize: '13px', width: '200px', outline: 'none' }} />
          </div>
          <button onClick={handleSync} disabled={isSyncing} style={{ background: `${c.accent}15`, color: c.accent, border: `1px solid ${c.accent}30`, borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'SYNCING' : 'SYNC'}
          </button>
        </div>
      </div>

      {/* AI SUMMARY BAR */}
      <div style={{ padding: '12px 25px', borderBottom: `1px solid ${c.border}`, background: dark ? '#05070a' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '44px' }}>
        <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: '900', color: '#fff', background: `linear-gradient(90deg, ${c.up}, ${c.accent})`, padding: '4px 12px', borderRadius: '50px', whiteSpace: 'nowrap' }}>✨ AI ANALYST</div>
          {loadingRangeSummary ? (
            <div style={{ color: c.sub, fontSize: '13px', fontWeight: '600' }} className="animate-pulse">Synthesizing market context...</div>
          ) : (
            <div style={{ color: c.text, fontSize: '15px', fontWeight: '500', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
              {cleanText(rangeSummary || "No major market-moving announcements found for selected date range.")}
            </div>
          )}
        </div>
        <button onClick={() => setShowInsights(!showInsights)} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, padding: '6px 14px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '15px', whiteSpace: 'nowrap' }}>
          {showInsights ? <ChevronUp size={14} /> : <ChevronDown size={14} />} INSIGHTS
        </button>
      </div>

      {/* STATS CARDS */}
      {showInsights && insights && (
        <div style={{ padding: '12px 25px', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: '12px', background: dark ? '#0d1117' : '#f0f4f8' }}>
          {[
            { label: 'TOTAL', value: insights.total, color: c.text },
            { label: 'MOST ACTIVE', value: insights.mostActive, color: c.accent },
            { label: 'TOP CATEGORY', value: insights.topCat, color: c.highlight },
            { label: 'HIGH PRIORITY', value: insights.highPriority, color: c.down },
            { label: 'AFFECTED', value: insights.affected, color: c.up },
          ].map((stat, i) => (
            <div key={i} style={{ flex: 1, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: '6px', background: c.card }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: c.sub, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: stat.color, fontFamily: 'monospace' }}>{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* DUAL PANE */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT: TIMELINE */}
        <div style={{ width: '32%', minWidth: '350px', borderRight: `1px solid ${c.border}`, overflowY: 'auto', background: dark ? '#05070a' : '#f8fafd' }}>
          {filtered.length > 0 ? (
            ['Today', 'Yesterday', 'This Week', 'Older'].map(group => (
              timeline[group].length > 0 && (
                <div key={group}>
                  <div style={{ padding: '8px 20px', background: dark ? '#0d1117' : '#e6edf5', borderBottom: `1px solid ${c.border}`, borderTop: group !== 'Today' ? `1px solid ${c.border}` : 'none' }}>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: c.sub, textTransform: 'uppercase', letterSpacing: '1.2px' }}>{group}</span>
                  </div>
                  {timeline[group].map((ann) => {
                    const cat = categorize(ann.title);
                    const cc = catColor(cat, c);
                    const isSel = selectedAnn?.id === ann.id;
                    return (
                      <div key={ann.id} onClick={() => setSelectedAnn(ann)} style={{ padding: '15px 25px', cursor: 'pointer', borderBottom: `1px solid ${c.border}40`, background: isSel ? (dark ? '#1f293780' : '#e0e7ff80') : 'transparent', borderLeft: isSel ? `3px solid ${c.accent}` : '3px solid transparent', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'all 0.1s' }}
                        onMouseOver={e => !isSel && (e.currentTarget.style.background = dark ? '#0d111750' : '#f0f4f850')}
                        onMouseOut={e => !isSel && (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ background: c.text, color: c.bg, fontWeight: '900', fontSize: '12px', padding: '3px 8px', borderRadius: '6px' }}>{ann.symbol}</span>
                            <span style={{ color: cc, fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', background: `${cc}15`, padding: '3px 8px', borderRadius: '6px' }}>{cat}</span>
                          </div>
                          <span style={{ color: c.sub, fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>{ann.announcement_date.split('-').slice(0, 2).join('-')}</span>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: isSel ? '800' : '600', color: isSel ? c.text : c.sub, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ann.title}</div>
                      </div>
                    );
                  })}
                </div>
              )
            ))
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: c.sub, fontSize: '14px', fontWeight: '700' }}>No major market-moving announcements found for selected date range.</div>
          )}
        </div>

        {/* RIGHT: ANALYSIS */}
        <div style={{ width: '68%', overflowY: 'auto', padding: '30px 45px', background: c.bg }}>
          {selectedAnn ? (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>

              {/* TITLE BAR */}
              <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ background: c.text, color: c.bg, padding: '6px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: '900' }}>{selectedAnn.symbol}</span>
                  {(() => { const cat = categorize(selectedAnn.title); const cc = catColor(cat, c); return (
                    <span style={{ border: `1px solid ${cc}40`, color: cc, padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: `${cc}10` }}>{cat.toUpperCase()}</span>
                  ); })()}
                  {!loadingSummary && summary && (
                    <>
                      <span style={{ background: `${sentColor}15`, color: sentColor, padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {sentiment === 'bullish' ? <TrendingUp size={14}/> : sentiment === 'bearish' ? <TrendingDown size={14}/> : <AlertCircle size={14}/>} {sentiment.toUpperCase()}
                      </span>
                      <span style={{ background: `${priorityColor(priority, c)}15`, color: priorityColor(priority, c), padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '900' }}>{priority.toUpperCase()} IMPACT</span>
                      <span style={{ background: dark ? '#1c2333' : '#e8ecf1', color: c.text, padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '900', fontFamily: 'monospace' }}>{impactScore.toFixed(1)}/10</span>
                    </>
                  )}
                  <span style={{ color: c.sub, fontSize: '12px', fontWeight: '700', marginLeft: 'auto', fontFamily: 'monospace' }}>{selectedAnn.announcement_date}</span>
                </div>
                <h2 style={{ fontSize: '26px', fontWeight: '900', color: c.text, lineHeight: '1.4', margin: 0 }}>{selectedAnn.title}</h2>
              </div>

              {/* AI ANALYSIS CARD */}
              <div style={{ borderRadius: '24px', padding: '35px', marginBottom: '25px', background: dark ? '#0a0d1480' : '#fff', border: `1px solid ${c.border}60`, backdropFilter: 'blur(10px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '15px', borderBottom: `1px solid ${c.border}40` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: `${c.accent}22`, padding: '8px', borderRadius: '8px' }}><Brain size={20} color={c.accent} /></div>
                    <span style={{ fontWeight: '900', fontSize: '20px', color: c.text, letterSpacing: '0.5px' }}>AI DOCUMENT ANALYSIS</span>
                  </div>
                </div>

                {loadingSummary ? (
                  <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', gap: '15px', color: c.sub }}>
                    <RefreshCw size={24} className="animate-spin" color={c.accent} /> <span style={{ fontSize: '15px', fontWeight: '700' }}>Deep analyzing document structure...</span>
                  </div>
                ) : (
                  <div>
                    {/* KEY INSIGHT */}
                    <div style={{ marginBottom: '30px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '900', color: c.accent, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={14}/> Key Insight</div>
                      <div style={{ color: c.text, fontSize: '18px', lineHeight: '1.7', fontWeight: '500' }}>{cleanText(s.summary || 'No summary available.')}</div>
                    </div>

                    {/* MARKET REACTION */}
                    {marketReaction && (
                      <div style={{ marginBottom: '30px', padding: '20px 25px', borderRadius: '16px', border: `1px solid ${marketReaction.includes('↑') ? c.up : marketReaction.includes('↓') ? c.down : c.accent}30`, background: `${marketReaction.includes('↑') ? c.up : marketReaction.includes('↓') ? c.down : c.accent}08` }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: c.sub, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>Expected Market Reaction</div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: marketReaction.includes('↑') ? c.up : marketReaction.includes('↓') ? c.down : c.accent }}>{marketReaction}</div>
                      </div>
                    )}

                    {/* WHY THIS MATTERS */}
                    {whyMatters.length > 0 && (
                      <div style={{ marginBottom: '30px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: c.highlight, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><Eye size={14}/> Why This Matters</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                          {whyMatters.map((item, i) => {
                            const isRisk = /risk|debt|legal|concern|negative|penalty/i.test(item);
                            const isOpp = /revenue|growth|expansion|positive|profit|dividend/i.test(item);
                            const bulletColor = isRisk ? c.down : isOpp ? c.up : c.warn;
                            return (
                              <div key={i} style={{ padding: '18px', borderRadius: '16px', border: `1px solid ${bulletColor}20`, background: `${bulletColor}08`, fontSize: '15px', lineHeight: '1.6', fontWeight: '600', color: c.text }}>
                                <span style={{ color: bulletColor, fontWeight: '900' }}>●</span> {item}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* INVESTOR ACTION */}
                    {investorActions.length > 0 && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: c.up, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={14}/> Suggested Investor Action</div>
                        {investorActions.map((a, i) => (
                          <div key={i} style={{ padding: '15px 20px', marginBottom: '12px', borderRadius: '12px', background: `${c.up}08`, border: `1px solid ${c.up}20`, fontSize: '16px', fontWeight: '600', color: c.text, display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.up }}></div> {a}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* QUICK ACTIONS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[
                  { icon: <BarChart3 size={18}/>, label: 'Technical Chart', color: c.accent, action: () => navigate('/watchlist') },
                  { icon: <Bell size={18}/>, label: 'Price Alert', color: c.warn, action: () => { setAlertModal(selectedAnn.symbol); setAlertPrice(''); } },
                  { icon: <Pin size={18}/>, label: 'Pin to Watchlist', color: c.highlight, action: () => handlePin(selectedAnn.symbol) },
                  { icon: <GitCompare size={18}/>, label: loadingCompare ? 'Analyzing...' : 'Compare Filing', color: c.sub, action: handleCompare },
                ].map((btn, i) => (
                  <button key={i} onClick={btn.action} style={{ background: `${btn.color}10`, border: `1px solid ${btn.color}25`, color: btn.color, borderRadius: '12px', padding: '15px 10px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                    onMouseOver={e => { e.currentTarget.style.background = `${btn.color}20`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = `${btn.color}10`; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    {btn.icon} {btn.label}
                  </button>
                ))}
              </div>

              {/* SOURCE + PDF */}
              <a href={selectedAnn.source_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ border: `1px solid ${c.border}`, borderRadius: '16px', padding: '20px 25px', display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer', background: c.card, transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = 'translateY(0)'; }}>
                  <div style={{ background: '#f8514915', padding: '12px', borderRadius: '12px' }}><FileText size={24} color="#f85149" /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '900', color: c.text, fontSize: '18px' }}>View Official PDF Source</div>
                    <div style={{ fontSize: '13px', color: c.sub, fontWeight: '600', marginTop: '4px' }}>Original Exchange Filing Document</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Shield size={14} color={c.up} />
                      <span style={{ fontSize: '11px', fontWeight: '900', color: c.up }}>NSE VERIFIED</span>
                    </div>
                    <span style={{ background: `${c.up}15`, color: c.up, fontSize: '11px', fontWeight: '900', padding: '4px 10px', borderRadius: '6px' }}>HIGH RELIABILITY</span>
                    <ExternalLink size={20} color={c.sub} />
                  </div>
                </div>
              </a>

            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: c.sub }}>
              <div style={{ background: `${c.sub}15`, padding: '20px', borderRadius: '50%', marginBottom: '20px' }}><Brain size={40} /></div>
              <p style={{ fontWeight: '800', fontSize: '16px', color: c.text }}>Select a Filing</p>
              <p style={{ fontWeight: '600', fontSize: '13px', marginTop: '4px' }}>Read deep AI analysis on the selected market event.</p>
            </div>
          )}
        </div>
      </div>

      {/* ALERT MODAL */}
      {alertModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAlertModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '24px', width: '340px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900' }}>Set Price Alert — {alertModal}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="number" placeholder="Target Price (₹)" value={alertPrice} onChange={e => setAlertPrice(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, fontSize: '14px', outline: 'none' }} />
              <select value={alertDir} onChange={e => setAlertDir(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, fontSize: '14px', outline: 'none' }}>
                <option value="above">Alert when ABOVE</option>
                <option value="below">Alert when BELOW</option>
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setAlertModal(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: 'transparent', color: c.text, fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAddAlert} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontWeight: '800', cursor: 'pointer' }}>Set Alert</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON MODAL */}
      {(compareData || loadingCompare) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCompareData(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: dark ? '#0a0d14' : '#fff', border: `1px solid ${c.border}`, borderRadius: '24px', padding: '40px', width: '600px', maxWidth: '90vw', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: `${c.highlight}20`, padding: '10px', borderRadius: '12px' }}><GitCompare size={24} color={c.highlight} /></div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900' }}>Filing Delta Analysis</h2>
              </div>
              <button onClick={() => setCompareData(null)} style={{ background: 'transparent', border: 'none', color: c.sub, cursor: 'pointer', fontSize: '24px' }}>×</button>
            </div>

            {loadingCompare ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <RefreshCw size={40} className="animate-spin" color={c.highlight} style={{ marginBottom: '20px', opacity: 0.5 }} />
                <p style={{ fontWeight: '700', color: c.text, fontSize: '18px', letterSpacing: '-0.2px' }}>Analyzing corporate trajectory...</p>
                <p style={{ color: c.sub, marginTop: '8px', fontSize: '14px' }}>AI is contextualizing historical filing data.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: c.sub, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', opacity: 0.7 }}>Strategic Delta</div>
                  <p style={{ margin: 0, fontSize: '17px', lineHeight: '1.7', color: c.text, fontWeight: '400' }}>{compareData.delta}</p>
                </div>

                {compareData.comparison_points && compareData.comparison_points.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: c.sub, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '15px', opacity: 0.7 }}>Key Shifts Identified</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {compareData.comparison_points.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', padding: '15px 0', borderBottom: i < compareData.comparison_points.length - 1 ? `1px solid ${c.border}40` : 'none', fontSize: '15px', fontWeight: '500', color: c.text }}>
                          <div style={{ color: c.highlight, fontWeight: '900', marginTop: '2px' }}>→</div>
                          <span style={{ flex: 1, lineHeight: '1.5' }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {compareData.sentiment_shift && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 25px', borderRadius: '16px', background: dark ? '#1c233350' : '#f0f4f8', border: `1px solid ${c.border}40` }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: c.sub, textTransform: 'uppercase', letterSpacing: '1px' }}>Sentiment Trajectory</span>
                    <span style={{ fontSize: '15px', fontWeight: '900', color: c.accent, letterSpacing: '0.5px' }}>{compareData.sentiment_shift.toUpperCase()}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                  <button onClick={() => setCompareData(null)} style={{ padding: '12px 35px', borderRadius: '50px', border: `1.5px solid ${c.highlight}`, background: 'transparent', color: c.highlight, fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.background = c.highlight; e.currentTarget.style.color = '#fff'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.highlight; }}>
                    DISMISS ANALYSIS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
