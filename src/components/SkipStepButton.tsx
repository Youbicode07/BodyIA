import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme/colors';

type Props = {
  label?: string;
  onPress: () => void;
};

/**
 * Bouton "Passer cette étape" — un vrai bouton en pilule, pas un lien texte
 * nu. Reste volontairement discret (fond neutre, pas de dégradé) pour ne
 * jamais concurrencer le CTA principal juste au-dessus, tout en gardant le
 * même langage visuel soigné (pilules, badges) que le reste de l'app.
 */
export function SkipStepButton({ label = 'Passer cette étape', onPress }: Props) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chevronDot}>
        <Ionicons name="chevron-forward" size={12} color={colors.subtext} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pressed: { opacity: 0.65 },
  label: { ...font.caption, fontWeight: '700', color: colors.subtext },
  chevronDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
