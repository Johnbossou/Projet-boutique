# SGCI Mobile App

<p align="center">
  <a href="https://expo.dev" target="_blank"><img src="https://static.expo.dev/brand/square-512x512.png" width="200" alt="Expo Logo"></a>
</p>

<p align="center">
  Système de Gestion Commerciale Intelligente - Mobile Application
</p>

## About SGCI Mobile

SGCI Mobile is a React Native application built with Expo that provides a comprehensive mobile experience for managing retail businesses on the go. Features include:

- Multi-tenant boutique management
- Product inventory management
- Sales and transaction processing
- Customer relationship management
- Stock movement tracking
- Analytics and reporting
- Offline support with AsyncStorage
- Background sync when online
- Memoized components for performance
- FlatList for efficient list rendering

## Features

### Core Features
- **Multi-Tenancy**: Boutique selection and management for proprietaires
- **Authentication**: JWT-based authentication with the backend API
- **Offline Support**: Data caching with AsyncStorage for offline access
- **Background Sync**: Automatic synchronization when device comes online
- **Performance**: Memoized components and FlatList for large lists
- **Barcode Scanning**: Product scanning with expo-barcode-scanner
- **Camera Integration**: Product image capture
- **Print Support**: Receipt printing with expo-print
- **Real-time Updates**: Live data synchronization

### Screens
- **Dashboard**: Overview with statistics and recent activity
- **Products**: Product management (CRUD operations)
- **Sales**: Sales processing and history
- **Customers**: Customer management
- **Inventory**: Stock management and movements
- **Analytics**: Reports and charts
- **Settings**: User and boutique settings

## Requirements

- Node.js >= 18.x
- npm, yarn, or pnpm
- Expo CLI
- iOS Simulator (Mac only) or Android Emulator
- Physical iOS or Android device (optional)
- SGCI Backend API running

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sgci-mobile/mobile-vs-emulator
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Start the development server:
```bash
npx expo start
```

4. Run on your preferred platform:
- Press `a` to run on Android emulator
- Press `i` to run on iOS simulator
- Scan the QR code with Expo Go app on your physical device

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Backend API Configuration
EXPO_PUBLIC_API_URL=http://localhost:8000/api
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000/api` |

## Project Structure

```
app/
├── (auth)/            # Authentication screens
│   └── login.tsx      # Login screen
├── (tabs)/            # Tab-based navigation
│   ├── index.tsx      # Dashboard
│   ├── produits.tsx   # Products
│   ├── caisse.tsx     # Sales/Cashier
│   ├── clients.tsx    # Customers
│   ├── arrivage.tsx   # Stock movements
│   ├── analytics.tsx  # Analytics
│   ├── ia.tsx         # AI features
│   └── parametres.tsx # Settings
├── _layout.tsx        # Root layout
└── ...
components/           # React components
contexts/             # React contexts (Auth, Theme)
services/             # Business logic services
lib/                  # Utility functions
types/                # TypeScript type definitions
```

## Available Scripts

- `npm start` - Start the development server
- `android` - Run on Android
- `ios` - Run on iOS
- `web` - Run on web
- `lint` - Run ESLint

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **Language**: TypeScript
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Storage**: AsyncStorage (@react-native-async-storage/async-storage)
- **Icons**: Lucide React Native
- **Charts**: Recharts
- **Barcode**: expo-barcode-scanner
- **Camera**: expo-camera
- **Image Picker**: expo-image-picker
- **Print**: expo-print

## Performance Optimizations

- **Memoization**: Components wrapped with React.memo
- **useCallback**: Callback functions memoized with useCallback
- **FlatList**: Efficient rendering of large lists instead of ScrollView
- **Lazy Loading**: Code splitting with Expo Router
- **Image Optimization**: expo-image for optimized image loading

## Offline Support

The app supports offline functionality through:

- **AsyncStorage**: Caching of frequently accessed data
- **Sync Queue**: Queued operations that sync when online
- **Background Sync**: Automatic sync when app comes to foreground
- **Network Detection**: Connectivity status monitoring

## Deployment

### EAS Build

Build your app for production using Expo Application Services (EAS):

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Expo Go

For quick testing, use Expo Go app on your device and scan the QR code from the development server.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

The SGCI project is proprietary software. All rights reserved.

## Support

For support, please contact the development team.
