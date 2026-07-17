'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Check,
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
import { addDays, addWeeks, format, isSameDay, isSameWeek, subDays } from 'date-fns';
import type { RecurrentOccurrenceState, RecurrentSubtask, RecurrentTask, RecurrenceType } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import SubtaskWorkLogSelect from '@/components/SubtaskWorkLogSelect';
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
  'minmax(180px, 2.25fr) minmax(72px, 0.8fr) minmax(82px, 0.9fr) minmax(150px, 1.65fr) repeat(21, minmax(25px, 0.34fr))';
const SCHEDULE_MINIMUM_WIDTH = 1000;
const WEEK_START_OPTIONS = { weekStartsOn: 1 as const };

interface PendingOccurrenceWorkLog {
  subtask: RecurrentSubtask;
  occurrenceDate: string;
}

function occurrenceStateKey(recurrentSubtaskId: string, occurrenceDate: string): string {
  return `${recurrentSubtaskId}:${occurrenceDate}`;
}

function isOccurrenceEditable(date: Date): boolean {
  const today = new Date();
  return isSameDay(date, today) || isSameDay(date, subDays(today, 1));
}

function truncateNotes(notes: string) {
  const normalizedNotes = notes.trim();
  return normalizedNotes.length > 70 ? `${normalizedNotes.slice(0, 70)}....` : normalizedNotes || '—';
}

interface OccurrenceStatusMarkerProps {
  status: RecurrentOccurrenceState['status'];
  editable: boolean;
  disabled: boolean;
  onClick: () => void;
}

