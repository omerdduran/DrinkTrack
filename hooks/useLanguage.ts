import { useEffect } from 'react';
import { useLanguageContext } from '../contexts/LanguageContext';

export function useLanguage() {
  const { language } = useLanguageContext();
  
  // Return language so components can use it if needed
  return language;
} 