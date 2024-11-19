import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ThemedTextProps extends TextProps {
  style?: any;
}

export function ThemedText({ style, ...props }: ThemedTextProps) {
  const { currentTheme } = useTheme();

  return (
    <Text
      style={[
        {
          color: currentTheme === 'dark' ? '#FFFFFF' : '#000000',
        },
        style,
      ]}
      {...props}
    />
  );
}
