import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../theme/colors';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  background?: string;
};

export function IconBadge({ icon, color, size = 44, background }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: background ?? `${color}1A`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}
