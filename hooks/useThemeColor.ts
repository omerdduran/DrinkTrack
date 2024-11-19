/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from 'react-native';

export type ThemeProps = {
  light: string;
  dark: string;
};

export function useThemeColor(
  props: ThemeProps,
  colorName: 'text' | 'background' | 'tint'
): string {
  const theme = useColorScheme() ?? 'light';
  return props[theme];
}
