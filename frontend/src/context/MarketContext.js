import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { marketAPI, watchlistAPI, announcementsAPI } from '../services/api';

const MarketContext = createContext();

export function useMarket() {
  return useContext(MarketContext);
}

export function MarketProvider({ children }) {
  const [marketOverview, setMarketOverview] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState({
    market: false,
    watchlist: false,
    announcements: false
  });
  const [lastFetched, setLastFetched] = useState(null);

  const fetchMarketOverview = useCallback(async () => {
    setLoading(prev => ({ ...prev, market: true }));
    try {
      const res = await marketAPI.getOverview();
      setMarketOverview(res.data);
    } catch (e) {
      console.error('Failed to fetch market overview', e);
    } finally {
      setLoading(prev => ({ ...prev, market: false }));
    }
  }, []);

  const fetchWatchlist = useCallback(async () => {
    setLoading(prev => ({ ...prev, watchlist: true }));
    try {
      const res = await watchlistAPI.get();
      setWatchlist(res.data || []);
    } catch (e) {
      console.error('Failed to fetch watchlist', e);
    } finally {
      setLoading(prev => ({ ...prev, watchlist: false }));
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(prev => ({ ...prev, announcements: true }));
    try {
      const res = await announcementsAPI.get();
      setAnnouncements(res.data || []);
    } catch (e) {
      console.error('Failed to fetch announcements', e);
    } finally {
      setLoading(prev => ({ ...prev, announcements: false }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    console.log('Refreshing all market data...');
    await Promise.all([
      fetchMarketOverview(),
      fetchWatchlist(),
      fetchAnnouncements()
    ]);
    setLastFetched(new Date());
  }, [fetchMarketOverview, fetchWatchlist, fetchAnnouncements]);

  // Initial fetch
  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 60000); // 1 minute auto-refresh
    return () => clearInterval(interval);
  }, [refreshAll]);

  const value = {
    marketOverview,
    watchlist,
    announcements,
    loading,
    lastFetched,
    refreshAll,
    fetchWatchlist,
    fetchMarketOverview,
    fetchAnnouncements
  };

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  );
}
