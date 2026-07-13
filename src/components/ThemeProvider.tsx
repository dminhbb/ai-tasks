'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';

const NEO_MINT = {
  color: {
    appBg: '#DDE7EA',
    mainBg: '#E7EEF1',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FAFC',
    surfaceMuted: '#EEF4F5',
    sidebarBg: '#F4F8F9',
    sidebarBorder: '#CBD5DA',
    panelBg: '#F1F6F7',
    panelBorder: '#C7D2DA',
    cardBorder: '#BFCBD3',
    cardBorderSoft: '#CBD5DA',
    primary: '#0F766E',
    primaryHover: '#115E59',
    primarySoft: '#D6F3EF',
    primarySubtle: '#ECFDF5',
    accent: '#14B8A6',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#2563EB',
    textTitle: '#0B1220',
    textBody: '#334155',
    textMuted: '#64748B',
    textInverse: '#F8FAFC',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  shadow: {
    card: '0 1px 2px rgba(15, 23, 42, 0.07), 0 8px 24px rgba(15, 23, 42, 0.06)',
    primary: '0 8px 24px rgba(15, 118, 110, 0.16)',
  },
  font: {
    primary: "var(--font-gilroy), 'Inter', system-ui, sans-serif",
  },
} as const;

type ThemeMode = 'light';

interface ThemeContextType {
  mode: ThemeMode;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleColorMode: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode] = useState<ThemeMode>('light');

  const toggleColorMode = () => {};

  const theme = useMemo(
    () =>
      createTheme({
        typography: {
          fontSize: 14,
          htmlFontSize: 16,
          fontFamily: NEO_MINT.font.primary,
          h1: { fontWeight: 800, fontSize: '48px', color: NEO_MINT.color.textTitle },
          h2: { fontWeight: 800, fontSize: '32px', color: NEO_MINT.color.textTitle },
          h3: { fontWeight: 700, fontSize: '24px', color: NEO_MINT.color.textTitle },
          h4: { fontWeight: 700, fontSize: '20px', color: NEO_MINT.color.textTitle },
          h5: { fontWeight: 700, fontSize: '16px', color: NEO_MINT.color.textTitle },
          h6: { fontWeight: 700, fontSize: '14px', color: NEO_MINT.color.textTitle },
          subtitle1: { fontWeight: 600, fontSize: '15px' },
          subtitle2: { fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: 0 },
          body1: { fontSize: '15px', lineHeight: 1.6 },
          body2: { fontSize: '13px', lineHeight: 1.5 },
          button: { fontWeight: 700, textTransform: 'none' },
        },
        shape: {
          borderRadius: NEO_MINT.radius.md,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              html: {
                backgroundColor: NEO_MINT.color.appBg,
              },
              body: {
                backgroundColor: NEO_MINT.color.appBg,
                color: NEO_MINT.color.textBody,
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: NEO_MINT.radius.md,
                backgroundColor: NEO_MINT.color.surface,
                color: NEO_MINT.color.textBody,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: NEO_MINT.color.cardBorder,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: NEO_MINT.color.textMuted,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: NEO_MINT.color.primary,
                  borderWidth: '2px',
                },
              },
            },
          },
          MuiInputLabel: {
            styleOverrides: {
              root: {
                color: NEO_MINT.color.textMuted,
                '&.Mui-focused': {
                  color: NEO_MINT.color.primary,
                },
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: NEO_MINT.radius.md,
                padding: '9px 18px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: NEO_MINT.shadow.primary,
                },
              },
            },
            variants: [
              {
                props: { variant: 'contained', color: 'primary' },
                style: {
                  backgroundColor: NEO_MINT.color.primary,
                  color: NEO_MINT.color.surface,
                  border: `1px solid ${NEO_MINT.color.primary}`,
                  '&:hover': {
                    backgroundColor: NEO_MINT.color.primaryHover,
                    borderColor: NEO_MINT.color.primaryHover,
                  },
                },
              },
              {
                props: { variant: 'outlined', color: 'primary' },
                style: {
                  borderColor: NEO_MINT.color.cardBorder,
                  color: NEO_MINT.color.textBody,
                  backgroundColor: NEO_MINT.color.surface,
                  '&:hover': {
                    borderColor: NEO_MINT.color.primary,
                    backgroundColor: NEO_MINT.color.primarySubtle,
                  },
                },
              },
            ],
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backgroundColor: NEO_MINT.color.surface,
                boxShadow: NEO_MINT.shadow.card,
              },
              elevation1: {
                boxShadow: NEO_MINT.shadow.card,
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: NEO_MINT.radius.lg,
                padding: '8px',
                border: `1px solid ${NEO_MINT.color.cardBorder}`,
                boxShadow: NEO_MINT.shadow.card,
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 999,
                fontWeight: 600,
                height: '26px',
              },
              filled: {
                backgroundColor: NEO_MINT.color.surfaceMuted,
                color: NEO_MINT.color.textBody,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: NEO_MINT.color.surface,
                color: NEO_MINT.color.textTitle,
                boxShadow: 'none',
                borderBottom: `1px solid ${NEO_MINT.color.cardBorderSoft}`,
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: NEO_MINT.color.sidebarBg,
                borderRight: `1px solid ${NEO_MINT.color.sidebarBorder}`,
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              head: {
                backgroundColor: NEO_MINT.color.surfaceSoft,
                color: NEO_MINT.color.textTitle,
                fontWeight: 700,
              },
              body: {
                color: NEO_MINT.color.textBody,
                borderColor: NEO_MINT.color.cardBorderSoft,
              },
            },
          },
        },
        palette: {
          mode: 'light',
          primary: {
            main: NEO_MINT.color.primary,
            dark: NEO_MINT.color.primaryHover,
            contrastText: NEO_MINT.color.surface,
          },
          secondary: {
            main: NEO_MINT.color.textTitle,
          },
          success: {
            main: NEO_MINT.color.success,
          },
          warning: {
            main: NEO_MINT.color.warning,
          },
          error: {
            main: NEO_MINT.color.danger,
          },
          info: {
            main: NEO_MINT.color.info,
          },
          background: {
            default: NEO_MINT.color.appBg,
            paper: NEO_MINT.color.surface,
          },
          text: {
            primary: NEO_MINT.color.textTitle,
            secondary: NEO_MINT.color.textMuted,
          },
          divider: NEO_MINT.color.cardBorderSoft,
          status: {
            urgent: NEO_MINT.color.danger,
            inProgress: NEO_MINT.color.primary,
            toDo: NEO_MINT.color.info,
            pending: NEO_MINT.color.warning,
            cancelled: NEO_MINT.color.textMuted,
            done: NEO_MINT.color.success,
          },
        },
      }),
    [],
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleColorMode }}>
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
