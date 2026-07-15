'use client';

import React from 'react';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { Logout, WarningAmber } from '@mui/icons-material';
import { NEO_MINT } from '@/styles/neoMintTokens';

interface AccessErrorScreenProps {
  message: string;
  onSignOut: () => void | Promise<void>;
}

export default function AccessErrorScreen({ message, onSignOut }: AccessErrorScreenProps) {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'var(--app-bg)' }}>
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'var(--surface)',
          color: NEO_MINT.textTitle,
          borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: '68px !important', px: { xs: 2, sm: 3 } }}>
          <Typography sx={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.04em' }}>
            AI TASK
          </Typography>
          <Button startIcon={<Logout />} onClick={() => void onSignOut()} sx={{ textTransform: 'none' }}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Box
        role="alert"
        sx={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2.25,
          px: 2,
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 88,
            height: 88,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '24px',
            backgroundColor: NEO_MINT.dangerSoft,
            border: `1px solid ${NEO_MINT.dangerBorder}`,
          }}
        >
          <WarningAmber sx={{ fontSize: 44, color: NEO_MINT.danger }} />
        </Box>
        <Typography sx={{ fontSize: '16px', fontWeight: 700, color: NEO_MINT.textTitle, maxWidth: 420 }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
}
