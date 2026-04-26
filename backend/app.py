from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room
import pymysql
from dotenv import load_dotenv
import os, bcrypt, yfinance as yf, threading, time
from datetime import timedelta
from groq import Groq
import re as _re_global
from apscheduler.schedulers.background import BackgroundScheduler
import requests
import json
from utils.notifications_engine import TelegramManager, EmailManager

load_dotenv()

# ── MOJIBAKE / ENCODING CLEANUP ──────────────────────────────────────────────
def fix_mojibake(text):
    """Fix garbled UTF-8 text (double-encoded / mojibake) from AI output."""
    if not isinstance(text, str):
        return text
    # Attempt proper decode first (handles bytes mis-stored as latin-1)
    try:
        fixed = text.encode('cp1252').decode('utf-8')
        if fixed != text:
            return fixed
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    # Manual replacements for common mojibake patterns
    pairs = [
        ('\u00e2\u0080\u0099', '\u2019'), ('\u00e2\u0080\u0098', '\u2018'),
        ('\u00e2\u0080\u009c', '\u201c'), ('\u00e2\u0080\u009d', '\u201d'),
        ('\u00e2\u0080\u0093', '\u2013'), ('\u00e2\u0080\u0094', '\u2014'),
        ('\u00e2\u0080\u00a2', '\u2022'), ('\u00e2\u0080\u00ba', '\u203a'),
        ('\u00e2\u0086\u0091', '\u2191'), ('\u00e2\u0086\u0093', '\u2193'),
        ('\u00e2\u0086\u0092', '\u2192'), ('\u00e2\u0086\u0090', '\u2190'),
        ('\u00e2\u009c\u0085', '\u2713'), ('\u00e2\u009c\u0093', '\u2713'),
        ('\u00e2\u0082\u00b9', '\u20b9'), ('\u00e2\u009a\u00a1', '\u26a1'),
        ('\u00e2\u0080\u00a6', '\u2026'), ('\u00c2\u00a0', ' '), ('\u00c2', ''),
    ]
    for bad, good in pairs:
        text = text.replace(bad, good)
    return text

def clean_ai_result(obj):
    """Recursively apply fix_mojibake to all strings in a dict/list."""
    if isinstance(obj, str):
        return fix_mojibake(obj)
    if isinstance(obj, list):
        return [clean_ai_result(item) for item in obj]
    if isinstance(obj, dict):
        return {k: clean_ai_result(v) for k, v in obj.items()}
    return obj

load_dotenv()

app = Flask(__name__)
app.config['JWT_SECRET_KEY']          = os.getenv('JWT_SECRET_KEY', 'stock-intel-v4-final-super-secret-key-2024')
app.config['SECRET_KEY']              = os.getenv('FLASK_SECRET_KEY', 'socket-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
app.json.ensure_ascii = False  # Output real UTF-8 in JSON responses

CORS(app, resources={r"/*": {"origins": "*"}})
jwt      = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ── GROQ ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
ai_client    = None
if GROQ_API_KEY:
    try:    ai_client = Groq(api_key=GROQ_API_KEY);  print("[OK] Groq ready")
    except Exception as e: print(f"[ERROR] Groq error: {e}")
else:
    print("[WARN] GROQ_API_KEY not set")

# ── DB ────────────────────────────────────────────────────────────────────────
def get_db():
    return pymysql.connect(
        host=os.getenv('DB_HOST','localhost'), user=os.getenv('DB_USER','root'),
        password=os.getenv('DB_PASSWORD','12345'), database=os.getenv('DB_NAME','stock_tracker'),
        cursorclass=pymysql.cursors.DictCursor, autocommit=True
    )

# ── MIGRATIONS ────────────────────────────────────────────────────────────────
def run_migrations():
    db = get_db(); cursor = db.cursor()
    try:
        try:   cursor.execute("ALTER TABLE announcements ADD COLUMN ai_summary TEXT DEFAULT NULL")
        except: pass
        try:   cursor.execute("ALTER TABLE announcements ADD COLUMN ai_sentiment VARCHAR(10) DEFAULT NULL")
        except: pass
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS price_alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL, stock_id INT NOT NULL,
                target_price DECIMAL(10,2) NOT NULL,
                direction ENUM('above','below') DEFAULT 'above',
                alert_type ENUM('price', 'volume', 'support', 'resistance') DEFAULT 'price',
                channel ENUM('email', 'telegram', 'both') DEFAULT 'both',
                triggered TINYINT(1) DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE
            )
        """)
        
        # New Tables for Notification System
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id INT PRIMARY KEY,
                email_alerts_enabled BOOLEAN DEFAULT TRUE,
                telegram_alerts_enabled BOOLEAN DEFAULT TRUE,
                telegram_chat_id VARCHAR(100),
                daily_summary_enabled BOOLEAN DEFAULT TRUE,
                ai_alerts_enabled BOOLEAN DEFAULT TRUE,
                price_alerts_enabled BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                stock_id INT,
                type VARCHAR(50),
                title TEXT,
                message TEXT,
                channel ENUM('email', 'telegram', 'both'),
                status ENUM('sent', 'failed', 'pending') DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE SET NULL
            )
        """)
        
        print("[OK] Migrations done")
    except Exception as e: print(f"Migration error: {e}")
    finally: db.close()

# ── AUTH ──────────────────────────────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    db = get_db(); cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE email = %s", (data.get('email'),))
    user = cursor.fetchone(); db.close()
    if user and bcrypt.checkpw(data.get('password').encode(), user['password'].encode()):
        token = create_access_token(identity=str(user['id']))
        return jsonify({'token': token, 'user': {'id': user['id'], 'name': user['name']}})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    name, email, password = data.get('name','').strip(), data.get('email','').strip(), data.get('password','')
    if not name or not email or not password:
        return jsonify({'error': 'All fields required'}), 400
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("INSERT INTO users (name, email, password) VALUES (%s, %s, %s)", (name, email, hashed))
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        token = create_access_token(identity=str(user['id']))
        return jsonify({'token': token, 'user': {'id': user['id'], 'name': user['name']}}), 201
    except pymysql.err.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 409
    finally: db.close()

