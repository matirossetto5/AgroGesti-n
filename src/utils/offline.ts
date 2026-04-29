export class OfflineStorage {
  private static readonly PREFIX = 'agro_offline_';

  static async saveSyncQueue(userId: string, data: any) {
    try {
      const queue = this.getSyncQueue(userId) || [];
      queue.push({
        id: Math.random().toString(36),
        timestamp: Date.now(),
        data,
        synced: false
      });
      localStorage.setItem(`${this.PREFIX}sync_queue_${userId}`, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving to sync queue:', error);
    }
  }

  static getSyncQueue(userId: string): any[] {
    try {
      const data = localStorage.getItem(`${this.PREFIX}sync_queue_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading sync queue:', error);
      return [];
    }
  }

  static markAsSynced(userId: string, itemId: string) {
    try {
      const queue = this.getSyncQueue(userId);
      const updated = queue.map(item =>
        item.id === itemId ? { ...item, synced: true } : item
      );
      localStorage.setItem(`${this.PREFIX}sync_queue_${userId}`, JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking as synced:', error);
    }
  }

  static clearSyncQueue(userId: string) {
    localStorage.removeItem(`${this.PREFIX}sync_queue_${userId}`);
  }

  static saveFarmData(farmId: string, data: any) {
    try {
      localStorage.setItem(`${this.PREFIX}farm_${farmId}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving farm data:', error);
    }
  }

  static getFarmData(farmId: string): any {
    try {
      const data = localStorage.getItem(`${this.PREFIX}farm_${farmId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading farm data:', error);
      return null;
    }
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }

  static onOnline(callback: () => void) {
    window.addEventListener('online', callback);
  }

  static onOffline(callback: () => void) {
    window.addEventListener('offline', callback);
  }

  static removeSyncListeners() {
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});
  }
}
