import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { consumed: number; goal: number; size?: number };

export function CalorieRing({ consumed, goal, size = 172 }: Props) {
  const strokeWidth = 16;
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const remaining = Math.max(goal - consumed, 0);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={radiusPx}
          stroke={colors.progressTrack} strokeWidth={strokeWidth} fill="none"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radiusPx}
          stroke={colors.calories} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.centerText}>
          <Ionicons name="flame" size={22} color={colors.calories} style={{ marginBottom: 4 }} />
          <Text style={styles.remaining}>{remaining}</Text>
          <Text style={styles.label}>kcal restantes</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerText: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  remaining: { ...font.h1, color: colors.text },
  label: { fontSize: 12, color: colors.subtext, marginTop: 2, fontWeight: '600' },
});
