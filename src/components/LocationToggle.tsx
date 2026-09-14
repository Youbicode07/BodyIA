import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WorkoutLocation } from '../context/OnboardingContext';
import { colors, spacing, radius, font } from '../theme/colors';

type Props = {
  value: WorkoutLocation;
  onChange: (next: WorkoutLocation) => void;
  /** Rappelle à quoi sert le choix. Masqué là où le contexte est évident. */
  caption?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const OPTIONS: { key: WorkoutLocation; label: string; icon: string; hint: string }[] = [
  { key: 'gym', label: 'Salle', icon: 'weight-lifter', hint: 'Machines et poids libres' },
  { key: 'home', label: 'Maison', icon: 'home-variant', hint: 'Peu ou pas de matériel' },
];

/**
 * Choix du lieu d'entraînement, sur les écrans de programme.
 *
 * Le choix n'existait qu'une fois, pendant l'inscription. Quelqu'un qui
 * changeait de salle, ou qui s'entraînait chez lui pendant les vacances,
 * n'avait aucun moyen de le dire : il continuait de recevoir des exercices sur
 * des machines hors de portée. Le choix est enregistré dans le profil, donc il
 * vaut pour tout le programme et pas seulement pour l'écran courant.
 */
export function LocationToggle({ value, onChange, caption, disabled, style }: Props) {
  return (
    <View style={style}>
      <View style={styles.toggle}>
        {OPTIONS.map((option) => {
          const active = value === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => !disabled && onChange(option.key)}
              style={[styles.button, active && styles.buttonActive]}
            >
              <MaterialCommunityIcons
                name={option.icon as any}
                size={16}
                color={active ? colors.white : colors.subtext}
              />
              <View>
                <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
                <Text style={[styles.hint, active && styles.hintActive]}>{option.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 4,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  buttonActive: { backgroundColor: colors.gym },
  label: { ...font.caption, fontWeight: '700', color: colors.subtext },
  labelActive: { color: colors.white },
  hint: { ...font.tiny, fontSize: 9, fontWeight: '500', color: colors.faint, marginTop: 1 },
  hintActive: { color: 'rgba(255,255,255,0.82)' },
  caption: {
    ...font.tiny,
    fontSize: 10,
    fontWeight: '500',
    color: colors.faint,
    marginTop: 6,
    lineHeight: 14,
  },
});
