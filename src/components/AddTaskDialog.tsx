import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Button,
  TextField,
  Box,
  CircularProgress,
  Typography,
  IconButton,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  NavigateBefore,
  NavigateNext,
  ThumbUp,
  ThumbDown,
  AutoAwesome,
  Add,
  Delete,
} from '@mui/icons-material';
import { Task, TaskStatus } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { sanitizeRichText } from '@/utils/richText';
import { extractTasksWithAi } from '@/lib/supabase/functions';

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  URGENT: { bg: NEO_MINT.dangerSoft, color: NEO_MINT.danger, border: NEO_MINT.dangerBorder },
  'IN PROGRESS': { bg: 'var(--primary-subtle)', color: NEO_MINT.primary, border: 'var(--primary-soft)' },
  'TO DO': { bg: NEO_MINT.surfaceMuted, color: NEO_MINT.primaryHover, border: NEO_MINT.cardBorderSoft },
  PENDING: { bg: NEO_MINT.surfaceSoft, color: NEO_MINT.textBody, border: NEO_MINT.cardBorderSoft },
  CANCELLED: { bg: NEO_MINT.outline, color: NEO_MINT.textMuted, border: NEO_MINT.cardBorderSoft },
  DONE: { bg: NEO_MINT.successSoft, color: NEO_MINT.success, border: NEO_MINT.successBorder },
};

const AI_CONTEXT_PREFIX =
  "I am a project manager. I have notes from a meeting. Extract all tasks from the notes into tasks with assignee, task name, and due date in dd/mm/yyyy format. Separate tasks with a period. Example: 'John prepare report by 15/5. Sarah review documentation by 20/5.' should be extracted as: Assignee=John,Title=Prepare report,Due Date=15/5/2025. Assignee=Sarah,Title=Review documentation,Due Date=20/5/2025.\n\nMy notes are:\n";

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onAddTasks: (tasks: Task[]) => void;
  availableTags: string[];
  availableAssignees: string[];
  skipAI?: boolean;
}

const normalizeAssigneeName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase());

// ── Pill Tag chip ────────────────────────────────────────────────────────────
function TagPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.35,
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 600,
        userSelect: 'none',
        transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
        backgroundColor: selected ? 'var(--primary-subtle)' : NEO_MINT.surfaceMuted,
        color: selected ? NEO_MINT.primary : NEO_MINT.textBody,
        border: `1px solid ${selected ? 'var(--primary-soft)' : NEO_MINT.cardBorderSoft}`,
        '&:hover': { backgroundColor: 'var(--primary-subtle)' },
      }}
    >
      {label}
    </Box>
  );
}

