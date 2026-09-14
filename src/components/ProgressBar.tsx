import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme/colors';

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.brandAlt, borderRadius: radius.pill },
});
