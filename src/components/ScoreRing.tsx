import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors, font } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** Valeur affichée au centre, 0 à 100. */
  value: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  gradient?: [string, string];
  /** Affiché tel quel au centre à la place du pourcentage. */
  display?: string;
};

/**
 * Anneau de progression générique.
 *
 * CalorieRing fait la même chose pour les calories, mais avec un texte et une
 * unité qui n'ont de sens que pour la nutrition. Plutôt que de le détourner,
 * cet anneau-ci reste neutre : le tableau de bord s'en sert pour la note de
 * progression, l'écran de programme pour l'avancement de la semaine.
 */
export function ScoreRing({
  value,
  label,
  sublabel,
  size = 148,
  strokeWidth = 13,
  gradient = [colors.brand, colors.brandAlt],
  display,
}: Props) {
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const ratio = Math.min(Math.max(value, 0), 100) / 100;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: ratio, duration: 900, useNativeDriver: false }).start();
  }, [ratio, anim]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="scoreRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={colors.progressTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke="url(#scoreRing)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <Text style={styles.value}>{display ?? `${Math.round(value)}`}</Text>
          <Text style={styles.label}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  value: { ...font.display, fontSize: 34, color: colors.text },
  label: { ...font.tiny, color: colors.subtext, marginTop: 2, textAlign: 'center' },
  sublabel: { ...font.tiny, fontSize: 9.5, fontWeight: '500', color: colors.faint, marginTop: 1, textAlign: 'center' },
});
