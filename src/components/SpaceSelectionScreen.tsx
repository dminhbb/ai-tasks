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
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 6 },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1040 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mb: { xs: 3, sm: 4 },
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: NEO_MINT.primary,
                mb: 0.75,
              }}
            >
              AI TASK / WORKSPACE
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '28px', sm: '34px' },
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: NEO_MINT.textTitle,
              }}
            >
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
            sx={{
              p: 5,
              borderRadius: '20px',
              border: `1px solid ${NEO_MINT.cardBorderSoft}`,
              backgroundColor: 'var(--surface-raised)',
              boxShadow: NEO_MINT.shadowSm,
              textAlign: 'center',
            }}
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: { xs: 1.25, sm: 2 },
            }}
          >
            {spaces.map((space) => (
              <Button
                key={space.id}
                onClick={() => onSelect(space)}
                aria-label={`Open ${space.name}`}
                sx={{
                  aspectRatio: '1 / 1',
                  minHeight: 180,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  borderRadius: '18px',
                  border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  backgroundColor: 'var(--surface-raised)',
                  color: NEO_MINT.textTitle,
                  textTransform: 'none',
                  boxShadow: NEO_MINT.shadowSm,
                  transition:
                    'transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast)',
                  '&:hover': {
                    borderColor: NEO_MINT.primary,
                    backgroundColor: 'var(--primary-subtle)',
                    transform: 'translateY(-2px)',
                    boxShadow: NEO_MINT.shadowMd,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '14px',
                    backgroundColor: 'var(--primary-soft)',
                  }}
                >
                  <Apps sx={{ fontSize: 25, color: NEO_MINT.primary }} />
                </Box>
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
