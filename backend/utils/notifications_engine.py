import os
import requests
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

class TelegramManager:
    @staticmethod
    def send_alert(message, chat_id=None):
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        target_chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID")
        
        if not token or not target_chat_id:
            print("Telegram Error: Missing Token or Chat ID")
            return False
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": target_chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"Telegram Failed: {e}")
            return False

class EmailManager:
    @staticmethod
    def send_alert(to_email, subject, html_content):
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = os.getenv('EMAIL_USER')
        msg['To'] = to_email
        msg.add_alternative(html_content, subtype='html')

        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(os.getenv('EMAIL_USER'), os.getenv('EMAIL_PASS'))
                smtp.send_message(msg)
            return True
        except Exception as e:
            print(f"Email Failed: {e}")
            return False

    @staticmethod
    def get_template(type, data):
        # Premium HTML Templates
        styles = """
            <style>
                .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #05070a; color: #f0f6fc; padding: 30px; border-radius: 12px; border: 1px solid #30363d; }
                .header { border-bottom: 1px solid #30363d; padding-bottom: 20px; margin-bottom: 25px; }
                .title { font-size: 24px; fontWeight: 900; margin: 0; letterSpacing: -0.5px; }
                .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 900; text-transform: uppercase; margin-top: 10px; }
                .bullish { background: #3fb950; color: white; }
                .bearish { background: #f85149; color: white; }
                .neutral { background: #58a6ff; color: white; }
                .content { line-height: 1.6; font-size: 14px; }
                .stock-info { background: #0d1117; border: 1px solid #30363d; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .price { font-size: 28px; font-weight: 900; color: #58a6ff; }
                .footer { color: #8b949e; font-size: 12px; margin-top: 30px; border-top: 1px solid #30363d; padding-top: 20px; }
            </style>
        """
        
        sentiment_class = data.get('sentiment', 'neutral').lower()
        
        if type == 'price_alert':
            return f"""
            <html>
                <head>{styles}</head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 class="title">📈 StockIntel Alert</h1>
                            <div class="badge {sentiment_class}">{data['symbol']} {data['direction'].upper()}</div>
                        </div>
                        <div class="content">
                            <p>System trigger detected for <strong>{data['company_name']}</strong>.</p>
                            <div class="stock-info">
                                <div style="font-size: 12px; color: #8b949e; font-weight: 800;">TARGET REACHED</div>
                                <div class="price">₹{data['target_price']}</div>
                                <div style="margin-top: 10px; font-size: 13px; color: #f0f6fc;">
                                    Signal: {data.get('signal', 'Price Level Hit')}
                                </div>
                            </div>
                            <p><strong>AI Insight:</strong> {data.get('ai_insight', 'Momentum confirmed at this level.')}</p>
                        </div>
                        <div class="footer">
                            Sent by StockIntel Terminal • Institutional Market Intelligence
                        </div>
                    </div>
                </body>
            </html>
            """
        
        elif type == 'ai_alert':
            return f"""
            <html>
                <head>{styles}</head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 class="title">🤖 Intelligence Alert</h1>
                            <div class="badge {sentiment_class}">{data['symbol']} | {data['sentiment'].upper()}</div>
                        </div>
                        <div class="content">
                            <p><strong>{data['title']}</strong></p>
                            <div class="stock-info">
                                <div style="font-size: 12px; color: #8b949e; font-weight: 800;">AI SUMMARY</div>
                                <div style="font-size: 15px; color: #f0f6fc; margin-top: 5px;">{data['summary']}</div>
                            </div>
                            <p><strong>Impact Score:</strong> {data.get('impact_score', 'N/A')}/10</p>
                            <p><strong>Investor Action:</strong> {data.get('investor_action', 'Monitor closely.')}</p>
                        </div>
                        <div class="footer">
                            Sent by StockIntel Terminal • Institutional Market Intelligence
                        </div>
                    </div>
                </body>
            </html>
            """
        
        return ""