# ── STOCKS ────────────────────────────────────────────────────────────────────
# ── MARKET DATA ──────────────────────────────────────────────────────────────
@app.route('/api/market/overview', methods=['GET'])
def get_market_overview():
    indices = {
        'NIFTY 50': '^NSEI',
        'SENSEX': '^BSESN',
        'BANK NIFTY': '^NSEBANK',
        'NIFTY IT': '^CNXIT',
        'INDIA VIX': '^INDIAVIX',
        'USD/INR': 'INR=X',
        'GOLD': 'GC=F',
        'CRUDE OIL': 'CL=F',
        'BTC/USD': 'BTC-USD',
        'NASDAQ': '^IXIC'
    }
    
    # Simple Server-side Cache
    global _MARKET_CACHE
    if '_MARKET_CACHE' not in globals():
        _MARKET_CACHE = {'data': None, 'time': 0}
    
    now = time.time()
    if _MARKET_CACHE['data'] and (now - _MARKET_CACHE['time'] < 60):
        return jsonify(_MARKET_CACHE['data'])

    results = {
        'indices': [],
        'movers': {
            'gainers': [],
            'losers': []
        },
        'heatmap': []
    }

    def fetch_index_data(name, sym):
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            price = round(info.last_price, 2)
            prev_close = ticker.info.get('previousClose', price)
            change = round(price - prev_close, 2)
            change_pct = round((change / prev_close) * 100, 2) if prev_close else 0
            
            # Sparkline data (intraday)
            hist = ticker.history(period='1d', interval='15m')
            sparkline = [round(x, 2) for x in hist['Close'].tolist()] if not hist.empty else []
            
            results['indices'].append({
                'name': name,
                'price': price,
                'change': change,
                'changePct': change_pct,
                'sparkline': sparkline
            })
        except Exception as e:
            print(f"Error fetching index {name}: {e}")

    # Fetch top movers (Simulate by checking Nifty 50 heavyweight stocks)
    heavyweights = [
        'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'INFY.NS', 
        'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LTIM.NS', 'HINDUNILVR.NS',
        'AXISBANK.NS', 'LT.NS', 'KOTAKBANK.NS', 'ADANIENT.NS', 'SUNPHARMA.NS'
    ]

    movers_list = []
    def fetch_mover_data(sym):
        try:
            t = yf.Ticker(sym)
            price = round(t.fast_info.last_price, 2)
            prev = t.info.get('previousClose', price)
            pct = round(((price - prev) / prev) * 100, 2) if prev else 0
            movers_list.append({
                'symbol': sym.replace('.NS', ''),
                'price': price,
                'changePct': pct
            })
        except: pass

    threads = [threading.Thread(target=fetch_index_data, args=(k, v)) for k, v in indices.items()]
    threads += [threading.Thread(target=fetch_mover_data, args=(s,)) for s in heavyweights]
    
    for t in threads: t.start()
    for t in threads: t.join()

    # Sort movers
    sorted_movers = sorted(movers_list, key=lambda x: x['changePct'], reverse=True)
    results['movers']['gainers'] = sorted_movers[:5]
    results['movers']['losers'] = sorted_movers[-5:][::-1]
    results['heatmap'] = sorted_movers

    # Update Cache
    _MARKET_CACHE['data'] = results
    _MARKET_CACHE['time'] = now

    return jsonify(results)

@app.route('/api/stocks', methods=['GET'])
def get_stocks():
    db = get_db(); cursor = db.cursor()
    cursor.execute("SELECT * FROM stocks ORDER BY symbol ASC")
    data = cursor.fetchall(); db.close()
    return jsonify(data)

# ── WATCHLIST ─────────────────────────────────────────────────────────────────
@app.route('/api/watchlist/symbols', methods=['GET'])
@jwt_required()
def get_watchlist_symbols():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    cursor.execute("""
        SELECT s.id, s.symbol, s.company_name
        FROM stocks s JOIN watchlist w ON s.id = w.stock_id
        WHERE w.user_id = %s
    """, (user_id,))
    stocks = cursor.fetchall(); db.close()
    return jsonify(stocks)

@app.route('/api/watchlist', methods=['GET'])
@jwt_required()
def get_watchlist():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    cursor.execute("""
        SELECT s.id, s.symbol, s.company_name, s.exchange, w.is_pinned,
               (SELECT COUNT(*) FROM price_alerts WHERE stock_id = s.id AND user_id = %s AND triggered = 0) as alert_count
        FROM stocks s JOIN watchlist w ON s.id = w.stock_id
        WHERE w.user_id = %s
        ORDER BY w.is_pinned DESC, s.symbol ASC
    """, (user_id, user_id))
    stocks = cursor.fetchall(); db.close()

    def fetch_market_data(stock):
        try:
            suffix = '.NS' if stock.get('exchange', 'NSE') == 'NSE' else '.BO'
            sym = f"{stock['symbol']}{suffix}"
            t = yf.Ticker(sym)
            fast = t.fast_info
            
            stock['price'] = round(fast.last_price, 2)
            prev = t.info.get('previousClose', stock['price'])
            stock['change'] = round(((stock['price'] - prev) / prev) * 100, 2) if prev > 0 else 0
            
            # Fetch 7D history for sparkline
            hist = t.history(period='7d', interval='1h')
            stock['sparkline'] = [round(p, 2) for p in hist['Close'].tolist()] if not hist.empty else []
            
            # Signal Logic (Simple)
            stock['signals'] = []
            if stock['change'] > 3: stock['signals'].append('BULLISH')
            if stock['change'] < -3: stock['signals'].append('BEARISH')
            
            # Why Moving (Dummy/Basic logic - would ideally use news)
            stock['why_moving'] = "Normal market movement"
            if abs(stock['change']) > 2:
                stock['why_moving'] = "High volatility detected"
                
        except Exception as e:
            print(f"Error fetching {stock['symbol']}: {e}")
            stock['price'], stock['change'], stock['sparkline'] = 'N/A', 0, []
    
    import threading
    threads = [threading.Thread(target=fetch_market_data, args=(s,)) for s in stocks]
    for t in threads: t.start()
    for t in threads: t.join()
    return jsonify(stocks)

