import React, { useRef } from 'react';
import { Pressable, Text, View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../theme/colors';

type Props = {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function ChoiceCard({ label, sublabel, selected, onPress, icon }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 45, bounciness: 5 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        style={[styles.card, selected && styles.cardSelected]}
      >
        {icon ? (
          <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
            <Ionicons name={icon} size={19} color={selected ? colors.white : colors.brand} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          {sublabel ? (
            <Text style={[styles.sublabel, selected && styles.sublabelSelected]}>{sublabel}</Text>
          ) : null}
        </View>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    minHeight: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 0,
    marginBottom: spacing.sm,
  },
  cardSelected: {
    backgroundColor: colors.brand,
    borderWidth: 0,
    borderRadius: radius.lg,
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: colors.bgSoft,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  iconWrapSelected: { backgroundColor: colors.gym },
  label: { ...font.bodyBold, color: colors.text },
  sublabel: { ...font.caption, color: colors.subtext, marginTop: 2 },
  labelSelected: { color: colors.white, fontWeight: '800' },
  sublabelSelected: { color: colors.white },
  radio: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.faint,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },
  radioSelected: { backgroundColor: colors.brand, borderColor: colors.white },
});
