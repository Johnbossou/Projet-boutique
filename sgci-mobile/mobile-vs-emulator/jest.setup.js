/* eslint-disable @typescript-eslint/no-require-imports */

// AsyncStorage n'a pas d'implémentation hors natif. Les libs testées lisent et
// écrivent le cache boutique : sans mock, tout test de lib/boutique-settings
// échouerait sur un module natif.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Silence des avertissements React Native sans effet sur les tests de lib/.
jest.spyOn(console, 'warn').mockImplementation(() => {});
