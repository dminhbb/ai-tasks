'use client';

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Apps, Logout } from '@mui/icons-material';
import type { Space } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';

interface SpaceSelectionScreenProps {
  spaces: Space[];
  onSelect: (space: Space) => void;
  onSignOut: () => void | Promise<void>;
}

export default function SpaceSelectionScreen({ spaces, onSelect, onSignOut }: SpaceSelectionScreenProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'var(--app-bg)',
        px: 2,
        py: 5,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 900 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography sx={{ fontSize: '28px', fontWeight: 900, color: NEO_MINT.textTitle }}>
              Choose a Space
            </Typography>
            <Typography sx={{ mt: 0.5, color: NEO_MINT.textMuted }}>
              Select the workspace you want to open.
            </Typography>
          </Box>
          <Button startIcon={<Logout />} onClick={() => void onSignOut()} sx={{ textTransform: 'none' }}>
            Sign out
          </Button>
        </Box>

        {spaces.length === 0 ? (
          <Box
            role="status"
            sx={{ p: 4, borderRadius: '14px', backgroundColor: NEO_MINT.surface, textAlign: 'center' }}
          >
            <Typography sx={{ fontWeight: 800, color: NEO_MINT.textTitle }}>No Space available</Typography>
            <Typography sx={{ mt: 0.75, color: NEO_MINT.textMuted }}>
              Ask a superadmin to assign your account to a Space.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 2,
            }}
          >
            {spaces.map((space) => (
              <Button
                key={space.id}
                onClick={() => onSelect(space)}
                aria-label={`Open ${space.name}`}
                sx={{
                  aspectRatio: '1 / 1',
                  minHeight: 150,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  borderRadius: '14px',
                  border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  backgroundColor: NEO_MINT.surface,
                  color: NEO_MINT.textTitle,
                  textTransform: 'none',
                  boxShadow: NEO_MINT.shadowSm,
                  '&:hover': {
                    borderColor: NEO_MINT.primary,
                    backgroundColor: 'var(--primary-subtle)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Apps sx={{ fontSize: 40, color: NEO_MINT.primary }} />
                <Typography
                  sx={{
                    maxWidth: '100%',
                    px: 1,
                    fontSize: '14px',
                    fontWeight: 800,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {space.name}
                </Typography>
              </Button>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
