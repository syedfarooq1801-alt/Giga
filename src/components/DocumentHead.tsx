import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export const DocumentHead = () => {
  const { isDark } = useTheme();
  
  return (
    <>
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512x512.png" />
      <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <meta name="theme-color" content={isDark ? '#000000' : '#ffffff'} />
    </>
  );
};
