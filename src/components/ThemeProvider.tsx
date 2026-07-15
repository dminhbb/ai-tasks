'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';

const THEME_STORAGE_KEY = 'ai-task-theme';
const THEME_CHANGE_EVENT = 'ai-task-theme-change';

export type AppThemeName = 'neo-mint' | 'pastel-rose' | 'elegant-grey' | 'midnight' | 'cobalt-contrast';

export interface AppThemeOption {
  id: AppThemeName;
  label: string;
  description: string;
  swatches: [string, string, string];
}

export const APP_THEME_OPTIONS: AppThemeOption[] = [
  {
    id: 'neo-mint',
    label: 'Neo Mint',
    description: 'Clear teal contrast with cool, quiet workspace surfaces.',
    swatches: ['#065F5B', '#DCEAE7', '#FFFFFF'],
  },
  {
    id: 'pastel-rose',
    label: 'Pastel Rose',
    description: 'Soft pink surfaces with deep-rose actions and readable text.',
    swatches: ['#9D174D', '#FCF1F5', '#FFFDFE'],
  },
  {
    id: 'elegant-grey',
    label: 'Elegant Grey',
    description: 'Light graphite surfaces with disciplined red accents.',
    swatches: ['#B42318', '#D5D5D7', '#FCFCFC'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Dark navy surfaces with a bright mint accent.',
    swatches: ['#5EEAD4', '#070B14', '#172033'],
  },
  {
    id: 'cobalt-contrast',
    label: 'Cobalt Contrast',
    description: 'High-contrast navy text, stronger borders, and cobalt actions.',
    swatches: ['#1746A2', '#D7E3F4', '#FFFFFF'],
  },
];

const THEME_PALETTES: Record<
  AppThemeName,
  {
    appBg: string;
    surface: string;
    primary: string;
    primaryHover: string;
    textTitle: string;
    textMuted: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  }
> = {
  'neo-mint': {
    appBg: '#DCEAE7',
    surface: '#FFFFFF',
    primary: '#065F5B',
    primaryHover: '#064E4B',
    textTitle: '#102A2A',
    textMuted: '#557072',
    success: '#167A4D',
    warning: '#A85A05',
    danger: '#B42318',
    info: '#0A5CAD',
  },
  'pastel-rose': {
    appBg: '#FCF1F5',
    surface: '#FFFDFE',
    primary: '#9D174D',
    primaryHover: '#831843',
    textTitle: '#401223',
    textMuted: '#80576A',
    success: '#237A4C',
    warning: '#9A5A08',
    danger: '#B4233D',
    info: '#8A2B62',
  },
  'elegant-grey': {
    appBg: '#DDDDDF',
    surface: '#FCFCFC',
    primary: '#B42318',
    primaryHover: '#8F1B13',
    textTitle: '#1C1C1E',
    textMuted: '#5E5E62',
    success: '#1B6E45',
    warning: '#8A5A00',
    danger: '#B42318',
    info: '#8F1B13',
  },
  midnight: {
    appBg: '#070B14',
    surface: '#111827',
    primary: '#5EEAD4',
    primaryHover: '#99F6E4',
    textTitle: '#F8FAFC',
    textMuted: '#94A3B8',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
  },
  'cobalt-contrast': {
    appBg: '#D7E3F4',
    surface: '#FFFFFF',
    primary: '#1746A2',
    primaryHover: '#0B2F73',
    textTitle: '#07152F',
    textMuted: '#52657F',
    success: '#087A35',
    warning: '#9A4D00',
    danger: '#B42318',
    info: '#1746A2',
  },
};

interface ThemeContextType {
  themeName: AppThemeName;
  setThemeName: (themeName: AppThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'neo-mint',
  setThemeName: () => undefined,
});

function isAppThemeName(value: string | null): value is AppThemeName {
  return APP_THEME_OPTIONS.some((option) => option.id === value);
}

function applyDocumentTheme(themeName: AppThemeName): void {
  document.documentElement.dataset.theme = themeName;
  document.documentElement.style.colorScheme = themeName === 'midnight' ? 'dark' : 'light';
}

function getStoredTheme(): AppThemeName {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isAppThemeName(storedTheme) ? storedTheme : 'neo-mint';
}

function subscribeToThemeChanges(onStoreChange: () => void): () => void {
  const handleChange = () => onStoreChange();
  window.addEventListener('storage', handleChange);
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);
  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
  };
}

