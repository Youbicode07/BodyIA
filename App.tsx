import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { UserProvider } from './src/context/UserContext';
import { NutritionProvider } from './src/context/NutritionContext';
import { CoachProvider } from './src/context/CoachContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme/colors';

export default function App() {
  return (
    // SafeAreaProvider est obligatoire pour useSafeAreaInsets : sans lui, la
    // barre d'onglets lève une exception au lancement. Il donne aussi les
    // marges réelles de chaque appareil (encoche, barre d'accueil iPhone),
    // ce qui évite les hauteurs codées en dur qui rognaient les libellés.
    <SafeAreaProvider>
      {/* Contient les erreurs de rendu : une exception isolée n'emporte plus
          toute l'application. */}
      <ErrorBoundary>
      <UserProvider>
        <OnboardingProvider>
          <NutritionProvider>
            {/* CoachProvider lit le compte ET les réponses d'inscription : il
                doit rester à l'intérieur des deux fournisseurs précédents. */}
            <CoachProvider>
            <NavigationContainer
                theme={{
                  dark: false,
                  colors: {
                    primary: colors.brand,
                    background: colors.bgSoft,
                    card: colors.white,
                    text: colors.text,
                    border: colors.cardBorder,
                    notification: colors.brand,
                  },
                }}
              >
                <StatusBar style="dark" />
                <RootNavigator />
            </NavigationContainer>
            </CoachProvider>
          </NutritionProvider>
        </OnboardingProvider>
      </UserProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
