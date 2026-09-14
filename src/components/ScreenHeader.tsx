import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font } from '../theme/colors';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  dark?: boolean;
};

/** En-tête d'écran cohérent : bouton retour optionnel, titre, sous-titre. */
export function ScreenHeader({ title, subtitle, onBack, right, dark = false }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color={dark ? colors.text : colors.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, dark && styles.darkTitle]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, dark && styles.darkSubtitle]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { ...font.h1, color: colors.text },
  subtitle: { ...font.caption, color: colors.subtext, marginTop: 2 },
  darkTitle: { color: colors.text },
  darkSubtitle: { color: colors.subtext },
});
