'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete, Button, Checkbox, IconButton, TextField, Box, Select, MenuItem, Typography
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import 'react-quill-new/dist/quill.snow.css';
import { Task, TaskStatus } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { applyManualProgress, getTaskProgress, MANUAL_PROGRESS_OPTIONS, syncTaskProgress } from '@/utils/taskProgress';


const STATUS_ORDER: Record<TaskStatus, number> = {
  'URGENT': 0,
  'IN PROGRESS': 1,
  'TO DO': 2,
  'PENDING': 3,
  'CANCELLED': 4,
  'DONE': 5,
};

const STATUS_STYLE: Record<TaskStatus, { bg: string; color: string; border: string }> = {
  'URGENT':      { bg: NEO_MINT.dangerSoft, color: NEO_MINT.danger, border: NEO_MINT.dangerBorder },
  'IN PROGRESS': { bg: 'rgba(15,118,110,0.10)', color: NEO_MINT.primary, border: 'rgba(15,118,110,0.24)' },
  'TO DO':       { bg: NEO_MINT.surfaceMuted, color: NEO_MINT.primaryHover, border: NEO_MINT.cardBorderSoft },
  'PENDING':     { bg: NEO_MINT.surfaceSoft, color: NEO_MINT.textBody, border: NEO_MINT.cardBorderSoft },
  'CANCELLED':   { bg: NEO_MINT.outline, color: NEO_MINT.textMuted, border: NEO_MINT.cardBorderSoft },
  'DONE':        { bg: NEO_MINT.successSoft, color: NEO_MINT.success, border: NEO_MINT.successBorder },
};

function toDateInputValue(isoStr: string | null | undefined): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

interface TaskDetailDialogProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (id: number) => void;
  availableTags: string[];
  availableAssignees: string[];
  topLayer?: boolean;
}

const normalizeAssigneeName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase());

// ── Pill Tag chip ─────────────────────────────────────────────────────────────
function TagPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center',
        px: 1, py: 0.35,
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '11px', fontWeight: 600,
        userSelect: 'none',
        transition: 'all 0.15s ease',
        backgroundColor: selected ? 'rgba(15,118,110,0.10)' : NEO_MINT.surfaceMuted,
        color: selected ? NEO_MINT.primary : NEO_MINT.textBody,
        border: `1px solid ${selected ? 'rgba(15,118,110,0.24)' : NEO_MINT.cardBorderSoft}`,
        '&:hover': { backgroundColor: selected ? 'rgba(15,118,110,0.14)' : 'var(--primary-subtle)' },
      }}
    >
      {label}
    </Box>
  );
}

// ── Field label ────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0,
      color: NEO_MINT.textBody,
      mb: 1.25,
      fontFamily: 'var(--font-gilroy)',
    }}>
      {children}
    </Typography>
  );
}

type RichTextEditorProps = {
  theme: string;
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  modules?: Record<string, unknown>;
};

