import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, radius, spacing } from '../theme/colors';

type Props = {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Dégradé de la valeur affichée : vert nutrition ou orange effort. */
  gradient?: [string, string];
  accent?: string;
};

const TICK_SPACING = 12;
const TICK_TALL = 30;
const TICK_SHORT = 16;

/**
 * Règle graduée horizontale, comme sur les balances connectées.
 *
 * Pourquoi remplacer la saisie au clavier : sur un pavé numérique iOS il n'y a
 * pas de touche de validation, donc le clavier restait ouvert et masquait le
 * bouton « Continuer » — c'est le blocage signalé. Ici il n'y a plus de clavier
 * du tout : on fait glisser, la valeur s'aimante sur la graduation, et le
 * réglage est à la fois plus rapide et impossible à bloquer.
 */
export function RulerPicker({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 1,
  gradient,
  accent = colors.brand,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  // Grossissement bref de la valeur à chaque cran franchi : le geste devient
  // lisible sans avoir à regarder la règle.
  const bump = useRef(new Animated.Value(0)).current;
  const lastValue = useRef(value);

  const ticks = useMemo(() => {
    const count = Math.floor((max - min) / step) + 1;
    return Array.from({ length: count }, (_, i) => min + i * step);
  }, [min, max, step]);

  const indexOf = (v: number) => Math.round((v - min) / step);

  // Recentrage sur la valeur courante dès que la largeur est connue.
  useEffect(() => {
    if (trackWidth === 0) return;
    scrollRef.current?.scrollTo({ x: indexOf(value) * TICK_SPACING, animated: false });
    // On ne resynchronise qu'au montage : pendant le geste, c'est l'utilisateur
    // qui commande, pas la prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWidth]);

  const playBump = () => {
    bump.setValue(0);
    Animated.spring(bump, { toValue: 1, useNativeDriver: true, friction: 5, tension: 180 }).start();
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / TICK_SPACING);
    const next = Math.min(Math.max(min + index * step, min), max);
    if (next !== lastValue.current) {
      lastValue.current = next;
      playBump();
      onChange(next);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const scale = bump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] });

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <Animated.View style={[styles.valueRow, { transform: [{ scale }] }]}>
        <Text style={[styles.value, { color: gradient ? gradient[0] : accent }]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </Animated.View>

      <View style={styles.trackWrap} onLayout={onLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_SPACING}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          // Marge = demi-largeur MOINS un demi-cran : sans ce demi-cran, le
          // centre d'une graduation tombe à mi-chemin entre deux positions
          // d'aimantation, et la valeur affichée décale d'un cran par rapport
          // au curseur.
          contentContainerStyle={{ paddingHorizontal: Math.max(0, trackWidth / 2 - TICK_SPACING / 2) }}
        >
          {ticks.map((t) => {
            // Graduation haute tous les 10 crans, avec la valeur écrite dessous.
            // Le repère suit le pas : avec un pas de 10 (calories), une
            // graduation tous les 10 crans veut dire tous les 100 — sinon
            // chaque trait porterait un nombre et la règle serait illisible.
            const major = t % (step * 10) === 0;
            const medium = !major && t % (step * 5) === 0;
            return (
              <View key={t} style={styles.tickSlot}>
                <View
                  style={[
                    styles.tick,
                    { height: major ? TICK_TALL : medium ? TICK_SHORT + 5 : TICK_SHORT },
                    major && { backgroundColor: colors.subtext, width: 2 },
                  ]}
                />
                {major ? <Text style={styles.tickLabel}>{t}</Text> : null}
              </View>
            );
          })}
        </ScrollView>

        {/* Estompage des bords : la règle semble continuer au-delà du cadre. */}
        <LinearGradient
          colors={[colors.bg, `${colors.bg}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fade, { left: 0 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[`${colors.bg}00`, colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fade, { right: 0 }]}
          pointerEvents="none"
        />

        {/* Curseur central fixe : c'est lui qui désigne la valeur retenue. */}
        <View style={styles.cursorWrap} pointerEvents="none">
          <View style={[styles.cursor, { backgroundColor: accent }]} />
          <View style={[styles.cursorDot, { backgroundColor: accent }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  label: { ...font.tiny, color: colors.subtext, textTransform: 'uppercase', textAlign: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, marginTop: 2 },
  value: { fontSize: 52, fontWeight: '800', letterSpacing: -1.5 },
  unit: { ...font.h3, color: colors.subtext },

  trackWrap: { height: 74, justifyContent: 'flex-start', marginTop: spacing.xs },
  tickSlot: { width: TICK_SPACING, alignItems: 'center' },
  tick: { width: 1.5, borderRadius: 1, backgroundColor: colors.faint },
  tickLabel: { ...font.tiny, fontSize: 10, fontWeight: '600', color: colors.subtext, marginTop: 4 },

  fade: { position: 'absolute', top: 0, bottom: 0, width: 46 },
  cursorWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  cursor: { width: 3, height: TICK_TALL + 6, borderRadius: 2 },
  cursorDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
});
