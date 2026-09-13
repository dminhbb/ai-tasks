'use client';

import { useState } from 'react';

// Import each icon from its own module instead of the package barrel — the barrel
// re-exports every Phosphor icon (~1500 modules) and is dramatically slower to load.
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Circle } from '@phosphor-icons/react/dist/csr/Circle';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { PauseCircle } from '@phosphor-icons/react/dist/csr/PauseCircle';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import type { SubtaskStatus } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';

const STATUS_SEQUENCE: SubtaskStatus[] = [
  'TO DO',
  'IN PROGRESS',
  'WARNING',
  'WAITING',
  'PENDING',
  'CANCELLED',
  'DONE',
];

const STATUS_LABELS: Record<SubtaskStatus, string> = {
  'TO DO': 'To Do',
  'IN PROGRESS': 'In Progress',
  WARNING: 'Warning',
  WAITING: 'Waiting',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
  DONE: 'Done',
};

const STATUS_ICONS: Record<SubtaskStatus, typeof Circle> = {
  'TO DO': Circle,
  'IN PROGRESS': Play,
  WARNING: Warning,
  WAITING: Clock,
  PENDING: PauseCircle,
  CANCELLED: XCircle,
  DONE: CheckCircle,
};

const STATUS_COLORS: Record<SubtaskStatus, string> = {
  'TO DO': NEO_MINT.textMuted,
  'IN PROGRESS': NEO_MINT.primary,
  WARNING: NEO_MINT.warning,
  WAITING: NEO_MINT.dueDateChange,
  PENDING: NEO_MINT.accent,
  CANCELLED: NEO_MINT.danger,
  DONE: NEO_MINT.success,
};

interface SubtaskStatusControlProps {
  status: SubtaskStatus;
  disabled?: boolean;
  size?: number;
  iconSize?: number;
  onSelect: (status: SubtaskStatus) => void;
}

export default function SubtaskStatusControl({
  status,
  disabled = false,
  size = 30,
  iconSize = 20,
  onSelect,
}: SubtaskStatusControlProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const activeStatus = status || 'TO DO';
  const label = STATUS_LABELS[activeStatus] || 'To Do';
  const StatusIcon = STATUS_ICONS[activeStatus] || STATUS_ICONS['TO DO'];
  const statusColor = STATUS_COLORS[activeStatus] || STATUS_COLORS['TO DO'];

  return (
    <>
      <Tooltip title={`${label} — click to choose a status`}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            aria-label={`Subtask status: ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(event.currentTarget);
            }}
            sx={{
              width: size,
              height: size,
              p: 0.25,
              color: statusColor,
            }}
          >
            <StatusIcon aria-hidden="true" size={iconSize} weight="bold" />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={(event: React.SyntheticEvent) => {
          event.stopPropagation();
          setAnchorEl(null);
        }}
        slotProps={{
          paper: {
            onClick: (event: React.MouseEvent) => event.stopPropagation(),
          },
        }}
      >
        {STATUS_SEQUENCE.map((candidate) => {
          const CandidateIcon = STATUS_ICONS[candidate];
          return (
            <MenuItem
              key={candidate}
              selected={candidate === activeStatus}
              onClick={(event) => {
                event.stopPropagation();
                setAnchorEl(null);
                if (candidate !== activeStatus) onSelect(candidate);
              }}
              sx={{ fontSize: '13px', gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: STATUS_COLORS[candidate] }}>
                <CandidateIcon aria-hidden="true" size={16} weight="bold" />
              </ListItemIcon>
              <ListItemText primary={STATUS_LABELS[candidate]} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
