import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type Theme = 'light' | 'dark';
type ColorScheme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  currentTheme: Theme;
  toggleTheme: () => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme() as Theme;
  const [colorScheme, setColorScheme] = useState<ColorScheme>('system');
  const [currentTheme, setCurrentTheme] = useState<Theme>(systemColorScheme || 'light');

  useEffect(() => {
    if (colorScheme === 'system') {
      setCurrentTheme(systemColorScheme || 'light');
    } else {
      setCurrentTheme(colorScheme as Theme);
    }
  }, [colorScheme, systemColorScheme]);

  const toggleTheme = () => {
    if (colorScheme !== 'system') {
      const newScheme = colorScheme === 'light' ? 'dark' : 'light';
      setColorScheme(newScheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, 
      toggleTheme, 
      colorScheme, 
      setColorScheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 