import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../App';
import { useAuth } from '../context/AuthContext';
import { LogOut, Activity, TrendingUp, TrendingDown, Clock, PlusCircle, RefreshCw, Layers } from 'lucide-react';
import TickerTape from '../components/TickerTape';
import Sparkline from '../components/Sparkline';
import { useMarket } from '../context/MarketContext';

// Professional Premium Trading Palette
const T = {
  dark:  { 
    bg: '#06090f', 
    card: 'rgba(13, 17, 23, 0.75)', 
    text: '#f0f6fc', 
    sub: '#8b949e', 
    border: 'rgba(48, 54, 61, 0.5)', 
    accent: '#3b82f6', 
    up: '#10b981', 
    down: '#ef4444',
    gold: '#eab308',
    glowUp: 'rgba(16, 185, 129, 0.15)',
    glowDown: 'rgba(239, 68, 68, 0.15)'
  },
  light: { 
    bg: '#f6f8fa', 
    card: 'rgba(255, 255, 255, 0.8)', 
    text: '#1f2328', 
    sub: '#656d76', 
    border: 'rgba(208, 215, 222, 0.6)', 
    accent: '#0969da', 
    up: '#1a7f37', 
    down: '#cf222e',
    gold: '#b8860b',
    glowUp: 'rgba(26, 127, 55, 0.1)',
    glowDown: 'rgba(207, 34, 46, 0.1)'
  },
};

