import React, { useMemo, useRef } from 'react';
import { Animated, GestureResponderEvent, PanResponder, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  width: number;
  height: number;
  children: React.ReactNode;
  maxScale?: number;
  initialScale?: number;
  style?: ViewStyle;
  /** Prévenu à chaque changement de zoom, pour afficher une aide contextuelle. */
  onScaleChange?: (scale: number) => void;
};

const DOUBLE_TAP_DELAY = 280;
const DOUBLE_TAP_SCALE = 2.4;

/**
 * Zoom par pincement, déplacement au doigt et double-tap.
 *
 * Écrit avec PanResponder plutôt qu'avec une bibliothèque de gestes : cela
 * évite d'ajouter un module natif, qui obligerait à recompiler l'application
 * et cesserait de fonctionner dans Expo Go.
 *
 * Point important : l'image ET les repères sont placés dans CE conteneur, donc
 * ils subissent exactement la même transformation. Les cercles et les flèches
 * restent collés au bon muscle quel que soit le zoom, sans aucun calcul
 * supplémentaire — et les repères restent tactiles, React Native se chargeant
 * de convertir les coordonnées du toucher.
 */
export function ZoomableView({
  width,
  height,
  children,
  maxScale = 4,
  initialScale = 1,
  style,
  onScaleChange,
}: Props) {
  const scale = useRef(new Animated.Value(initialScale)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Valeurs « validées » à la fin de chaque geste : le geste suivant repart
  // de là, sinon chaque pincement recommencerait à l'échelle 1.
  const base = useRef({ scale: initialScale, x: 0, y: 0 });
  const gesture = useRef({ distance: 0, startX: 0, startY: 0 });
  const lastTap = useRef(0);

  /** Empêche l'image de sortir complètement du cadre une fois zoomée. */
  const clampTranslation = (value: number, axisSize: number, currentScale: number) => {
    const limit = (axisSize * (currentScale - 1)) / 2;
    return Math.min(Math.max(value, -limit), limit);
  };

  const applyScale = (next: number) => {
    base.current.scale = next;
    scale.setValue(next);
    onScaleChange?.(next);
  };

  const reset = () => {
    base.current = { scale: initialScale, x: 0, y: 0 };
    Animated.parallel([
      Animated.spring(scale, { toValue: initialScale, useNativeDriver: true, friction: 7 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7 }),
    ]).start();
    onScaleChange?.(initialScale);
  };

  const zoomTo = (target: number) => {
    base.current = { scale: target, x: 0, y: 0 };
    Animated.parallel([
      Animated.spring(scale, { toValue: target, useNativeDriver: true, friction: 7 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7 }),
    ]).start();
    onScaleChange?.(target);
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      lastTap.current = 0;
      if (base.current.scale > initialScale + 0.05) reset();
      else zoomTo(DOUBLE_TAP_SCALE);
      return true;
    }
    lastTap.current = now;
    return false;
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // On ne capte pas le simple contact : les repères doivent rester
        // cliquables. On n'intercepte qu'à partir d'un vrai mouvement.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => {
          const touches = _e.nativeEvent.touches.length;
          if (touches >= 2) return true;
          // À l'échelle 1, un glissement d'un doigt reste au parent (la liste
          // en dessous peut ainsi défiler normalement).
          return base.current.scale > initialScale + 0.05 && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4);
        },

        onPanResponderGrant: (e: GestureResponderEvent) => {
          const touches = e.nativeEvent.touches;
          gesture.current.startX = base.current.x;
          gesture.current.startY = base.current.y;
          gesture.current.distance =
            touches.length >= 2
              ? Math.hypot(
                  touches[0].pageX - touches[1].pageX,
                  touches[0].pageY - touches[1].pageY,
                )
              : 0;
        },

        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;

          if (touches.length >= 2) {
            const distance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
            if (gesture.current.distance === 0) {
              gesture.current.distance = distance;
              return;
            }
            const ratio = distance / gesture.current.distance;
            const next = Math.min(Math.max(base.current.scale * ratio, initialScale), maxScale);
            scale.setValue(next);
            return;
          }

          if (base.current.scale > initialScale + 0.05) {
            const x = clampTranslation(gesture.current.startX + g.dx, width, base.current.scale);
            const y = clampTranslation(gesture.current.startY + g.dy, height, base.current.scale);
            translateX.setValue(x);
            translateY.setValue(y);
          }
        },

        onPanResponderRelease: (e) => {
          const wasPinch = gesture.current.distance > 0;
          gesture.current.distance = 0;

          if (wasPinch) {
            // On relit l'échelle atteinte pendant le pincement pour en faire
            // la nouvelle base.
            scale.stopAnimation((value) => {
              const next = Math.min(Math.max(value, initialScale), maxScale);
              if (next <= initialScale + 0.02) reset();
              else applyScale(next);
            });
            return;
          }

          translateX.stopAnimation((x) => {
            base.current.x = x;
          });
          translateY.stopAnimation((y) => {
            base.current.y = y;
          });
        },

        onPanResponderTerminationRequest: () => false,
      }),
    // Les dimensions ne changent qu'à la rotation de l'écran.
    [width, height, maxScale, initialScale],
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      // Le double-tap est géré ici, en amont des repères : un simple toucher
      // continue de descendre jusqu'à eux.
      onStartShouldSetResponderCapture={() => {
        handleTap();
        return false;
      }}
      style={[
        styles.container,
        style,
        { width, height, transform: [{ scale }, { translateX }, { translateY }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
