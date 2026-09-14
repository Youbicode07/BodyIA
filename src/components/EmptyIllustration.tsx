import React from 'react';
import Svg, { Circle, Path, Rect, G, Ellipse } from 'react-native-svg';
import { colors } from '../theme/colors';

type Props = {
  kind: 'meal' | 'body';
  width?: number;
  color?: string;
};

/**
 * Illustrations vectorielles pour les états vides. Dessinées en SVG plutôt
 * qu'importées : rien à télécharger, jamais d'image cassée, et elles suivent
 * automatiquement la couleur d'accent de l'écran.
 */
export function EmptyIllustration({ kind, width = 140, color = colors.brand }: Props) {
  const height = width * 0.72;
  const soft = `${color}1A`;
  const mid = `${color}40`;

  if (kind === 'meal') {
    return (
      <Svg width={width} height={height} viewBox="0 0 140 100">
        {/* Halo */}
        <Ellipse cx="70" cy="86" rx="46" ry="7" fill={soft} />
        {/* Assiette */}
        <Circle cx="70" cy="52" r="30" fill={soft} />
        <Circle cx="70" cy="52" r="22" fill={colors.white} stroke={mid} strokeWidth={2} />
        {/* Aliments */}
        <Circle cx="63" cy="47" r="7" fill={color} opacity={0.65} />
        <Circle cx="77" cy="50" r="5.5" fill={color} opacity={0.4} />
        <Path d="M62 60 q8 -5 16 0" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {/* Couverts */}
        <Rect x="30" y="34" width="3" height="36" rx="1.5" fill={mid} />
        <Rect x="107" y="34" width="3" height="36" rx="1.5" fill={mid} />
        {/* Étincelle IA */}
        <G>
          <Path d="M104 22 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z" fill={color} />
          <Path d="M32 18 l1.6 3.8 l3.8 1.6 l-3.8 1.6 l-1.6 3.8 l-1.6 -3.8 l-3.8 -1.6 l3.8 -1.6 z" fill={color} opacity={0.5} />
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height} viewBox="0 0 140 100">
      <Ellipse cx="70" cy="88" rx="40" ry="6" fill={soft} />
      {/* Cadre photo */}
      <Rect x="40" y="14" width="60" height="70" rx="10" fill={soft} stroke={mid} strokeWidth={2} />
      {/* Silhouette */}
      <Circle cx="70" cy="34" r="7" fill={color} opacity={0.55} />
      <Path d="M60 46 q10 -4 20 0 l2 20 h-24 z" fill={color} opacity={0.45} />
      <Rect x="61" y="66" width="7" height="14" rx="3" fill={color} opacity={0.4} />
      <Rect x="72" y="66" width="7" height="14" rx="3" fill={color} opacity={0.4} />
      {/* Repères d'analyse */}
      <Circle cx="70" cy="52" r="13" stroke={color} strokeWidth={2} fill="none" strokeDasharray="4 3" />
      <Path d="M100 24 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z" fill={color} />
    </Svg>
  );
}
