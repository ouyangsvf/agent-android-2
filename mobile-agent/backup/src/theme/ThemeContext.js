/**
 * ThemeContext - 主题管理
 * 支持深色/浅色模式切换
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

export const themes = {
  dark: {
    background: '#0d1117',
    header: '#161b22',
    card: '#21262d',
    text: '#f0f6fc',
    textSecondary: '#8b949e',
    primary: '#58a6ff',
    border: '#30363d',
    inputBackground: '#0d1117',
  },
  light: {
    background: '#f6f8fa',
    header: '#ffffff',
    card: '#ffffff',
    text: '#24292f',
    textSecondary: '#57606a',
    primary: '#0969da',
    border: '#d0d7de',
    inputBackground: '#f6f8fa',
  },
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  const theme = isDark ? themes.dark : themes.light;

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
