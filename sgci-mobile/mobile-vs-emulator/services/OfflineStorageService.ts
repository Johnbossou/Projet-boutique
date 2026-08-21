import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'sgci_offline_';
const SYNC_QUEUE_KEY = 'sgci_sync_queue';

interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineStorageService {
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing = false;
  private isOnline: boolean = true;

  /**
   * Check if device is online
   * Note: This is a simplified version. For production, install @react-native-community/netinfo
   */
  async checkOnlineStatus(): Promise<boolean> {
    try {
      // Simple fetch to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isOnline = response.ok;
      return this.isOnline;
    } catch (error) {
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Manually set online status (for testing or manual control)
   */
  setOnlineStatus(status: boolean): void {
    this.isOnline = status;
  }

  /**
   * Store data offline
   */
  async storeData(key: string, data: any): Promise<void> {
    try {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      const jsonValue = JSON.stringify({
        data,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem(storageKey, jsonValue);
    } catch (error) {
      console.error('Error storing data offline:', error);
    }
  }

  /**
   * Retrieve data from offline storage
   */
  async getData(key: string): Promise<any | null> {
    try {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      const jsonValue = await AsyncStorage.getItem(storageKey);
      if (jsonValue) {
        const { data, timestamp } = JSON.parse(jsonValue);
        // Return data if less than 24 hours old
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          return data;
        }
        // Remove old data
        await AsyncStorage.removeItem(storageKey);
      }
      return null;
    } catch (error) {
      console.error('Error retrieving offline data:', error);
      return null;
    }
  }

  /**
   * Remove data from offline storage
   */
  async removeData(key: string): Promise<void> {
    try {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Error removing offline data:', error);
    }
  }

  /**
   * Clear all offline data
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
      await AsyncStorage.multiRemove(offlineKeys);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const queueItem: SyncQueueItem = {
        ...item,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      
      this.syncQueue.push(queueItem);
      await this.saveSyncQueue();
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  /**
   * Load sync queue from storage
   */
  async loadSyncQueue(): Promise<void> {
    try {
      const jsonValue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (jsonValue) {
        this.syncQueue = JSON.parse(jsonValue);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  /**
   * Save sync queue to storage
   */
  async saveSyncQueue(): Promise<void> {
    try {
      const jsonValue = JSON.stringify(this.syncQueue);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, jsonValue);
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  /**
   * Process sync queue
   */
  async processSyncQueue(apiFetch: any): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      const online = await this.checkOnlineStatus();
      if (!online) {
        return;
      }

      const failedItems: SyncQueueItem[] = [];

      for (const item of this.syncQueue) {
        try {
          await apiFetch(item.endpoint, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
          });
        } catch (error) {
          console.error('Sync failed for item:', item.id, error);
          item.retryCount++;
          if (item.retryCount < 3) {
            failedItems.push(item);
          }
        }
      }

      this.syncQueue = failedItems;
      await this.saveSyncQueue();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get sync queue size
   */
  getSyncQueueSize(): number {
    return this.syncQueue.length;
  }

  /**
   * Initialize offline storage service
   */
  async initialize(apiFetch: any): Promise<void> {
    await this.loadSyncQueue();
    
    // Check online status on startup
    await this.checkOnlineStatus();

    // Process queue on startup if online
    if (this.isOnline) {
      this.processSyncQueue(apiFetch);
    }
  }
}

export const offlineStorageService = new OfflineStorageService();
