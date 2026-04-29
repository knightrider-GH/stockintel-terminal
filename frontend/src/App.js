  import React, { useState, useEffect, createContext, useContext } from 'react';
  import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
  import { AuthProvider, useAuth } from './context/AuthContext';
  import Login from './pages/Login';
  import Register from './pages/Register';
  import Dashboard from './pages/Dashboard';
  import Watchlist from './pages/Watchlist';
  import Intelligence from './pages/Intelligence';
  import Alerts from './pages/Alerts';
  import Settings from './pages/Settings';
  import Sidebar from './components/Sidebar';
  import ErrorBoundary from './components/ErrorBoundary';
  import { MarketProvider } from './context/MarketContext';

  // ── THEME CONTEXT — exported so all pages can use useTheme() ──────────────────
  export const ThemeContext = createContext();
  export function useTheme() {
    return useContext(ThemeContext);
  }

  function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/login" />;
  }

  function AppLayout({ children }) {
    const { dark, setDark, isCollapsed, setIsCollapsed } = useTheme();

    useEffect(() => {
      document.body.style.background = dark ? '#0f172a' : '#f8fafc';
    }, [dark]);

    const sidebarWidth = isCollapsed ? '88px' : '280px';

    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        background: dark ? '#0f172a' : '#f8fafc'
      }}>
        <Sidebar darkMode={dark} setDarkMode={setDark} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <div style={{
          marginLeft: sidebarWidth,
          width: `calc(100% - ${sidebarWidth})`,
          transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
          minHeight: '100vh',
          background: dark ? '#0f172a' : '#f8fafc'
        }}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  function App() {
    const [dark, setDark] = useState(
      localStorage.getItem('darkMode') === 'true'
    );
    const [isCollapsed, setIsCollapsed] = useState(
      localStorage.getItem('sidebarCollapsed') === 'true'
    );

    useEffect(() => {
      localStorage.setItem('darkMode', dark);
    }, [dark]);

    useEffect(() => {
      localStorage.setItem('sidebarCollapsed', isCollapsed);
    }, [isCollapsed]);

    return (
      <ThemeContext.Provider value={{ dark, setDark, isCollapsed, setIsCollapsed }}>
        <AuthProvider>
          <MarketProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
                <Route path="/watchlist" element={<ProtectedRoute><AppLayout><Watchlist /></AppLayout></ProtectedRoute>} />
                <Route path="/intelligence" element={<ProtectedRoute><AppLayout><Intelligence /></AppLayout></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute><AppLayout><Alerts /></AppLayout></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
                <Route path="/" element={<Navigate to="/dashboard" />} />
              </Routes>
            </Router>
          </MarketProvider>
        </AuthProvider>
      </ThemeContext.Provider>
    );
  }

  export default App;
