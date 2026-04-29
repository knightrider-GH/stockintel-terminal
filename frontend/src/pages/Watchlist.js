import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { watchlistAPI, stocksAPI, announcementsAPI } from '../services/api';
import { useTheme } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Trash2, TrendingUp, TrendingDown, Bell,
  Activity, Info, X, Layers, Star, ShieldAlert,
  ChevronDown, Zap, Award, Shield, PieChart, Globe, Briefcase, 
  ArrowUpCircle, ArrowDownCircle, Target, Check, BarChart3, Maximize2
} from 'lucide-react';
import Chart from 'react-apexcharts';
import Sparkline from '../components/Sparkline';
import { useMarket } from '../context/MarketContext';
import axios from 'axios';

const T = {
  dark: {
    bg: '#05070a',
    card: '#0d1117',
    text: '#f0f6fc',
    sub: '#8b949e',
    border: '#30363d',
    accent: '#58a6ff',
    up: '#3fb950',
    down: '#f85149',
    hover: '#161b22',
    gold: '#f2cc60'
  },
  light: {
    bg: '#f6f8fa',
    card: '#ffffff',
    text: '#1f2328',
    sub: '#656d76',
    border: '#d0d7de',
    accent: '#0969da',
    up: '#1a7f37',
    down: '#cf222e',
    hover: '#f3f4f6',
    gold: '#b8860b'
  },
};

const MARKET_CATEGORIES = [
  { id: 'most-active', label: 'Most Active', icon: <Activity size={16} /> },
  { id: 'day-gainers', label: 'Day Gainers', icon: <ArrowUpCircle size={16} /> },
  { id: 'day-losers', label: 'Day Losers', icon: <ArrowDownCircle size={16} /> },
  { id: 'trending', label: 'Trending', icon: <Zap size={16} /> },
  { id: 'high-dividend', label: 'Highest Dividend', icon: <Award size={16} /> },
  { id: 'large-cap', label: 'Large Cap', icon: <Shield size={16} /> },
  { id: 'small-cap', label: 'Small Cap', icon: <Target size={16} /> },
  { id: 'etfs', label: 'ETFs', icon: <Layers size={16} /> },
  { id: 'indices', label: 'Indices', icon: <Globe size={16} /> },
];

