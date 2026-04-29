import { useState, useCallback, useEffect } from 'react';
import { Notification, notificationService } from '../services';

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`notifications_${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setNotifications(parsed);
      updateUnreadCount(parsed);
    }
  }, [userId]);

  const updateUnreadCount = (notifs: Notification[]) => {
    const count = notifs.filter(n => !n.read).length;
    setUnreadCount(count);
  };

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => {
      const updated = [notification, ...prev];
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
      updateUnreadCount(updated);
      return updated;
    });
  }, [userId]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
      updateUnreadCount(updated);
      return updated;
    });
  }, [userId]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
      updateUnreadCount(updated);
      return updated;
    });
  }, [userId]);

  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
      updateUnreadCount(updated);
      return updated;
    });
  }, [userId]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem(`notifications_${userId}`);
  }, [userId]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  };
}