function OccurrenceStatusMarker({ status, editable, disabled, onClick }: OccurrenceStatusMarkerProps) {
  const statusLabel = status === 'TO DO' ? 'To Do' : status === 'IN PROGRESS' ? 'In Progress' : 'Done';
  const tooltip = editable
    ? `${statusLabel} — click to change status`
    : `${statusLabel} — only Today and Yesterday can be changed`;

  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          size="small"
          disabled={disabled || !editable}
          aria-label={`Recurrent occurrence status: ${statusLabel}`}
          onClick={onClick}
          sx={{ width: 24, height: 24, p: 0.25 }}
        >
          {status === 'TO DO' && (
            <Box
              aria-hidden="true"
              sx={{ width: 15, height: 15, borderRadius: '4px', backgroundColor: NEO_MINT.primary }}
            />
          )}
          {status === 'IN PROGRESS' && (
            <Box
              aria-hidden="true"
              sx={{
                width: 0,
                height: 0,
                ml: 0.25,
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderLeft: `12px solid ${NEO_MINT.primary}`,
              }}
            />
          )}
          {status === 'DONE' && <Check aria-hidden="true" sx={{ fontSize: 20, color: NEO_MINT.success }} />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

interface RecurringTasksDialogProps {
  open: boolean;
  tasks: RecurrentTask[];
  availableTags: string[];
  availableAssignees: string[];
  canManageTasks: boolean;
  onLoadOccurrenceStates: (fromDate: string, toDate: string) => Promise<RecurrentOccurrenceState[]>;
  onCycleOccurrence: (
    recurrentSubtaskId: string,
    occurrenceDate: string,
    workHours?: number
  ) => Promise<RecurrentOccurrenceState>;
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
            <MenuItem key={type} value={type}>
              {RECURRENCE_LABELS[type]}
            </MenuItem>
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
  onLoadOccurrenceStates,
  onCycleOccurrence,
  onClose,
  onSaveTask,
  onDeleteTask,
}: RecurringTasksDialogProps) {
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<RecurrentTask | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<{
    task: RecurrentTask;
    subtask: RecurrentSubtask;
  } | null>(null);
  const [occurrenceStates, setOccurrenceStates] = useState<RecurrentOccurrenceState[]>([]);
  const [pendingWorkLog, setPendingWorkLog] = useState<PendingOccurrenceWorkLog | null>(null);
  const [pendingWorkHours, setPendingWorkHours] = useState(0);
  const [isUpdatingOccurrence, setIsUpdatingOccurrence] = useState(false);
  const scheduleDays = useMemo(() => getThreeWeekDays(referenceDate), [referenceDate]);
  const scheduleStartDate = format(scheduleDays[0], 'yyyy-MM-dd');
  const scheduleEndDate = format(scheduleDays[scheduleDays.length - 1], 'yyyy-MM-dd');
  const occurrenceStateByKey = useMemo(
    () =>
      new Map(
        occurrenceStates.map((state) => [
          occurrenceStateKey(state.recurrentSubtaskId, state.occurrenceDate),
          state,
        ])
      ),
    [occurrenceStates]
  );

  useEffect(() => {
    if (!open) return;
    let isActive = true;
    void onLoadOccurrenceStates(scheduleStartDate, scheduleEndDate)
      .then((states) => {
        if (isActive) setOccurrenceStates(states);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setOccurrenceStates([]);
        window.alert(error instanceof Error ? error.message : 'Không thể tải trạng thái công việc định kỳ.');
      });
    return () => {
      isActive = false;
    };
  }, [onLoadOccurrenceStates, open, scheduleEndDate, scheduleStartDate]);

  const applyOccurrenceState = (state: RecurrentOccurrenceState) => {
    setOccurrenceStates((current) => {
      const withoutCurrent = current.filter(
        (item) =>
          item.recurrentSubtaskId !== state.recurrentSubtaskId || item.occurrenceDate !== state.occurrenceDate
      );
      return state.status === 'TO DO' ? withoutCurrent : [...withoutCurrent, state];
    });
  };

  const handleOccurrenceClick = async (subtask: RecurrentSubtask, date: Date) => {
    if (!canManageTasks || !isOccurrenceEditable(date) || isUpdatingOccurrence) return;
    const occurrenceDate = format(date, 'yyyy-MM-dd');
    const currentState = occurrenceStateByKey.get(occurrenceStateKey(subtask.id, occurrenceDate));
    if (currentState?.status === 'IN PROGRESS') {
      setPendingWorkLog({ subtask, occurrenceDate });
      setPendingWorkHours(currentState.workHours);
      return;
    }

    setIsUpdatingOccurrence(true);
    try {
      applyOccurrenceState(await onCycleOccurrence(subtask.id, occurrenceDate));
    } catch (error: unknown) {
      window.alert(error instanceof Error ? error.message : 'Không thể cập nhật công việc định kỳ.');
    } finally {
      setIsUpdatingOccurrence(false);
    }
  };

  const completePendingOccurrence = async () => {
    if (!pendingWorkLog || isUpdatingOccurrence) return;
    setIsUpdatingOccurrence(true);
    try {
      applyOccurrenceState(
        await onCycleOccurrence(pendingWorkLog.subtask.id, pendingWorkLog.occurrenceDate, pendingWorkHours)
      );
      setPendingWorkLog(null);
    } catch (error: unknown) {
      window.alert(error instanceof Error ? error.message : 'Không thể hoàn thành công việc định kỳ.');
    } finally {
      setIsUpdatingOccurrence(false);
    }
  };
  const toggleExpanded = (taskId: string) =>
    setCollapsedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  const saveScheduledSubtask = (updatedSubtask: RecurrentSubtask) => {
    if (!editingSubtask) return;
    const task = editingSubtask.task;
    void onSaveTask({
      ...task,
      subtasks: task.subtasks.map((subtask) => (subtask.id === updatedSubtask.id ? updatedSubtask : subtask)),
    });
    setEditingSubtask(null);
  };

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
            minWidth: SCHEDULE_MINIMUM_WIDTH,
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
              '& > *': {
                boxSizing: 'border-box',
                minWidth: 0,
                borderRight: `1px solid ${NEO_MINT.cardBorderSoft}`,
              },
            }}
          >
            {['Task', 'Tags', 'Assignee', 'Notes'].map((header) => (
              <Typography
                key={header}
                sx={{
                  p: 1,
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: NEO_MINT.textBody,
                }}
              >
                {header}
              </Typography>
            ))}
            {scheduleDays.map((day) => {
              const todayColumn = isTodayScheduleDate(day);
              const currentWeek = isSameWeek(day, new Date(), WEEK_START_OPTIONS);
              return (
                <Typography
                  key={day.toISOString()}
                  sx={{
                    p: 1,
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: NEO_MINT.textBody,
                    backgroundColor: todayColumn
                      ? 'color-mix(in srgb, var(--primary) 32%, var(--primary-subtle))'
                      : currentWeek
                        ? 'color-mix(in srgb, var(--primary) 18%, var(--surface-muted))'
                        : 'transparent',
                  }}
                >
                  <Box component="span" sx={{ display: 'block' }}>
                    {format(day, 'EEE')}
                  </Box>
                  <Box component="span" sx={{ display: 'block' }}>
                    {format(day, 'd')}
                  </Box>
                </Typography>
              );
            })}
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
                  '& > *': {
                    boxSizing: 'border-box',
                    minWidth: 0,
                    borderRight: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <IconButton
                    size="small"
                    aria-label={
                      collapsedTaskIds.has(task.id) ? 'Expand recurrent task' : 'Collapse recurrent task'
                    }
                    onClick={() => toggleExpanded(task.id)}
                  >
                    {collapsedTaskIds.has(task.id) ? <ExpandMore /> : <ExpandLess />}
                  </IconButton>
                  <Button
                    onClick={() => setEditingTask(task)}
                    sx={{
                      justifyContent: 'flex-start',
                      color: NEO_MINT.textTitle,
                      fontWeight: 800,
                      textTransform: 'none',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.title}
                  </Button>
                </Box>
                <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                  {task.tags.join(', ') || '—'}
                </Typography>
                <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                  {task.assignee || '—'}
                </Typography>
                <Tooltip title={task.notes || 'No notes'}>
                  <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                    {truncateNotes(task.notes)}
                  </Typography>
                </Tooltip>
                {scheduleDays.map((day) => (
                  <Box
                    key={day.toISOString()}
                    sx={{
                      height: '100%',
                      backgroundColor: isTodayScheduleDate(day)
                        ? 'color-mix(in srgb, var(--primary) 22%, var(--primary-subtle))'
                        : isSameWeek(day, new Date(), WEEK_START_OPTIONS)
                          ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))'
                          : 'transparent',
                    }}
                  />
                ))}
              </Box>
              {!collapsedTaskIds.has(task.id) &&
                task.subtasks.map((subtask) => (
                  <Box
                    key={subtask.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: SCHEDULE_GRID_COLUMNS,
                      alignItems: 'center',
                      minHeight: 42,
                      borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
                      backgroundColor:
                        occursOnDate(subtask, new Date()) || occursOnDate(subtask, addDays(new Date(), 1))
                          ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))'
                          : NEO_MINT.surface,
                      '& > *': {
                        boxSizing: 'border-box',
                        minWidth: 0,
                        borderRight: `1px solid ${NEO_MINT.cardBorderSoft}`,
                      },
                    }}
                  >
                    <Button
                      onClick={() => setEditingSubtask({ task, subtask })}
                      sx={{
                        justifyContent: 'flex-start',
                        pl: 4,
                        color: NEO_MINT.textBody,
                        fontWeight: 400,
                        textTransform: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
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
                    <Tooltip title={subtask.notes || 'No notes'}>
                      <Typography sx={{ px: 1, fontSize: '11px' }} noWrap>
                        {truncateNotes(subtask.notes)}
                      </Typography>
                    </Tooltip>
                    {scheduleDays.map((day) => (
                      <Box
                        key={day.toISOString()}
                        sx={{
                          height: '100%',
                          minHeight: 42,
                          display: 'grid',
                          placeItems: 'center',
                          backgroundColor: isTodayScheduleDate(day)
                            ? 'color-mix(in srgb, var(--primary) 22%, var(--primary-subtle))'
                            : isSameWeek(day, new Date(), WEEK_START_OPTIONS)
                              ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))'
                              : 'transparent',
                        }}
                      >
                        {occursOnDate(subtask, day) &&
                          (() => {
                            const occurrenceDate = format(day, 'yyyy-MM-dd');
                            const state = occurrenceStateByKey.get(
                              occurrenceStateKey(subtask.id, occurrenceDate)
                            );
                            return (
                              <OccurrenceStatusMarker
                                status={state?.status ?? 'TO DO'}
                                editable={isOccurrenceEditable(day)}
                                disabled={!canManageTasks || isUpdatingOccurrence}
                                onClick={() => void handleOccurrenceClick(subtask, day)}
                              />
                            );
                          })()}
                      </Box>
                    ))}
                  </Box>
                ))}
            </Box>
          ))}
        </Box>
      </Box>
      <Dialog
        open={pendingWorkLog !== null}
        onClose={() => {
          if (!isUpdatingOccurrence) setPendingWorkLog(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Log work</DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Typography sx={{ color: NEO_MINT.textBody }}>{pendingWorkLog?.subtask.title}</Typography>
          <Typography sx={{ fontSize: '12px', color: NEO_MINT.textMuted }}>
            {pendingWorkLog?.occurrenceDate}
          </Typography>
          <SubtaskWorkLogSelect
            value={pendingWorkHours}
            disabled={isUpdatingOccurrence}
            onChange={setPendingWorkHours}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={isUpdatingOccurrence} onClick={() => setPendingWorkLog(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isUpdatingOccurrence}
            onClick={() => void completePendingOccurrence()}
          >
            Complete
          </Button>
        </DialogActions>
      </Dialog>
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
      <RecurrentSubtaskDialog
        key={editingSubtask?.subtask.id ?? 'scheduled-subtask'}
        open={editingSubtask !== null}
        subtask={editingSubtask?.subtask ?? null}
        availableTags={availableTags}
        availableAssignees={availableAssignees}
        onClose={() => setEditingSubtask(null)}
        onSave={saveScheduledSubtask}
      />
    </Dialog>
  );
}
