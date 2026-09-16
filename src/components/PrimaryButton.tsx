import React, { useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, font } from '../theme/colors';
import { useResponsive } from '../utils/responsive';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: keyof typeof Ionicons.glyphMap;
};

export function PrimaryButton({ label, onPress, disabled, style, variant = 'primary', icon }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const { moderateScale } = useResponsive();
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  const tint = isPrimary ? colors.primaryText : colors.text;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={[
          styles.button,
          isPrimary && styles.primary,
          variant === 'secondary' && styles.secondary,
          isOutline && styles.outline,
          isPrimary && !disabled && shadow.button,
          disabled && styles.disabled,
        ]}
      >
        {icon ? <Ionicons name={icon} size={19} color={disabled ? colors.faint : tint} /> : null}
        <Text style={[styles.label, { fontSize: moderateScale(16), color: disabled ? colors.faint : tint }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 17,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.brand },
  disabled: { backgroundColor: colors.progressTrack, opacity: 0.8 },
  label: { ...font.bodyBold, fontSize: 16 },
});
