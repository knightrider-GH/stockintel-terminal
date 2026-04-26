import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add backend directory to path to import managers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from utils.notifications_engine import TelegramManager, EmailManager

load_dotenv()

def send_demo_alerts():
    print("Starting StockIntel Demo Alerts...")
    
    # -------------------------------------------------------------------------
    # DEMO 1: RELIANCE BULLISH BREAKOUT (Price Alert)
    # -------------------------------------------------------------------------
    symbol = "RELIANCE"
    price = "2,845"
    signal = "Bullish"
    confidence = "High"
    ai_insight = "Strong buying momentum detected after institutional accumulation. Support held firmly at 2780."
    suggested_action = "Watch for breakout continuation above ₹2,860."
    
    # Telegram Formatting (Premium)
    tg_price_msg = (
        f"📈 *STOCKINTEL ALERT*\n\n"
        f"*{symbol}* crossed resistance level\n\n"
        f"💰 *Current Price:* ₹{price}\n"
        f"🚦 *Signal:* {signal}\n"
        f"🎯 *Confidence:* {confidence}\n\n"
        f"🤖 *AI Insight:*\n"
        f"{ai_insight}\n\n"
        f"💡 *Suggested Action:*\n"
        f"{suggested_action}\n\n"
        f"_{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_"
    )
    
    # Email Data
    email_data_1 = {
        'symbol': symbol,
        'company_name': 'Reliance Industries Ltd.',
        'target_price': price,
        'direction': 'Above Resistance',
        'sentiment': 'bullish',
        'signal': f'{signal} ({confidence} Confidence)',
        'ai_insight': f"{ai_insight} {suggested_action}"
    }
    
    # -------------------------------------------------------------------------
    # DEMO 2: PAYTM PROMOTER STAKE INCREASE (Filing Alert)
    # -------------------------------------------------------------------------
    symbol_2 = "PAYTM"
    title_2 = "High Impact Filing: Promoter Stake Increased"
    summary_2 = "Promoter group acquired 1.2% additional stake via open market purchase, signaling strong internal confidence."
    investor_action_2 = "Bullish long-term signal. Accumulate on dips."
    impact_score_2 = "8.5"
    
    # Telegram Formatting (Premium)
    tg_filing_msg = (
        f"🤖 *INTELLIGENCE ALERT*\n\n"
        f"🔔 *{symbol_2}* | HIGH IMPACT FILING\n\n"
        f"📝 *Title:* {title_2}\n\n"
        f"📋 *AI Summary:*\n"
        f"{summary_2}\n\n"
        f"📊 *Impact Score:* {impact_score_2}/10\n"
        f"🎯 *Investor Action:* {investor_action_2}\n\n"
        f"_{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_"
    )
    
    # Email Data
    email_data_2 = {
        'symbol': symbol_2,
        'sentiment': 'bullish',
        'title': title_2,
        'summary': summary_2,
        'impact_score': impact_score_2,
        'investor_action': investor_action_2
    }

    # -------------------------------------------------------------------------
    # EXECUTION
    # -------------------------------------------------------------------------
    email_user = os.getenv('EMAIL_USER')
    
    print("\n--- Sending to Telegram ---")
    if TelegramManager.send_alert(tg_price_msg):
        print("[OK] Telegram: Price Alert sent.")
    else:
        print("[ERROR] Telegram: Price Alert failed.")
        
    if TelegramManager.send_alert(tg_filing_msg):
        print("[OK] Telegram: Intelligence Alert sent.")
    else:
        print("[ERROR] Telegram: Intelligence Alert failed.")

    if email_user:
        print("\n--- Sending to Email ---")
        # Send Price Alert Email
        html_1 = EmailManager.get_template('price_alert', email_data_1)
        if EmailManager.send_alert(email_user, f"[StockIntel] Bullish Alert: {symbol} Breakout Detected", html_1):
            print(f"[OK] Email: Price Alert sent to {email_user}.")
        else:
            print("[ERROR] Email: Price Alert failed.")
            
        # Send Filing Alert Email
        html_2 = EmailManager.get_template('ai_alert', email_data_2)
        if EmailManager.send_alert(email_user, f"[StockIntel] High Impact Filing: {symbol_2}", html_2):
            print(f"[OK] Email: Intelligence Alert sent to {email_user}.")
        else:
            print("[ERROR] Email: Intelligence Alert failed.")
    else:
        print("\n[WARNING] Skipping Email: EMAIL_USER not set in .env")

    print("\nDemo Alert Cycle Complete.")

if __name__ == "__main__":
    send_demo_alerts()