@app.route('/api/watchlist/toggle-pin', methods=['POST'])
@jwt_required()
def toggle_pin():
    user_id = get_jwt_identity()
    symbol = request.json.get('symbol', '').upper().strip()
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("""
            UPDATE watchlist w JOIN stocks s ON w.stock_id = s.id
            SET is_pinned = NOT is_pinned
            WHERE w.user_id = %s AND s.symbol = %s
        """, (user_id, symbol))
        db.commit()
        return jsonify({'message': 'Success'})
    finally: db.close()

@app.route('/api/stocks/search', methods=['GET'])
@jwt_required()
def search_stocks():
    query = request.args.get('q', '').strip()
    if not query: return jsonify([])
    try:
        import requests
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=8", headers=headers, timeout=5)
        results = []
        if res.status_code == 200:
            for q in res.json().get('quotes', []):
                if q.get('exchange') in ['NSI', 'NSE', 'BSE']:
                    sym = q.get('symbol', '')
                    if sym.endswith('.NS') or sym.endswith('.BO'):
                        clean_sym = sym.replace('.NS', '').replace('.BO', '')
                        results.append({
                            'symbol': clean_sym,
                            'name': q.get('shortname') or q.get('longname') or clean_sym,
                            'exchange': 'NSE' if sym.endswith('.NS') else 'BSE'
                        })
        return jsonify(results[:5])
    except Exception as e:
        print("Search API error:", e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/watchlist/add', methods=['POST'])
@jwt_required()
def add_to_watchlist():
    user_id = get_jwt_identity()
    symbol  = request.json.get('symbol', '').upper().strip()
    if not symbol: return jsonify({'error': 'No symbol'}), 400
    db = get_db(); cursor = db.cursor(); stock_id = None

    resolved_symbol = symbol
    company_name = symbol
    exchange_val = 'NSE'
    try:
        import requests
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(f"https://query2.finance.yahoo.com/v1/finance/search?q={symbol}&quotesCount=5", headers=headers, timeout=5)
        if res.status_code == 200:
            for q in res.json().get('quotes', []):
                if q.get('exchange') in ['NSI', 'NSE', 'BSE']:
                    sym = q.get('symbol', '')
                    if sym.endswith('.NS'):
                        resolved_symbol = sym.replace('.NS', '')
                        exchange_val = 'NSE'
                        company_name = q.get('shortname') or q.get('longname') or resolved_symbol
                        break
                    elif sym.endswith('.BO'):
                        resolved_symbol = sym.replace('.BO', '')
                        exchange_val = 'BSE'
                        company_name = q.get('shortname') or q.get('longname') or resolved_symbol
    except Exception as e:
        print("Symbol resolution error:", e)

    try:
        cursor.execute("SELECT id FROM stocks WHERE symbol = %s", (resolved_symbol,))
        stock = cursor.fetchone()
        if stock:
            stock_id = stock['id']
        else:
            cursor.execute("INSERT INTO stocks (symbol, company_name, exchange) VALUES (%s, %s, %s)", (resolved_symbol, company_name, exchange_val))
            stock_id = cursor.lastrowid
            if not stock_id:
                cursor.execute("SELECT id FROM stocks WHERE symbol = %s", (resolved_symbol,))
                row = cursor.fetchone()
                stock_id = row['id'] if row else None
        if not stock_id:
            return jsonify({'error': f'Could not resolve stock id for {resolved_symbol}'}), 500
        cursor.execute("SELECT id FROM watchlist WHERE user_id = %s AND stock_id = %s", (user_id, stock_id))
        if cursor.fetchone():
            return jsonify({'message': 'Already in watchlist'}), 200
        cursor.execute("INSERT INTO watchlist (user_id, stock_id) VALUES (%s, %s)", (user_id, stock_id))
        return jsonify({'message': 'Added', 'symbol': resolved_symbol}), 201
    except Exception as e:
        print(f"Add watchlist error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close(); db.close()
        def scrape(sym):
            try:
                import subprocess, sys
                path = os.path.join(os.path.dirname(__file__), 'scraper', 'nse_scraper.py')
                if os.path.exists(path): subprocess.Popen([sys.executable, path, sym])
            except Exception as e: print(f"Scrape trigger failed: {e}")
        threading.Thread(target=scrape, args=(resolved_symbol,), daemon=True).start()

@app.route('/api/watchlist/remove', methods=['DELETE'])
@jwt_required()
def remove_from_watchlist():
    user_id = get_jwt_identity()
    symbol  = request.args.get('symbol', '').upper().strip()
    if not symbol: return jsonify({'error': 'No symbol provided'}), 400
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("SELECT id FROM stocks WHERE symbol = %s", (symbol,))
        stock = cursor.fetchone()
        if not stock: return jsonify({'error': f'Stock {symbol} not found'}), 404
        cursor.execute("DELETE FROM watchlist WHERE user_id = %s AND stock_id = %s", (user_id, stock['id']))
        return jsonify({'message': 'Removed', 'symbol': symbol})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally: db.close()

# ── STOCK HISTORY (FOR CHART) ────────────────────────────────────────────────
@app.route('/api/stocks/<symbol>/history', methods=['GET'])
@jwt_required()
def get_stock_history(symbol):
    period = request.args.get('period', '1mo')
    interval = request.args.get('interval', '1h')
    
    # Common suffix handling
    full_symbol = symbol if ('.' in symbol or '^' in symbol or '=' in symbol) else f"{symbol}.NS"
    
    try:
        ticker = yf.Ticker(full_symbol)
        hist = ticker.history(period=period, interval=interval)
        
        # Weekend / Holiday fallback for 1D chart
        if hist.empty and period == '1d':
            hist = ticker.history(period='5d', interval=interval)
            if not hist.empty:
                last_date = hist.index[-1].date()
                hist = hist[hist.index.date == last_date]
        
        if hist.empty:
            return jsonify({'error': 'No data found'}), 404
            
        hist = hist.reset_index()
        # Ensure all required columns exist
        required = ['Open', 'High', 'Low', 'Close', 'Volume']
        if not all(col in hist.columns for col in required):
            return jsonify({'error': 'Missing OHLCV data'}), 404
            
        hist = hist.dropna(subset=required)
        
        # Determine the date column name (it varies based on interval/period)
        date_col = 'Date' if 'Date' in hist.columns else 'Datetime'
        
        # Convert to records
        data = []
        for _, row in hist.iterrows():
            ts = int(row[date_col].timestamp() * 1000)
            data.append({
                'timestamp': ts,
                'open': round(float(row['Open']), 2),
                'high': round(float(row['High']), 2),
                'low': round(float(row['Low']), 2),
                'close': round(float(row['Close']), 2),
                'volume': int(row['Volume'])
            })
            
        # Ensure sorting
        data.sort(key=lambda x: x['timestamp'])
        
        # Meta info
        try:
            info = ticker.fast_info
            current_price = round(info.last_price, 2)
            try:
                long_name = ticker.info.get('longName', symbol)
            except:
                long_name = symbol
            
            # Change info
            prev_close = ticker.info.get('previousClose', current_price)
            change = round(current_price - prev_close, 2)
            pct_change = round((change / prev_close) * 100, 2) if prev_close else 0
            
            # Last updated time
            last_updated = time.strftime('%B %d at %I:%M %p GMT+5:30', time.localtime())
        except:
            current_price = data[-1]['close'] if data else 0
            long_name = symbol
            change = 0
            pct_change = 0
            last_updated = "Live"

        return jsonify({
            'symbol': symbol,
            'name': long_name,
            'currentPrice': current_price,
            'change': change,
            'changePct': pct_change,
            'lastUpdated': last_updated,
            'history': data
        })
        
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        return jsonify({'error': str(e)}), 500

# ── ANNOUNCEMENTS & AI ────────────────────────────────────────────────────────
ANN_BASE_QUERY = """
    SELECT a.id, s.symbol, a.title, a.announcement_date, a.source_url
    FROM announcements a
    JOIN stocks s ON a.stock_id = s.id
    JOIN watchlist w ON s.id = w.stock_id
    WHERE w.user_id = %s
    ORDER BY STR_TO_DATE(a.announcement_date, '%%d-%%b-%%Y') DESC
"""

@app.route('/api/announcements', methods=['GET'])
@jwt_required()
def get_announcements():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    cursor.execute(ANN_BASE_QUERY, (user_id,))
    data = cursor.fetchall(); db.close()
    return jsonify(data)

@app.route('/api/announcements/sync', methods=['POST'])
@jwt_required()
def sync_announcements():
    def scrape():
        try:
            import subprocess, sys, os
            path = os.path.join(os.path.dirname(__file__), 'scraper', 'nse_scraper.py')
            if os.path.exists(path):
                subprocess.Popen([sys.executable, path])
        except Exception as e: 
            print(f"Scrape trigger failed: {e}")
    
    import threading
    threading.Thread(target=scrape, daemon=True).start()
    return jsonify({'message': 'Global sync started in background'}), 200

@app.route('/api/announcements/count', methods=['GET'])
@jwt_required()
def get_announcements_count():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    cursor.execute("""
        SELECT COUNT(*) as total FROM announcements a
        JOIN stocks s ON a.stock_id = s.id
        JOIN watchlist w ON s.id = w.stock_id
        WHERE w.user_id = %s
    """, (user_id,))
    result = cursor.fetchone(); db.close()
    return jsonify({'count': result['total'] if result else 0})

@app.route('/api/announcements/recent', methods=['GET'])
@jwt_required()
def get_recent_announcements():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    cursor.execute(ANN_BASE_QUERY + " LIMIT 5", (user_id,))
    data = cursor.fetchall(); db.close()
    return jsonify(data)

@app.route('/api/announcements/<int:ann_id>/summary', methods=['GET'])
@jwt_required()
def get_announcement_summary(ann_id):
    if not ai_client:
        return jsonify({'summary': '[WARN] Groq AI not available. Add GROQ_API_KEY to .env and restart.'}), 200
    
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("SELECT title, source_url, ai_summary, ai_sentiment FROM announcements WHERE id = %s", (ann_id,))
        ann = cursor.fetchone()
        if not ann:
            return jsonify({'error': 'Announcement not found'}), 404

        # Return cached JSON if available (new format) — skip old plain-text cache
        if ann.get('ai_summary'):
            import json as _json
            try:
                cached = _json.loads(ann['ai_summary'])
                if isinstance(cached, dict) and 'impact_score' in cached:
                    return jsonify(clean_ai_result(cached))
                # Old plain-text — fall through to regenerate with new prompt
            except: pass

        # --- PDF EXTRACTION ---
        import requests, io, json
        from PyPDF2 import PdfReader
        pdf_text = ""
        if ann.get('source_url'):
            try:
                headers = {'User-Agent': 'Mozilla/5.0'}
                response = requests.get(ann['source_url'], headers=headers, timeout=10)
                if response.status_code == 200:
                    pdf_file = io.BytesIO(response.content)
                    reader = PdfReader(pdf_file)
                    for i in range(min(2, len(reader.pages))):
                        pdf_text += reader.pages[i].extract_text() + "\n"
            except Exception as e: print(f"[WARN] Could not read PDF: {e}")

        prompt = f"""You are a senior financial analyst at a Bloomberg terminal, specializing in Indian NSE/BSE stocks.

Announcement Title: "{ann['title']}"

Extracted PDF Content:
"{pdf_text[:3000]}"

Analyze this filing and respond ONLY with a valid JSON object in this EXACT format (no markdown, no explanation, just raw JSON):

{{
  "sentiment": "bullish",
  "impact_score": 7.5,
  "priority": "High",
  "summary": "2-3 sentence key insight for an institutional investor. No asterisks.",
  "why_it_matters": [
    "Revenue impact: one-line point",
    "Promoter activity: one-line point",
    "Expansion signal: one-line point"
  ],
  "market_reaction": "Positive Opening Likely",
  "investor_action": [
    "Monitor closely before next earnings",
    "Long-term positive — accumulate on dips"
  ]
}}

Rules:
- sentiment: exactly one of "bullish", "bearish", "neutral"
- impact_score: float 0.0–10.0
- priority: exactly one of "Low", "Medium", "High", "Critical"
- why_it_matters: 3-5 bullets starting with a label: "Revenue impact:", "Debt concern:", "Promoter activity:", "Expansion signal:", "Legal risk:", "Regulatory effect:", "Dividend:", "Board change:"
- market_reaction: one of "Positive Opening Likely", "Volatile Session Expected", "Negative Pressure Likely", "Neutral / Wait & Watch", "High Volatility Expected"
- investor_action: 2-3 specific, practical guidance items
- summary: plain string, no asterisks"""

        import re as _re
        raw = ai_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600
        ).choices[0].message.content.strip()

        result = None
        try:
            result = json.loads(raw)
        except:
            m = _re.search(r'\{[\s\S]*\}', raw)
            if m:
                try: result = json.loads(m.group())
                except: pass

        if result and isinstance(result, dict):
            sentiment = str(result.get('sentiment', 'neutral')).lower()
            if sentiment not in ('bullish', 'bearish', 'neutral'): sentiment = 'neutral'
            result['sentiment']       = sentiment
            result['impact_score']    = float(result.get('impact_score', 5.0))
            result['priority']        = result.get('priority', 'Medium')
            result['why_it_matters']  = result.get('why_it_matters', [])
            result['market_reaction'] = result.get('market_reaction', 'Neutral / Wait & Watch')
            result['investor_action'] = result.get('investor_action', [])
            result['summary']         = result.get('summary', '')
            try:
                cursor.execute(
                    "UPDATE announcements SET ai_summary = %s, ai_sentiment = %s WHERE id = %s",
                    (json.dumps(result), sentiment, ann_id)
                )
            except: pass
            result = clean_ai_result(result)
            return jsonify(result)
        else:
            return jsonify(clean_ai_result({
                'summary': raw, 'sentiment': 'neutral', 'impact_score': 5.0,
                'priority': 'Medium', 'why_it_matters': [],
                'market_reaction': 'Neutral / Wait & Watch', 'investor_action': []
            }))

    except Exception as e:
        msg = str(e)
        return jsonify({
            'summary': '[ERROR] Groq quota exceeded.' if ('quota' in msg.lower() or '429' in msg.lower()) else f'[ERROR] AI Error: {msg}',
            'sentiment': 'neutral', 'impact_score': 5.0, 'priority': 'Medium',
            'why_it_matters': [], 'market_reaction': 'Neutral / Wait & Watch', 'investor_action': []
        }), 200
    finally:
        db.close()

@app.route('/api/announcements/range-summary', methods=['POST'])
@jwt_required()
def get_range_summary():
    data = request.json
    announcements = data.get('announcements', [])
    
    if not announcements:
        return jsonify({'summary': 'No announcements in this period.'})
        
    if not ai_client:
        return jsonify({'summary': '[WARN] Groq AI not available.'}), 200
        
    # Build context string from announcements (limit to 30 for token limits)
    context_lines = []
    for ann in announcements[:30]:
        context_lines.append(f"- {ann.get('symbol')}: {ann.get('title')}")
    context_text = "\n".join(context_lines)

    prompt = f"""You are a top-tier financial analyst operating a premium Bloomberg terminal for the Indian Stock Market (NSE/BSE).
I will provide you with a list of recent market announcements.
Please provide a very sharp, concise 1-2 sentence summary of the overarching market activity for this period. 
Focus on dominant sectors, highly active stocks, and major events (Earnings, Board Meetings, Dividends).

Announcements:
{context_text}

Respond ONLY with the 1-2 sentence summary. Make it sound professional and insightful."""

    try:
        summary = ai_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150
        ).choices[0].message.content.strip()
        return jsonify({'summary': fix_mojibake(summary)})
    except Exception as e:
        return jsonify({'summary': f'Failed to generate summary: {str(e)}'}), 200