function Dashboard() {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const { logout } = useAuth();
  const c = dark ? T.dark : T.light;

  const { 
    marketOverview: marketData, 
    watchlist: fullWatchlist, 
    announcements: allAnnouncements, 
    loading: contextLoading,
    refreshAll 
  } = useMarket();

  // Derived state for Dashboard specific views
  const watchlist = fullWatchlist.slice(0, 6);
  
  // One latest news per stock in watchlist
  const recentNews = watchlist.map(stock => {
    const latest = allAnnouncements?.find(a => a.symbol === stock.symbol);
    return latest ? latest : {
      symbol: stock.symbol,
      title: 'No recent news available for this ticker.',
      announcement_date: '-',
      id: `empty-${stock.symbol}`
    };
  });

  const loading = contextLoading.market || contextLoading.watchlist || contextLoading.announcements;

  if (loading && !marketData) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
        <Activity size={48} color={c.accent} style={{ marginBottom: '20px' }} className="animate-pulse" />
        <p style={{ color: c.accent, fontWeight: '800', letterSpacing: '2px', fontSize: '14px' }}>INITIALIZING TERMINAL...</p>
      </div>
    );
  }

  // Calculate Sentiment
  let sentimentStr = "NEUTRAL";
  let sentimentScore = 50; // 0 to 100
  let sentimentColor = c.sub;

  if (marketData?.heatmap) {
    const gainers = marketData.heatmap.filter(s => s.changePct > 0).length;
    const losers = marketData.heatmap.filter(s => s.changePct < 0).length;
    const total = gainers + losers;
    if (total > 0) {
      sentimentScore = Math.round((gainers / total) * 100);
      if (sentimentScore >= 60) { sentimentStr = "BULLISH"; sentimentColor = c.up; }
      else if (sentimentScore <= 40) { sentimentStr = "BEARISH"; sentimentColor = c.down; }
      else { sentimentStr = "NEUTRAL"; sentimentColor = c.gold; }
    }
  }

  // Top 6 Heavyweights for Heatmap
  const heatmapStocks = marketData?.heatmap?.slice(0, 6) || [];

  return (
    <div style={{ minHeight: '100vh', background: c.bg, transition: 'background 0.3s' }}>
      
      {/* 1. POLISHED TICKER TAPE */}
      <div style={{ borderBottom: `1px solid ${c.border}`, background: dark ? '#000' : '#fff' }}>
        <TickerTape indices={marketData?.indices} dark={dark} />
      </div>

      <div style={{ padding: '25px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* HEADER SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.up, boxShadow: `0 0 12px ${c.up}` }}></div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: c.up, textTransform: 'uppercase', letterSpacing: '1px' }}>Global Market Live</span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', color: c.text, margin: 0, letterSpacing: '-0.5px' }}>Market Terminal</h1>
          </div>
          <button onClick={logout} style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, color: c.sub, padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} onMouseOver={e => e.currentTarget.style.borderColor = c.accent} onMouseOut={e => e.currentTarget.style.borderColor = c.border}>
            <LogOut size={14} /> EXIT TERMINAL
          </button>
        </div>

        {/* --- NEW COMMAND CENTER ROW --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gap: '20px', marginBottom: '30px' }}>
          
          {/* 1. SENTIMENT METER */}
          <div style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: c.sub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Market Sentiment</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: sentimentColor, textShadow: `0 0 20px ${sentimentColor}40` }}>{sentimentStr}</h2>
              <span style={{ fontSize: '18px', fontWeight: '800', color: c.text, fontFamily: 'monospace' }}>{sentimentScore}%</span>
            </div>
            {/* Progress Bar */}
            <div style={{ height: '8px', background: `linear-gradient(90deg, ${c.down} 0%, ${c.gold} 50%, ${c.up} 100%)`, borderRadius: '4px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-4px', bottom: '-4px', width: '4px', background: '#fff', left: `${sentimentScore}%`, borderRadius: '2px', boxShadow: '0 0 10px rgba(255,255,255,0.8)' }}></div>
            </div>
          </div>

          {/* 2. MINI HEATMAP */}
          <div style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: c.sub, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Heavyweight Heatmap</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {heatmapStocks.map((s, i) => {
                const isUp = s.changePct >= 0;
                return (
                  <div key={i} style={{ background: isUp ? c.glowUp : c.glowDown, border: `1px solid ${isUp ? c.up : c.down}40`, borderRadius: '6px', padding: '10px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = isUp ? c.up : c.down} onMouseOut={e => e.currentTarget.style.borderColor = `${isUp ? c.up : c.down}40`}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: c.text }}>{s.symbol.replace('.NS', '')}</span>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: isUp ? c.up : c.down, fontFamily: 'monospace' }}>{isUp ? '+' : ''}{s.changePct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. QUICK ACTIONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => navigate('/watchlist')} style={{ flex: 1, background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '10px', color: c.text, fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} onMouseOver={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.background = `${c.accent}15`; }} onMouseOut={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = c.card; }}>
              <PlusCircle size={16} color={c.accent} /> Add Asset
            </button>
            <button onClick={() => navigate('/intelligence')} style={{ flex: 1, background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '10px', color: c.text, fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} onMouseOver={e => { e.currentTarget.style.borderColor = c.gold; e.currentTarget.style.background = `${c.gold}15`; }} onMouseOut={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = c.card; }}>
              <Layers size={16} color={c.gold} /> Intelligence
            </button>
            <button onClick={refreshAll} style={{ flex: 1, background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '10px', color: c.text, fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }} onMouseOver={e => { e.currentTarget.style.borderColor = c.up; e.currentTarget.style.background = `${c.up}15`; }} onMouseOut={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = c.card; }}>
              <RefreshCw size={16} color={c.up} /> Sync Market
            </button>
          </div>

        </div>

        {/* EXISTING MARKET OVERVIEW GRID (Indices with Sparklines) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          {marketData?.indices.map((idx, i) => (
            <motion.div
              key={idx.name}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', transition: 'transform 0.2s, border-color 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = c.sub; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = c.border; }}
            >
              <div>
                <p style={{ fontSize: '12px', fontWeight: '800', color: c.sub, margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{idx.name}</p>
                <h3 style={{ fontSize: '22px', fontWeight: '900', color: c.text, margin: '0 0 5px 0', fontFamily: 'monospace' }}>
                  {typeof idx.price === 'number' ? idx.price.toLocaleString('en-IN') : idx.price}
                </h3>
                <span style={{ fontSize: '13px', fontWeight: '900', color: idx.change >= 0 ? c.up : c.down, background: idx.change >= 0 ? c.glowUp : c.glowDown, padding: '2px 6px', borderRadius: '4px' }}>
                  {idx.change >= 0 ? '+' : ''}{idx.changePct}%
                </span>
              </div>
              <Sparkline data={idx.sparkline} color={idx.change >= 0 ? c.up : c.down} width={120} height={40} />
            </motion.div>
          ))}
        </div>

        {/* 3. MAIN TERMINAL PANES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' }}>
          
          {/* LEFT COLUMN: MOVERS & MARKET ANALYTICS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* TOP GAINERS & LOSERS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* GAINERS */}
              <div style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <TrendingUp size={18} color={c.up} />
                  <span style={{ fontSize: '14px', fontWeight: '900', color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Gainers</span>
                </div>
                {marketData?.movers.gainers.map((stock, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 4 ? `1px solid ${c.border}` : 'none', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontWeight: '800', color: c.text, fontSize: '14px' }}>{stock.symbol}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: c.text, fontFamily: 'monospace' }}>₹{stock.price}</div>
                      <div style={{ fontSize: '12px', fontWeight: '900', color: c.up }}>+{stock.changePct}%</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* LOSERS */}
              <div style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <TrendingDown size={18} color={c.down} />
                  <span style={{ fontSize: '14px', fontWeight: '900', color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Losers</span>
                </div>
                {marketData?.movers.losers.map((stock, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 4 ? `1px solid ${c.border}` : 'none', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontWeight: '800', color: c.text, fontSize: '14px' }}>{stock.symbol}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: c.text, fontFamily: 'monospace' }}>₹{stock.price}</div>
                      <div style={{ fontSize: '12px', fontWeight: '900', color: c.down }}>{stock.changePct}%</div>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* WATCHLIST QUICK VIEW */}
            <div style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity size={18} color={c.accent} />
                  <span style={{ fontSize: '14px', fontWeight: '900', color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Watchlist Snapshot</span>
                </div>
                <button onClick={() => navigate('/watchlist')} style={{ background: 'transparent', border: 'none', color: c.accent, fontSize: '12px', fontWeight: '900', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = c.accent}>VIEW ALL →</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                {watchlist.map((s, i) => (
                  <div key={i} onClick={() => navigate('/watchlist')} style={{ background: dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', padding: '15px', borderRadius: '10px', border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseOut={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <div>
                      <div style={{ fontWeight: '900', color: c.text, fontSize: '15px' }}>{s.symbol}</div>
                      <div style={{ fontSize: '12px', color: c.sub, fontWeight: '800' }}>NSE</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', color: c.text, fontSize: '15px', fontFamily: 'monospace' }}>₹{s.price}</div>
                      <div style={{ fontSize: '12px', fontWeight: '900', color: s.change >= 0 ? c.up : c.down, background: s.change >= 0 ? c.glowUp : c.glowDown, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{s.change >= 0 ? '+' : ''}{s.change}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: INTELLIGENCE FEED */}
          <div style={{ background: c.card, backdropFilter: 'blur(10px)', border: `1px solid ${c.border}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '20px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} color={c.gold} />
                <span style={{ fontSize: '14px', fontWeight: '900', color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Intelligence Feed</span>
              </div>
              <button onClick={() => navigate('/intelligence')} style={{ background: 'transparent', border: 'none', color: c.gold, fontSize: '12px', fontWeight: '900', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = c.gold}>HISTORY →</button>
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: '700px', flex: 1, padding: '10px 0' }}>
              {recentNews.length > 0 ? (
                recentNews.map((news, i) => (
                  <div key={i} onClick={() => navigate('/intelligence')} style={{ padding: '15px 20px', borderBottom: `1px solid ${c.border}`, cursor: 'pointer', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', gap: '8px' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: c.text, background: dark ? '#1f2937' : '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>{news.symbol}</span>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: c.sub, fontFamily: 'monospace' }}>{news.announcement_date.split(' ')[0]}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: c.text, fontWeight: '600', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {news.title}
                    </p>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: c.sub, fontSize: '14px', fontWeight: '600' }}>No recent intelligence found.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;