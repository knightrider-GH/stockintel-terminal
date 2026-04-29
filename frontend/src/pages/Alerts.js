import React, { useState, useEffect, useRef } from 'react';
import { alertsAPI, watchlistAPI } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../App';
import { Bell, Plus, Trash2, Activity, TrendingUp, TrendingDown, Clock, ChevronRight, X, AlertTriangle, Send, Mail, Monitor, History, CheckCircle2, AlertCircle, ShieldCheck, Zap, BarChart3, Globe, Cpu, Radio } from 'lucide-react';
import axios from 'axios';

const T = {
  dark:  { bg: '#05070a', card: '#0d1117', text: '#f0f6fc', sub: '#8b949e', border: '#30363d', accent: '#58a6ff', up: '#3fb950', down: '#f85149', hover: '#161b22', highlight: '#d2a8ff' },
  light: { bg: '#f6f8fa', card: '#ffffff', text: '#1f2328', sub: '#656d76', border: '#d0d7de', accent: '#0969da', up: '#1a7f37', down: '#cf222e', hover: '#f3f4f6', highlight: '#8250df' },
};

export default function Alerts() {
  const { dark } = useTheme();
  const c = dark ? T.dark : T.light;

  const [alerts, setAlerts] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ symbol: '', target_price: '', direction: 'above', alert_type: 'price', channel: 'both' });
  const [error, setError] = useState('');

  const refreshTimer = useRef(null);

  useEffect(() => { 
    load(true);
    refreshTimer.current = setInterval(() => load(false), 10000);
    return () => clearInterval(refreshTimer.current);
  }, []);

  const load = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [aRes, wRes, lRes] = await Promise.all([
        alertsAPI.getAll(),
        watchlistAPI.get(),
        axios.get('http://localhost:5000/api/notifications/logs', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);
      
      const alertData = aRes.data || [];
      const watchData = wRes.data || [];
      const logData = lRes.data || [];

      const enriched = alertData.map(alert => {
        const match = watchData.find(w => w.symbol === alert.symbol);
        return { ...alert, current_price: match ? match.price : 0 };
      });

      setAlerts(enriched);
      setWatchlist(watchData);
      setLogs(logData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    if (!form.symbol || !form.target_price) { setError('Missing required fields'); return; }
    
    setCreating(true);
    try {
      await axios.post('http://localhost:5000/api/alerts', { 
        ...form,
        target_price: parseFloat(form.target_price)
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setForm({ symbol: '', target_price: '', direction: 'above', alert_type: 'price', channel: 'both' });
      setShowForm(false);
      load(false);
    } catch (e) {
      setError('Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertsAPI.delete(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      alert('Delete failed');
    }
  };

  const active = alerts.filter(a => !a.triggered);
  const triggered = alerts.filter(a => a.triggered);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
        <Activity size={40} color={c.accent} className="animate-pulse" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, padding: '40px 25px', color: c.text }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0, letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: `linear-gradient(135deg, ${c.accent}, #8250df)`, padding: '10px', borderRadius: '12px' }}><Radio size={24} color="white" /></div>
              INTELLIGENCE MONITORS
            </h1>
            <p style={{ fontSize: '13px', color: c.sub, fontWeight: '700', marginTop: '8px', letterSpacing: '0.5px' }}>{active.length} ACTIVE REAL-TIME PROTOCOLS DEPLOYED</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{ background: c.accent, color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: `0 4px 15px ${c.accent}40`, transition: 'all 0.2s' }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'CANCEL DEPLOYMENT' : 'DEPLOY NEW MONITOR'}
          </button>
        </div>

        {/* STATS BAR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '40px' }}>
          {[
            { label: 'ACTIVE PROTOCOLS', value: active.length, icon: <Monitor size={18} color={c.accent}/>, color: c.accent },
            { label: 'DELIVERY SUCCESS', value: `${logs.length > 0 ? Math.round((logs.filter(l => l.status === 'sent').length / logs.length) * 100) : 100}%`, icon: <ShieldCheck size={18} color={c.up}/>, color: c.up },
            { label: 'TOTAL SIGNALS', value: logs.length, icon: <Zap size={18} color={c.highlight || '#d2a8ff'}/>, color: c.highlight || '#d2a8ff' },
            { label: 'SYSTEM UPTIME', value: '99.98%', icon: <Globe size={18} color={c.accent}/>, color: c.accent },
          ].map((stat, i) => (
            <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: '900', color: c.sub, letterSpacing: '1px' }}>{stat.label}</span>
                {stat.icon}
              </div>
              <span style={{ fontSize: '24px', fontWeight: '900', color: stat.color, fontFamily: 'monospace' }}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* CREATE ALERT FORM */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }} style={{ marginBottom: '40px' }}>
              <div style={{ background: `linear-gradient(145deg, ${c.card}, ${dark ? '#0a0d18' : '#f0f4ff'})`, border: `1px solid ${c.accent}33`, borderRadius: '20px', padding: '35px', boxShadow: `0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px ${c.accent}15` }}>
                
                {/* Form Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px', paddingBottom: '20px', borderBottom: `1px solid ${c.border}50` }}>
                  <div style={{ background: `linear-gradient(135deg, ${c.accent}, #8250df)`, padding: '10px', borderRadius: '12px' }}>
                    <Radio size={20} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '900', fontSize: '16px', letterSpacing: '0.5px' }}>DEPLOY INTELLIGENCE MONITOR</div>
                    <div style={{ fontSize: '12px', color: c.sub, fontWeight: '600', marginTop: '2px' }}>Configure real-time surveillance protocol</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.up, animation: 'pulse 2s infinite' }}></div>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: c.up }}>READY</span>
                  </div>
                </div>

                {/* Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '25px' }}>
                  {[
                    { label: '📌 SYMBOL', field: 'symbol', type: 'select', opts: [['', 'Select Asset...'], ...watchlist.map(s => [s.symbol, s.symbol])] },
                    { label: '⚡ TRIGGER', field: 'alert_type', type: 'select', opts: [['price', 'PRICE LEVEL'], ['volume', 'VOLUME SPIKE'], ['support', 'SUPPORT BREAK'], ['resistance', 'RESISTANCE BREAK']] },
                    { label: '🎯 TARGET ₹', field: 'target_price', type: 'number', placeholder: '0.00' },
                    { label: '📐 CONDITION', field: 'direction', type: 'select', opts: [['above', 'CROSSES ABOVE ▲'], ['below', 'CROSSES BELOW ▼']] },
                    { label: '📡 CHANNEL', field: 'channel', type: 'select', opts: [['both', 'EMAIL + TELEGRAM'], ['email', 'EMAIL ONLY'], ['telegram', 'TELEGRAM ONLY']] },
                  ].map(({ label, field, type, opts, placeholder }) => (
                    <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '900', color: c.sub, letterSpacing: '0.8px' }}>{label}</label>
                      {type === 'select' ? (
                        <select
                          value={form[field]}
                          onChange={e => setForm({ ...form, [field]: e.target.value })}
                          style={{ padding: '11px 14px', borderRadius: '10px', border: `1px solid ${c.border}`, background: dark ? '#0d1117' : '#fff', color: c.text, fontWeight: '800', outline: 'none', fontSize: '12px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                          onFocus={e => e.currentTarget.style.borderColor = c.accent}
                          onBlur={e => e.currentTarget.style.borderColor = c.border}
                        >
                          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <input
                          type={type}
                          placeholder={placeholder}
                          value={form[field]}
                          onChange={e => setForm({ ...form, [field]: e.target.value })}
                          style={{ padding: '11px 14px', borderRadius: '10px', border: `1px solid ${c.border}`, background: dark ? '#0d1117' : '#fff', color: c.text, fontWeight: '800', outline: 'none', fontSize: '13px', transition: 'border-color 0.2s' }}
                          onFocus={e => e.currentTarget.style.borderColor = c.accent}
                          onBlur={e => e.currentTarget.style.borderColor = c.border}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {error && <p style={{ color: c.down, fontSize: '12px', fontWeight: '800', margin: '0 0 18px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={14}/> {error}</p>}

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  style={{ width: '100%', background: creating ? c.sub : `linear-gradient(135deg, ${c.accent}, #8250df)`, color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: creating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', letterSpacing: '0.5px', boxShadow: creating ? 'none' : `0 6px 20px ${c.accent}40`, transition: 'all 0.2s' }}
                  onMouseOver={e => !creating && (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {creating ? <Activity size={18} className="animate-spin" /> : <Radio size={18} />}
                  {creating ? 'DEPLOYING INTELLIGENCE AGENT...' : 'DEPLOY MONITORING AGENT'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '30px' }}>
          
          {/* ACTIVE ALERTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
              <Activity size={16} color={c.accent} />
              <span style={{ fontSize: '12px', fontWeight: '900', color: c.accent, textTransform: 'uppercase' }}>Live System Monitors</span>
            </div>
            
            {active.length > 0 ? active.map((alert) => (
                <div 
                  key={alert.id}
                  style={{ 
                    background: `linear-gradient(145deg, ${c.card}, ${dark ? '#0a0d14' : '#f8fafd'})`, 
                    border: `1px solid ${c.border}`, 
                    borderRadius: '16px', 
                    padding: '20px 25px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    borderLeft: `5px solid ${alert.direction === 'above' ? c.up : c.down}`,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateX(5px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <div style={{ display: 'flex', gap: '35px', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '900', color: c.text, fontSize: '18px', letterSpacing: '-0.5px' }}>{alert.symbol}</span>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: 'white', background: c.accent, padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.5px' }}>{alert.alert_type?.toUpperCase()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: c.text }}>₹{parseFloat(alert.target_price).toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: alert.direction === 'above' ? c.up : c.down }}>
                          {alert.direction === 'above' ? '▲ BREAKOUT' : '▼ BREAKDOWN'}
                        </span>
                      </div>
                    </div>
                    <div style={{ width: '1px', height: '40px', background: c.border, opacity: 0.5 }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {alert.channel === 'both' || alert.channel === 'email' ? <div style={{ background: `${c.sub}20`, padding: '6px', borderRadius: '6px' }}><Mail size={14} color={c.text} /></div> : null}
                        {alert.channel === 'both' || alert.channel === 'telegram' ? <div style={{ background: `${c.sub}20`, padding: '6px', borderRadius: '6px' }}><Send size={14} color={c.text} /></div> : null}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: '800', color: c.sub, textTransform: 'uppercase' }}>CHANNELS ACTIVE</div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleDelete(alert.id)} 
                    style={{ background: `${c.down}15`, color: c.down, border: `1px solid ${c.down}33`, padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.background = c.down; e.currentTarget.style.color = 'white'; }}
                    onMouseOut={e => { e.currentTarget.style.background = `${c.down}15`; e.currentTarget.style.color = c.down; }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
            )) : (
              <div style={{ padding: '60px', textAlign: 'center', border: `2px dashed ${c.border}`, borderRadius: '12px', color: c.sub }}>
                <Bell size={40} style={{ marginBottom: '15px', opacity: 0.5 }} />
                <p style={{ fontWeight: '800', margin: 0 }}>No active monitors deployed</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* DELIVERY LOGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <History size={16} color={c.sub} />
                  <span style={{ fontSize: '12px', fontWeight: '900', color: c.sub, textTransform: 'uppercase', letterSpacing: '1px' }}>Delivery Success Logs</span>
               </div>
               
               <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto' }}>
                  {logs.length > 0 ? logs.map((log, i) => (
                    <div key={log.id} style={{ padding: '15px 20px', borderBottom: i === logs.length - 1 ? 'none' : `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: log.status === 'sent' ? `${c.up}20` : `${c.down}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {log.status === 'sent' ? <CheckCircle2 size={16} color={c.up} /> : <AlertCircle size={16} color={c.down} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: '800', fontSize: '13px' }}>{log.title}</span>
                          <span style={{ fontSize: '10px', color: c.sub, fontWeight: '700', fontFamily: 'monospace' }}>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: c.sub, marginTop: '2px', fontWeight: '600' }}>{log.message} • via {log.channel?.toUpperCase()}</div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: c.sub, fontSize: '12px', fontWeight: '700' }}>No delivery logs detected.</div>
                  )}
               </div>
            </div>

            {/* SYSTEM INTELLIGENCE CONSOLE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <Cpu size={16} color={c.accent} />
                  <span style={{ fontSize: '12px', fontWeight: '900', color: c.accent, textTransform: 'uppercase', letterSpacing: '1px' }}>Intelligence Console</span>
               </div>
               
               <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: c.sub }}>CHANNEL CONNECTIVITY</span>
                      <span style={{ fontSize: '10px', fontWeight: '900', color: c.up, display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.up }}></div> ACTIVE</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1, height: '4px', background: c.up, borderRadius: '2px' }}></div>
                      <div style={{ flex: 1, height: '4px', background: c.up, borderRadius: '2px' }}></div>
                      <div style={{ flex: 1, height: '4px', background: c.accent, borderRadius: '2px', opacity: 0.3 }}></div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div style={{ background: `${c.bg}`, padding: '15px', borderRadius: '12px', border: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: '9px', fontWeight: '900', color: c.sub, marginBottom: '5px' }}>SCAN FREQUENCY</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: c.text }}>1.5s <span style={{ fontSize: '10px', color: c.up }}>▼</span></div>
                    </div>
                    <div style={{ background: `${c.bg}`, padding: '15px', borderRadius: '12px', border: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: '9px', fontWeight: '900', color: c.sub, marginBottom: '5px' }}>API LATENCY</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: c.text }}>42ms <span style={{ fontSize: '10px', color: c.up }}>▼</span></div>
                    </div>
                  </div>

                  <div style={{ padding: '15px', borderRadius: '12px', border: `1px dashed ${c.border}`, textAlign: 'center' }}>
                    <BarChart3 size={24} color={c.sub} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <div style={{ fontSize: '11px', fontWeight: '800', color: c.sub }}>COVERAGE DENSITY</div>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: c.text, marginTop: '4px' }}>{active.length} / 50 NODES</div>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>
      <style>{`
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 4px rgba(63,185,80,0.6); } 50% { box-shadow: 0 0 12px rgba(63,185,80,0.9); } }
      `}</style>
    </div>
  );
}