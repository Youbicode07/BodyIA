import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { MuscleZone, ZoneStatus, muscleLabel } from '../data/muscleGroups';
import { FitRect } from '../utils/imageFit';
import { colors } from '../theme/colors';

export const ZONE_STATUS_COLOR: Record<ZoneStatus, string> = {
  priority: colors.danger,
  developed: colors.fats,
  balanced: colors.success,
};

type Props = {
  zones: MuscleZone[];
  width: number;
  height: number;
  content: FitRect;
  labelOnlyPriority?: boolean;
  restrictToPriority?: boolean;
  onZonePress?: (zone: MuscleZone) => void;
  activeMuscle?: string;
};

type Marker = {
  zone: MuscleZone;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

type PlacedMarker = Marker & {
  labelCenterX: number;
  labelY: number;
  number: number;
  titleWidth: number;
};

/**
 * Repères sobres : un numéro cerclé, une flèche précise et une annotation
 * manuscrite au bas de la photo, sans panneau ni cadre qui masque le corps.
 */
export function BodyZoneOverlay({
  zones,
  width,
  height,
  content,
  labelOnlyPriority = true,
  restrictToPriority = false,
  onZonePress,
}: Props) {
  const drawable = zones.filter(
    (z) => z.visible !== false && !z.isGeneric && (!restrictToPriority || z.status === 'priority'),
  );
  const px = (x: number) => content.x + x * content.width;
  const py = (y: number) => content.y + y * content.height;

  const toMarkers = (zone: MuscleZone): Marker[] => {
    const rx = zone.shape === 'circle'
      ? (zone.radius ?? 0.05) * content.width
      : ((zone.width ?? 0.3) * content.width) / 2;
    const ry = zone.shape === 'circle'
      ? (zone.radius ?? 0.05) * content.width
      : ((zone.height ?? 0.1) * content.height) / 2;
    const xs = zone.mirrorX !== undefined ? [zone.x, zone.mirrorX] : [zone.x];
    return xs.map((x) => ({ zone, cx: px(x), cy: py(zone.y), rx, ry }));
  };

  const markers = drawable.flatMap(toMarkers);
  const inFrame = (m: Marker) =>
    m.cx > -m.rx && m.cx < width + m.rx && m.cy > -m.ry && m.cy < height + m.ry;
  const visibleMarkers = markers.filter(inFrame);
  const labelledZones = labelOnlyPriority
    ? drawable.filter((z) => z.status === 'priority')
    : drawable;
  const photoLeft = content.x + 12;
  const photoRight = content.x + content.width - 12;
  const photoTop = content.y + 42;
  const photoBottom = content.y + content.height - 42;

  const placed: PlacedMarker[] = labelledZones.flatMap((zone, zoneIndex) => {
    const own = toMarkers(zone).filter(inFrame);
    if (!own.length) return [];
    // Keep annotations in two stable columns. Long explanations stay in the
    // detail sheet, so the photo remains readable on small screens.
    const target = own[0];
    const side = zoneIndex % 2 === 0 ? 'left' : 'right';
    const blockWidth = Math.min(148, Math.max(112, content.width * 0.26));
    const preferredX = side === 'left'
      ? photoLeft + blockWidth / 2
      : photoRight - blockWidth / 2;
    return [{
      ...target,
      labelCenterX: preferredX,
      labelY: Math.max(photoTop, Math.min(photoBottom, target.cy)),
      number: zoneIndex + 1,
      titleWidth: blockWidth - 30,
    }];
  });

  // Keep nearby labels readable while preserving their proximity to the
  // corresponding muscle.
  placed.sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < placed.length; i += 1) {
    if (Math.abs(placed[i].labelCenterX - placed[i - 1].labelCenterX) < 160 &&
        placed[i].labelY - placed[i - 1].labelY < 48) {
      placed[i].labelY = placed[i - 1].labelY + 48;
    }
  }
  placed.forEach((marker) => {
    marker.labelY = Math.max(photoTop, Math.min(photoBottom, marker.labelY));
  });

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      pointerEvents={onZonePress ? 'box-none' : 'none'}
    >
      {drawable
        .filter((zone) => zone.status === 'priority')
        .flatMap(toMarkers)
        .filter(inFrame)
        .map((marker, index) => {
          const radius = Math.max(marker.rx, marker.ry) + 8;
          return (
            <Circle
              key={`target-zone-${index}`}
              cx={marker.cx}
              cy={marker.cy}
              r={radius}
              fill={colors.danger}
              fillOpacity={0.1}
              stroke={colors.danger}
              strokeWidth={2.5}
              strokeDasharray="8 5"
            />
          );
        })}
      {placed.map((marker, index) => {
        const color = colors.danger;
        const title = muscleLabel(marker.zone.muscleGroup).toUpperCase();
        const problem = marker.zone.problem.replace(/^Non visible.*$/i, '').trim().slice(0, 42);
        const exercise = (
          marker.zone.exercisesGym[0]?.name
          ?? marker.zone.exercisesHome[0]?.name
          ?? marker.zone.recommendation
        ).slice(0, 38);
        const period = marker.zone.estimatedWeeks
          ? `${marker.zone.estimatedWeeks} semaines`
          : '8-12 semaines';
        const startY = marker.labelY;
        const labelLeft = marker.labelCenterX - marker.titleWidth / 2 - 19;
        const labelRight = marker.labelCenterX + marker.titleWidth / 2 + 19;
        const lineStartX = marker.cx < marker.labelCenterX ? labelLeft : labelRight;
        const angle = Math.atan2(marker.cy - startY, marker.cx - lineStartX);
        const head = 8;
        const p1 = `${marker.cx},${marker.cy}`;
        const p2 = `${marker.cx - head * Math.cos(angle - 0.45)},${marker.cy - head * Math.sin(angle - 0.45)}`;
        const p3 = `${marker.cx - head * Math.cos(angle + 0.45)},${marker.cy - head * Math.sin(angle + 0.45)}`;

        return (
          <G key={`label-${index}`} onPress={onZonePress ? () => onZonePress(marker.zone) : undefined}>
            <Line x1={lineStartX} y1={startY} x2={marker.cx} y2={marker.cy} stroke={color} strokeWidth={2.2} />
            <Polygon points={`${p1} ${p2} ${p3}`} fill={color} />
            <Circle
              cx={marker.labelCenterX - marker.titleWidth / 2 - 12}
              cy={marker.labelY - 11}
              r={10}
              fill="none"
              stroke={color}
              strokeWidth={2}
            />
            <SvgText
              x={marker.labelCenterX - marker.titleWidth / 2 - 12}
              y={marker.labelY - 7}
              fontSize={11}
              fontFamily="Marker Felt"
              fontWeight="700"
              fill={color}
              textAnchor="middle"
            >
              {marker.number}
            </SvgText>
            <SvgText
              x={marker.labelCenterX}
              y={marker.labelY - 7}
              fontSize={10}
              fontFamily="Marker Felt"
              fontWeight="700"
              fill={color}
              textAnchor="middle"
              textDecoration="underline"
            >
              {title}
            </SvgText>
            <SvgText
              x={marker.labelCenterX}
              y={marker.labelY + 10}
              fontSize={8}
              fontFamily="Marker Felt"
              fill={color}
              textAnchor="middle"
            >
              {`: ${problem}`}
            </SvgText>
            <SvgText
              x={marker.labelCenterX}
              y={marker.labelY + 23}
              fontSize={7.8}
              fontFamily="Marker Felt"
              fill={color}
              textAnchor="middle"
            >
              {`Exercise : ${exercise}`}
            </SvgText>
            <SvgText
              x={marker.labelCenterX}
              y={marker.labelY + 36}
              fontSize={7.8}
              fontFamily="Marker Felt"
              fill={color}
              textAnchor="middle"
            >
              {`Period : ${period}`}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
