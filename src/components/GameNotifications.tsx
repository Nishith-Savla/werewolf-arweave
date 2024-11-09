import { useEffect, useState } from 'react';
import './GameNotifications.css';

interface Notification {
  id: number;
  message: string;
  type: 'elimination' | 'phase-change' | 'game-over' | 'vote' | 'debug' | 'night-action';
  timestamp: number;
}

export const GameNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (message: string, type: Notification['type']) => {
    setNotifications(prev => [
      ...prev,
      {
        id: Date.now(),
        message,
        type,
        timestamp: Date.now()
      }
    ].slice(-5)); // Keep only last 5 notifications
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setNotifications(prev => prev.filter(n => Date.now() - n.timestamp < 5000));
    }, 5000);

    return () => clearTimeout(timeout);
  }, [notifications]);

  return (
    <div className="game-notifications">
      {notifications.map(notification => (
        <div key={notification.id} className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      ))}
    </div>
  );
}; 