export default function TaskDetailDialog({ open, task, onClose, onSave, onDelete, availableTags, availableAssignees, topLayer = false }: TaskDetailDialogProps) {
  const [localTask, setLocalTask] = useState<Task | null>(() => task ? { ...task } : null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [ReactQuill, setReactQuill] = useState<React.ComponentType<RichTextEditorProps> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('react-quill-new').then((mod) => {
        const Editor = mod.default as unknown as React.ComponentType<RichTextEditorProps>;
        setReactQuill(() => Editor);
      });
    }
  }, []);

  if (!localTask) return null;

  const statusStyle = STATUS_STYLE[localTask.status] || STATUS_STYLE['TO DO'];
  const assigneeOptions = Array.from(
    new Map(
      [
        ...availableAssignees,
        localTask.assignee,
      ]
        .map((assignee) => normalizeAssigneeName(assignee || ''))
        .filter(Boolean)
        .map((assignee) => [assignee.toLocaleLowerCase(), assignee])
    ).values()
  ).sort((a, b) => a.localeCompare(b));
  const normalizedAssignee = normalizeAssigneeName(localTask.assignee || '');

  const handleClearFormat = () => {
    const temp = document.createElement('div');
    temp.innerHTML = localTask.details;
    setLocalTask({ ...localTask, details: temp.textContent || temp.innerText || '' });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = localTask.tags.includes(tag)
      ? localTask.tags.filter(t => t !== tag)
      : [...localTask.tags, tag];
    setLocalTask({ ...localTask, tags: newTags });
  };

  const handleAddSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title) return;

    setLocalTask(syncTaskProgress({
      ...localTask,
      subtasks: [
        ...(localTask.subtasks || []),
        { id: Date.now(), title, completed: false },
      ],
    }));
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (id: number) => {
    setLocalTask(syncTaskProgress({
      ...localTask,
      subtasks: (localTask.subtasks || []).map((subtask) =>
        subtask.id === id ? { ...subtask, completed: !subtask.completed } : subtask
      ),
    }));
  };

  const handleDeleteSubtask = (id: number) => {
    setLocalTask(syncTaskProgress({
      ...localTask,
      subtasks: (localTask.subtasks || []).filter((subtask) => subtask.id !== id),
    }));
  };

  const hasSubtasks = (localTask.subtasks || []).length > 0;
  const progress = getTaskProgress(localTask);

  const handleProgressChange = (value: number) => {
    setLocalTask(applyManualProgress(localTask, value));
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="md"
      sx={{ zIndex: topLayer ? (theme) => theme.zIndex.modal + 20 : undefined }}
      slotProps={{ paper: { sx: { borderRadius: '12px', p: 0.75, border: '1px solid var(--card-border)', boxShadow: NEO_MINT.shadowSm } } }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, gap: 2 }}>
          <Typography sx={{ fontSize: '20px', fontWeight: 700, color: NEO_MINT.textTitle, lineHeight: 1.25 }}>
            Task Details
          </Typography>
          <Button
            startIcon={<Delete sx={{ fontSize: '18px !important' }} />}
            onClick={() => onDelete(localTask.id)}
            variant="outlined"
            sx={{
              borderRadius: '10px',
              border: `1px solid ${NEO_MINT.dangerBorder}`,
              color: NEO_MINT.danger,
              backgroundColor: NEO_MINT.surface,
              fontWeight: 700,
              fontSize: '13px',
              px: 1.75, py: 0.65,
              textTransform: 'none',
              '&:hover': { backgroundColor: NEO_MINT.dangerSoft, border: `1px solid ${NEO_MINT.danger}` },
            }}
          >
            Delete Task
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Title */}
          <Box sx={{ mt: 1 }}>
            <FieldLabel>Title</FieldLabel>
            <TextField
              fullWidth
              size="small"
              value={localTask.title}
              onChange={(e) => setLocalTask({ ...localTask, title: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '18px',
                  fontWeight: 700,
                  color: NEO_MINT.textTitle,
                  borderRadius: '10px',
                  backgroundColor: NEO_MINT.surface,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.cardBorderSoft }
                },
              }}
            />
          </Box>

          {/* Status + Assignee row */}
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Status */}
            <Box>
              <FieldLabel>Status</FieldLabel>
              <Select
                size="small"
                value={localTask.status}
                onChange={(e) => setLocalTask({ ...localTask, status: e.target.value as TaskStatus })}
                sx={{
                  minWidth: 160,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.color,
                  height: '38px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: statusStyle.border },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: statusStyle.border },
                  '& .MuiSelect-icon': { color: statusStyle.color },
                }}
              >
                {Object.keys(STATUS_ORDER).map(s => (
                  <MenuItem key={s} value={s} sx={{ fontSize: '13px', fontWeight: 600 }}>{s}</MenuItem>
                ))}
              </Select>
            </Box>

            {/* Progress */}
            <Box>
              <FieldLabel>% Progress</FieldLabel>
              <Select
                size="small"
                value={progress}
                disabled={hasSubtasks}
                onChange={(e) => handleProgressChange(Number(e.target.value))}
                sx={{
                  minWidth: 132,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: hasSubtasks ? NEO_MINT.surfaceMuted : NEO_MINT.surface,
                  color: hasSubtasks ? NEO_MINT.textMuted : NEO_MINT.textTitle,
                  height: '38px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.cardBorderSoft },
                  '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                  },
                }}
              >
                {hasSubtasks ? (
                  <MenuItem value={progress} sx={{ fontSize: '13px', fontWeight: 600 }}>{progress}%</MenuItem>
                ) : (
                  MANUAL_PROGRESS_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option} sx={{ fontSize: '13px', fontWeight: 600 }}>
                      {option}%
                    </MenuItem>
                  ))
                )}
              </Select>
            </Box>

            {/* Assignee */}
            <Box sx={{ flex: '1 1 260px', minWidth: 240 }}>
              <FieldLabel>Assignee</FieldLabel>
              <Autocomplete
                freeSolo
                size="small"
                options={assigneeOptions}
                value={normalizedAssignee}
                inputValue={localTask.assignee || ''}
                onInputChange={(_, value) => setLocalTask({ ...localTask, assignee: value })}
                onChange={(_, value) => setLocalTask({ ...localTask, assignee: normalizeAssigneeName(value || '') })}
                onBlur={() => setLocalTask({ ...localTask, assignee: normalizedAssignee })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Type or choose assignee..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '10px',
                        backgroundColor: NEO_MINT.surface,
                        fontSize: '14px',
                        color: NEO_MINT.textTitle,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.cardBorderSoft },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.textMuted },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.primary },
                      },
                    }}
                  />
                )}
              />
            </Box>

            {/* Due date */}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <FieldLabel>Due Date</FieldLabel>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={toDateInputValue(localTask.dueDate)}
                onChange={(e) => setLocalTask({ ...localTask, dueDate: e.target.value || null })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
            </Box>
          </Box>

          {/* Tags */}
          {availableTags.length > 0 && (
            <Box>
              <FieldLabel>Tags</FieldLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {availableTags.map(tag => (
                  <TagPill
                    key={tag}
                    label={tag}
                    selected={localTask.tags.includes(tag)}
                    onClick={() => handleTagToggle(tag)}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Subtasks */}
          <Box>
            <FieldLabel>Subtasks</FieldLabel>
            <Box
              sx={{
                border: '1px solid var(--card-border-soft)',
                borderRadius: '12px',
                backgroundColor: NEO_MINT.surface,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  p: 1.5,
                  backgroundColor: 'var(--surface-soft)',
                  borderBottom: '1px solid var(--card-border-soft)',
                }}
              >
                <TextField
                  size="small"
                  fullWidth
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Add a subtask..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: NEO_MINT.surface,
                      fontSize: '14px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.cardBorderSoft },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.textMuted },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.primary },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<Add sx={{ fontSize: '18px !important' }} />}
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  sx={{
                    borderRadius: '10px',
                    backgroundColor: NEO_MINT.primary,
                    color: NEO_MINT.surface,
                    fontSize: '13px',
                    fontWeight: 700,
                    px: 2,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    '&:hover': { backgroundColor: NEO_MINT.primaryHover },
                    '&.Mui-disabled': { backgroundColor: NEO_MINT.surfaceMuted, color: NEO_MINT.textMuted },
                  }}
                >
                  Add
                </Button>
              </Box>

              {(localTask.subtasks || []).length === 0 ? (
                <Typography sx={{ p: 2, fontSize: '13px', color: NEO_MINT.textMuted, fontStyle: 'italic' }}>
                  No subtasks yet
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {(localTask.subtasks || []).map((subtask, index) => (
                    <Box
                      key={subtask.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.25,
                        py: 1,
                        borderTop: index === 0 ? 'none' : '1px solid var(--surface-muted)',
                        '&:hover': { backgroundColor: 'var(--primary-subtle)' },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={subtask.completed}
                        onChange={() => handleToggleSubtask(subtask.id)}
                        sx={{
                          color: NEO_MINT.cardBorderSoft,
                          '&.Mui-checked': { color: NEO_MINT.primary },
                        }}
                      />
                      <Typography
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: '14px',
                          fontWeight: 500,
                          color: subtask.completed ? NEO_MINT.textMuted : NEO_MINT.textTitle,
                          textDecoration: subtask.completed ? 'line-through' : 'none',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {subtask.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteSubtask(subtask.id)}
                        sx={{
                          color: NEO_MINT.textMuted,
                          borderRadius: '8px',
                          '&:hover': { color: NEO_MINT.danger, backgroundColor: NEO_MINT.dangerSoft },
                        }}
                      >
                        <Delete sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Rich text editor */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <FieldLabel>Task Description</FieldLabel>
              <Button
                size="small"
                onClick={handleClearFormat}
                variant="text"
                sx={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: NEO_MINT.textBody,
                  borderRadius: '10px',
                  px: 1.5, py: 0.5,
                  textTransform: 'none',
                  border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  '&:hover': { backgroundColor: 'var(--surface-muted)' },
                }}
              >
                Clear Format
              </Button>
            </Box>

            <Box sx={{
              height: 250,
              mb: 4,
              borderRadius: '12px',
              border: '1px solid var(--card-border-soft)',
              overflow: 'hidden',
              backgroundColor: NEO_MINT.surface,
              '& .ql-toolbar': {
                borderBottom: '1px solid var(--card-border-soft)',
                backgroundColor: 'var(--surface-soft)',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderRadius: '12px 12px 0 0',
              },
              '& .ql-container': {
                border: 'none',
                fontSize: '14px',
                fontFamily: "'Inter', sans-serif",
              },
              '& .ql-editor': {
                color: NEO_MINT.textBlack,
                minHeight: 180,
              },
            }}>
              {ReactQuill ? (
                <ReactQuill
                  theme="snow"
                  value={localTask.details}
                  onChange={(val: string) => setLocalTask({ ...localTask, details: val })}
                  style={{ height: '100%' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                      ['link', 'clean'],
                    ],
                  }}
                />
              ) : (
                <TextField
                  fullWidth
                  multiline
                  rows={9}
                  value={localTask.details}
                  onChange={(e) => setLocalTask({ ...localTask, details: e.target.value })}
                  placeholder="Loading editor..."
                  sx={{ '& .MuiOutlinedInput-root': { border: 'none', borderRadius: 0 } }}
                />
              )}
            </Box>
          </Box>

        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2.25 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '10px',
            color: NEO_MINT.textBody,
            fontWeight: 600,
            textTransform: 'none',
            px: 2,
            '&:hover': { backgroundColor: 'var(--surface-muted)' },
          }}
        >
          Close
        </Button>
        <Button
          onClick={() => onSave({
            ...syncTaskProgress(localTask),
            assignee: normalizeAssigneeName(localTask.assignee || ''),
            subtasks: (localTask.subtasks || []).filter((subtask) => subtask.title.trim() !== ''),
            details: localTask.details.replace(/&nbsp;/g, ' ')
          })}
          variant="contained"
          disableElevation
          sx={{
            borderRadius: '10px',
            backgroundColor: NEO_MINT.primary,
            color: NEO_MINT.surface,
            fontWeight: 700,
            px: 3,
            textTransform: 'none',
            '&:hover': { backgroundColor: NEO_MINT.primaryHover, boxShadow: 'rgba(15, 118, 110, 0.16) 0px 8px 24px' },
          }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
