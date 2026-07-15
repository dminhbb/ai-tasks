'use client';

import { Check } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import type { SubtaskStatus } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';

const STATUS_LABELS: Record<SubtaskStatus, string> = {
  'TO DO': 'To Do',
  'IN PROGRESS': 'In Progress',
  DONE: 'Done',
};

interface SubtaskStatusControlProps {
  status: SubtaskStatus;
  disabled?: boolean;
  onCycle: () => void;
}

export default function SubtaskStatusControl({
  status,
  disabled = false,
  onCycle,
}: SubtaskStatusControlProps) {
  const label = STATUS_LABELS[status];

  return (
    <Tooltip title={`${label} — click to change status`}>
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          aria-label={`Subtask status: ${label}`}
          onClick={onCycle}
          sx={{
            width: 30,
            height: 30,
            p: 0.5,
            color: status === 'DONE' ? NEO_MINT.success : NEO_MINT.primary,
          }}
        >
          {status === 'TO DO' && (
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                display: 'block',
                border: `2px solid ${NEO_MINT.textMuted}`,
                borderRadius: 2,
                boxSizing: 'border-box',
              }}
            />
          )}
          {status === 'IN PROGRESS' && (
            <span
              aria-hidden="true"
              style={{
                width: 0,
                height: 0,
                display: 'block',
                marginLeft: 2,
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderLeft: `14px solid ${NEO_MINT.primary}`,
              }}
            />
          )}
          {status === 'DONE' && <Check aria-hidden="true" sx={{ fontSize: 21, strokeWidth: 2 }} />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