@app.route('/api/stocks/<symbol>/summary', methods=['GET'])
@jwt_required()
def get_stock_summary(symbol):
    symbol = symbol.upper().strip()
    if not ai_client:
        return jsonify({'summary': '[WARN] Groq AI not available. Add GROQ_API_KEY to .env and restart.'}), 200
    prompt = f"""You are a helpful financial analyst for Indian retail investors.
Give a brief overview of the NSE-listed stock "{symbol}" in exactly 3 bullet points.
Use simple English. If unsure about recent data, say so clearly.

Respond in this exact format:
* [What this company does / sector]
* [Key things investors should know]
* [General risks or things to watch]"""
    try:
        summary = ai_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300
        ).choices[0].message.content.strip()
        return jsonify({'summary': fix_mojibake(summary)})
    except Exception as e:
        return jsonify({'summary': f'[ERROR] AI Error: {str(e)}'}), 200


# ── MARKET EXPLORER ──────────────────────────────────────────────────────────
MARKET_UNIVERSES = {
    'most-active': ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "INFOSYS.NS", "ITC.NS", "AXISBANK.NS", "KOTAKBANK.NS", "BAJFINANCE.NS", "TATAMOTORS.NS", "ADANIENT.NS", "JSWSTEEL.NS", "ONGC.NS", "ZOMATO.NS", "HDFCLIFE.NS", "WIPRO.NS", "POWERGRID.NS"],
    'day-gainers': ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "SBIN.NS", "INFOSYS.NS", "ITC.NS", "HINDUNILVR.NS", "LT.NS", "AXISBANK.NS", "KOTAKBANK.NS", "BAJFINANCE.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS", "M&M.NS", "ADANIENT.NS", "TATAMOTORS.NS", "ASIANPAINT.NS", "ULTRACEMCO.NS", "ONGC.NS", "NTPC.NS", "JSWSTEEL.NS", "POWERGRID.NS", "TATASTEEL.NS", "HCLTECH.NS", "COALINDIA.NS", "INDUSINDBK.NS", "SBILIFE.NS", "ZOMATO.NS", "TRENT.NS", "HAL.NS", "BEL.NS", "RECLTD.NS", "PFC.NS"],
    'day-losers': ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "SBIN.NS", "INFOSYS.NS", "ITC.NS", "HINDUNILVR.NS", "LT.NS", "AXISBANK.NS", "KOTAKBANK.NS", "BAJFINANCE.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS", "M&M.NS", "ADANIENT.NS", "TATAMOTORS.NS", "ASIANPAINT.NS", "ULTRACEMCO.NS", "ONGC.NS", "NTPC.NS", "JSWSTEEL.NS", "POWERGRID.NS", "TATASTEEL.NS", "HCLTECH.NS", "COALINDIA.NS", "INDUSINDBK.NS", "SBILIFE.NS", "ZOMATO.NS", "TRENT.NS", "HAL.NS", "BEL.NS", "RECLTD.NS", "PFC.NS"],
    'trending': ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "INFOSYS.NS", "ITC.NS", "TATAMOTORS.NS", "ADANIENT.NS", "ZOMATO.NS", "JIOFIN.NS", "IRFC.NS", "RVNL.NS", "SUZLON.NS", "PAYTM.NS", "NYKAA.NS", "POLICYBZR.NS"],
    'etfs': ["NIFTYBEES.NS", "BANKBEES.NS", "GOLDBEES.NS", "MON100.NS", "JUNIORBEES.NS", "LIQUIDBEES.NS", "ITBEES.NS", "PHARMABEES.NS", "CPSEETF.NS", "ICICINV20.NS"],
    'indices': ["^NSEI", "^BSESN", "^NSEBANK", "^CNXIT", "^CNXAUTO", "^CNXENERGY", "^CNXPHARMA", "^CNXREALTY", "^CNXINFRA", "^CNXMETAL", "^CNXMNC", "^CNXPSE"],
    'large-cap': ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "SBIN.NS", "INFOSYS.NS", "ITC.NS", "HINDUNILVR.NS", "LT.NS", "HCLTECH.NS", "ADANIENT.NS", "SUNPHARMA.NS", "MARUTI.NS"],
    'small-cap': ["SUZLON.NS", "IDEA.NS", "YESBANK.NS", "SOUTHBANK.NS", "PNB.NS", "UCOBANK.NS", "IOB.NS", "CENTRALBK.NS", "NHPC.NS", "SJVN.NS", "IFCI.NS", "IREDA.NS"],
}

