import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from './GradientButton';
import { FadeInUp } from './FadeInUp';
import { colors, spacing, radius, font, gradients } from '../theme/colors';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  gradient?: [string, string];
  title: string;
  subtitle?: string;
  bullets?: string[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children?: React.ReactNode;
};

/** Gabarit commun aux écrans "une question, deux boutons" de l'onboarding.
 * Garantit un style identique partout sans dupliquer la mise en page. */
export function PromptScreen({
  icon,
  gradient = gradients.brand,
  title,
  subtitle,
  bullets,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }} />

      <FadeInUp>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
          <Ionicons name={icon} size={32} color={colors.white} />
        </LinearGradient>

        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </FadeInUp>

      {bullets?.length ? (
        <View style={styles.bullets}>
          {bullets.map((b, i) => (
            <FadeInUp key={i} delay={120 + i * 70}>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={17} color={colors.success} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            </FadeInUp>
          ))}
        </View>
      ) : null}

      {children}

      <View style={{ flex: 1 }} />

      <GradientButton label={primaryLabel} onPress={onPrimary} gradient={gradient} />

      {secondaryLabel && onSecondary ? (
        <Pressable onPress={onSecondary} style={styles.secondary}>
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  icon: {
    width: 76, height: 76, borderRadius: radius.lg, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  title: { ...font.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...font.body, color: colors.subtext, textAlign: 'center',
    marginTop: spacing.sm, paddingHorizontal: spacing.sm, lineHeight: 21,
  },
  bullets: { marginTop: spacing.lg, gap: spacing.sm },
  bulletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  bulletText: { ...font.caption, color: colors.text, flex: 1, fontWeight: '600' },
  secondary: { alignItems: 'center', paddingVertical: spacing.md },
  secondaryText: { ...font.caption, color: colors.faint, fontWeight: '600' },
});
