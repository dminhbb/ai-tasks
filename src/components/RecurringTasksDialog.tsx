'use client';

import { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Close,
  Delete,
  DragIndicator,
  Edit,
  ExpandLess,
  ExpandMore,
  NavigateBefore,
  NavigateNext,
  Repeat,
} from '@mui/icons-material';
import { addWeeks, format, isSameWeek } from 'date-fns';
import type { RecurrentSubtask, RecurrentTask, RecurrenceType } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import {
  getThreeWeekDays,
  isTodayScheduleDate,
  occursOnDate,
  RECURRENCE_LABELS,
} from '@/utils/recurrentSchedule';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];
const RECURRENCE_TYPES: RecurrenceType[] = [
  'weekly',
  'bi-weekly',
  'monthly',
  'quarterly',
  'half-yearly',
  'yearly',
];
const SCHEDULE_GRID_COLUMNS =
  'minmax(180px, 2.5fr) minmax(80px, 1fr) minmax(88px, 1fr) repeat(21, minmax(25px, 0.36fr))';
const SCHEDULE_MINIMUM_WIDTH = 900;
const WEEK_START_OPTIONS = { weekStartsOn: 1 as const };

interface RecurringTasksDialogProps {
  open: boolean;
  tasks: RecurrentTask[];
  availableTags: string[];
  availableAssignees: string[];
  canManageTasks: boolean;
  onClose: () => void;
  onSaveTask: (task: RecurrentTask) => Promise<void>;
  onDeleteTask: (task: RecurrentTask) => Promise<void>;
}

interface RecurrentTaskEditorProps {
  open: boolean;
  task: RecurrentTask | null;
  availableTags: string[];
  availableAssignees: string[];
  canManageTasks: boolean;
  onClose: () => void;
  onSave: (task: RecurrentTask) => Promise<void>;
  onDelete: (task: RecurrentTask) => Promise<void>;
}

function emptySubtask(sortOrder: number): RecurrentSubtask {
  return {
    id: crypto.randomUUID(),
    title: '',
    assignee: '',
    tags: [],
    notes: '',
    recurrence: 'weekly',
    anchorDate: format(new Date(), 'yyyy-MM-dd'),
    weekdays: [1],
    sortOrder,
  };
}

function emptyTask(sortOrder: number): RecurrentTask {
  return { id: crypto.randomUUID(), title: '', assignee: '', tags: [], notes: '', sortOrder, subtasks: [] };
}

