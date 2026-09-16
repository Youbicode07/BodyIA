import { useWindowDimensions } from 'react-native';

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function responsiveScale(
  value: number,
  width: number,
  factor = 0.5,
): number {
  return value + ((width / DESIGN_WIDTH) * value - value) * factor;
}

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const scale = width / DESIGN_WIDTH;

  return {
    width,
    height,
    scale,
    isSmallPhone: width < 360 || height < 700,
    horizontalPadding: clamp(width * 0.06, 16, 28),
    contentWidth: Math.min(width - clamp(width * 0.06, 16, 28) * 2, 560),
    verticalScale: (value: number) => clamp((height / DESIGN_HEIGHT) * value, value * 0.82, value * 1.12),
    moderateScale: (value: number, factor = 0.5) => responsiveScale(value, width, factor),
    fontScale: clamp(fontScale, 0.85, 1.15),
  };
}
