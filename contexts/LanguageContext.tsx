import React, { createContext, useContext, useEffect, useState } from 'react';
import { LanguageService } from '../services/languageService';
import { EventEmitter } from '../services/eventEmitter';
import { SupportedLanguages } from '../translations/types';

type LanguageContextType = {
  language: SupportedLanguages;
  setLanguage: (lang: SupportedLanguages) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguages>('en');

  useEffect(() => {
    LanguageService.initialize().then(() => {
      setLanguageState(LanguageService.getLanguage());
    });

    const handleLanguageChange = (newLanguage: SupportedLanguages) => {
      setLanguageState(newLanguage);
    };

    EventEmitter.on('languageChanged', handleLanguageChange);
    return () => {
      EventEmitter.off('languageChanged', handleLanguageChange);
    };
  }, []);

  const setLanguage = async (newLanguage: SupportedLanguages) => {
    await LanguageService.setLanguage(newLanguage);
    setLanguageState(newLanguage);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguageContext() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  return context;
} 