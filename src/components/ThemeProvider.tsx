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

export type AppThemeName = 'neo-mint' | 'midnight' | 'cobalt-contrast';

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
    description: 'Soft teal workspace with calm neutral surfaces.',
    swatches: ['#0F766E', '#DDE7EA', '#FFFFFF'],
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
    appBg: '#DDE7EA',
    surface: '#FFFFFF',
    primary: '#0F766E',
    primaryHover: '#115E59',
    textTitle: '#0B1220',
    textMuted: '#64748B',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#2563EB',
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
        fontFamily: "var(--font-gilroy), 'Inter', system-ui, sans-serif",
        h1: { fontWeight: 800, fontSize: '48px', color: 'var(--text-title)' },
        h2: { fontWeight: 800, fontSize: '32px', color: 'var(--text-title)' },
        h3: { fontWeight: 700, fontSize: '24px', color: 'var(--text-title)' },
        h4: { fontWeight: 700, fontSize: '20px', color: 'var(--text-title)' },
        h5: { fontWeight: 700, fontSize: '16px', color: 'var(--text-title)' },
        h6: { fontWeight: 700, fontSize: '14px', color: 'var(--text-title)' },
        subtitle1: { fontWeight: 600, fontSize: '15px' },
        subtitle2: { fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' },
        body1: { fontSize: '15px', lineHeight: 1.6 },
        body2: { fontSize: '13px', lineHeight: 1.5 },
        button: { fontWeight: 700, textTransform: 'none' },
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
              borderRadius: 12,
              padding: '9px 18px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
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
              borderRadius: 16,
              padding: '8px',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--card-shadow)',
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { borderRadius: 999, fontWeight: 600, height: '26px' },
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