_MARKET_LIST_CACHE = {}

@app.route('/api/stocks/market-list/<category>', methods=['GET'])
@jwt_required()
def get_market_list(category):
    global _MARKET_LIST_CACHE
    now = time.time()
    
    # Check cache (5 minute expiry)
    if category in _MARKET_LIST_CACHE:
        cache = _MARKET_LIST_CACHE[category]
        if now - cache['time'] < 300:
            return jsonify(cache['data'])

    symbols = MARKET_UNIVERSES.get(category, MARKET_UNIVERSES['most-active'])
    try:
        data = yf.download(symbols, period='2d', interval='1d', group_by='ticker', threads=True, progress=False)
        market_data = []
        for sym in symbols:
            try:
                hist = data[sym] if len(symbols) > 1 else data
                if hist.empty: continue
                # Handle cases where only 1 day is returned
                if len(hist) < 2:
                    curr = hist['Close'].iloc[-1]
                    prev = curr # Change is 0
                else:
                    curr = hist['Close'].iloc[-1]
                    prev = hist['Close'].iloc[-2]
                
                change = ((curr - prev) / prev) * 100 if prev else 0
                vol = hist['Volume'].iloc[-1]
                name = sym.replace('.NS', '').replace('^', '')
                if sym == '^NSEI': name = 'NIFTY 50'
                elif sym == '^BSESN': name = 'SENSEX'
                elif sym == '^NSEBANK': name = 'NIFTY BANK'
                
                market_data.append({
                    'symbol': sym.replace('.NS', ''),
                    'name': name,
                    'price': round(curr, 2),
                    'change': round(change, 2),
                    'volume': int(vol)
                })
            except: continue
            
        if category == 'day-gainers': market_data.sort(key=lambda x: x['change'], reverse=True)
        elif category == 'day-losers': market_data.sort(key=lambda x: x['change'])
        elif category == 'most-active': market_data.sort(key=lambda x: x['volume'], reverse=True)
        
        final_data = market_data[:12]
        # Update Cache
        _MARKET_LIST_CACHE[category] = {'data': final_data, 'time': now}
        return jsonify(final_data)
    except Exception as e: 
        print(f"Market list error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stocks/most-active', methods=['GET'])
@jwt_required()
def get_most_active(): return get_market_list('most-active')

@app.route('/api/stocks/day-gainers', methods=['GET'])
@jwt_required()
def get_day_gainers(): return get_market_list('day-gainers')

@app.route('/api/stocks/day-losers', methods=['GET'])
@jwt_required()
def get_day_losers(): return get_market_list('day-losers')

@app.route('/api/stocks/trending', methods=['GET'])
@jwt_required()
def get_trending(): return get_market_list('trending')

@app.route('/api/stocks/high-dividend', methods=['GET'])
@jwt_required()
def get_high_dividend(): return get_market_list('large-cap')

@app.route('/api/stocks/large-cap', methods=['GET'])
@jwt_required()
def get_large_cap(): return get_market_list('large-cap')

@app.route('/api/stocks/small-cap', methods=['GET'])
@jwt_required()
def get_small_cap(): return get_market_list('small-cap')

@app.route('/api/stocks/high-beta', methods=['GET'])
@jwt_required()
def get_high_beta(): return get_market_list('trending')

@app.route('/api/stocks/unusual-volume', methods=['GET'])
@jwt_required()
def get_unusual_volume(): return get_market_list('most-active')

@app.route('/api/stocks/etfs', methods=['GET'])
@jwt_required()
def get_etfs(): return get_market_list('etfs')

@app.route('/api/stocks/indices', methods=['GET'])
@jwt_required()
def get_indices(): return get_market_list('indices')

# ── STOCK DETAILS ─────────────────────────────────────────────────────────────
@app.route('/api/stocks/<symbol>/details', methods=['GET'])
@jwt_required()
def get_stock_details(symbol):
    symbol = symbol.upper().strip()
    try:
        db = get_db(); cursor = db.cursor()
        cursor.execute("SELECT exchange FROM stocks WHERE symbol = %s", (symbol,))
        row = cursor.fetchone(); db.close()
        ex = row['exchange'] if row else 'NSE'
        suffix = '.NS' if ex == 'NSE' else '.BO'
        
        ticker = yf.Ticker(f"{symbol}{suffix}")
        info = ticker.info
        
        # Support / Resistance (Pivot Points)
        high = info.get('dayHigh', 0)
        low = info.get('dayLow', 0)
        close = info.get('previousClose', 0)
        pp = (high + low + close) / 3 if (high and low and close) else 0
        
        details = {
            'symbol': symbol,
            'name': info.get('longName', symbol),
            'sector': info.get('sector', 'N/A'),
            'previousClose': info.get('previousClose', 'N/A'),
            'open': info.get('open', 'N/A'),
            'dayLow': info.get('dayLow', 'N/A'),
            'dayHigh': info.get('dayHigh', 'N/A'),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow', 'N/A'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh', 'N/A'),
            'volume': info.get('volume', 'N/A'),
            'avgVolume': info.get('averageVolume', 'N/A'),
            'marketCap': info.get('marketCap', 'N/A'),
            'peRatio': info.get('trailingPE', 'N/A'),
            'beta': info.get('beta', 'N/A'),
            'support': round(pp * 0.98, 2) if pp else 'N/A',
            'resistance': round(pp * 1.02, 2) if pp else 'N/A',
            'longBusinessSummary': info.get('longBusinessSummary', 'No description available.')
        }
        return jsonify(details)
    except Exception as e:
        print("Details API error:", e)
        return jsonify({'error': str(e)}), 500
        