export const useThemeContext = (): ThemeContextType => useContext(ThemeContext);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeName = useSyncExternalStore(
    subscribeToThemeChanges,
    getStoredTheme,
    (): AppThemeName => 'neo-mint'
  );

  useEffect(() => {
    applyDocumentTheme(themeName);
  }, [themeName]);

  const setThemeName = useCallback((nextThemeName: AppThemeName) => {
    applyDocumentTheme(nextThemeName);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextThemeName);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const theme = useMemo(() => {
    const colors = THEME_PALETTES[themeName];
    return createTheme({
      typography: {
        fontSize: 14,
        htmlFontSize: 16,
        fontFamily: 'var(--font-gilroy), system-ui, sans-serif',
        h1: {
          fontWeight: 800,
          fontSize: 'clamp(2rem, 3vw, 3rem)',
          letterSpacing: '-0.04em',
          color: 'var(--text-title)',
        },
        h2: {
          fontWeight: 800,
          fontSize: 'clamp(1.65rem, 2.5vw, 2.25rem)',
          letterSpacing: '-0.032em',
          color: 'var(--text-title)',
        },
        h3: { fontWeight: 750, fontSize: '1.5rem', letterSpacing: '-0.025em', color: 'var(--text-title)' },
        h4: { fontWeight: 750, fontSize: '1.25rem', letterSpacing: '-0.018em', color: 'var(--text-title)' },
        h5: { fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.012em', color: 'var(--text-title)' },
        h6: { fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-title)' },
        subtitle1: { fontWeight: 650, fontSize: '0.9375rem' },
        subtitle2: {
          fontWeight: 750,
          fontSize: '0.6875rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
        body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
        body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
        button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0' },
      },
      shape: { borderRadius: 12 },
      palette: {
        mode: themeName === 'midnight' ? 'dark' : 'light',
        primary: {
          main: colors.primary,
          dark: colors.primaryHover,
          contrastText: themeName === 'midnight' ? '#07111F' : '#FFFFFF',
        },
        secondary: { main: colors.textTitle },
        success: { main: colors.success },
        warning: { main: colors.warning },
        error: { main: colors.danger },
        info: { main: colors.info },
        background: { default: colors.appBg, paper: colors.surface },
        text: { primary: colors.textTitle, secondary: colors.textMuted },
        divider: colors.textMuted,
        status: {
          urgent: colors.danger,
          inProgress: colors.primary,
          toDo: colors.info,
          pending: colors.warning,
          cancelled: colors.textMuted,
          done: colors.success,
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            html: { backgroundColor: 'var(--app-bg)' },
            body: { backgroundColor: 'var(--app-bg)', color: 'var(--text-body)' },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 12,
              backgroundColor: 'var(--input-bg)',
              color: 'var(--text-body)',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--input-border)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--text-muted)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--input-focus)',
                borderWidth: '2px',
              },
            },
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              color: 'var(--text-muted)',
              '&.Mui-focused': { color: 'var(--primary)' },
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              padding: '8px 14px',
              transition:
                'background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast)',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
              '&:active': { transform: 'translateY(1px)' },
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-body)',
              boxShadow: 'var(--card-shadow)',
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 20,
              padding: '4px',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--shadow-lg)',
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { borderRadius: 999, fontWeight: 650, height: '24px', fontSize: '0.6875rem' },
            filled: { backgroundColor: 'var(--surface-muted)', color: 'var(--text-body)' },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: 'var(--surface)',
              color: 'var(--text-title)',
              boxShadow: 'none',
              borderBottom: '1px solid var(--card-border-soft)',
              backdropFilter: 'blur(18px)',
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundColor: 'var(--sidebar-bg)',
              borderRight: '1px solid var(--sidebar-border)',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              backgroundColor: 'var(--surface-soft)',
              color: 'var(--text-title)',
              fontWeight: 700,
            },
            body: { color: 'var(--text-body)', borderColor: 'var(--card-border-soft)' },
          },
        },
      },
    });
  }, [themeName]);

  return (
    <ThemeContext.Provider value={{ themeName, setThemeName }}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
}

declare module '@mui/material/styles' {
  interface Palette {
    status: {
      urgent: string;
      inProgress: string;
      toDo: string;
      pending: string;
      cancelled: string;
      done: string;
    };
  }
  interface PaletteOptions {
    status?: {
      urgent: string;
      inProgress: string;
      toDo: string;
      pending: string;
      cancelled: string;
      done: string;
    };
  }
}
