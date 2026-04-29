export type NotificationType = 'warning' | 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export interface NotificationPreferences {
  emailAlerts: boolean;
  pushAlerts: boolean;
  weatherAlerts: boolean;
  expenseAlerts: boolean;
  incomeAlerts: boolean;
  maintenanceAlerts: boolean;
  alertThresholds: {
    highExpenseAmount: number;
    lowIncomeAmount: number;
    forecastDays: number;
  };
}

export const notificationService = {
  createNotification(
    type: NotificationType,
    title: string,
    message: string,
    actionUrl?: string
  ): Notification {
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      actionUrl
    };
  },

  getNotificationIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      warning: '⚠️',
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };
    return icons[type];
  },

  getNotificationColor(type: NotificationType): string {
    const colors: Record<NotificationType, string> = {
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800'
    };
    return colors[type];
  },

  generateWeatherAlert(message: string, severity: 'low' | 'medium' | 'high'): Notification {
    const type = severity === 'high' ? 'warning' : severity === 'medium' ? 'info' : 'info';
    return this.createNotification(type, 'Alerta Climática', message);
  },

  generateExpenseAlert(amount: number, category: string, threshold: number): Notification {
    if (amount > threshold) {
      return this.createNotification(
        'warning',
        'Gasto Elevado',
        `Se registró un gasto de $${amount.toLocaleString('es-AR')} en ${category}`,
        '/gastos'
      );
    }
    return this.createNotification(
      'info',
      'Gasto Registrado',
      `Nuevo gasto de $${amount.toLocaleString('es-AR')} en ${category}`
    );
  },

  generateIncomeAlert(amount: number, category: string): Notification {
    return this.createNotification(
      'success',
      'Ingreso Registrado',
      `Ingreso de $${amount.toLocaleString('es-AR')} en ${category}`,
      '/ingresos'
    );
  },

  generateMaintenanceAlert(machinery: string, type: 'due' | 'overdue'): Notification {
    const title = type === 'due' ? 'Mantenimiento Próximo' : 'Mantenimiento Vencido';
    return this.createNotification(
      type === 'overdue' ? 'warning' : 'info',
      title,
      `${machinery} requiere mantenimiento`,
      '/maquinarias'
    );
  },

  requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('Este navegador no soporta notificaciones');
      return Promise.resolve(false);
    }

    if (Notification.permission === 'granted') {
      return Promise.resolve(true);
    }

    if (Notification.permission !== 'denied') {
      return Notification.requestPermission().then(permission => permission === 'granted');
    }

    return Promise.resolve(false);
  },

  sendPushNotification(title: string, options?: NotificationOptions): Notification {
    const notification = new Notification(title, {
      icon: '/agro-icon.png',
      ...options
    });

    return this.createNotification('info', title, options?.body || '');
  },

  storeNotificationPreferences(preferences: NotificationPreferences, userId: string) {
    localStorage.setItem(`notif_prefs_${userId}`, JSON.stringify(preferences));
  },

  getNotificationPreferences(userId: string): NotificationPreferences {
    const stored = localStorage.getItem(`notif_prefs_${userId}`);
    return stored ? JSON.parse(stored) : this.getDefaultPreferences();
  },

  getDefaultPreferences(): NotificationPreferences {
    return {
      emailAlerts: false,
      pushAlerts: true,
      weatherAlerts: true,
      expenseAlerts: true,
      incomeAlerts: true,
      maintenanceAlerts: true,
      alertThresholds: {
        highExpenseAmount: 50000,
        lowIncomeAmount: 10000,
        forecastDays: 7
      }
    };
  }
};