# ── PRICE ALERTS ──────────────────────────────────────────────────────────────
@app.route('/api/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("""
            SELECT pa.id, s.symbol, s.company_name, pa.target_price, pa.direction, pa.triggered
            FROM price_alerts pa JOIN stocks s ON pa.stock_id = s.id
            WHERE pa.user_id = %s ORDER BY pa.created_at DESC
        """, (user_id,))
        return jsonify(cursor.fetchall())
    finally: db.close()

@app.route('/api/alerts', methods=['POST'])
@jwt_required()
def create_alert():
    user_id = get_jwt_identity()
    data    = request.json
    symbol  = data.get('symbol', '').upper().strip()
    target_price = data.get('target_price')
    direction    = data.get('direction', 'above')
    alert_type   = data.get('alert_type', 'price')
    channel      = data.get('channel', 'both')
    
    if not symbol or not target_price:
        return jsonify({'error': 'symbol and target_price required'}), 400
        
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("SELECT id FROM stocks WHERE symbol = %s", (symbol,))
        stock = cursor.fetchone()
        if not stock: return jsonify({'error': f'Stock {symbol} not found.'}), 404
        
        cursor.execute("""
            INSERT INTO price_alerts (user_id, stock_id, target_price, direction, alert_type, channel) 
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (user_id, stock['id'], target_price, direction, alert_type, channel))
        return jsonify({'message': 'Alert created'}), 201
    finally: db.close()

