import React from 'react';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';
import { MuscleGroupKey } from '../data/muscleGroups';
import { colors } from '../theme/colors';

type Props = {
  /** Muscles à mettre en évidence. */
  highlight?: (MuscleGroupKey | string)[];
  /** Couleur du surlignage. */
  color?: string;
  width?: number;
};

/**
 * Silhouette vectorielle de face, avec les muscles ciblés mis en évidence.
 * Entièrement dessinée en SVG : aucune image à télécharger, donc toujours
 * affichée, même hors ligne, et nette à toutes les tailles.
 *
 * Repère du dessin : boîte 100 x 200.
 */
export function MuscleBodyDiagram({ highlight = [], color = colors.brand, width = 90 }: Props) {
  const height = width * 2;
  const on = (key: MuscleGroupKey | string) => highlight.includes(key);
  const fillFor = (key: MuscleGroupKey | string) => (on(key) ? color : colors.cardBorder);
  const opacityFor = (key: MuscleGroupKey | string) => (on(key) ? 1 : 0.55);

  return (
    <Svg width={width} height={height} viewBox="0 0 100 200">
      {/* Silhouette de base */}
      <G>
        {/* Tête */}
        <Circle cx="50" cy="16" r="11" fill={colors.cardBorder} opacity={0.55} />
        {/* Cou */}
        <Path d="M45 26 h10 v6 h-10 z" fill={colors.cardBorder} opacity={0.55} />
        {/* Torse */}
        <Path
          d="M31 33 q19 -6 38 0 l3 34 q-4 8 -5 22 l-36 0 q-1 -14 -5 -22 z"
          fill={colors.cardBorder}
          opacity={0.45}
        />
        {/* Bassin */}
        <Path d="M32 89 h36 l-2 14 h-32 z" fill={colors.cardBorder} opacity={0.45} />
        {/* Jambes */}
        <Path d="M35 103 h12 l-2 52 h-9 z" fill={colors.cardBorder} opacity={0.45} />
        <Path d="M53 103 h12 l-1 52 h-9 z" fill={colors.cardBorder} opacity={0.45} />
        {/* Bras */}
        <Path d="M25 37 l7 -3 l4 30 l-6 2 z" fill={colors.cardBorder} opacity={0.45} />
        <Path d="M75 37 l-7 -3 l-4 30 l6 2 z" fill={colors.cardBorder} opacity={0.45} />
        <Path d="M30 66 l6 -2 l3 24 l-6 1 z" fill={colors.cardBorder} opacity={0.45} />
        <Path d="M70 66 l-6 -2 l-3 24 l6 1 z" fill={colors.cardBorder} opacity={0.45} />
      </G>

      {/* Groupes musculaires mis en évidence */}
      {/* Épaules */}
      <Ellipse cx="30" cy="39" rx="8" ry="7" fill={fillFor('epaules')} opacity={opacityFor('epaules')} />
      <Ellipse cx="70" cy="39" rx="8" ry="7" fill={fillFor('epaules')} opacity={opacityFor('epaules')} />

      {/* Pectoraux */}
      <Ellipse cx="41" cy="48" rx="10" ry="8" fill={fillFor('pectoraux')} opacity={opacityFor('pectoraux')} />
      <Ellipse cx="59" cy="48" rx="10" ry="8" fill={fillFor('pectoraux')} opacity={opacityFor('pectoraux')} />

      {/* Dos (trapèzes visibles de face) */}
      <Path d="M38 33 q12 -4 24 0 l-4 6 h-16 z" fill={fillFor('dos')} opacity={opacityFor('dos')} />

      {/* Abdominaux */}
      <Path d="M42 60 h16 v28 h-16 z" fill={fillFor('abdominaux')} opacity={opacityFor('abdominaux')} />

      {/* Biceps */}
      <Ellipse cx="29" cy="55" rx="5" ry="10" fill={fillFor('biceps')} opacity={opacityFor('biceps')} />
      <Ellipse cx="71" cy="55" rx="5" ry="10" fill={fillFor('biceps')} opacity={opacityFor('biceps')} />

      {/* Triceps (face arrière, esquissés en bord de bras) */}
      <Ellipse cx="24" cy="56" rx="3" ry="9" fill={fillFor('triceps')} opacity={opacityFor('triceps')} />
      <Ellipse cx="76" cy="56" rx="3" ry="9" fill={fillFor('triceps')} opacity={opacityFor('triceps')} />

      {/* Avant-bras */}
      <Ellipse cx="33" cy="78" rx="4" ry="11" fill={fillFor('avant_bras')} opacity={opacityFor('avant_bras')} />
      <Ellipse cx="67" cy="78" rx="4" ry="11" fill={fillFor('avant_bras')} opacity={opacityFor('avant_bras')} />

      {/* Fessiers */}
      <Path d="M34 92 h32 l-2 11 h-28 z" fill={fillFor('fessiers')} opacity={opacityFor('fessiers')} />

      {/* Quadriceps */}
      <Ellipse cx="41" cy="122" rx="6" ry="18" fill={fillFor('quadriceps')} opacity={opacityFor('quadriceps')} />
      <Ellipse cx="59" cy="122" rx="6" ry="18" fill={fillFor('quadriceps')} opacity={opacityFor('quadriceps')} />

      {/* Ischio-jambiers (arrière de cuisse, esquissés en bord) */}
      <Ellipse cx="35" cy="126" rx="3" ry="15" fill={fillFor('ischio_jambiers')} opacity={opacityFor('ischio_jambiers')} />
      <Ellipse cx="65" cy="126" rx="3" ry="15" fill={fillFor('ischio_jambiers')} opacity={opacityFor('ischio_jambiers')} />

      {/* Mollets */}
      <Ellipse cx="40" cy="152" rx="5" ry="12" fill={fillFor('mollets')} opacity={opacityFor('mollets')} />
      <Ellipse cx="60" cy="152" rx="5" ry="12" fill={fillFor('mollets')} opacity={opacityFor('mollets')} />
    </Svg>
  );
}
