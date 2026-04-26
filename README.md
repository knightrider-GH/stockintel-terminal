# 📈 StockIntel Terminal v4.0

### Institutional-Grade AI Market Intelligence Terminal

StockIntel Terminal is a production-ready, high-density financial intelligence platform inspired by institutional systems like Bloomberg and Reuters. It combines real-time market data with AI-driven document analysis and a multi-channel notification engine (Telegram & Email) to provide traders with a professional-grade monitoring environment.

---

## 🌟 Key Features

- **Institutional Dashboard**: A high-density overview of market performance with real-time price action.
- **AI Intelligence Engine**: Automated scraping and analysis of NSE corporate filings using **Groq AI (Llama 3)**.
- **Advanced Charting**: Integrated technical analysis charts with Candlestick, Mountain, and Line views, plus Volume histograms.
- **Multi-Channel Alerts**: 
  - **Telegram Alerts**: Instant bot notifications for price breakouts and high-impact filings.
  - **Email Alerts**: Professional HTML-formatted investment-grade reports sent to your inbox.
- **Smart Watchlist**: Manage your assets with 7D sparkline trends and real-time P&L tracking.
- **Institutional Activity Feed**: Live feed of corporate actions, board meetings, and earnings reports.
- **AI Range Summaries**: Get a synthesized AI overview of all market events over any custom date range.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React.js
- **Styling**: Vanilla CSS (Institutional Dark Mode)
- **Visuals**: ApexCharts (Technical Analysis), Lucide-React (Icons), Framer Motion (Animations)
- **State Management**: React Context API

### Backend
- **Framework**: Flask (Python)
- **Database**: MySQL / MariaDB
- **ORM**: SQLAlchemy / PyMySQL
- **Task Scheduling**: APScheduler (Background monitoring)
- **AI Processing**: Groq Cloud API (Llama 3 70B)
- **Data Source**: Yahoo Finance API (yfinance)

---

## 📸 Screenshots

*(Add your screenshots here for a professional portfolio look)*

- **Dashboard**: `[Dashboard Screenshot Placeholder]`
- **Intelligence Center**: `[Intelligence Center Screenshot Placeholder]`
- **Technical Charts**: `[Chart View Screenshot Placeholder]`
- **Notifications**: `[Telegram/Email Proof Screenshot Placeholder]`

---

## 🚀 Installation & Setup

### 1. Prerequisites
- Python 3.8+
- Node.js & npm
- MySQL / MariaDB Server

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
GROQ_API_KEY=your_key
DB_PASSWORD=your_password
TELEGRAM_BOT_TOKEN=your_token
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 5. Database Initialization
```bash
# Ensure MySQL is running, then create the database:
mysql -u root -p -e "CREATE DATABASE stock_tracker;"
# The backend will automatically handle migrations on first run.
```

### 6. Run the Project
**Terminal 1 (Backend):**
```bash
python app.py
```
**Terminal 2 (Frontend):**
```bash
npm start
```

---

## 🤖 Notification Setup

### Telegram Setup Guide
1. Message **@BotFather** on Telegram to create a new bot.
2. Copy the `API Token` to your `.env`.
3. Message **@userinfobot** to get your `Chat ID`.
4. Add the Chat ID to your `.env` or settings page.

### Email Setup Guide
1. Go to your Google Account settings -> Security.
2. Enable **2-Step Verification**.
3. Search for **App Passwords**.
4. Generate a new password for "Mail" and "Other (StockIntel)".
5. Use this 16-character code as your `EMAIL_PASS`.

---

## 🌐 Deployment

### Backend (Render / Railway)
1. Connect your GitHub repository.
2. Set the build command: `pip install -r requirements.txt`
3. Set the start command: `gunicorn app:app` (ensure gunicorn is in requirements).
4. Add your Environment Variables in the provider's dashboard.

### Frontend (Vercel / Netlify)
1. Connect your GitHub repository.
2. Set the build command: `npm run build`
3. Set the output directory: `build`
4. Update the `api.js` base URL to point to your deployed backend.

---

## 🔮 Future Roadmap

- [ ] **Direct Broker Integration**: Buy/Sell directly from the terminal via Zerodha/Kite API.
- [ ] **Advanced Backtesting**: Test strategies on historical NSE data.
- [ ] **Social Sentiment**: Sentiment analysis of Twitter/X and news headlines.
- [ ] **Institutional Heatmaps**: Sector-wise heatmaps for volume and price action.

---

## 📄 License
This project is for educational and portfolio purposes.

---

**StockIntel Terminal** — *Built for traders who demand more intelligence.*
