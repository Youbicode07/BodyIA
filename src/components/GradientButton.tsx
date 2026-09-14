import React, { useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadow, font } from '../theme/colors';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  gradient?: [string, string];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Bouton principal en dégradé, avec retour tactile animé. */
export function GradientButton({
  label,
  onPress,
  icon,
  gradient = gradients.brand,
  disabled,
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
      >
        <LinearGradient
          colors={disabled ? [colors.progressTrack, colors.progressTrack] : gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, !disabled && shadow.floating]}
        >
          {icon ? <Ionicons name={icon} size={19} color={disabled ? colors.faint : colors.white} /> : null}
          <Text style={[styles.label, disabled && { color: colors.faint }]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 17,
    borderRadius: radius.pill,
  },
  label: { ...font.bodyBold, fontSize: 16, color: colors.white },
});