@app.route('/api/alerts/<int:alert_id>', methods=['DELETE'])
@jwt_required()
def delete_alert(alert_id):
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM price_alerts WHERE id = %s AND user_id = %s", (alert_id, user_id))
        return jsonify({'message': 'Deleted'})
    finally: db.close()

# ── NOTIFICATION PREFERENCES ──────────────────────────────────────────────────
@app.route('/api/settings/notifications', methods=['GET'])
@jwt_required()
def get_notification_settings():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("SELECT * FROM user_preferences WHERE user_id = %s", (user_id,))
        prefs = cursor.fetchone()
        if not prefs:
            # Default preferences
            cursor.execute("INSERT INTO user_preferences (user_id) VALUES (%s)", (user_id,))
            cursor.execute("SELECT * FROM user_preferences WHERE user_id = %s", (user_id,))
            prefs = cursor.fetchone()
        return jsonify(prefs)
    finally: db.close()

@app.route('/api/settings/notifications', methods=['POST'])
@jwt_required()
def update_notification_settings():
    user_id = get_jwt_identity()
    data = request.json
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("""
            UPDATE user_preferences 
            SET email_alerts_enabled = %s, telegram_alerts_enabled = %s, telegram_chat_id = %s,
                daily_summary_enabled = %s, ai_alerts_enabled = %s, price_alerts_enabled = %s
            WHERE user_id = %s
        """, (
            data.get('email_alerts_enabled', True), data.get('telegram_alerts_enabled', True),
            data.get('telegram_chat_id'), data.get('daily_summary_enabled', True),
            data.get('ai_alerts_enabled', True), data.get('price_alerts_enabled', True),
            user_id
        ))
        return jsonify({'message': 'Preferences updated'})
    finally: db.close()

