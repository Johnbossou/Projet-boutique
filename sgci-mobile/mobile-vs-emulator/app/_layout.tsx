import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { SgciThemeProvider } from '@/contexts/ThemeContext';
import NotificationService from '@/services/NotificationService';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Thème sombre assumé : tous les écrans sont conçus pour le mode nuit.
function RootNavigation() {
  return (
    <AuthProvider>
      <AuthGuard>
        <ThemeProvider value={DarkTheme}>
          <Stack>
            <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="light" backgroundColor="#0f172a" />
        </ThemeProvider>
      </AuthGuard>
    </AuthProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize notification service
    NotificationService.initialize();
  }, []);

  return (
    <SgciThemeProvider>
      <RootNavigation />
    </SgciThemeProvider>
  );
}
