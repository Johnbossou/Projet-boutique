'use client';

import { useState, useEffect } from 'react';
import { Bell, X, Check, AlertTriangle, Package, ShoppingCart, Users, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface Notification {
  id: number;
  type: string;
  titre: string;
  message: string;
  donnees?: any;
  lu: boolean;
  created_at: string;
}

export function RealTimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/notifications');
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await apiFetch('/notifications/unread-count');
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du compteur:', error);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await apiFetch(`/notifications/${notificationId}/read`, { method: 'POST' });
      
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, lu: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      
      setNotifications(notifications.map(n => ({ ...n, lu: true })));
      setUnreadCount(0);
      toast.success('Toutes les notifications marquées comme lues');
    } catch (error) {
      console.error('Erreur lors du marquage tout comme lu:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    // Polling pour les notifications en temps réel (toutes les 30 secondes)
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stock_alert':
      case 'stock_rupture':
        return <Package className="w-5 h-5 text-orange-500" />;
      case 'vente':
        return <ShoppingCart className="w-5 h-5 text-green-500" />;
      case 'user':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'paiement':
        return <DollarSign className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'stock_alert':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'stock_rupture':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'vente':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      default:
        return 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50"
            />

            {/* Notifications Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-12 w-96 max-h-[500px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      Tout marquer comme lu
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto max-h-[400px]">
                {isLoading ? (
                  <div className="p-4 text-center text-slate-500">
                    Chargement...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune notification</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <Card
                      key={notification.id}
                      className={`border-l-4 ${getNotificationColor(notification.type)} ${
                        !notification.lu ? 'bg-slate-50 dark:bg-slate-800' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 dark:text-white">
                              {notification.titre}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                          </div>
                          {!notification.lu && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
