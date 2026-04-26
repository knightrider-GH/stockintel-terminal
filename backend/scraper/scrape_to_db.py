"""
Scrape and save to MySQL database
"""

import pymysql
from nse_scraper import NSEScraper
from datetime import datetime


def get_db():
    return pymysql.connect(
        host='localhost',
        user='root',
        password='12345',  
        database='stock_tracker',
        cursorclass=pymysql.cursors.DictCursor
    )


def scrape_all_stocks():
    print("Starting scraping...")
    
    db = get_db()
    cursor = db.cursor()
    
    # Get all stocks from database
    cursor.execute("SELECT id, symbol FROM stocks")
    stocks = cursor.fetchall()
    
    scraper = NSEScraper()
    new_count = 0
    
    for stock in stocks:
        stock_id = stock['id']
        symbol = stock['symbol']
        
        # Scrape announcements
        announcements = scraper.get_announcements(symbol)
        
        for ann in announcements:
            # Check if already exists
            cursor.execute(
                "SELECT id FROM announcements WHERE stock_id = %s AND title = %s",
                (stock_id, ann['title'])
            )
            
            if cursor.fetchone():
                print(f"Skip duplicate: {ann['title']}")
                continue
            
            # Insert new announcement
            cursor.execute(
                """INSERT INTO announcements 
                   (stock_id, title, category, announcement_date, source_url)
                   VALUES (%s, %s, %s, %s, %s)""",
                (stock_id, ann['title'], ann['category'], 
                 ann['date'], f"https://www.nseindia.com/get-quotes/equity?symbol={symbol}")
            )
            db.commit()
            new_count += 1
            print(f"Saved: {ann['title']}")
    
    cursor.close()
    db.close()
    
    print(f"\nDONE! Added {new_count} new announcements")


if __name__ == "__main__":
    scrape_all_stocks()