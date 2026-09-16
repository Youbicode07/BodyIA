import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { UserProvider } from './src/context/UserContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { NutritionProvider } from './src/context/NutritionContext';
import { CoachProvider } from './src/context/CoachContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { startAutoFlush } from './src/services/sync';
import { colors } from './src/theme/colors';

export default function App() {
  // Les modifications faites hors ligne repartent dès que l'application
  // revient au premier plan, sans que l'utilisateur ait quoi que ce soit à
  // faire — ni bouton à trouver, ni écran à rouvrir.
  useEffect(() => startAutoFlush(), []);

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
        {/* L'abonnement est rattaché au compte : il doit vivre sous
            UserProvider, et au-dessus des écrans qui en dépendent. */}
        <SubscriptionProvider>
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
        </SubscriptionProvider>
      </UserProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
