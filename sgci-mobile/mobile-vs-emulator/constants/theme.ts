/**
 * Système de design SGCI.
 * Palette alignée sur le logo de marque : bleu profond + jaune signal, sur fond slate.
 * Les clés historiques (text, background, tint, icon, tabIconDefault, tabIconSelected)
 * sont conservées pour la compatibilité avec les écrans existants.
 */

import { Platform } from 'react-native';

// Bleu de marque (dégradé du logo)
export const Brand = {
  blue: '#3b82f6',
  blueDeep: '#1e40af',
  blueLight: '#60a5fa',
  sky: '#e6f4fe',
  yellow: '#facc15',
  yellowDeep: '#eab308',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export const Colors = {
  light: {
    text: '#0f172a',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    border: '#e2e8f0',
    muted: '#64748b',
    primary: '#2563eb',
    accent: '#eab308',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    tint: '#2563eb',
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: '#2563eb',
    tabBackground: '#ffffff',
  },
  dark: {
    text: '#f1f5f9',
    background: '#0b1220',
    surface: '#111c30',
    surfaceAlt: '#16233c',
    border: '#21304d',
    muted: '#94a3b8',
    primary: '#3b82f6',
    accent: '#facc15',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    tint: '#3b82f6',
    icon: '#9aa7c0',
    tabIconDefault: '#64748b',
    tabIconSelected: '#3b82f6',
    tabBackground: '#0e1729',
  },
};

// Échelle d'espacement (px)
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

// Rayons de coins
export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

// Tailles de police
export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Cible tactile minimale (Apple HIG / Material)
export const TouchTarget = 48;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});