import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font } from '../theme/colors';
import { IconBadge } from './IconBadge';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
};

export function SettingsRow({ icon, color = colors.text, label, value, onPress, isLast }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !isLast && styles.divider]}
      disabled={!onPress}
    >
      <IconBadge icon={icon} color={color} size={34} />
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
      {/* Certaines valeurs sont longues (liste de motivations, de freins...) :
          sans limite ni rétrécissement, elles poussaient la ligne hors écran. */}
      {value ? (
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  label: { ...font.body, color: colors.text, flex: 1, marginLeft: spacing.sm, fontWeight: '600' },
  value: {
    ...font.caption,
    color: colors.subtext,
    marginRight: spacing.xs,
    marginLeft: spacing.sm,
    flexShrink: 1,
    maxWidth: '52%',
    textAlign: 'right',
  },
});