export default function AddTaskDialog({
  open,
  onClose,
  onAddTasks,
  availableTags,
  availableAssignees,
  skipAI = false,
}: AddTaskDialogProps) {
  const [freetext, setFreetext] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down' | null>>({});
  const [parsedTasks, setParsedTasks] = useState<Partial<Task>[] | null>(
    skipAI
      ? [{ title: '', details: '', assignee: '', dueDate: null, notes: '', tags: [], status: 'TO DO' }]
      : null
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleParse = async () => {
    setLoading(true);
    try {
      const data = await extractTasksWithAi(AI_CONTEXT_PREFIX + freetext);
      if (Array.isArray(data) && data.length > 0) {
        setParsedTasks(data);
        setCurrentIndex(0);
      } else {
        alert('No tasks found. Please check your notes.');
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Error extracting tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = (type: 'up' | 'down') => setFeedback((prev) => ({ ...prev, [currentIndex]: type }));

  const updateCurrentTask = <K extends keyof Task>(field: K, value: Task[K]) => {
    if (!parsedTasks) return;
    const newTasks = [...parsedTasks];
    newTasks[currentIndex] = { ...newTasks[currentIndex], [field]: value };
    setParsedTasks(newTasks);
  };

  const handleAddMore = () => {
    if (!parsedTasks) return;
    const newTasks = [
      ...parsedTasks,
      {
        title: '',
        details: '',
        assignee: '',
        dueDate: null,
        notes: '',
        tags: [],
        status: 'TO DO' as TaskStatus,
      },
    ];
    setParsedTasks(newTasks);
    setCurrentIndex(newTasks.length - 1);
  };

  const handleRemoveCurrent = () => {
    if (!parsedTasks || parsedTasks.length <= 1) return;
    const newTasks = parsedTasks.filter((_, i) => i !== currentIndex);
    setParsedTasks(newTasks);
    setCurrentIndex(Math.min(currentIndex, newTasks.length - 1));
  };

  const handleSaveAll = () => {
    if (!parsedTasks) return;
    const nonEmpty = parsedTasks.filter((pt) => pt.title && pt.title.trim() !== '');
    if (nonEmpty.length === 0) {
      alert('Please enter a title for at least 1 task.');
      return;
    }
    const newTasks: Task[] = nonEmpty.map((pt) => ({
      id: crypto.randomUUID(),
      createdAt: pt.createdAt || new Date().toISOString(),
      inProgressAt: pt.inProgressAt || null,
      doneAt: pt.doneAt || null,
      title: pt.title || 'Untitled',
      details: sanitizeRichText((pt.details || '').replace(/&nbsp;/g, ' ')),
      assignee: normalizeAssigneeName(pt.assignee || ''),
      tags: pt.tags || [],
      status: pt.status || 'TO DO',
      progress: pt.progress || 0,
      startDate: pt.startDate || null,
      dueDate: pt.dueDate || null,
      notes: pt.notes || '',
      subtasks: pt.subtasks || [],
    }));
    onAddTasks(newTasks);
    onClose();
  };

  const currentTask = parsedTasks ? parsedTasks[currentIndex] : null;
  const currentStatus = (currentTask?.status || 'TO DO') as TaskStatus;
  const statusStyle = STATUS_STYLE[currentStatus] || STATUS_STYLE['TO DO'];
  const assigneeOptions = Array.from(
    new Map(
      [...availableAssignees, currentTask?.assignee]
        .map((assignee) => normalizeAssigneeName(assignee || ''))
        .filter(Boolean)
        .map((assignee) => [assignee.toLocaleLowerCase(), assignee])
    ).values()
  ).sort((a, b) => a.localeCompare(b));
  const normalizedAssignee = normalizeAssigneeName(currentTask?.assignee || '');

  const dialogTitle = skipAI ? 'Manual Entry' : parsedTasks ? 'Review Tasks' : 'AI Task Extraction';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: '20px',
            p: { xs: 0, sm: 0.5 },
            border: '1px solid var(--card-border)',
            boxShadow: NEO_MINT.shadowLg,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          px: { xs: 2, sm: 2.5 },
          pt: { xs: 2, sm: 2.5 },
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: NEO_MINT.textTitle,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <span>{dialogTitle}</span>
          {parsedTasks && !skipAI && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.35,
                borderRadius: '8px',
                backgroundColor: 'var(--primary-soft)',
                color: NEO_MINT.primary,
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <AutoAwesome sx={{ fontSize: '14px !important' }} />
              AI-POWERED
            </Box>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, sm: 2.5 } }}>
        {/* ── Step 1: freetext input ── */}
        {!parsedTasks ? (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Meeting Notes"
              value={freetext}
              onChange={(e) => setFreetext(e.target.value)}
              placeholder="e.g., John prepare report by Friday. Sarah review Q2 documentation by 30/5..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  fontSize: '14px',
                  backgroundColor: NEO_MINT.surface,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: NEO_MINT.cardBorderSoft },
                },
              }}
            />
            <Box
              sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: '12px',
                backgroundColor: 'var(--primary-subtle)',
                border: '1px solid var(--primary-soft)',
              }}
            >
              <Typography
                sx={{ fontSize: '13px', color: NEO_MINT.primary, lineHeight: 1.5, fontWeight: 500 }}
              >
                AI parsing is ready for assignee, task title, and due date.
              </Typography>
            </Box>
          </Box>
        ) : (
          /* ── Step 2: review carousel ── */
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Navigation bar */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 0.75,
                borderRadius: '12px',
                backgroundColor: 'var(--surface-soft)',
                border: '1px solid var(--card-border-soft)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((c) => c - 1)}
                  sx={{ color: NEO_MINT.textTitle, '&:hover': { backgroundColor: NEO_MINT.surfaceMuted } }}
                >
                  <NavigateBefore fontSize="small" />
                </IconButton>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: NEO_MINT.textTitle, px: 1.5 }}>
                  {currentIndex + 1} / {parsedTasks.length}
                </Typography>
                <IconButton
                  size="small"
                  disabled={currentIndex === parsedTasks.length - 1}
                  onClick={() => setCurrentIndex((c) => c + 1)}
                  sx={{ color: NEO_MINT.textTitle, '&:hover': { backgroundColor: NEO_MINT.surfaceMuted } }}
                >
                  <NavigateNext fontSize="small" />
                </IconButton>
              </Box>

              {!skipAI && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Good results">
                    <IconButton
                      size="small"
                      onClick={() => handleFeedback('up')}
                      sx={{
                        color: feedback[currentIndex] === 'up' ? NEO_MINT.success : NEO_MINT.textMuted,
                        '&:hover': { backgroundColor: NEO_MINT.successSoft },
                      }}
                    >
                      <ThumbUp fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Could be better">
                    <IconButton
                      size="small"
                      onClick={() => handleFeedback('down')}
                      sx={{
                        color: feedback[currentIndex] === 'down' ? NEO_MINT.danger : NEO_MINT.textMuted,
                        '&:hover': { backgroundColor: NEO_MINT.dangerSoft },
                      }}
                    >
                      <ThumbDown fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>

            {/* Title */}
            <TextField
              label="Task Title"
              fullWidth
              size="small"
              value={currentTask?.title || ''}
              onChange={(e) => updateCurrentTask('title', e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '15px', fontWeight: 600, borderRadius: '10px' } }}
            />

            {/* Details */}
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              size="small"
              value={currentTask?.details || ''}
              onChange={(e) => updateCurrentTask('details', e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '14px' } }}
            />

            {/* Status + Tags row */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Status selector — styled pill */}
              <Select
                size="small"
                value={currentTask?.status || 'TO DO'}
                onChange={(e) => updateCurrentTask('status', e.target.value as TaskStatus)}
                sx={{
                  minWidth: 160,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.color,
                  height: '36px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: statusStyle.border },
                  '& .MuiSelect-icon': { color: statusStyle.color },
                }}
              >
                {(['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'] as TaskStatus[]).map(
                  (s) => (
                    <MenuItem key={s} value={s} sx={{ fontSize: '13px', fontWeight: 600 }}>
                      {s}
                    </MenuItem>
                  )
                )}
              </Select>

              {/* Tags */}
              {availableTags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {availableTags.map((tag) => (
                    <TagPill
                      key={tag}
                      label={tag}
                      selected={(currentTask?.tags || []).includes(tag)}
                      onClick={() => {
                        const curr = currentTask?.tags || [];
                        updateCurrentTask(
                          'tags',
                          curr.includes(tag) ? curr.filter((t: string) => t !== tag) : [...curr, tag]
                        );
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* Assignee + Due Date */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Autocomplete
                freeSolo
                size="small"
                options={assigneeOptions}
                value={normalizedAssignee}
                inputValue={currentTask?.assignee || ''}
                onInputChange={(_, value) => updateCurrentTask('assignee', value)}
                onChange={(_, value) => updateCurrentTask('assignee', normalizeAssigneeName(value || ''))}
                onBlur={() => updateCurrentTask('assignee', normalizedAssignee)}
                sx={{ flex: '1 1 220px', minWidth: 220 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Assignee"
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
              <TextField
                label="Due Date"
                type="date"
                size="small"
                value={currentTask?.dueDate ? currentTask.dueDate.substring(0, 10) : ''}
                onChange={(e) => updateCurrentTask('dueDate', e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{
                  flex: '1 1 180px',
                  minWidth: 180,
                  '& .MuiOutlinedInput-root': { borderRadius: '10px' },
                }}
              />
            </Box>

            {/* Notes */}
            <TextField
              label="Internal Notes"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={currentTask?.notes || ''}
              onChange={(e) => updateCurrentTask('notes', e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '14px' } }}
            />

            {/* Add / Remove */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 1 }}>
              {parsedTasks.length > 1 && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<Delete sx={{ fontSize: '18px !important' }} />}
                  onClick={handleRemoveCurrent}
                  sx={{
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: NEO_MINT.danger,
                    textTransform: 'none',
                    '&:hover': { backgroundColor: NEO_MINT.dangerSoft },
                  }}
                >
                  Remove this task
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add sx={{ fontSize: '18px !important' }} />}
                onClick={handleAddMore}
                sx={{
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: NEO_MINT.textTitle,
                  borderColor: NEO_MINT.cardBorderSoft,
                  textTransform: 'none',
                  px: 2,
                  '&:hover': {
                    backgroundColor: 'var(--primary-subtle)',
                    borderColor: NEO_MINT.primary,
                    color: NEO_MINT.primary,
                  },
                }}
              >
                Add another
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{ px: { xs: 2, sm: 2.5 }, py: 2.25, borderTop: `1px solid ${NEO_MINT.cardBorderSoft}` }}
      >
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
          Cancel
        </Button>

        {!parsedTasks ? (
          <Button
            onClick={handleParse}
            disabled={!freetext || loading}
            variant="contained"
            disableElevation
            sx={{
              borderRadius: '10px',
              backgroundColor: NEO_MINT.primary,
              color: NEO_MINT.surface,
              fontWeight: 700,
              px: 3,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: NEO_MINT.primaryHover,
                boxShadow: 'rgba(15, 118, 110, 0.16) 0px 8px 24px',
              },
              '&.Mui-disabled': { backgroundColor: NEO_MINT.surfaceMuted, color: NEO_MINT.textMuted },
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={18} sx={{ color: NEO_MINT.textMuted }} />
                <span>Parsing...</span>
              </Box>
            ) : (
              'Extract Tasks'
            )}
          </Button>
        ) : (
          <Button
            onClick={handleSaveAll}
            variant="contained"
            disableElevation
            sx={{
              borderRadius: '10px',
              backgroundColor: NEO_MINT.primary,
              color: NEO_MINT.surface,
              fontWeight: 700,
              px: 3,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: NEO_MINT.primaryHover,
                boxShadow: 'rgba(15, 118, 110, 0.16) 0px 8px 24px',
              },
            }}
          >
            Save All ({parsedTasks.length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
