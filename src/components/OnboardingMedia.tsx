import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GymScene } from './GymScene';
import { colors, radius, font } from '../theme/colors';
import { useResponsive } from '../utils/responsive';

export function OnboardingMedia({ stepId }: { stepId: string }) {
  const { width, verticalScale } = useResponsive();
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const spin = Animated.loop(Animated.timing(rotation, {
      toValue: 1, duration: 12000, useNativeDriver: true,
    }));
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    spin.start();
    breathe.start();
    return () => {
      spin.stop();
      breathe.stop();
    };
  }, [pulse, rotation]);

  const spinStyle = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scaleStyle = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

  return (
    <View style={[styles.frame, { height: verticalScale(154) }]}>
      <LinearGradient
        colors={['#0C1930', '#164A69', '#0EA5A5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View style={[styles.orbit, { transform: [{ rotate: spinStyle }] }]} />
        <Animated.View style={[styles.scene, { transform: [{ scale: scaleStyle }] }]}>
          <View style={[styles.scenePanel, { width: Math.min(width - 64, 238) }]}>
            <GymScene scene={stepId === 'speed' || stepId.includes('goal') ? 'progress' : 'gym'} width={Math.min(width - 80, 225)} />
          </View>
        </Animated.View>
        <View style={styles.topRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.labelText}>COACHING IA · ACTIF</Text>
          </View>
          <View style={styles.playButton}>
            <Ionicons name="sparkles" size={15} color={colors.white} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: 154,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
    shadowColor: colors.brandAlt,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  orbit: {
    position: 'absolute', width: 230, height: 230, borderRadius: 115,
    borderWidth: 0,
    alignSelf: 'center', top: -38,
  },
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 18 },
  scenePanel: {
    width: 238,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(225, 255, 255, 0.92)',
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#071323',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  playIcon: { color: colors.white, fontSize: 13, fontWeight: '800' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#48FFB0' },
  offlineDot: { backgroundColor: colors.warning },
  labelText: { ...font.tiny, color: colors.white, fontSize: 9 },
});