@app.route('/api/notifications/logs', methods=['GET'])
@jwt_required()
def get_notification_logs():
    user_id = get_jwt_identity()
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("""
            SELECT nl.*, s.symbol 
            FROM notification_logs nl 
            LEFT JOIN stocks s ON nl.stock_id = s.id 
            WHERE nl.user_id = %s 
            ORDER BY nl.created_at DESC LIMIT 20
        """, (user_id,))
        return jsonify(cursor.fetchall())
    finally: db.close()

# ── WEBSOCKET ─────────────────────────────────────────────────────────────────
@socketio.on('connect')
def on_connect():
    print(f"Client connected: {request.sid}")
    emit('connection_response', {'data': 'Connected to StockIntel'})

@socketio.on('join')
def on_join(data):
    user_id = data.get('user_id')
    if user_id: join_room(str(user_id)); print(f"User {user_id} joined room")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

# ── BACKGROUND SYSTEM ─────────────────────────────────────────────────────────
scheduler = BackgroundScheduler()

def check_price_alerts():
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("""
            SELECT pa.*, s.symbol, s.company_name, s.exchange, up.email_alerts_enabled, up.telegram_alerts_enabled, up.telegram_chat_id
            FROM price_alerts pa 
            JOIN stocks s ON pa.stock_id = s.id
            JOIN user_preferences up ON pa.user_id = up.user_id
            WHERE pa.triggered = 0 AND pa.is_active = 1
        """)
        alerts = cursor.fetchall()
        
        for alert in alerts:
            try:
                suffix = '.NS' if alert['exchange'] == 'NSE' else '.BO'
                t = yf.Ticker(f"{alert['symbol']}{suffix}")
                price = round(t.fast_info.last_price, 2)
                
                hit = (alert['direction'] == 'above' and price >= float(alert['target_price'])) or \
                      (alert['direction'] == 'below' and price <= float(alert['target_price']))
                
                if hit:
                    cursor.execute("UPDATE price_alerts SET triggered = 1 WHERE id = %s", (alert['id'],))
                    
                    # 1. Socket.io Emit
                    socketio.emit('price_alert', {
                        'symbol': alert['symbol'], 'price': price, 'target': float(alert['target_price'])
                    }, room=str(alert['user_id']))
                    
                    # 2. Telegram
                    if alert['telegram_alerts_enabled']:
                        msg = f"📈 *STOCKINTEL ALERT*\n\n{alert['symbol']} crossed {alert['direction']} level\n\nPrice: ₹{price}\nTarget: ₹{alert['target_price']}\n\nAI Insight: Momentum confirmed."
                        TelegramManager.send_alert(msg, alert['telegram_chat_id'])
                        
                    # 3. Email
                    if alert['email_alerts_enabled']:
                        cursor.execute("SELECT email FROM users WHERE id = %s", (alert['user_id'],))
                        user = cursor.fetchone()
                        html = EmailManager.get_template('price_alert', {
                            'symbol': alert['symbol'], 'company_name': alert['company_name'],
                            'target_price': alert['target_price'], 'direction': alert['direction'],
                            'sentiment': 'bullish' if alert['direction'] == 'above' else 'bearish'
                        })
                        EmailManager.send_alert(user['email'], f"[StockIntel] Alert: {alert['symbol']} Target Hit", html)
                    
                    # 4. Log
                    cursor.execute("""
                        INSERT INTO notification_logs (user_id, stock_id, type, title, message, channel)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (alert['user_id'], alert['stock_id'], 'PRICE', f"{alert['symbol']} Hit", f"Target ₹{alert['target_price']} reached", alert['channel']))
                    
            except Exception as e: print(f"Monitor single error: {e}")
        db.commit()
    finally: db.close()

def send_daily_summary():
    # This would ideally be scheduled for evening
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute("SELECT id, email, name FROM users")
        users = cursor.fetchall()
        for user in users:
            cursor.execute("SELECT daily_summary_enabled, telegram_chat_id FROM user_preferences WHERE user_id = %s", (user['id'],))
            prefs = cursor.fetchone()
            if prefs and prefs['daily_summary_enabled']:
                # Mock summary for now - in production, fetch gainers/losers
                summary_msg = f"📊 *DAILY MARKET SUMMARY*\n\nHello {user['name']},\n\nNIFTY 50: +0.45%\nTop Gainer: RELIANCE (+2.3%)\n\nWatchlist: Bullish momentum continues.\n\nPremium Briefing sent to your email."
                TelegramManager.send_alert(summary_msg, prefs['telegram_chat_id'])
                # Email would follow similar logic with a 'daily_summary' template
    finally: db.close()

# Schedule tasks
scheduler.add_job(check_price_alerts, 'interval', minutes=2)
# scheduler.add_job(send_daily_summary, 'cron', hour=18, minute=30) # 6:30 PM
        

# ── MAIN ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    run_migrations()
    scheduler.start()
    threading.Thread(target=lambda: print("[INFO] Pre-warming market categories..."), daemon=True).start()
    print("StockIntel backend starting on port 5000...")
    print(f"Groq AI: {'ready' if ai_client else 'disabled'}")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)