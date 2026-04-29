import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 15000
});

// Attach JWT token to every request
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// Auto-logout on 401 (expired or invalid token)
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear everything and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login:    (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
};

export const watchlistAPI = {
  get:        ()       => API.get('/watchlist'),
  getSymbols: ()       => API.get('/watchlist/symbols'),
  add:        (symbol) => API.post('/watchlist/add', { symbol }),
  remove:     (symbol) => API.delete(`/watchlist/remove?symbol=${symbol}`),
  togglePin:  (symbol) => API.post('/watchlist/toggle-pin', { symbol }),
};

export const announcementsAPI = {
  get:             ()                => API.get('/announcements'),
  getCount:        ()                => API.get('/announcements/count'),
  getRecent:       ()                => API.get('/announcements/recent'),
  getSummary:      (annId)           => API.get(`/announcements/${annId}/summary`),
  getComparison:   (annId)           => API.get(`/announcements/${annId}/compare`),
  getRangeSummary: (announcements)   => API.post('/announcements/range-summary', { announcements }),
  sync:            ()                => API.post('/announcements/sync'),
};

export const stocksAPI = {
  getAll:     ()       => API.get('/stocks'),
  getSummary: (symbol) => API.get(`/stocks/${symbol}/summary`),
  getHistory: (symbol, period = '1mo') => API.get(`/stocks/${symbol}/history?period=${period}`),
  getDetails: (symbol) => API.get(`/stocks/${symbol}/details`),
  search:     (query)  => API.get(`/stocks/search?q=${query}`),
  getMarketList: (category) => API.get(`/stocks/market-list/${category}`),
};

export const alertsAPI = {
  getAll: ()     => API.get('/alerts'),
  create: (data) => API.post('/alerts', data),
  delete: (id)   => API.delete(`/alerts/${id}`),
};

export const marketAPI = {
  getOverview: () => API.get('/market/overview'),
};


export default API;