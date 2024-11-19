import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ThemedViewProps extends ViewProps {
  style?: any;
}

export function ThemedView({ style, ...props }: ThemedViewProps) {
  const { currentTheme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: currentTheme === 'dark' ? '#000000' : '#FFFFFF',
        },
        style,
      ]}
      {...props}
    />
  );
}
