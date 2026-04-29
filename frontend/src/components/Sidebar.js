import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

import {
  LayoutDashboard,
  Layers,
  Brain,
  BadgeAlert,
  SlidersVertical,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';

function Sidebar({ darkMode, setDarkMode, isCollapsed, setIsCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/watchlist', icon: Layers, label: 'Watchlist' },
    { path: '/intelligence', icon: Brain, label: 'Intelligence' },
    { path: '/alerts', icon: BadgeAlert, label: 'Alerts' },
    { path: '/settings', icon: SlidersVertical, label: 'Settings' }
  ];

  const isActive = (path) => location.pathname === path;

  const sidebarWidth = isCollapsed ? '88px' : '280px';
  const c = {
    bg: darkMode ? '#0d1117' : '#ffffff',
    border: darkMode ? '#30363d' : '#d0d7de',
    text: darkMode ? '#f0f6fc' : '#1f2328',
    sub: darkMode ? '#8b949e' : '#656d76',
    accent: '#58a6ff',
    hover: darkMode ? '#161b22' : '#f6f8fa'
  };

  return (
    <div style={{
      width: sidebarWidth,
      height: '100vh',
      background: c.bg,
      borderRight: `1px solid ${c.border}`,
      padding: isCollapsed ? '30px 15px' : '30px 20px',
      position: 'fixed',
      left: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      color: c.text,
      zIndex: 1000,
      transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
      boxSizing: 'border-box'
    }}>

      {/* FLOATING TOGGLE BUTTON */}
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: 'absolute',
          top: '40px',
          right: '-16px',
          background: c.bg,
          border: `1px solid ${c.border}`,
          color: c.text,
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          zIndex: 1001,
          transition: 'background 0.3s'
        }}
      >
        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </motion.button>

      {/* LOGO SECTION - RESTORED ICON & ANIMATION */}
      <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <motion.img
          initial={false}
          animate={{ width: isCollapsed ? '44px' : '150px' }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          src="/logo.png"
          alt="StockIntel"
          style={{
            borderRadius: '16px',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/dashboard')}
        />
      </div>

      {/* THEME TOGGLE */}
      <div style={{ marginBottom: '30px', padding: '0 10px' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDarkMode(!darkMode)}
          style={{
            width: '100%',
            background: c.hover,
            border: `1px solid ${c.border}`,
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            cursor: 'pointer',
            transition: '0.2s'
          }}
        >
          {!isCollapsed && <span style={{ fontSize: '14px', fontWeight: '700', color: c.text }}>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>}
          {darkMode ? <Moon size={18} color={c.accent} /> : <Sun size={18} color="#eab308" />}
        </motion.button>
      </div>

      {/* NAVIGATION */}
      <nav style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px', 
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <motion.div
              key={item.path}
              whileHover={{ x: 5, background: c.hover }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(item.path)}
              title={isCollapsed ? item.label : ''} 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: isCollapsed ? '0' : '15px',
                padding: '12px 15px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: active ? `${c.accent}15` : 'transparent',
                borderLeft: active ? `4px solid ${c.accent}` : '4px solid transparent',
                transition: 'all 0.2s',
                color: active ? c.accent : c.sub,
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {!isCollapsed && <span style={{ fontSize: '15px', fontWeight: active ? '800' : '600', whiteSpace: 'nowrap' }}>{item.label}</span>}
            </motion.div>
          );
        })}
      </nav>

      {/* LOGOUT */}
      <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={logout}
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px solid ${darkMode ? '#f8514944' : '#cf222e44'}`,
            padding: '14px',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '12px',
            color: darkMode ? '#f85149' : '#cf222e',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => { e.currentTarget.style.background = darkMode ? '#f85149' : '#cf222e'; e.currentTarget.style.color = 'white'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = darkMode ? '#f85149' : '#cf222e'; }}
        >
          <LogOut size={18} />
          {!isCollapsed && <span style={{ fontSize: '14px', fontWeight: '800' }}>LOGOUT TERMINAL</span>}
        </motion.button>
      </div>

    </div>
  );
}

export default Sidebar;