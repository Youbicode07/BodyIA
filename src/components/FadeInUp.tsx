import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** Petite animation d'apparition (fondu + glissement) pour donner du rythme
 * aux listes de cartes, sans dépendance d'animation externe. */
export function FadeInUp({ children, delay = 0, style }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
