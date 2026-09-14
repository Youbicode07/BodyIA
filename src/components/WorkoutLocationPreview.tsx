import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GymScene } from './GymScene';
import { colors, font, radius } from '../theme/colors';

type Props = {
  mode: 'gym' | 'home';
  selected: boolean;
};

export function WorkoutLocationPreview({ mode, selected }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    const scanLoop = Animated.loop(
      Animated.timing(scan, { toValue: 1, duration: 2800, useNativeDriver: true }),
    );
    pulseLoop.start();
    scanLoop.start();
    return () => {
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, [pulse, scan]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const scanTranslate = scan.interpolate({ inputRange: [0, 1], outputRange: [-38, 38] });
  const accent = mode === 'gym' ? colors.brandAlt : colors.brand;

  return (
    <View style={styles.preview}>
      <LinearGradient
        colors={mode === 'gym' ? ['#101D3A', '#164A69'] : ['#102B43', '#0E625F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.glow,
          { backgroundColor: accent, transform: [{ scale: glowScale }], opacity: selected ? 0.3 : 0.18 },
        ]}
      />
      <View style={styles.previewHeader}>
        <View style={styles.live}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text style={styles.liveText}>IA LIVE</Text>
        </View>
        <Ionicons name={mode === 'gym' ? 'barbell-outline' : 'home-outline'} size={18} color={colors.white} />
      </View>
      <Animated.View style={[styles.scene, { transform: [{ scale: glowScale }] }]}>
        <GymScene scene={mode === 'gym' ? 'gym' : 'scan'} width={180} />
      </Animated.View>
      <Animated.View
        style={[styles.scanLine, { backgroundColor: accent, transform: [{ translateY: scanTranslate }] }]}
      />
      <View style={styles.status}>
        <Text style={styles.statusText}>{mode === 'gym' ? 'ENVIRONNEMENT GYM' : 'ESPACE MAISON'}</Text>
        <Text style={styles.statusSub}>PROGRAMME ADAPTATIF · PRÊT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 132,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: colors.bgDark,
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    left: '50%',
    top: -30,
    marginLeft: -90,
  },
  previewHeader: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { ...font.tiny, color: colors.white, fontSize: 9, letterSpacing: 1 },
  scene: { alignItems: 'center', justifyContent: 'center', height: 126, paddingTop: 8 },
  scanLine: { position: 'absolute', left: 20, right: 20, height: 1.5, opacity: 0.7 },
  status: {
    position: 'absolute',
    left: 12,
    bottom: 9,
    backgroundColor: 'rgba(7,19,35,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: { ...font.tiny, color: colors.white, fontSize: 8.5 },
  statusSub: { ...font.tiny, color: colors.subtext, fontSize: 7.5, marginTop: 1 },
});
