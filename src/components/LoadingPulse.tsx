import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, gradients } from '../theme/colors';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  colorsGradient?: [string, string];
  size?: number;
};

/** Indicateur de chargement animé (pulsation + anneau tournant) utilisé
 * pendant les analyses IA, plus vivant qu'un simple spinner. */
export function LoadingPulse({ icon, colorsGradient = gradients.brand, size = 96 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    pulseLoop.start();
    spinLoop.start();
    return () => {
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: size * 1.6, height: size * 1.6, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.ring,
          { borderColor: colorsGradient[0], transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.secondaryRing,
          { borderColor: colorsGradient[1], transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', transform: [{ rotate }] }]}
      >
        <View style={[styles.dashedRing, { width: size * 1.25, height: size * 1.25, borderRadius: (size * 1.25) / 2, borderColor: colorsGradient[1] }]} />
        <View style={[styles.orbitDot, { backgroundColor: colorsGradient[1], top: size * 0.08 }]} />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] },
        ]}
      >
        <View style={[styles.orbitDotSmall, { backgroundColor: colorsGradient[0], top: size * 0.26 }]} />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={colorsGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Ionicons name={icon} size={size * 0.42} color={colors.white} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2, borderRadius: radius.pill },
  secondaryRing: { borderWidth: 1, borderRadius: radius.pill, transform: [{ rotate: '45deg' }] },
  dashedRing: { borderWidth: 2, borderStyle: 'dashed', opacity: 0.4 },
  orbitDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5 },
  orbitDotSmall: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
