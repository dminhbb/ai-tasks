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
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 800 }}>AI TASK</Typography>
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
          gap: 2,
          px: 2,
          textAlign: 'center',
        }}
      >
        <WarningAmber sx={{ fontSize: 72, color: NEO_MINT.danger }} />
        <Typography sx={{ fontSize: '16px', fontWeight: 700, color: NEO_MINT.textTitle }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
}
