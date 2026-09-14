import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

export function Card({ children, style, padded = true }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: padded ? spacing.md : 0,
          borderWidth: 0,
          borderColor: colors.cardBorder,
          shadowColor: colors.black,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
