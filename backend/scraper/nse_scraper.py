"""
NSE Scraper - Master Intelligence Version
Features: Argument-based Sync, Multi-Watcher Notifications, & Clean Date Parsing
"""

import time
import json
import pymysql
import sys
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# 1. DATABASE CONNECTION
def get_db():
    return pymysql.connect(
        host='localhost',
        user='root',
        password='12345', 
        database='stock_tracker',
        cursorclass=pymysql.cursors.DictCursor
    )

# 2. DATE FORMATTER (Preserves your 14-digit to '26-Feb-2026' logic)
def format_nse_date(raw_date):
    if not raw_date: return "Recent"
    date_str = str(raw_date).strip()
    
    # Check if already formatted
    if "-" in date_str and not date_str.isdigit(): return date_str
    
    try:
        if len(date_str) >= 8:
            just_date = date_str[:8] # YYYYMMDD
            return datetime.strptime(just_date, '%Y%m%d').strftime('%d-%b-%Y')
    except Exception: pass
    return date_str

# 3. GET STOCKS TO SCRAPE (Supports both Global Scrape and Single Sync)
def get_target_stocks(filter_symbol=None):
    db = get_db()
    cursor = db.cursor()
    try:
        if filter_symbol:
            # Used when clicking 'Sync' for a specific stock
            cursor.execute("SELECT id, symbol FROM stocks WHERE symbol = %s", (filter_symbol,))
        else:
            # Used for the scheduled hourly run
            cursor.execute("SELECT id, symbol FROM stocks") 
        return cursor.fetchall()
    finally:
        db.close()

# 4. MASTER SCRAPE ENGINE
def run_master_scraper():
    # CAPTURE THE ARGUMENT (If any)
    target_symbol = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("\n" + "="*60)
    print(f"🚀 {'SYNCING: ' + target_symbol if target_symbol else 'STARTING GLOBAL SCRAPE'}")
    print("="*60 + "\n")

    stocks = get_target_stocks(target_symbol)
    if not stocks:
        print(f"⚠️ No stock found matching: {target_symbol if target_symbol else 'ALL'}")
        return

    # Setup Selenium
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    driver = webdriver.Chrome(options=chrome_options)

    try:
        print("🔐 Initializing NSE Session...")
        driver.get("https://www.nseindia.com")
        time.sleep(5) 

        for s in stocks:
            symbol = s['symbol']
            stock_id = s['id']
            
            print(f"📥 Fetching news for: {symbol}...")
            url = f"https://www.nseindia.com/api/corporate-announcements?index=equities&symbol={symbol}"
            
            driver.get(url)
            time.sleep(3) 
            
            try:
                raw_data = driver.find_element("tag name", "body").text
                json_data = json.loads(raw_data)
                
                if not json_data:
                    print(f"  ℹ️ No recent news for {symbol}")
                    continue

                save_to_database(json_data, stock_id, symbol)
                
            except Exception as e:
                print(f"  ❌ Failed to parse {symbol}: {e}")

    finally:
        driver.quit()
        print("\n✅ Scraper process complete.")

# 5. DATABASE SAVE & NOTIFICATION LOGIC
def save_to_database(json_data, stock_id, symbol):
    db = get_db()
    cursor = db.cursor()
    new_items = 0

    try:
        for item in json_data:
            title = item.get('desc') or item.get('subject')
            raw_date = item.get('an_dt') or item.get('anDt') or item.get('dt')
            clean_date = format_nse_date(raw_date)
            
            file = item.get('attchmntFile') or item.get('attachment')
            pdf_url = f"https://nsearchives.nseindia.com/corporate/{file}" if file and not file.startswith('http') else (file or "")

            # DUPLICATE CHECK
            cursor.execute(
                "SELECT id FROM announcements WHERE stock_id = %s AND title = %s", 
                (stock_id, title)
            )
            
            if not cursor.fetchone():
                # 1. SAVE ANNOUNCEMENT
                cursor.execute(
                    """INSERT INTO announcements 
                       (stock_id, title, announcement_date, source_url, category) 
                       VALUES (%s, %s, %s, %s, %s)""",
                    (stock_id, title, clean_date, pdf_url, 'General')
                )
                announcement_id = cursor.lastrowid

                # 2. TRIGGER NOTIFICATIONS FOR ALL WATCHERS
                cursor.execute("SELECT user_id FROM watchlist WHERE stock_id = %s", (stock_id,))
                watchers = cursor.fetchall()

                for watcher in watchers:
                    cursor.execute(
                        "INSERT INTO notifications (user_id, announcement_id) VALUES (%s, %s)",
                        (watcher['user_id'], announcement_id)
                    )
                new_items += 1
        
        db.commit()
        if new_items > 0:
            print(f"  ✅ Saved {new_items} NEW announcements for {symbol}")
            
    except Exception as e:
        print(f"  ❌ Database Error on {symbol}: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_master_scraper()