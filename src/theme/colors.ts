import { Platform } from 'react-native';

export const colors = {
  // Fonds
  bg: '#111827',
  bgSoft: '#172943',
  bgDark: '#0E1626',

  // Texte
  text: '#E7F0FF',
  subtext: '#B8C4D8',
  faint: '#8094B2',

  // Actions
  primary: '#253B5B',
  primaryText: '#FFFFFF',

  // Surfaces
  card: '#1B2A43',
  cardBorder: '#2B3D5B',
  white: '#FFFFFF',
  black: '#0B1220',

  // Thème feutre rouge : fond tableau sombre, annotations rouges et craie claire.
  brand: '#0EA5A5',
  brandAlt: '#38BDF8',

  // Effort / salle de sport — même accent rouge pour garder un thème cohérent.
  gym: '#7C3AED',
  gymAlt: '#A855F7',

  // Macros / accents
  accentRed: '#FF4D4F',
  calories: '#FF4D4F',
  protein: '#FF3D71',
  carbs: '#FFA940',
  fats: '#3B9EFF',

  success: '#0EA5A5',
  warning: '#F59E0B',
  danger: '#FF4D4F',

  progressTrack: '#2B3D5B',
  progressFill: '#0EA5A5',
};

/** Dégradés réutilisables dans toute l'app.
 * Deux familles : le vert (nutrition, santé, progression) et l'orange
 * (effort, salle de sport, entraînement). */
export const gradients: Record<string, [string, string]> = {
  brand: ['#0EA5A5', '#38BDF8'],
  fresh: ['#0EA5A5', '#38BDF8'],
  gym: ['#7C3AED', '#A855F7'],
  muscle: ['#7C3AED', '#A855F7'],
  fire: ['#F97316', '#FF4D4F'],
  dark: ['#253B5B', '#0E1626'],
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 };

export const font = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.7 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  h3: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.25 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0.05 },
  bodyBold: { fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.1 },
  caption: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.1 },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },
};

export const shadow = Platform.select({
  ios: {
    card: {
      shadowColor: '#071323',
      shadowOpacity: 0.06,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    button: {
      shadowColor: '#071323',
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    floating: {
      shadowColor: '#0EA5A5',
      shadowOpacity: 0.28,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
    },
  },
  default: {
    card: { elevation: 2 },
    button: { elevation: 6 },
    floating: { elevation: 10 },
  },
})!;