function RecurrentTaskEditorDialog({
  open,
  task,
  availableTags,
  availableAssignees,
  canManageTasks,
  onClose,
  onSave,
  onDelete,
}: RecurrentTaskEditorProps) {
  const [draft, setDraft] = useState<RecurrentTask | null>(task);
  const [editingSubtask, setEditingSubtask] = useState<RecurrentSubtask | null>(null);
  const [deleteTaskStep, setDeleteTaskStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);

  if (!draft) return null;

  const save = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await onSave({
        ...draft,
        title: draft.title.trim(),
        subtasks: draft.subtasks.filter((subtask) => subtask.title.trim()),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (deleteTaskStep === 0) {
      setDeleteTaskStep(1);
      return;
    }
    setBusy(true);
    try {
      await onDelete(draft);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const saveSubtask = (subtask: RecurrentSubtask) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            subtasks: current.subtasks.some((item) => item.id === subtask.id)
              ? current.subtasks.map((item) => (item.id === subtask.id ? subtask : item))
              : [...current.subtasks, subtask],
          }
        : current
    );
    setEditingSubtask(null);
  };
  const removeSubtask = (subtaskId: string) => {
    if (!window.confirm('Delete this recurrent subtask?')) return;
    setDraft((current) =>
      current
        ? { ...current, subtasks: current.subtasks.filter((subtask) => subtask.id !== subtaskId) }
        : current
    );
  };
  const reorderSubtasks = (targetSubtaskId: string) => {
    if (!draggedSubtaskId || draggedSubtaskId === targetSubtaskId) return;
    setDraft((current) => {
      if (!current) return current;
      const ordered = [...current.subtasks].sort((left, right) => left.sortOrder - right.sortOrder);
      const sourceIndex = ordered.findIndex((subtask) => subtask.id === draggedSubtaskId);
      const targetIndex = ordered.findIndex((subtask) => subtask.id === targetSubtaskId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [dragged] = ordered.splice(sourceIndex, 1);
      ordered.splice(targetIndex, 0, dragged);
      return { ...current, subtasks: ordered.map((subtask, index) => ({ ...subtask, sortOrder: index })) };
    });
    setDraggedSubtaskId(null);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {task?.title ? 'Edit recurrent task' : 'Add recurrent task'}
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            label="Task name"
            value={draft.title}
            required
            disabled={!canManageTasks}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
          <Autocomplete
            multiple
            options={availableTags}
            value={draft.tags}
            disabled={!canManageTasks}
            onChange={(_, tags) => setDraft({ ...draft, tags })}
            renderInput={(params) => <TextField {...params} label="Tags" />}
          />
          <Autocomplete
            freeSolo
            options={availableAssignees}
            value={draft.assignee}
            disabled={!canManageTasks}
            onInputChange={(_, assignee) => setDraft({ ...draft, assignee })}
            renderInput={(params) => <TextField {...params} label="Assignee" />}
          />
          <TextField
            label="Notes"
            value={draft.notes}
            multiline
            minRows={3}
            disabled={!canManageTasks}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>Subtasks</Typography>
            <Button
              size="small"
              startIcon={<Add />}
              disabled={!canManageTasks}
              onClick={() => setEditingSubtask(emptySubtask(draft.subtasks.length))}
            >
              Add subtask
            </Button>
          </Box>
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {[...draft.subtasks]
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((subtask) => (
                <Box
                  key={subtask.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderSubtasks(subtask.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                    borderRadius: '8px',
                  }}
                >
                  <Box
                    component="span"
                    draggable={canManageTasks}
                    onDragStart={() => setDraggedSubtaskId(subtask.id)}
                    onDragEnd={() => setDraggedSubtaskId(null)}
                    sx={{
                      display: 'inline-flex',
                      cursor: canManageTasks ? 'grab' : 'default',
                      color: NEO_MINT.textMuted,
                    }}
                  >
                    <DragIndicator fontSize="small" />
                  </Box>
                  <Repeat fontSize="small" color="action" />
                  <Typography sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {subtask.title || 'Untitled subtask'} · {RECURRENCE_LABELS[subtask.recurrence]}
                  </Typography>
                  <IconButton
                    size="small"
                    disabled={!canManageTasks}
                    onClick={() => setEditingSubtask(subtask)}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={!canManageTasks}
                    onClick={() => removeSubtask(subtask.id)}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
          {task?.title ? (
            <Button color="error" disabled={!canManageTasks || busy} onClick={() => void confirmDelete()}>
              {deleteTaskStep === 0 ? 'Delete task' : 'Confirm delete task'}
            </Button>
          ) : (
            <span />
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!canManageTasks || busy || !draft.title.trim()}
              onClick={() => void save()}
            >
              Save
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
      <RecurrentSubtaskDialog
        key={editingSubtask?.id ?? 'new-subtask'}
        open={editingSubtask !== null}
        subtask={editingSubtask}
        availableTags={availableTags}
        availableAssignees={availableAssignees}
        onClose={() => setEditingSubtask(null)}
        onSave={saveSubtask}
      />
    </>
  );
}

interface RecurrentSubtaskDialogProps {
  open: boolean;
  subtask: RecurrentSubtask | null;
  availableTags: string[];
  availableAssignees: string[];
  onClose: () => void;
  onSave: (subtask: RecurrentSubtask) => void;
}
function RecurrentSubtaskDialog({
  open,
  subtask,
  availableTags,
  availableAssignees,
  onClose,
  onSave,
}: RecurrentSubtaskDialogProps) {
  const [draft, setDraft] = useState<RecurrentSubtask | null>(subtask);
  if (!draft) return null;
  const recurringWeekly = draft.recurrence === 'weekly' || draft.recurrence === 'bi-weekly';
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Recurrent subtask</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
        <TextField
          label="Subtask name"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <Autocomplete
          multiple
          options={availableTags}
          value={draft.tags}
          onChange={(_, tags) => setDraft({ ...draft, tags })}
          renderInput={(params) => <TextField {...params} label="Tags" />}
        />
        <Autocomplete
          freeSolo
          options={availableAssignees}
          value={draft.assignee}
          onInputChange={(_, assignee) => setDraft({ ...draft, assignee })}
          renderInput={(params) => <TextField {...params} label="Assignee" />}
        />
        <TextField
          label="Notes"
          value={draft.notes}
          multiline
          minRows={2}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
        <TextField
          select
          label="Type"
          value={draft.recurrence}
          onChange={(event) =>
            setDraft({
              ...draft,
              recurrence: event.target.value as RecurrenceType,
              weekdays:
                event.target.value === 'weekly' || event.target.value === 'bi-weekly' ? draft.weekdays : [],
            })
          }
        >
          {RECURRENCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {RECURRENCE_LABELS[type]}
            </option>
          ))}
        </TextField>
        <TextField
          label="Anchor date"
          type="date"
          value={draft.anchorDate}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => setDraft({ ...draft, anchorDate: event.target.value })}
        />
        {recurringWeekly && (
          <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 700 }}>Repeat on</Typography>
            {WEEKDAY_OPTIONS.map((weekday) => (
              <Button
                key={weekday.value}
                size="small"
                variant={draft.weekdays.includes(weekday.value) ? 'contained' : 'outlined'}
                sx={{ mr: 0.5, mt: 0.75, minWidth: 42 }}
                onClick={() =>
                  setDraft({
                    ...draft,
                    weekdays: draft.weekdays.includes(weekday.value)
                      ? draft.weekdays.filter((value) => value !== weekday.value)
                      : [...draft.weekdays, weekday.value].sort(),
                  })
                }
              >
                {weekday.label}
              </Button>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!draft.title.trim() || (recurringWeekly && draft.weekdays.length === 0)}
          onClick={() => onSave({ ...draft, title: draft.title.trim() })}
        >
          Save subtask
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RecurringTasksDialog({
  open,
  tasks,
  availableTags,
  availableAssignees,
  canManageTasks,
  onClose,
  onSaveTask,
  onDeleteTask,
}: RecurringTasksDialogProps) {
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<RecurrentTask | null>(null);
  const scheduleDays = useMemo(() => getThreeWeekDays(referenceDate), [referenceDate]);
  const toggleExpanded = (taskId: string) =>
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            backgroundColor: 'var(--main-bg)',
            backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.13) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          },
        },
      }}
    >
      <Box
        component="header"
        sx={{
          height: 68,
          display: 'flex',
          alignItems: 'center',
          px: { xs: 1.5, md: 3 },
          gap: 1,
          borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
          backgroundColor: NEO_MINT.surface,
        }}
      >
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
        <Repeat sx={{ color: NEO_MINT.primary }} />
        <Typography sx={{ fontSize: '20px', fontWeight: 800, flex: 1 }}>Recurr Task</Typography>
        <Typography
          sx={{
            display: { xs: 'none', md: 'block' },
            fontSize: '12px',
            fontWeight: 700,
            color: NEO_MINT.textMuted,
          }}
        >
          {format(referenceDate, 'EEEE, dd MMM yyyy')}
        </Typography>
        <Button
          startIcon={<Add />}
          variant="contained"
          disabled={!canManageTasks}
          onClick={() => setEditingTask(emptyTask(tasks.length))}
        >
          Add task
        </Button>
        <Button onClick={() => setReferenceDate(new Date())}>Today</Button>
        <IconButton onClick={() => setReferenceDate((date) => addWeeks(date, -1))}>
          <NavigateBefore />
        </IconButton>
        <IconButton onClick={() => setReferenceDate((date) => addWeeks(date, 1))}>
          <NavigateNext />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, md: 3 } }}>
        <Box
          sx={{
            width: '100%',
            minWidth: { xs: SCHEDULE_MINIMUM_WIDTH, md: 0 },
            backgroundColor: NEO_MINT.surface,
            border: `1px solid ${NEO_MINT.cardBorderSoft}`,
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: SCHEDULE_GRID_COLUMNS,
              backgroundColor: 'var(--surface-muted)',
              borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
            }}
          >
            {['Task', 'Tags', 'Assignee', ...scheduleDays.map((day) => format(day, 'EEE d'))].map(
              (label, index) => {
                const day = index >= 3 ? scheduleDays[index - 3] : null;
                const todayColumn = day ? isTodayScheduleDate(day) : false;
                const currentWeek = day ? isSameWeek(day, new Date(), WEEK_START_OPTIONS) : false;
                return (
                  <Typography
                    key={label}
                    sx={{
                      p: 1,
                      textAlign: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      borderRight: `1px solid ${NEO_MINT.cardBorderSoft}`,
                      color: NEO_MINT.textBody,
                      backgroundColor: todayColumn
                        ? 'color-mix(in srgb, var(--primary) 20%, var(--primary-subtle))'
                        : currentWeek
                          ? 'color-mix(in srgb, var(--primary-subtle) 72%, var(--surface-muted))'
                          : 'transparent',
                    }}
                  >
                    {label}
                  </Typography>
                );
              }
            )}
          </Box>
          {tasks.map((task) => (
            <Box key={task.id}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: SCHEDULE_GRID_COLUMNS,
                  alignItems: 'center',
                  minHeight: 46,
                  backgroundColor: 'color-mix(in srgb, var(--surface-muted) 72%, transparent)',
                  borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
                }}
              >
                <Button
                  onClick={() => toggleExpanded(task.id)}
                  sx={{
                    justifyContent: 'flex-start',
                    color: NEO_MINT.textTitle,
                    fontWeight: 800,
                    textTransform: 'none',
                  }}
                >
                  {expandedTaskIds.has(task.id) ? <ExpandLess /> : <ExpandMore />}
                  {task.title}
                </Button>
                <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                  {task.tags.join(', ') || '—'}
                </Typography>
                <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                  {task.assignee || '—'}
                </Typography>
                {scheduleDays.map((day) => (
                  <Box
                    key={day.toISOString()}
                    sx={{
                      height: '100%',
                      backgroundColor: isTodayScheduleDate(day)
                        ? 'color-mix(in srgb, var(--primary) 13%, var(--primary-subtle))'
                        : isSameWeek(day, new Date(), WEEK_START_OPTIONS)
                          ? 'color-mix(in srgb, var(--primary-subtle) 48%, transparent)'
                          : 'transparent',
                      borderLeft: `1px solid ${NEO_MINT.cardBorderSoft}`,
                    }}
                  />
                ))}
              </Box>
              {expandedTaskIds.has(task.id) &&
                task.subtasks.map((subtask) => (
                  <Box
                    key={subtask.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: SCHEDULE_GRID_COLUMNS,
                      alignItems: 'center',
                      minHeight: 42,
                      borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
                    }}
                  >
                    <Button
                      onClick={() => setEditingTask(task)}
                      sx={{
                        justifyContent: 'flex-start',
                        pl: 4,
                        color: NEO_MINT.textBody,
                        textTransform: 'none',
                      }}
                    >
                      {subtask.title}
                    </Button>
                    <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                      {subtask.tags.join(', ') || '—'}
                    </Typography>
                    <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                      {subtask.assignee || '—'}
                    </Typography>
                    {scheduleDays.map((day) => (
                      <Box
                        key={day.toISOString()}
                        sx={{
                          height: '100%',
                          minHeight: 42,
                          display: 'grid',
                          placeItems: 'center',
                          borderLeft: `1px solid ${NEO_MINT.cardBorderSoft}`,
                          backgroundColor: isTodayScheduleDate(day)
                            ? 'color-mix(in srgb, var(--primary) 13%, var(--primary-subtle))'
                            : isSameWeek(day, new Date(), WEEK_START_OPTIONS)
                              ? 'color-mix(in srgb, var(--primary-subtle) 48%, transparent)'
                              : 'transparent',
                        }}
                      >
                        {occursOnDate(subtask, day) && (
                          <Tooltip title={RECURRENCE_LABELS[subtask.recurrence]}>
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: '5px',
                                backgroundColor: NEO_MINT.primary,
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    ))}
                  </Box>
                ))}
            </Box>
          ))}
        </Box>
      </Box>
      <RecurrentTaskEditorDialog
        key={editingTask?.id ?? 'new-task'}
        open={editingTask !== null}
        task={editingTask}
        availableTags={availableTags}
        availableAssignees={availableAssignees}
        canManageTasks={canManageTasks}
        onClose={() => setEditingTask(null)}
        onSave={onSaveTask}
        onDelete={onDeleteTask}
      />
    </Dialog>
  );
}
