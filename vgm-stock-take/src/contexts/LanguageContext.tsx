import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'EN' | 'BM' | 'DE';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  EN: {
    login: 'Login',
    userId: 'User ID',
    password: 'Password',
    hub: 'Command Center',
    stockTake: 'Stock Take',
    batteryTracking: 'Battery Tracking',
    qualityAssurance: 'Quality Assurance',
    back: 'Back',
    notCounted: 'Not Counted',
    counted: 'Counted',
    verified: 'Verified',
    role: 'Role',
    zoneProgress: 'Zone Progress',
    search: 'Search Part No / Material...',
  },
  BM: {
    login: 'Log Masuk',
    userId: 'ID Pengguna',
    password: 'Kata Laluan',
    hub: 'Pusat Arahan',
    stockTake: 'Kiraan Stok',
    batteryTracking: 'Penjejakan Bateri',
    qualityAssurance: 'Jaminan Kualiti',
    back: 'Kembali',
    notCounted: 'Belum Dikira',
    counted: 'Telah Dikira',
    verified: 'Disahkan',
    role: 'Peranan',
    zoneProgress: 'Kemajuan Zon',
    search: 'Cari No Bahagian / Bahan...',
  },
  DE: {
    login: 'Anmelden',
    userId: 'Benutzer-ID',
    password: 'Passwort',
    hub: 'Kommandozentrale',
    stockTake: 'Inventur',
    batteryTracking: 'Batterieverfolgung',
    qualityAssurance: 'Qualitätssicherung',
    back: 'Zurück',
    notCounted: 'Nicht gezählt',
    counted: 'Gezählt',
    verified: 'Verifiziert',
    role: 'Rolle',
    zoneProgress: 'Zonenfortschritt',
    search: 'Teilenr. / Material suchen...',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('EN');

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
