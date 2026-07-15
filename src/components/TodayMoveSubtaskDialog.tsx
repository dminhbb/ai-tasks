'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Radio,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { Task, TaskStatus } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { ALL_TASK_FILTER_VALUE, filterMoveTargetTasks, type TaskStatusFilter } from '@/utils/subtaskMove';

const TASK_STATUSES: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'];
const MOVE_DIALOG_Z_INDEX = 1500;
const MOVE_SELECT_MENU_PROPS = { sx: { zIndex: MOVE_DIALOG_Z_INDEX + 1 } };

interface TodayMoveSubtaskDialogProps {
  open: boolean;
  sourceTaskId: string | null;
  subtaskTitle: string;
  tasks: Task[];
  disabled?: boolean;
  onClose: () => void;
  onMove: (targetTaskId: string) => void | Promise<void>;
}

export default function TodayMoveSubtaskDialog({
  open,
  sourceTaskId,
  subtaskTitle,
  tasks,
  disabled = false,
  onClose,
  onMove,
}: TodayMoveSubtaskDialogProps) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState(ALL_TASK_FILTER_VALUE);
  const [status, setStatus] = useState<TaskStatusFilter>(ALL_TASK_FILTER_VALUE);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const availableTags = useMemo(
    () =>
      Array.from(new Set(tasks.flatMap((task) => task.tags))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [tasks]
  );
  const visibleTasks = useMemo(() => {
    return filterMoveTargetTasks(tasks, { sourceTaskId, query, tag, status });
  }, [query, sourceTaskId, status, tag, tasks]);

  const handleClose = () => {
    setQuery('');
    setTag(ALL_TASK_FILTER_VALUE);
    setStatus(ALL_TASK_FILTER_VALUE);
    setSelectedTaskId('');
    setErrorMessage('');
    onClose();
  };

  const handleMove = async () => {
    if (!selectedTaskId || disabled) return;
    setErrorMessage('');
    try {
      await onMove(selectedTaskId);
      handleClose();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to move this subtask.');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" sx={{ zIndex: MOVE_DIALOG_Z_INDEX }}>
      <DialogTitle sx={{ fontWeight: 800, color: NEO_MINT.textTitle }}>Move subtask</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ mb: 2, fontSize: '13px', color: NEO_MINT.textBody }}>
          Move <strong>{subtaskTitle}</strong> to another parent task.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 150px 150px' }, gap: 1 }}>
          <TextField
            size="small"
            label="Search tasks"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 200))}
          />
          <FormControl size="small">
            <InputLabel id="move-task-tag-label">Tag</InputLabel>
            <Select
              labelId="move-task-tag-label"
              label="Tag"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              MenuProps={MOVE_SELECT_MENU_PROPS}
            >
              <MenuItem value={ALL_TASK_FILTER_VALUE}>All tags</MenuItem>
              {availableTags.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="move-task-status-label">Status</InputLabel>
            <Select
              labelId="move-task-status-label"
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              MenuProps={MOVE_SELECT_MENU_PROPS}
            >
              <MenuItem value={ALL_TASK_FILTER_VALUE}>All statuses</MenuItem>
              {TASK_STATUSES.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box
          role="radiogroup"
          aria-label="Choose target parent task"
          sx={{ mt: 2, maxHeight: 360, overflowY: 'auto', border: `1px solid ${NEO_MINT.cardBorderSoft}` }}
        >
          {visibleTasks.length === 0 ? (
            <Typography sx={{ p: 2, fontSize: '13px', color: NEO_MINT.textMuted, textAlign: 'center' }}>
              No matching target task.
            </Typography>
          ) : (
            visibleTasks.map((task) => (
              <Box
                component="label"
                key={task.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  backgroundColor: selectedTaskId === task.id ? 'var(--primary-subtle)' : NEO_MINT.surface,
                }}
              >
                <Radio
                  size="small"
                  value={task.id}
                  checked={selectedTaskId === task.id}
                  onChange={() => setSelectedTaskId(task.id)}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontSize: '13px', fontWeight: 700, color: NEO_MINT.textTitle }}>
                    {task.title}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: '11px', color: NEO_MINT.textMuted }}>
                    {task.status} · {task.tags.length > 0 ? task.tags.join(', ') : 'No tags'}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
        {errorMessage && (
          <Typography role="alert" sx={{ mt: 1.5, fontSize: '12px', color: NEO_MINT.danger }}>
            {errorMessage}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!selectedTaskId || disabled}
          onClick={() => void handleMove()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Move
        </Button>
      </DialogActions>
    </Dialog>
  );
}
