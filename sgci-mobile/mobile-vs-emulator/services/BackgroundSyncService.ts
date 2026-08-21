import { AppState, AppStateStatus } from 'react-native';
import { offlineStorageService } from './OfflineStorageService';

class BackgroundSyncService {
  private appStateSubscription: any = null;
  private syncInterval: any = null;
  private apiFetch: any = null;

  /**
   * Initialize background sync service
   */
  initialize(apiFetch: any): void {
    this.apiFetch = apiFetch;

    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Set up periodic sync (every 5 minutes)
    this.syncInterval = setInterval(() => {
      this.triggerSync();
    }, 5 * 60 * 1000);

    // Initial sync
    this.triggerSync();
  }

  /**
   * Handle app state changes
   */
  handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground, trigger sync
      this.triggerSync();
    }
  };

  /**
   * Trigger sync process
   */
  async triggerSync(): Promise<void> {
    try {
      await offlineStorageService.processSyncQueue(this.apiFetch);
    } catch (error) {
      console.error('Background sync error:', error);
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const backgroundSyncService = new BackgroundSyncService();
