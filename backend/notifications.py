import pymysql
import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

load_dotenv()

def get_db():
    return pymysql.connect(
        host='localhost',
        user='root',
        password='12345',
        database='stock_tracker',
        cursorclass=pymysql.cursors.DictCursor
    )

def send_email(to_email, user_name, stock_symbol, title, link):
    msg = EmailMessage()
    msg['Subject'] = f"🚀 NEW Announcement: {stock_symbol}"
    msg['From'] = os.getenv('EMAIL_USER')
    msg['To'] = to_email

    content = f"""
    Hello {user_name},

    There is a new market announcement for {stock_symbol}:

    📢 Title: {title}
    📄 View PDF: {link}

    Check your StockTracker Dashboard for more details.
    """
    msg.set_content(content)

    try:
        # Using Gmail's SMTP server
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(os.getenv('EMAIL_USER'), os.getenv('EMAIL_PASS'))
            smtp.send_message(msg)
        return True
    except Exception as e:
        print(f"❌ Email Failed: {e}")
        return False

def process_notifications():
    db = get_db()
    cursor = db.cursor()

    try:
        # 1. Find all unsent notifications
        cursor.execute("""
            SELECT 
                n.id as notif_id, u.email, u.name, 
                s.symbol, a.title, a.source_url
            FROM notifications n
            JOIN users u ON n.user_id = u.id
            JOIN announcements a ON n.announcement_id = a.id
            JOIN stocks s ON a.stock_id = s.id
            WHERE n.email_sent = FALSE
        """)
        
        unsent = cursor.fetchall()
        print(f"📧 Found {len(unsent)} new alerts to send...")

        for alert in unsent:
            success = send_email(
                alert['email'], alert['name'], 
                alert['symbol'], alert['title'], alert['source_url']
            )

            if success:
                # 2. Mark as sent so we don't spam the user
                cursor.execute(
                    "UPDATE notifications SET email_sent = TRUE WHERE id = %s", 
                    (alert['notif_id'],)
                )
                db.commit()
                print(f"✅ Email sent to {alert['email']} for {alert['symbol']}")

    finally:
        db.close()

if __name__ == "__main__":
    process_notifications()