import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme/colors';

type Props = {
  /** Version condensée (une ligne) pour les endroits à espace réduit. */
  compact?: boolean;
};

/**
 * Rappel obligatoire : une analyse par IA n'est pas un avis médical.
 *
 * Affiché sur les écrans qui présentent une analyse corporelle ou un
 * programme d'exercices qui en découle — c'est là que quelqu'un pourrait
 * confondre une observation esthétique avec un diagnostic.
 */
export function MedicalDisclaimer({ compact = false }: Props) {
  if (compact) {
    return (
      <View style={styles.compactRow}>
        <Ionicons name="information-circle-outline" size={13} color={colors.subtext} />
        <Text style={styles.compactText}>
          Analyse IA à visée esthétique, pas un diagnostic médical.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Ionicons name="medical-outline" size={18} color={colors.warning} />
      <Text style={styles.text}>
        Cette analyse est générée par une intelligence artificielle à des fins d'entraînement
        physique et esthétique. Elle ne constitue en aucun cas un diagnostic médical. En cas de
        douleur, de blessure ou de problème de santé, consulte un professionnel de santé avant de
        commencer ou de poursuivre un programme d'exercices.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${colors.warning}12`, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.warning}45`,
    padding: spacing.md,
  },
  text: { flex: 1, ...font.tiny, fontWeight: '500', color: '#805A00', lineHeight: 16 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactText: { flex: 1, ...font.tiny, fontWeight: '500', color: colors.subtext, lineHeight: 14 },
});
