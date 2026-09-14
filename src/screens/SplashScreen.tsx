import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, radius, spacing, gradients } from '../theme/colors';

export function SplashScreen({ navigation }: any) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => navigation.replace('Welcome'), 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <Animated.View
        style={{
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
      >
        <View style={styles.logoBox}>
          <Ionicons name="body" size={46} color={colors.white} />
        </View>
        <Text style={styles.logo}>BodyAI</Text>
        <Text style={styles.tagline}>Ton coach intelligent</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBox: {
    width: 104, height: 104, borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  logo: { ...font.display, color: colors.white, textAlign: 'center', marginTop: spacing.md },
  tagline: { ...font.caption, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 2 },
});
