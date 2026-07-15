'use client';

import React, { useState } from 'react';
import { LockOutlined, Login } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { useAuth } from './AuthProvider';

export default function LoginScreen() {
  const { error, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError('');

    const normalizedEmail = email.trim().toLocaleLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setValidationError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (!password) {
      setValidationError('Vui lòng nhập mật khẩu.');
      return;
    }

    try {
      await signIn(normalizedEmail, password);
    } catch {
      // AuthProvider exposes a safe user-facing error.
    }
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        background: 'linear-gradient(145deg, #DDE7EA 0%, #ECFDF5 100%)',
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          borderRadius: '16px',
          border: `1px solid ${NEO_MINT.cardBorderSoft}`,
          boxShadow: NEO_MINT.shadowSm,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '12px',
              display: 'grid',
              placeItems: 'center',
              color: NEO_MINT.surface,
              backgroundColor: NEO_MINT.primary,
            }}
          >
            <LockOutlined />
          </Box>
          <Box>
            <Typography sx={{ color: NEO_MINT.textTitle, fontSize: 22, fontWeight: 800 }}>AI TASK</Typography>
            <Typography sx={{ color: NEO_MINT.textMuted, fontSize: 12, fontWeight: 600 }}>
              Đăng nhập để tiếp tục
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
          {(validationError || error) && <Alert severity="error">{validationError || error}</Alert>}
          <TextField
            autoComplete="username"
            autoFocus
            disabled={loading}
            fullWidth
            label="Email"
            name="email"
            onChange={(event) => setEmail(event.target.value.slice(0, 320))}
            required
            type="email"
            value={email}
          />
          <TextField
            autoComplete="current-password"
            disabled={loading}
            fullWidth
            label="Mật khẩu"
            name="password"
            onChange={(event) => setPassword(event.target.value.slice(0, 256))}
            required
            type="password"
            value={password}
          />
          <Button
            disabled={loading}
            fullWidth
            size="large"
            startIcon={loading ? <CircularProgress color="inherit" size={18} /> : <Login />}
            type="submit"
            variant="contained"
            sx={{ py: 1.1, borderRadius: '10px', fontWeight: 800, textTransform: 'none' }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
