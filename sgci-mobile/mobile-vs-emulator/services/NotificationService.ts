import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private pushToken: string | null = null;

  /**
   * Initialize notification service and request permissions
   */
  async initialize(): Promise<void> {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }

      // Get push token
      this.pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push token:', this.pushToken);
    } else {
      console.warn('Must use physical device for push notifications');
    }

    // Set up notification listeners
    this.setupNotificationListeners();
  }

  /**
   * Get the push token
   */
  getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners(): void {
    // Listen for notifications received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Listen for user tapping on a notification
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data?.screen) {
        // Navigate to the specified screen
        // This would be handled by your navigation system
      }
    });
  }

  /**
   * Schedule a local notification
   */
  async scheduleNotification({
    title,
    body,
    data,
    delay = 0,
  }: NotificationData & { delay?: number }): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger:
        delay > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: delay,
              repeats: false,
            }
          : null,
    });
  }

  /**
   * Send a local notification immediately
   */
  async sendNotification({ title, body, data }: NotificationData): Promise<void> {
    await this.scheduleNotification({ title, body, data });
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Cancel a specific notification by identifier
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear badge count
   */
  async clearBadgeCount(): Promise<void> {
    await this.setBadgeCount(0);
  }

  /**
   * Send a sale notification
   */
  async sendSaleNotification(amount: number, customerName?: string): Promise<void> {
    const title = 'Nouvelle vente';
    const body = customerName
      ? `Vente de ${amount} FCFA par ${customerName}`
      : `Nouvelle vente de ${amount} FCFA`;

    await this.sendNotification({
      title,
      body,
      data: { type: 'sale', amount, customerName },
    });
  }

  /**
   * Send a low stock notification
   */
  async sendLowStockNotification(productName: string, quantity: number): Promise<void> {
    const title = 'Stock faible';
    const body = `${productName} - Il ne reste que ${quantity} unités`;

    await this.sendNotification({
      title,
      body,
      data: { type: 'low_stock', productName, quantity },
    });
  }

  /**
   * Send a new customer notification
   */
  async sendNewCustomerNotification(customerName: string): Promise<void> {
    const title = 'Nouveau client';
    const body = `${customerName} a été ajouté`;

    await this.sendNotification({
      title,
      body,
      data: { type: 'new_customer', customerName },
    });
  }

  /**
   * Send a sync notification
   */
  async sendSyncNotification(status: 'success' | 'failed', count?: number): Promise<void> {
    const title = status === 'success' ? 'Synchronisation réussie' : 'Échec de la synchronisation';
    const body = count
      ? `${count} éléments synchronisés`
      : status === 'success'
      ? 'Données synchronisées'
      : 'Erreur lors de la synchronisation';

    await this.sendNotification({
      title,
      body,
      data: { type: 'sync', status, count },
    });
  }
}

export default new NotificationService();
