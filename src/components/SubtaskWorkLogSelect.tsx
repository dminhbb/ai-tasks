'use client';

import { Box, MenuItem, Select, Typography } from '@mui/material';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { WORK_HOUR_OPTIONS } from '@/utils/subtaskWork';

interface SubtaskWorkLogSelectProps {
  value: number;
  disabled?: boolean;
  compact?: boolean;
  onChange: (hours: number) => void;
}

export default function SubtaskWorkLogSelect({
  value,
  disabled = false,
  compact = false,
  onChange,
}: SubtaskWorkLogSelectProps) {
  const safeValue = WORK_HOUR_OPTIONS.includes(value) ? value : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        flexShrink: 0,
      }}
    >
      {!compact && (
        <Typography component="span" sx={{ fontSize: '11px', fontWeight: 700, color: NEO_MINT.textBody }}>
          Log work
        </Typography>
      )}
      <Select
        size="small"
        value={safeValue}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        inputProps={{ 'aria-label': compact ? 'Log work hours' : undefined }}
        sx={{
          width: compact ? 58 : 66,
          height: 30,
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          backgroundColor: NEO_MINT.surface,
          '& .MuiSelect-select': { py: 0.5, pl: 1 },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.cardBorderSoft },
        }}
      >
        {WORK_HOUR_OPTIONS.map((hours) => (
          <MenuItem key={hours} value={hours} sx={{ fontSize: '12px' }}>
            {hours}h
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
