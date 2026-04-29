import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    // Request browser notification permission as soon as we connect
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    this.socket = io('http://localhost:5000', {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected to StockIntel Core');
      
      // FIX: Matches your Python backend "@socketio.on('join')" exactly
      if (user && user.id) {
        this.socket.emit('join', { user_id: user.id }); 
        console.log(`👤 User ${user.id} routed to private alert channel`);
      }
    });

    this.socket.on('price_alert', (data) => {
      this.showNotification(data);
    });
  }
  
  showNotification(data) {
    if (Notification.permission === 'granted') {
      new Notification(`🔔 Target Breach: ${data.symbol}`, {
        body: `${data.symbol} hit ₹${data.current_price} (Target: ₹${data.target_price})`,
        icon: '/logo192.png' // Make sure you have a logo file here!
      });
    } else {
      console.log("Alert received, but notifications are blocked by browser:", data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }
} // Correctly closing the class at the very end

export default new SocketService();