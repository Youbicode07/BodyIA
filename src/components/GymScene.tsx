import React from 'react';
import Svg, { Rect, Circle, Path, G, Line, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';

type Props = {
  /** Scène illustrée à afficher. */
  scene: 'gym' | 'scan' | 'progress';
  width?: number;
};

/**
 * Illustrations de salle de sport dessinées en SVG.
 * Vectorielles plutôt qu'importées : aucun fichier à charger, aucune image
 * cassée, et elles restent nettes sur tous les écrans.
 */
export function GymScene({ scene, width = 260 }: Props) {
  const height = width * 0.62;
  const brand = colors.brand;
  const alt = colors.brandAlt;

  if (scene === 'gym') {
    return (
      <Svg width={width} height={height} viewBox="0 0 260 160">
        <Defs>
          <SvgGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={brand} stopOpacity="0.12" />
            <Stop offset="1" stopColor={brand} stopOpacity="0.02" />
          </SvgGradient>
        </Defs>

        {/* Sol */}
        <Rect x="0" y="118" width="260" height="42" fill="url(#floor)" />
        <Line x1="0" y1="118" x2="260" y2="118" stroke={brand} strokeOpacity={0.25} strokeWidth={2} />

        {/* Rack à poids au fond */}
        <Rect x="14" y="52" width="52" height="66" rx="5" fill={brand} opacity={0.1} />
        <Line x1="14" y1="76" x2="66" y2="76" stroke={brand} strokeOpacity={0.35} strokeWidth={3} />
        <Line x1="14" y1="98" x2="66" y2="98" stroke={brand} strokeOpacity={0.35} strokeWidth={3} />
        <Circle cx="26" cy="70" r="6" fill={brand} opacity={0.45} />
        <Circle cx="42" cy="70" r="6" fill={brand} opacity={0.35} />
        <Circle cx="26" cy="92" r="6" fill={brand} opacity={0.3} />
        <Circle cx="42" cy="92" r="6" fill={brand} opacity={0.4} />

        {/* Banc */}
        <Rect x="176" y="96" width="66" height="9" rx="4" fill={alt} opacity={0.5} />
        <Rect x="184" y="105" width="6" height="14" rx="2" fill={alt} opacity={0.35} />
        <Rect x="228" y="105" width="6" height="14" rx="2" fill={alt} opacity={0.35} />

        {/* Athlète avec barre */}
        <G>
          <Circle cx="122" cy="46" r="12" fill={brand} />
          <Path d="M110 62 q12 -6 24 0 l3 34 h-30 z" fill={brand} opacity={0.85} />
          {/* Bras levés tenant la barre */}
          <Path d="M110 66 l-14 -12" stroke={brand} strokeWidth={7} strokeLinecap="round" />
          <Path d="M134 66 l14 -12" stroke={brand} strokeWidth={7} strokeLinecap="round" />
          {/* Jambes */}
          <Rect x="112" y="96" width="8" height="22" rx="4" fill={brand} opacity={0.7} />
          <Rect x="124" y="96" width="8" height="22" rx="4" fill={brand} opacity={0.7} />
        </G>

        {/* Barre + disques */}
        <Line x1="76" y1="54" x2="168" y2="54" stroke={colors.text} strokeWidth={5} strokeLinecap="round" />
        <Rect x="78" y="42" width="9" height="24" rx="3" fill={colors.text} />
        <Rect x="90" y="46" width="7" height="16" rx="2" fill={colors.text} opacity={0.7} />
        <Rect x="157" y="42" width="9" height="24" rx="3" fill={colors.text} />
        <Rect x="147" y="46" width="7" height="16" rx="2" fill={colors.text} opacity={0.7} />

        {/* Étincelle IA */}
        <Path d="M212 30 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={colors.carbs} />
        <Path d="M46 26 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill={colors.carbs} opacity={0.6} />
      </Svg>
    );
  }

  if (scene === 'scan') {
    return (
      <Svg width={width} height={height} viewBox="0 0 260 160">
        {/* Téléphone */}
        <Rect x="88" y="14" width="84" height="132" rx="14" fill={brand} opacity={0.08} stroke={brand} strokeWidth={2} />
        <Rect x="116" y="21" width="28" height="4" rx="2" fill={brand} opacity={0.4} />

        {/* Silhouette scannée dans l'écran */}
        <Circle cx="130" cy="52" r="9" fill={brand} opacity={0.7} />
        <Path d="M120 66 q10 -5 20 0 l2 28 h-24 z" fill={brand} opacity={0.55} />
        <Rect x="122" y="94" width="7" height="22" rx="3" fill={brand} opacity={0.45} />
        <Rect x="131" y="94" width="7" height="22" rx="3" fill={brand} opacity={0.45} />

        {/* Ligne de scan */}
        <Line x1="94" y1="80" x2="166" y2="80" stroke={colors.carbs} strokeWidth={3} strokeLinecap="round" />
        <Rect x="94" y="76" width="72" height="8" fill={colors.carbs} opacity={0.18} />

        {/* Repères d'analyse sortant de l'écran */}
        <Circle cx="130" cy="70" r="16" stroke={colors.danger} strokeWidth={2} fill="none" strokeDasharray="4 3" />
        <Line x1="146" y1="62" x2="196" y2="46" stroke={colors.danger} strokeWidth={2} />
        <Rect x="196" y="36" width="46" height="19" rx="9" fill={colors.danger} />

        <Line x1="114" y1="96" x2="62" y2="112" stroke={colors.fats} strokeWidth={2} />
        <Rect x="18" y="102" width="44" height="19" rx="9" fill={colors.fats} />

        {/* Étincelle IA */}
        <Path d="M206 96 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={colors.carbs} />
      </Svg>
    );
  }

  // progress
  return (
    <Svg width={width} height={height} viewBox="0 0 260 160">
      {/* Cadre graphique */}
      <Line x1="30" y1="128" x2="238" y2="128" stroke={colors.cardBorder} strokeWidth={2} />
      <Line x1="30" y1="24" x2="30" y2="128" stroke={colors.cardBorder} strokeWidth={2} />

      {/* Barres de progression */}
      <Rect x="48" y="94" width="26" height="34" rx="6" fill={brand} opacity={0.3} />
      <Rect x="86" y="76" width="26" height="52" rx="6" fill={brand} opacity={0.45} />
      <Rect x="124" y="58" width="26" height="70" rx="6" fill={brand} opacity={0.6} />
      <Rect x="162" y="42" width="26" height="86" rx="6" fill={brand} opacity={0.8} />
      <Rect x="200" y="30" width="26" height="98" rx="6" fill={brand} />

      {/* Courbe de tendance */}
      <Path
        d="M61 96 L99 78 L137 60 L175 44 L213 32"
        stroke={colors.success}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx="213" cy="32" r="6" fill={colors.success} />

      {/* Étincelle */}
      <Path d="M232 16 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z" fill={colors.carbs} />
    </Svg>
  );
}
