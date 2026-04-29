import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../App';
import { SlidersVertical, Shield, Bell, User, Cpu, Globe, Database, Save, Activity, Power, Send, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const T = {
  dark:  { bg: '#05070a', card: '#0d1117', text: '#f0f6fc', sub: '#8b949e', border: '#30363d', accent: '#58a6ff', up: '#3fb950', down: '#f85149', hover: '#161b22' },
  light: { bg: '#f6f8fa', card: '#ffffff', text: '#1f2328', sub: '#656d76', border: '#d0d7de', accent: '#0969da', up: '#1a7f37', down: '#cf222e', hover: '#f3f4f6' },
};

export default function Settings() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const c = dark ? T.dark : T.light;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  
  const [prefs, setPrefs] = useState({
    email_alerts_enabled: true,
    telegram_alerts_enabled: true,
    telegram_chat_id: '',
    daily_summary_enabled: true,
    ai_alerts_enabled: true,
    price_alerts_enabled: true
  });

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/settings/notifications', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPrefs(res.data);
    } catch (e) {
      console.error("Failed to fetch settings", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('http://localhost:5000/api/settings/notifications', prefs, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
        <Activity size={40} color={c.accent} className="animate-pulse" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, padding: '40px 25px' }}>
      
      <AnimatePresence>
        {showSaveToast && (
          <motion.div initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} style={{ position: 'fixed', top: '40px', left: '50%', x: '-50%', background: c.up, color: 'white', padding: '12px 30px', borderRadius: '12px', fontWeight: '900', zIndex: 1000, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} /> CONFIGURATION SYNCHRONIZED
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>Terminal Configuration</h1>
            <p style={{ fontSize: '13px', color: c.sub, fontWeight: '700', marginTop: '5px' }}>Manage your high-performance trading environment</p>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ background: c.accent, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <Activity size={16} className="animate-spin" /> : <Save size={16} />} 
            {saving ? 'SYNCING...' : 'SAVE CHANGES'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' }}>
          
          {/* LEFT: SETTINGS GROUPS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* NOTIFICATIONS */}
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                <Bell size={20} color={c.accent} />
                <span style={{ fontWeight: '900', fontSize: '14px', textTransform: 'uppercase' }}>Alert Protocols</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Channel Toggles */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div onClick={() => toggle('email_alerts_enabled')} style={{ padding: '20px', borderRadius: '12px', border: `1px solid ${prefs.email_alerts_enabled ? c.accent : c.border}`, background: prefs.email_alerts_enabled ? `${c.accent}10` : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <Globe size={18} color={prefs.email_alerts_enabled ? c.accent : c.sub} />
                      <div style={{ width: '32px', height: '16px', background: prefs.email_alerts_enabled ? c.accent : c.border, borderRadius: '20px', position: 'relative' }}>
                         <div style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: prefs.email_alerts_enabled ? '18px' : '2px', transition: 'all 0.2s' }} />
                      </div>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '13px' }}>Email Notifications</div>
                  </div>

                  <div onClick={() => toggle('telegram_alerts_enabled')} style={{ padding: '20px', borderRadius: '12px', border: `1px solid ${prefs.telegram_alerts_enabled ? c.accent : c.border}`, background: prefs.telegram_alerts_enabled ? `${c.accent}10` : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <Send size={18} color={prefs.telegram_alerts_enabled ? c.accent : c.sub} />
                      <div style={{ width: '32px', height: '16px', background: prefs.telegram_alerts_enabled ? c.accent : c.border, borderRadius: '20px', position: 'relative' }}>
                         <div style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: prefs.telegram_alerts_enabled ? '18px' : '2px', transition: 'all 0.2s' }} />
                      </div>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '13px' }}>Telegram Alerts</div>
                  </div>
                </div>

                {/* Telegram ID */}
                {prefs.telegram_alerts_enabled && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label style={{ fontSize: '11px', fontWeight: '900', color: c.sub, display: 'block', marginBottom: '8px' }}>TELEGRAM CHAT ID</label>
                    <input 
                      type="text" 
                      placeholder="Enter your Telegram Chat ID..."
                      value={prefs.telegram_chat_id || ''} 
                      onChange={(e) => setPrefs({...prefs, telegram_chat_id: e.target.value})}
                      style={{ width: '100%', padding: '12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, fontWeight: '700', outline: 'none' }} 
                    />
                    <p style={{ fontSize: '11px', color: c.sub, marginTop: '8px', fontWeight: '600' }}>Get your ID from @userinfobot on Telegram</p>
                  </motion.div>
                )}

                <div style={{ height: '1px', background: c.border }}></div>

                {/* Feature Toggles */}
                {[
                  { id: 'price_alerts_enabled', label: 'Real-time Price Monitors', sub: 'Instant notification on target hits' },
                  { id: 'ai_alerts_enabled', label: 'AI Intelligence Reports', sub: 'Alerts for high-impact corporate filings' },
                  { id: 'daily_summary_enabled', label: 'Daily Market Briefing', sub: 'Evening summary of performance & news' }
                ].map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: c.text, fontSize: '14px' }}>{item.label}</div>
                      <div style={{ fontSize: '12px', color: c.sub, fontWeight: '600' }}>{item.sub}</div>
                    </div>
                    <div 
                      onClick={() => toggle(item.id)}
                      style={{ width: '40px', height: '20px', background: prefs[item.id] ? c.up : c.border, borderRadius: '50px', cursor: 'pointer', position: 'relative' }}
                    >
                      <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: prefs[item.id] ? '22px' : '2px', transition: 'all 0.2s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECURITY */}
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                <Shield size={20} color={c.accent} />
                <span style={{ fontWeight: '900', fontSize: '14px', textTransform: 'uppercase' }}>Security Matrix</span>
              </div>
              <div style={{ padding: '15px', background: `${c.up}11`, border: `1px solid ${c.up}33`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '10px', height: '10px', background: c.up, borderRadius: '50%', boxShadow: `0 0 10px ${c.up}` }}></div>
                <div style={{ fontWeight: '800', color: c.up, fontSize: '13px' }}>AES-256 Encryption Active</div>
              </div>
            </div>

          </div>

          {/* RIGHT: SYSTEM INFO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                <Cpu size={20} color={c.accent} />
                <span style={{ fontWeight: '900', fontSize: '14px', textTransform: 'uppercase' }}>Engine Stats</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: c.bg, borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: c.sub }}>AI MODEL</span>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: c.accent }}>Llama 3.1 (8B)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: c.bg, borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: c.sub }}>PROCESSOR</span>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: c.text }}>Groq LPU™</span>
                </div>
              </div>
            </div>

            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                <Database size={20} color={c.accent} />
                <span style={{ fontWeight: '900', fontSize: '14px', textTransform: 'uppercase' }}>Data Pipeline</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: c.sub, lineHeight: '1.6' }}>
                Streaming live market data from NSE/BSE via secure webhooks. Database synchronization occurs every 60 seconds.
              </div>
            </div>

            <div style={{ background: `${c.down}11`, border: `1px solid ${c.down}33`, borderRadius: '12px', padding: '25px', marginTop: 'auto' }}>
              <h4 style={{ margin: '0 0 10px 0', color: c.down, fontWeight: '900', fontSize: '14px' }}>DANGER ZONE</h4>
              <p style={{ fontSize: '12px', color: c.sub, marginBottom: '20px', fontWeight: '600' }}>Terminate all active sessions and delete your account data permanently.</p>
              <button style={{ width: '100%', background: c.down, color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                <Power size={14} style={{ marginRight: '8px' }} /> TERMINAL SHUTDOWN
              </button>
            </div>

          </div>

        </div>

      </div>
      <style>{`
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}