export default function Watchlist() {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const c = dark ? T.dark : T.light;

  const { 
    watchlist, 
    loading: contextLoading,
    fetchWatchlist // still keep it for actions like add/remove
  } = useMarket();

  const [searchTerm, setSearchTerm] = useState('');
  const [liveSuggestions, setLiveSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Market Explorer State
  const [showStocksMenu, setShowStocksMenu] = useState(false);
  const [marketCategory, setMarketCategory] = useState('most-active');
  const [marketData, setMarketData] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);

  // Side Panel State (RESTORED)
  const [intelStock, setIntelStock] = useState(null);
  const [intelData, setIntelData] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelNews, setIntelNews] = useState(null);

  // Chart Modal State
  const [selectedStock, setSelectedStock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('1M');
  const [chartType, setChartType] = useState('mountain'); // line | candle | mountain
  const [showVolume, setShowVolume] = useState(true);
  const [chartMeta, setChartMeta] = useState(null);

  const PERIOD_MAP = {
    '1D': { period: '1d', interval: '5m' },
    '5D': { period: '5d', interval: '15m' },
    '1M': { period: '1mo', interval: '1h' },
    '6M': { period: '6mo', interval: '1d' },
    'YTD': { period: 'ytd', interval: '1d' },
    '1Y': { period: '1y', interval: '1d' },
    '5Y': { period: '5y', interval: '1wk' },
    'All': { period: 'max', interval: '1mo' },
  };

  const fetchHistory = React.useCallback(async (symbol, periodLabel) => {
    setChartLoading(true);
    const { period, interval } = PERIOD_MAP[periodLabel];
    try {
      const res = await API.get(`/stocks/${symbol}/history`, { params: { period, interval } });
      setChartData(res.data.history || []);
      setChartMeta(res.data);
    } catch (e) {
      console.error("History fetch failed:", e);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStock) {
      fetchHistory(selectedStock.symbol, chartPeriod);
    }
  }, [selectedStock, chartPeriod, fetchHistory]);

  useEffect(() => {
    if (showStocksMenu) fetchMarketData(marketCategory);
  }, [marketCategory, showStocksMenu]);

  // Pre-fetch default market data on mount
  useEffect(() => {
    fetchMarketData('most-active');
    fetchMarketData('day-gainers');
    fetchMarketData('day-losers');
  }, []);

  const fetchMarketData = async (cat) => {
    setMarketLoading(true);
    try {
      const res = await stocksAPI.getMarketList(cat);
      setMarketData(res.data || []);
    } catch (e) { console.error(e); }
    finally { setMarketLoading(false); }
  };

  const isAdded = (symbol) => watchlist.some(s => s.symbol === symbol);

  const loading = contextLoading.watchlist;



  const togglePin = async (e, symbol) => {
    e.stopPropagation();
    try { await watchlistAPI.togglePin(symbol); fetchWatchlist(); } catch (e) { console.error(e); }
  };

  const openIntel = async (stock) => {
    setIntelStock(stock);
    setIntelLoading(true);
    setIntelData(null);
    setIntelNews(null);
    try {
      const [details, news] = await Promise.all([
        stocksAPI.getDetails(stock.symbol),
        announcementsAPI.get()
      ]);
      setIntelData(details.data);
      setIntelNews(news.data?.filter(n => n.symbol === stock.symbol)[0]);
    } catch (e) { console.error("Intel fetch failed", e); } finally { setIntelLoading(false); }
  };

  const performance = useMemo(() => {
    if (!watchlist.length) return { gain: 0, pct: 0 };
    const totalGain = watchlist.reduce((acc, s) => acc + ((s.price || 0) * (s.change || 0) / 100), 0);
    const avgPct = watchlist.reduce((acc, s) => acc + (s.change || 0), 0) / watchlist.length;
    return { gain: totalGain.toFixed(2), pct: avgPct.toFixed(2) };
  }, [watchlist]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      const query = searchTerm.trim();
      if (!query) { setLiveSuggestions([]); setShowDropdown(false); return; }
      try {
        const res = await stocksAPI.search(query);
        setLiveSuggestions(res.data);
        setShowDropdown(true);
      } catch (e) { console.error("Search failed", e); }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleAddStock = async (symbol) => {
    try { await watchlistAPI.add(symbol); fetchWatchlist(); setSearchTerm(''); setShowDropdown(false); } catch (e) { alert("Failed to add stock"); }
  };

  const handleRemoveStock = async (e, symbol) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${symbol}?`)) return;
    try { await watchlistAPI.remove(symbol); fetchWatchlist(); if (intelStock?.symbol === symbol) setIntelStock(null); } catch (e) { alert("Failed to remove"); }
  };

  if (loading && !watchlist.length) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
        <Activity size={40} color={c.accent} className="animate-pulse" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, padding: '25px', color: c.text, display: 'flex', gap: '25px', overflow: 'hidden' }}>
      {/* MAIN FEED */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* TOP STATS */}
        <div style={{ background: `linear-gradient(135deg, ${c.card}, ${c.bg})`, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: '800', color: c.sub, textTransform: 'uppercase', marginBottom: '5px' }}>Today's Watchlist Performance</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px' }}>
              <h2 style={{ fontSize: '38px', fontWeight: '900', margin: 0, color: performance.gain >= 0 ? c.up : c.down }}>
                {performance.gain >= 0 ? '+' : ''}₹{performance.gain}
              </h2>
              <span style={{ fontSize: '20px', fontWeight: '800', color: performance.gain >= 0 ? c.up : c.down, background: performance.gain >= 0 ? `${c.up}15` : `${c.down}15`, padding: '4px 12px', borderRadius: '8px' }}>
                {performance.gain >= 0 ? '↑' : '↓'} {Math.abs(performance.pct)}%
              </span>
            </div>
          </div>
          <Activity size={32} color={c.accent} style={{ opacity: 0.3 }} />
        </div>

        {/* SEARCH & ACTIONS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', gap: '15px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: c.sub }} />
            <input
              type="text" placeholder="Search and add to terminal..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              onFocus={() => setShowDropdown(true)}
              style={{ width: '100%', height: '50px', padding: '12px 15px 12px 45px', borderRadius: '12px', border: `1px solid ${c.border}`, background: c.card, color: c.text, fontSize: '14px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }}
            />
            <AnimatePresence>
              {showDropdown && liveSuggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', overflow: 'hidden', zIndex: 100, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                  {liveSuggestions.map((s, i) => (
                    <div key={i} onClick={() => handleAddStock(s.symbol)} style={{ padding: '12px 15px', borderBottom: `1px solid ${c.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseOver={e => e.currentTarget.style.background = c.hover} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '14px' }}>{s.symbol}</div>
                        <div style={{ fontSize: '11px', color: c.sub }}>{s.name}</div>
                      </div>
                      <Plus size={16} color={c.accent} />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ position: 'relative', flex: 1 }}>
            <button 
              onClick={() => setShowStocksMenu(!showStocksMenu)}
              style={{ background: showStocksMenu ? c.accent : c.card, border: `1px solid ${c.border}`, color: showStocksMenu ? '#fff' : c.text, padding: '12px 25px', borderRadius: '12px', fontSize: '14px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: showStocksMenu ? `0 0 20px ${c.accent}40` : 'none', height: '50px', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
            >
              STOCKS <ChevronDown size={16} style={{ transform: showStocksMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          </div>

          <button onClick={() => navigate('/intelligence')} style={{ background: `${c.accent}15`, border: `1px solid ${c.accent}40`, color: c.accent, padding: '12px 25px', borderRadius: '12px', fontSize: '14px', fontWeight: '900', cursor: 'pointer', whiteSpace: 'nowrap', height: '50px', boxSizing: 'border-box' }}>
            MASTER FEED
          </button>
        </div>

        {/* MARKET EXPLORER PANEL (FULL WIDTH) */}
        <AnimatePresence>
          {showStocksMenu && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ marginBottom: '30px', background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
            >
              {/* Category Tabs */}
              <div style={{ display: 'flex', gap: '5px', padding: '15px 20px', borderBottom: `1px solid ${c.border}`, background: dark ? '#0a0d14' : '#f8fafd', overflowX: 'auto' }}>
                {MARKET_CATEGORIES.map(cat => (
                  <button 
                    key={cat.id} 
                    onClick={() => setMarketCategory(cat.id)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: marketCategory === cat.id ? c.accent : 'transparent', color: marketCategory === cat.id ? '#fff' : c.sub, fontSize: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                  >
                    {cat.icon} {cat.label.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Data Rows */}
              <div style={{ padding: '10px 0' }}>
                {marketLoading ? (
                  <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={24} color={c.accent} className="animate-spin" />
                  </div>
                ) : marketData.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {marketData.map((s, i) => {
                      const isUp = s.change >= 0;
                      const added = isAdded(s.symbol);
                      return (
                        <div key={i} style={{ padding: '15px 20px', borderBottom: i === marketData.length - 1 ? 'none' : `1px solid ${c.border}50`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background = c.hover} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                            <div style={{ background: `${isUp ? c.up : c.down}15`, color: isUp ? c.up : c.down, width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px' }}>{s.symbol.slice(0, 2)}</div>
                            <div style={{ width: '200px' }}>
                              <div style={{ fontWeight: '900', fontSize: '18px' }}>{s.symbol}</div>
                              <div style={{ fontSize: '12px', color: c.sub, fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                            </div>
                            <div style={{ width: '120px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '900', color: c.sub }}>PRICE</div>
                              <div style={{ fontWeight: '900', fontSize: '18px' }}>₹{s.price.toLocaleString('en-IN')}</div>
                            </div>
                            <div style={{ width: '120px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '900', color: c.sub }}>CHANGE</div>
                              <div style={{ color: isUp ? c.up : c.down, fontWeight: '900', fontSize: '17px' }}>{isUp ? '+' : ''}{s.change}%</div>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                              onClick={() => { setSelectedStock({ symbol: s.symbol, name: s.name }); }}
                              style={{ padding: '8px 15px', borderRadius: '8px', border: `1px solid ${c.border}`, background: 'transparent', color: c.sub, fontSize: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <BarChart3 size={14} /> Chart
                            </button>
                            <button 
                              onClick={() => alert(`Price alert setup for ${s.symbol}`)}
                              style={{ padding: '8px 15px', borderRadius: '8px', border: `1px solid ${c.border}`, background: 'transparent', color: c.sub, fontSize: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Bell size={14} /> Alert
                            </button>
                            <button 
                              disabled={added}
                              onClick={() => handleAddStock(s.symbol)}
                              style={{ minWidth: '130px', padding: '8px 15px', borderRadius: '8px', border: `1px solid ${added ? c.up : c.accent}`, background: added ? `${c.up}10` : c.accent, color: added ? c.up : '#fff', fontSize: '12px', fontWeight: '900', cursor: added ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                            >
                              {added ? <Check size={14} /> : <Plus size={14} />} {added ? 'ADDED' : 'ADD TO TERMINAL'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: c.sub, fontSize: '13px', fontWeight: '700' }}>No market movers found for this category.</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WATCHLIST TABLE */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${c.border}`, background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '15px 20px', fontSize: '14px', fontWeight: '900', color: c.sub }}>ASSET</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: '900', color: c.sub }}>PRICE</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: '900', color: c.sub }}>CHANGE</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: '900', color: c.sub }}>7D TREND</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: '900', color: c.sub, textAlign: 'center' }}>CHART</th>
                <th style={{ padding: '15px 20px', fontSize: '12px', fontWeight: '900', color: c.sub, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((s, i) => {
                const isUp = (s.change || 0) >= 0;
                return (
                  <motion.tr
                    key={s.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => openIntel(s)}
                    style={{ borderBottom: `1px solid ${c.border}`, cursor: 'pointer', background: intelStock?.symbol === s.symbol ? `${c.accent}08` : 'transparent' }}
                    onMouseOver={e => e.currentTarget.style.background = c.hover}
                    onMouseOut={e => e.currentTarget.style.background = intelStock?.symbol === s.symbol ? `${c.accent}08` : 'transparent'}
                  >
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div onClick={(e) => togglePin(e, s.symbol)} style={{ cursor: 'pointer' }}>
                          <Star size={16} color={s.is_pinned ? c.gold : c.sub} fill={s.is_pinned ? c.gold : 'none'} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '900', fontSize: '18px' }}>{s.symbol}</div>
                          <div style={{ fontSize: '11px', color: c.sub, fontWeight: '700' }}>{s.exchange || 'NSE'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '15px 20px', fontFamily: 'monospace', fontWeight: '800', fontSize: '18px' }}>₹{typeof s.price === 'number' ? s.price.toLocaleString('en-IN') : 'N/A'}</td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ color: isUp ? c.up : c.down, fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {isUp ? '+' : ''}{s.change}%
                      </div>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <Sparkline data={s.sparkline} color={isUp ? c.up : c.down} width={100} height={30} />
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedStock(s); }} 
                        style={{ background: `${c.accent}15`, border: `1px solid ${c.accent}40`, color: c.accent, padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', transition: 'all 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = `${c.accent}30`}
                        onMouseOut={e => e.currentTarget.style.background = `${c.accent}15`}
                      >
                        <BarChart3 size={20} />
                      </button>
                    </td>
                    <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={(e) => handleRemoveStock(e, s.symbol)} 
                        style={{ background: `${c.down}15`, border: `1px solid ${c.down}40`, color: c.down, padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', transition: 'all 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = `${c.down}30`}
                        onMouseOut={e => e.currentTarget.style.background = `${c.down}15`}
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* INTELLIGENCE PANEL (RESTORED) */}
      <AnimatePresence>
        {intelStock && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ width: '400px', background: c.card, borderLeft: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.3)', zIndex: 1000 }}>
            <div style={{ padding: '25px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '26px', fontWeight: '900' }}>{intelStock.symbol}</h3>
                <p style={{ margin: 0, fontSize: '15px', color: c.sub, fontWeight: '700' }}>{intelData?.name || intelStock.company_name}</p>
              </div>
              <button onClick={() => setIntelStock(null)} style={{ background: 'transparent', border: 'none', color: c.sub, cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '25px' }}>
              {intelLoading ? (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={24} color={c.accent} className="animate-pulse" /></div>
              ) : intelData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div style={{ background: `${c.bg}80`, padding: '12px', borderRadius: '8px', border: `1px solid ${c.border}` }}>
                      <p style={{ fontSize: '13px', fontWeight: '900', color: c.sub, margin: '0 0 5px 0' }}>MARKET CAP</p>
                      <p style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>₹{(intelData.marketCap / 1e7).toFixed(0)} Cr</p>
                    </div>
                    <div style={{ background: `${c.bg}80`, padding: '12px', borderRadius: '8px', border: `1px solid ${c.border}` }}>
                      <p style={{ fontSize: '13px', fontWeight: '900', color: c.sub, margin: '0 0 5px 0' }}>P/E RATIO</p>
                      <p style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>{intelData.peRatio}</p>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '900', color: c.sub }}>DAY RANGE</span>
                      <span style={{ fontSize: '14px', fontWeight: '900', color: c.text }}>{intelData.dayLow} — {intelData.dayHigh}</span>
                    </div>
                    <div style={{ height: '4px', background: c.border, borderRadius: '2px', position: 'relative' }}>
                      <div style={{ position: 'absolute', height: '100%', left: '30%', right: '40%', background: c.accent, borderRadius: '2px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '900', color: c.sub }}>52W RANGE</span>
                      <span style={{ fontSize: '14px', fontWeight: '900', color: c.text }}>{intelData.fiftyTwoWeekLow} — {intelData.fiftyTwoWeekHigh}</span>
                    </div>
                    <div style={{ height: '4px', background: c.border, borderRadius: '2px', position: 'relative' }}>
                      <div style={{ position: 'absolute', height: '100%', left: '20%', right: '10%', background: c.gold, borderRadius: '2px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1, border: `1px dashed ${c.up}50`, padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '12px', fontWeight: '900', color: c.up, margin: '0 0 4px 0' }}>SUPPORT</p>
                      <p style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>₹{intelData.support}</p>
                    </div>
                    <div style={{ flex: 1, border: `1px dashed ${c.down}50`, padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '12px', fontWeight: '900', color: c.down, margin: '0 0 4px 0' }}>RESISTANCE</p>
                      <p style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>₹{intelData.resistance}</p>
                    </div>
                  </div>

                  <div style={{ background: `${c.accent}05`, border: `1px solid ${c.accent}20`, padding: '15px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Activity size={16} color={c.accent} />
                      <span style={{ fontSize: '12px', fontWeight: '900', color: c.accent }}>AI INTEL SUMMARY</span>
                    </div>
                    <p style={{ fontSize: '16px', lineHeight: '1.6', color: c.text, margin: 0, fontWeight: '600' }}>
                      {intelStock.why_moving} based on recent volatility and volume spikes. Strong technical setup.
                    </p>
                  </div>

                  {intelNews ? (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '900', color: c.sub, textTransform: 'uppercase', marginBottom: '10px' }}>Latest NSE Filing</div>
                      <div style={{ background: c.hover, padding: '12px', borderRadius: '10px', border: `1px solid ${c.border}` }}>
                        <p style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 5px 0', color: c.text }}>{intelNews.title}</p>
                        <p style={{ fontSize: '13px', color: c.sub, margin: 0 }}>{intelNews.announcement_date}</p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: c.sub, textAlign: 'center' }}>No recent exchange filings.</p>
                  )}
                  <button onClick={() => setSelectedStock(intelStock)} style={{ width: '100%', background: c.accent, color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Maximize2 size={16} /> OPEN FULL CHART
                  </button>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: c.sub }}>Could not load intelligence.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* YAHOO FINANCE STYLE CHART MODAL (APEXCHARTS) */}
      <AnimatePresence>
        {selectedStock && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ width: '100%', maxWidth: '900px', background: '#0d1117', borderRadius: '16px', border: '1px solid #30363d', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
              
              {/* HEADER */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#f0f6fc', letterSpacing: '-0.5px' }}>{chartMeta?.name || selectedStock.name || selectedStock.symbol}</h2>
                    <span style={{ fontSize: '13px', color: '#8b949e', fontWeight: '600', paddingTop: '4px' }}>({selectedStock.symbol})</span>
                  </div>
                  {chartMeta && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '26px', fontWeight: '800', color: '#f0f6fc' }}>₹{chartMeta.currentPrice.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: chartMeta.change >= 0 ? '#00d06c' : '#ff4b4b', background: chartMeta.change >= 0 ? 'rgba(0,208,108,0.1)' : 'rgba(255,75,75,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        {chartMeta.change >= 0 ? '+' : ''}{chartMeta.change} ({chartMeta.changePct}%)
                      </span>
                      <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600', marginLeft: '10px', textTransform: 'uppercase' }}>At Close: {chartMeta.lastUpdated}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => { setSelectedStock(null); setChartMeta(null); }} style={{ background: '#21262d', border: '1px solid #30363d', color: '#8b949e', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex' }}><X size={18} /></button>
              </div>

              {/* TOOLBAR */}
              <div style={{ padding: '12px 24px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {Object.keys(PERIOD_MAP).map(p => (
                    <button key={p} onClick={() => setChartPeriod(p)}
                      style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: chartPeriod === p ? '#1f6feb' : 'transparent', color: chartPeriod === p ? '#fff' : '#8b949e', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }}>
                      {p}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: '#161b22', borderRadius: '8px', border: '1px solid #30363d', overflow: 'hidden' }}>
                    {['mountain', 'line', 'candle'].map(type => (
                      <button key={type} onClick={() => setChartType(type)}
                        style={{ padding: '5px 12px', border: 'none', background: chartType === type ? '#21262d' : 'transparent', color: chartType === type ? '#f0f6fc' : '#8b949e', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textTransform: 'capitalize' }}>
                        {type === 'mountain' ? '🏔 Mountain' : type === 'line' ? '📈 Line' : '🕯 Candle'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowVolume(!showVolume)}
                    style={{ padding: '5px 12px', borderRadius: '8px', border: `1px solid ${showVolume ? '#1f6feb' : '#30363d'}`, background: showVolume ? 'rgba(31,111,235,0.15)' : 'transparent', color: showVolume ? '#58a6ff' : '#8b949e', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    Volume
                  </button>
                </div>
              </div>

              {/* CHART AREA */}
              <div style={{ height: '440px', position: 'relative', background: '#0d1117', overflow: 'hidden' }}>
                {chartLoading ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Activity size={32} color="#58a6ff" className="animate-pulse" />
                      <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '10px', fontWeight: '600' }}>Fetching market history...</p>
                    </div>
                  </div>
                ) : chartData.length > 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    <Chart
                      options={{
                        chart: {
                          id: 'stock-technical-chart',
                          toolbar: { show: false },
                          animations: { enabled: false },
                          background: 'transparent',
                          foreColor: '#8b949e',
                          fontFamily: 'Inter, sans-serif'
                        },
                        theme: { mode: 'dark' },
                        xaxis: {
                          type: 'datetime',
                          axisBorder: { color: '#30363d' },
                          axisTicks: { color: '#30363d' },
                          labels: { style: { fontSize: '10px', fontWeight: 600 } }
                        },
                        yaxis: [
                        {
                          seriesName: 'Price',
                          opposite: true,
                          decimalsInFloat: 2,
                          axisBorder: { show: true, color: '#30363d' },
                          labels: { style: { fontSize: '11px', fontWeight: 700 } },
                          tooltip: { enabled: true }
                        },
                        {
                          seriesName: 'Volume',
                          show: false,
                          max: (max) => max * 5 // Scale volume down significantly
                        }
                      ],
                        dataLabels: { enabled: false },
                        grid: { borderColor: '#21262d', strokeDashArray: 3, padding: { left: 20, right: 20 } },
                        stroke: { 
                          curve: chartType === 'mountain' ? 'straight' : 'smooth', 
                          width: chartType === 'candle' ? 1 : 2 
                        },
                        fill: {
                          type: chartType === 'mountain' ? 'gradient' : 'none',
                          gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 }
                        },
                        tooltip: {
                          theme: 'dark',
                          x: { format: 'dd MMM yyyy HH:mm' },
                          y: { 
                            formatter: (val, { seriesIndex }) => {
                              if (val === undefined || val === null) return 'N/A';
                              if (seriesIndex === 1) {
                                return val >= 1000000 ? (val / 1000000).toFixed(2) + 'M' : val.toLocaleString('en-IN');
                              }
                              return `₹${val.toLocaleString('en-IN')}`;
                            }
                          }
                        },
                        markers: { size: 0 },
                        colors: chartType === 'candle' ? ['#00d06c'] : (chartMeta?.change >= 0 ? ['#00d06c', '#58a6ff'] : ['#ff4b4b', '#58a6ff']),
                        plotOptions: {
                          candlestick: {
                            colors: { upward: '#00d06c', downward: '#ff4b4b' },
                            wick: { useFillColor: true }
                          },
                          bar: {
                            columnWidth: '60%',
                            opacity: 0.3
                          }
                        }
                      }}
                      series={[
                        {
                          name: 'Price',
                          type: chartType === 'candle' ? 'candlestick' : (chartType === 'mountain' ? 'area' : 'line'),
                          data: chartType === 'candle' 
                            ? chartData
                                .filter(d => d.open && d.high && d.low && d.close)
                                .map(d => ({ x: d.timestamp, y: [d.open, d.high, d.low, d.close] }))
                            : chartData
                                .filter(d => d.close !== null && d.close !== undefined)
                                .map(d => ({ x: d.timestamp, y: d.close }))
                        },
                        ...(showVolume ? [{
                          name: 'Volume',
                          type: 'bar',
                          data: chartData
                            .filter(d => d.volume !== null && d.volume !== undefined)
                            .map(d => ({ x: d.timestamp, y: d.volume }))
                        }] : [])
                      ]}
                    height="400"
                    />
                  </motion.div>
                ) : (
                  <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
                    <div style={{ textAlign: 'center' }}>
                      <ShieldAlert size={40} color="#ff4b4b" style={{ opacity: 0.5, marginBottom: '10px' }} />
                      <p style={{ fontWeight: '700' }}>No Market Data Available</p>
                      <p style={{ fontSize: '12px' }}>Try a different time range or symbol.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090b10' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>Source: Yahoo Finance (yfinance)</span>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#30363d' }}></div>
                  <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>StockIntel Terminal v4.0</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}