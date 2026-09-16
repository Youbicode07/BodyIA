import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { OnboardingStepScreen } from '../screens/OnboardingStepScreen';
import { TrustScreen } from '../screens/TrustScreen';

// Analyse corporelle IA
import { PhotoCaptureScreen } from '../screens/PhotoCaptureScreen';
import { AnalysisLoadingScreen } from '../screens/AnalysisLoadingScreen';
import { AnalysisResultScreen } from '../screens/AnalysisResultScreen';
import { WorkoutLocationScreen } from '../screens/WorkoutLocationScreen';
import { ProgramGeneratingScreen } from '../screens/ProgramGeneratingScreen';
import { ProgramReadyScreen } from '../screens/ProgramReadyScreen';

// Post-programme (façon Cal AI)
import { RatingScreen } from '../screens/RatingScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

// Compte
import { AuthScreen } from '../screens/AuthScreen';
import { PaywallScreen } from '../screens/PaywallScreen';

// Séance guidée
import { WorkoutSessionScreen } from '../screens/WorkoutSessionScreen';

// App principale
import { MainTabs } from './MainTabs';
import { NutritionDashboardScreen } from '../screens/NutritionDashboardScreen';
import { MealCaptureScreen } from '../screens/MealCaptureScreen';
import { MealAnalyzingScreen } from '../screens/MealAnalyzingScreen';
import { MealResultScreen } from '../screens/MealResultScreen';
import { NutritionPlanScreen } from '../screens/NutritionPlanScreen';
import { BodyPhotoViewerScreen } from '../screens/BodyPhotoViewerScreen';
import { ProgressHistoryScreen } from '../screens/ProgressHistoryScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { DiagnosticScreen } from '../screens/DiagnosticScreen';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Onboarding complet (façon Cal AI) */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="OnboardingStep" component={OnboardingStepScreen} />
      <Stack.Screen name="Trust" component={TrustScreen} />

      {/* Analyse corporelle IA (fonctionnalité différenciante) */}
      <Stack.Screen name="PhotoCapture" component={PhotoCaptureScreen} />
      <Stack.Screen name="AnalysisLoading" component={AnalysisLoadingScreen} />
      <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} />
      {/* Photo annotée en plein écran, zoomable et cliquable muscle par muscle. */}
      <Stack.Screen
        name="BodyPhotoViewer"
        component={BodyPhotoViewerScreen}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      {/* Historique des analyses et suivi de la progression tous les 15 jours. */}
      <Stack.Screen name="ProgressHistory" component={ProgressHistoryScreen} />
      <Stack.Screen name="WorkoutLocation" component={WorkoutLocationScreen} />
      <Stack.Screen name="ProgramGenerating" component={ProgramGeneratingScreen} />
      <Stack.Screen name="ProgramReady" component={ProgramReadyScreen} />

      {/* Post-programme, façon Cal AI */}
      <Stack.Screen name="Rating" component={RatingScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />

      {/* Compte */}
      <Stack.Screen name="Auth" component={AuthScreen} />
      {/* Abonnement. Présenté en feuille modale : on peut le refermer quand il
          est ouvert depuis le profil, et il est verrouillé (dismissible:false)
          quand il barre l'accès à une fonction payante. */}
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />

      {/* App principale (post-onboarding) */}
      <Stack.Screen name="MainTabs" component={MainTabs} />
      {/* Séance guidée : c'est elle qui alimente le journal d'entraînement. */}
      <Stack.Screen
        name="WorkoutSession"
        component={WorkoutSessionScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      {/* Suivi nutritionnel complet : conservé tel quel, désormais atteint
          depuis le tableau de bord du coach plutôt que depuis un onglet. */}
      <Stack.Screen name="Nutrition" component={NutritionDashboardScreen} />
      <Stack.Screen name="MealCapture" component={MealCaptureScreen} />
      <Stack.Screen name="MealAnalyzing" component={MealAnalyzingScreen} />
      <Stack.Screen name="MealResult" component={MealResultScreen} />
      <Stack.Screen name="NutritionPlan" component={NutritionPlanScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="Diagnostic" component={DiagnosticScreen} />
    </Stack.Navigator>
  );
}
