'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { MAX_BATCH_SUBTASKS, MAX_BATCH_TEXT_LENGTH, parseBatchSubtaskTitles } from '@/utils/todayBatch';
import { TODAY_TASK_TITLE } from '@/utils/taskOrdering';

interface TodayBatchAddDialogProps {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onAdd: (titles: string[]) => void;
}

export default function TodayBatchAddDialog({ open, disabled, onClose, onAdd }: TodayBatchAddDialogProps) {
  const [batchText, setBatchText] = useState('');

  const handleAdd = () => {
    const titles = parseBatchSubtaskTitles(batchText);
    if (disabled || titles.length === 0) return;
    onAdd(titles);
    setBatchText('');
  };

  const handleClose = () => {
    setBatchText('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
    >
      <DialogTitle sx={{ fontWeight: 800, color: NEO_MINT.textTitle }}>Batch add Today subtasks</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1.25, fontSize: '12px', color: NEO_MINT.textMuted }}>
          Enter one subtask per line. Up to {MAX_BATCH_SUBTASKS} subtasks will be added to {TODAY_TASK_TITLE}.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={8}
          maxRows={16}
          value={batchText}
          onChange={(event) => setBatchText(event.target.value.slice(0, MAX_BATCH_TEXT_LENGTH))}
          placeholder={'Prepare weekly report\nCall the supplier\nReview project notes'}
          slotProps={{ htmlInput: { maxLength: MAX_BATCH_TEXT_LENGTH } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} sx={{ color: NEO_MINT.textBody }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          disabled={disabled || !batchText.trim()}
          onClick={handleAdd}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
