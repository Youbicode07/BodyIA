import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
};

export function MacroRing({ label, value, goal, unit = 'g', color, icon, size = 84 }: Props) {
  const strokeWidth = 7;
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 900, useNativeDriver: false }).start();
  }, [progress]);

  const strokeDashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2} cy={size / 2} r={radiusPx}
            stroke={colors.progressTrack} strokeWidth={strokeWidth} fill="none"
          />
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={radiusPx}
            stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
      </View>
      <Text style={styles.value}>
        {value}
        <Text style={styles.unit}>{unit}</Text>
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { ...font.bodyBold, color: colors.text, marginTop: 8 },
  unit: { ...font.caption, color: colors.subtext },
  label: { ...font.tiny, color: colors.subtext, marginTop: 2 },
});
