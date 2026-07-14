import React, { useState } from 'react';
import type { DragEvent } from 'react';
import { Box, Button, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, TextField, Typography, Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridSortModel, GridRowSelectionModel } from '@mui/x-data-grid';
import { Delete, Label, VisibilityOff, Person, AssignmentTurnedIn, DragIndicator } from '@mui/icons-material';
import { Task, TaskStatus } from '@/types';
import { isToday, isPast, parseISO, startOfDay, isBefore, endOfWeek, addWeeks, endOfDay } from 'date-fns';
import { FilterState } from './FilterPanel';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { getTaskProgress } from '@/utils/taskProgress';
import { STATUS_ORDER, compareTaskPriority, reorderTasksWithinStatus } from '@/utils/taskOrdering';


// ── Status configuration ─────────────────────────────────────────────────────
const STATUS_STYLE: Record<TaskStatus, { bg: string; color: string; border: string }> = {
  'URGENT':      { bg: NEO_MINT.dangerSoft, color: NEO_MINT.danger, border: NEO_MINT.dangerBorder },
  'IN PROGRESS': { bg: 'rgba(15,118,110,0.10)', color: NEO_MINT.primary, border: 'rgba(15,118,110,0.24)' },
  'TO DO':       { bg: NEO_MINT.surfaceMuted, color: NEO_MINT.primaryHover, border: NEO_MINT.cardBorderSoft },
  'PENDING':     { bg: NEO_MINT.surfaceSoft, color: NEO_MINT.textBody, border: NEO_MINT.cardBorderSoft },
  'CANCELLED':   { bg: NEO_MINT.outline, color: NEO_MINT.textMuted, border: NEO_MINT.cardBorderSoft },
  'DONE':        { bg: NEO_MINT.successSoft, color: NEO_MINT.success, border: NEO_MINT.successBorder },
};

const ACTIVE_STATUSES: TaskStatus[] = ['TO DO', 'IN PROGRESS', 'URGENT', 'PENDING'];

const TASK_LIST_TEXT = {
  title: '13px',
  body: '12px',
  badge: '10px',
  header: '11px',
  toolbar: '12px',
  meta: '11px',
};

interface TaskListProps {
  tasks: Task[];
  filters: Partial<FilterState>;
  onSaveTasks: (tasks: Task[]) => void;
  availableTags: string[];
  onRowClick?: (task: Task) => void;
}

function evaluateSearch(text: string, query: string): boolean {
  if (!query) return true;
  const t = text.toLowerCase();
  const exactMatches = query.match(/"([^"]+)"/g);
  let q = query;
  if (exactMatches) {
    for (const match of exactMatches) {
      const phrase = match.replace(/"/g, '').toLowerCase();
      if (!t.includes(phrase)) return false;
      q = q.replace(match, '');
    }
  }
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  let isMatch = true;
  let currentOp = 'AND';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'or') { currentOp = 'OR'; continue; }
    if (token === 'and' || token === '+') { currentOp = 'AND'; continue; }
    const hasToken = t.includes(token);
    if (currentOp === 'AND') { isMatch = isMatch && hasToken; }
    else { isMatch = isMatch || hasToken; currentOp = 'AND'; }
  }
  return isMatch;
}

// ── Action button shared style ────────────────────────────────────────────────
const actionBtnSx = {
  borderRadius: '10px',
  fontSize: TASK_LIST_TEXT.toolbar,
  fontWeight: 600,
  px: 1.25,
  py: 0.5,
  minHeight: 30,
  textTransform: 'none',
};

function appendTasksToStatus(tasks: Task[], ids: string[], status: TaskStatus) {
  let nextSortOrder = Math.max(
    -1,
    ...tasks
      .filter(t => t.status === status && !ids.includes(t.id))
      .map(t => Number.isFinite(t.sortOrder) ? t.sortOrder! : -1)
  ) + 1;

  return tasks.map(t => {
    if (!ids.includes(t.id)) return t;
    return { ...t, status, sortOrder: nextSortOrder++ };
  });
}

export default function TaskList({ tasks, filters, onSaveTasks, availableTags, onRowClick }: TaskListProps) {
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [showAll, setShowAll] = useState(false);

  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedTagToAssign, setSelectedTagToAssign] = useState('');

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedStatusToAssign, setSelectedStatusToAssign] = useState<TaskStatus | ''>('');

  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [selectedAssigneeToAssign, setSelectedAssigneeToAssign] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const handleStatusChange = (id: string, newStatus: TaskStatus) => {
    const currentTask = tasks.find(t => t.id === id);
    const nextSortOrder = Math.max(
      -1,
      ...tasks
        .filter(t => t.status === newStatus && t.id !== id)
        .map(t => Number.isFinite(t.sortOrder) ? t.sortOrder! : -1)
    ) + 1;

    onSaveTasks(tasks.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        status: newStatus,
        sortOrder: currentTask?.status === newStatus ? t.sortOrder : nextSortOrder,
      };
    }));
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(taskId));
    setDraggedTaskId(taskId);
    setSortModel([]);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, targetTask: Task) => {
    const draggedTask = draggedTaskId === null ? null : tasks.find(t => t.id === draggedTaskId);
    if (!draggedTask || draggedTask.status !== targetTask.status || draggedTask.id === targetTask.id) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTaskId(targetTask.id);
  };

  const handleDrop = (event: DragEvent<HTMLElement>, targetTask: Task) => {
    event.preventDefault();
    event.stopPropagation();

    const draggedId = event.dataTransfer.getData('text/plain') || draggedTaskId;
    const draggedTask = tasks.find(t => t.id === draggedId);
    if (!draggedTask || draggedTask.status !== targetTask.status || draggedTask.id === targetTask.id) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    onSaveTasks(reorderTasksWithinStatus(tasks, draggedTask.id, targetTask.id));
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const getEventRowTask = (event: DragEvent<HTMLElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const rowElement = target?.closest('[data-id]');
    const rowId = rowElement?.getAttribute('data-id');
    return rowId ? tasks.find(t => t.id === rowId) : undefined;
  };

  const handleGridDragOver = (event: DragEvent<HTMLElement>) => {
    const targetTask = getEventRowTask(event);
    if (targetTask) handleDragOver(event, targetTask);
  };

  const handleGridDrop = (event: DragEvent<HTMLElement>) => {
    const targetTask = getEventRowTask(event);
    if (targetTask) handleDrop(event, targetTask);
  };

  const handleDeleteSelected = (ids: string[]) => {
    onSaveTasks(tasks.filter(t => !ids.includes(t.id)));
    setSelectionModel({ type: 'include', ids: new Set() });
    setDeleteConfirmOpen(false);
  };

  const handleHideSelected = (ids: string[]) => {
    onSaveTasks(appendTasksToStatus(tasks, ids, 'CANCELLED'));
    setSelectionModel({ type: 'include', ids: new Set() });
  };

  const handleAssignTag = (ids: string[]) => {
    if (!selectedTagToAssign) return;
    onSaveTasks(tasks.map(t => {
      if (ids.includes(t.id) && !t.tags.includes(selectedTagToAssign)) {
        return { ...t, tags: [...t.tags, selectedTagToAssign] };
      }
      return t;
    }));
    setSelectionModel({ type: 'include', ids: new Set() });
    setTagDialogOpen(false);
  };

  const handleAssignStatus = (ids: string[]) => {
    if (!selectedStatusToAssign) return;
    onSaveTasks(appendTasksToStatus(tasks, ids, selectedStatusToAssign as TaskStatus));
    setSelectionModel({ type: 'include', ids: new Set() });
    setStatusDialogOpen(false);
  };

  const handleAssignAssignee = (ids: string[]) => {
    onSaveTasks(tasks.map(t => ids.includes(t.id) ? { ...t, assignee: selectedAssigneeToAssign } : t));
    setSelectionModel({ type: 'include', ids: new Set() });
    setAssigneeDialogOpen(false);
  };

  // ── Column definitions ──────────────────────────────────────────────────────
  const columns: GridColDef[] = [
    {
      field: 'drag',
      headerName: '',
      width: 42,
      minWidth: 42,
      maxWidth: 42,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => (
        <Tooltip title="Drag to reorder within this status">
          <Box
            component="span"
            draggable
            onDragStart={(event) => handleDragStart(event, p.row.id)}
            onDragOver={(event) => handleDragOver(event, p.row as Task)}
            onDrop={(event) => handleDrop(event, p.row as Task)}
            onDragEnd={handleDragEnd}
            onClick={(event) => event.stopPropagation()}
            sx={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              color: NEO_MINT.textMuted,
              cursor: 'grab',
              '&:hover': {
                backgroundColor: 'var(--surface-muted)',
                color: NEO_MINT.primary,
              },
              '&:active': {
                cursor: 'grabbing',
              },
            }}
          >
            <DragIndicator sx={{ fontSize: 18 }} />
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'title', headerName: 'Task Title', flex: 1.25, minWidth: 160,
      renderCell: (p) => {
        const dueDateChangeCount = Number(p.row.dueDateChangeCount || 0);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, width: '100%' }}>
            <Typography sx={{ fontSize: TASK_LIST_TEXT.title, fontWeight: 600, color: NEO_MINT.textTitle, whiteSpace: 'normal', lineHeight: 1.45, overflowWrap: 'anywhere', minWidth: 0 }}>
              {p.value}
            </Typography>
            {dueDateChangeCount >= 1 && (
              <Box
                component="span"
                title={`Due date changed ${dueDateChangeCount} time${dueDateChangeCount > 1 ? 's' : ''}`}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  minWidth: 18,
                  height: 18,
                  px: 0.5,
                  borderRadius: '8px',
                  backgroundColor: NEO_MINT.dueDateChangeSoft,
                  border: `1px solid ${NEO_MINT.dueDateChange}`,
                  color: NEO_MINT.dueDateChange,
                  fontSize: '10px',
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {dueDateChangeCount}
              </Box>
            )}
          </Box>
        );
      },
    },
    {
      field: 'details', headerName: 'Details', flex: 0.95, minWidth: 120, resizable: true,
      renderCell: (p) => {
        const stripped = (p.value || '').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '');
        return (
          <Typography sx={{ fontSize: TASK_LIST_TEXT.body, color: NEO_MINT.textBody, whiteSpace: 'normal', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
            {stripped.length > 40 ? stripped.substring(0, 40) + '…' : stripped}
          </Typography>
        );
      },
    },
    {
      field: 'assignee', headerName: 'Assignee', width: 96, minWidth: 82, align: 'center', headerAlign: 'center',
      renderCell: (p) => (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p.value ? (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              px: 1, py: 0,
              borderRadius: '8px',
              backgroundColor: 'var(--primary-subtle)',
              border: `1px solid ${NEO_MINT.cardBorderSoft}`,
              color: NEO_MINT.primary,
              fontSize: TASK_LIST_TEXT.badge, fontWeight: 700,
              minWidth: 0,
              maxWidth: '100%',
              height: '22px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {p.value}
            </Box>
          ) : null}
        </Box>
      ),
    },
    {
      field: 'subtasks',
      headerName: 'Chk-List',
      width: 68,
      minWidth: 64,
      maxWidth: 74,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (p) => {
        const subtasks = p.row.subtasks || [];
        if (subtasks.length === 0) return null;

        const completed = subtasks.filter((subtask: Task['subtasks'][number]) => subtask.completed).length;
        return (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: TASK_LIST_TEXT.meta, fontWeight: 700, color: NEO_MINT.textBody, whiteSpace: 'nowrap' }}>
              {completed}/{subtasks.length}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'progress',
      headerName: '%',
      width: 56,
      minWidth: 52,
      maxWidth: 62,
      align: 'center',
      headerAlign: 'center',
      sortable: true,
      valueGetter: (_, row) => getTaskProgress(row as Task),
      renderCell: (p) => {
        const progress = getTaskProgress(p.row as Task);
        if (progress <= 0) return null;

        return (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: TASK_LIST_TEXT.meta, fontWeight: 800, color: progress >= 100 ? NEO_MINT.success : NEO_MINT.primary, whiteSpace: 'nowrap' }}>
              {progress}%
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'tags', headerName: 'Tags', width: 126, minWidth: 96, align: 'center', headerAlign: 'center',
      renderCell: (p) => (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5, justifyContent: 'center' }}>
            {(p.value || []).map((tag: string) => (
              <Box key={tag} sx={{
                px: 1, py: 0,
                borderRadius: '8px',
                backgroundColor: 'var(--surface-muted)',
                border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                color: NEO_MINT.textBody,
                fontSize: TASK_LIST_TEXT.badge, fontWeight: 700,
                height: '22px',
                maxWidth: 96,
                display: 'inline-flex',
                alignItems: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {tag}
              </Box>
            ))}
          </Box>
        </Box>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 132, minWidth: 118, align: 'center', headerAlign: 'center',
      renderCell: (p) => (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Select
            size="small"
            value={p.value}
            onChange={(e) => handleStatusChange(p.row.id, e.target.value as TaskStatus)}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: '116px',
              fontSize: TASK_LIST_TEXT.badge,
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: STATUS_STYLE[p.value as TaskStatus]?.bg || NEO_MINT.surface,
              color: STATUS_STYLE[p.value as TaskStatus]?.color || NEO_MINT.textTitle,
              height: '22px',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: STATUS_STYLE[p.value as TaskStatus]?.border || NEO_MINT.cardBorderSoft,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: STATUS_STYLE[p.value as TaskStatus]?.border || NEO_MINT.cardBorderSoft,
              },
              '& .MuiSelect-icon': {
                color: STATUS_STYLE[p.value as TaskStatus]?.color || NEO_MINT.textTitle,
                fontSize: '14px',
              },
              '& .MuiSelect-select': {
                py: '0px !important',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pr: '24px !important',
                minHeight: '22px',
              }
            }}
          >
            {Object.keys(STATUS_ORDER).map(s => (
              <MenuItem key={s} value={s} sx={{ fontSize: TASK_LIST_TEXT.body, fontWeight: 500 }}>{s}</MenuItem>
            ))}
          </Select>
        </Box>
      ),
    },
    {
      field: 'dueDate', headerName: 'Due Date', width: 96, minWidth: 90, align: 'center', headerAlign: 'center',
      renderCell: (p) => {
        if (!p.value) return null;
        const isOverdue = isPast(startOfDay(parseISO(p.value))) && !isToday(parseISO(p.value));
        return (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{
              fontSize: TASK_LIST_TEXT.meta,
              fontWeight: 600,
              color: isOverdue ? NEO_MINT.danger : NEO_MINT.textBody,
            }}>
              {p.value.substring(0, 10)}
            </Typography>
          </Box>
        );
      },
    },
  ];

  // ── Filtering ───────────────────────────────────────────────────────────────
  let rows = tasks.map(t => ({ ...t, statusSort: STATUS_ORDER[t.status], tagsStr: t.tags.join(',') }));

  if (!showAll) rows = rows.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED');

  if (filters.searchQuery) {
    rows = rows.filter(t => evaluateSearch(`${t.title} ${t.details} ${t.assignee} ${t.tags.join(' ')}`, filters.searchQuery || ''));
  }

  const isActiveStatus = (s: string) => ACTIVE_STATUSES.includes(s as TaskStatus);

  if (filters.dueToday) {
    const todayEnd = endOfDay(new Date());
    rows = rows.filter(t => isActiveStatus(t.status) && t.dueDate && (isBefore(parseISO(t.dueDate), todayEnd) || isToday(parseISO(t.dueDate))));
  }
  if (filters.dueInWeek) {
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    rows = rows.filter(t => isActiveStatus(t.status) && t.dueDate && isBefore(parseISO(t.dueDate), endOfDay(weekEnd)));
  }
  if (filters.dueNextWeek) {
    const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
    rows = rows.filter(t => isActiveStatus(t.status) && t.dueDate && isBefore(parseISO(t.dueDate), endOfDay(nextWeekEnd)));
  }
  if (filters.overdue) {
    rows = rows.filter(t => t.dueDate && isPast(startOfDay(parseISO(t.dueDate))) && !isToday(parseISO(t.dueDate)));
  }
  if (filters.tags && filters.tags.length > 0) {
    rows = rows.filter(t => {
      if (filters.tagsOperator === 'AND') return filters.tags!.every(tag => t.tags.includes(tag));
      if (filters.tagsOperator === 'NOT') return !filters.tags!.some(tag => t.tags.includes(tag));
      return filters.tags!.some(tag => t.tags.includes(tag));
    });
  }
  if (filters.statuses && filters.statuses.length > 0) {
    rows = rows.filter(t => {
      if (filters.statusOperator === 'AND') return filters.statuses!.every(s => t.status === s);
      if (filters.statusOperator === 'NOT') return !filters.statuses!.some(s => t.status === s);
      return filters.statuses!.some(s => t.status === s);
    });
  }
  if (filters.quickUrgent) rows = rows.filter(t => t.status === 'URGENT');
  if (filters.quickNotFinished) rows = rows.filter(t => !['PENDING', 'CANCELLED', 'DONE'].includes(t.status));
  if (filters.quickIncompleteToday) {
    rows = rows.filter(t => {
      const isIncomplete = t.status !== 'DONE' && t.status !== 'CANCELLED';
      const isDueOrOverdue = t.dueDate && (isBefore(parseISO(t.dueDate), new Date()) || isToday(parseISO(t.dueDate)));
      return isIncomplete && isDueOrOverdue;
    });
  }
  if (filters.quickAssignee) {
    const q = filters.quickAssignee.toLowerCase();
    rows = rows.filter(t => t.assignee && t.assignee.toLowerCase().includes(q));
  }

  rows.sort((a, b) => {
    if (a.statusSort !== b.statusSort) return a.statusSort - b.statusSort;
    const priorityCompare = compareTaskPriority(a, b);
    if (priorityCompare !== 0) return priorityCompare;
    if (a.tagsStr !== b.tagsStr) return a.tagsStr.localeCompare(b.tagsStr);
    if (a.assignee !== b.assignee) return (a.assignee || '').localeCompare(b.assignee || '');
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const statusBorderRows = new Set<string>();
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].statusSort !== rows[i + 1].statusSort) statusBorderRows.add(rows[i].id);
  }

  const actualSelectedIds = selectionModel.type === 'include'
    ? Array.from(selectionModel.ids || []).map(String)
    : rows.map(r => r.id).filter(id => !(selectionModel.ids || new Set()).has(id));

  const hasSelection = actualSelectedIds.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Toolbar strip */}
      <Box sx={{
        display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap',
        px: 2, py: 1.5,
        backgroundColor: 'var(--card-bg)',
        borderRadius: '12px',
        border: '1px solid var(--card-border)',
        boxShadow: NEO_MINT.shadowSm,
      }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Delete sx={{ fontSize: '16px !important' }} />}
          disabled={!hasSelection}
          onClick={() => setDeleteConfirmOpen(true)}
          sx={{ ...actionBtnSx, borderColor: NEO_MINT.dangerBorder, color: NEO_MINT.danger, backgroundColor: '#fff', '&:hover': { backgroundColor: NEO_MINT.dangerSoft, borderColor: NEO_MINT.danger } }}
        >
          Delete
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Label sx={{ fontSize: '16px !important' }} />}
          disabled={!hasSelection}
          onClick={() => setTagDialogOpen(true)}
          sx={{ ...actionBtnSx, borderColor: NEO_MINT.cardBorderSoft, color: NEO_MINT.textTitle, backgroundColor: '#fff', '&:hover': { backgroundColor: 'var(--primary-subtle)', borderColor: NEO_MINT.primary, color: NEO_MINT.primary } }}
        >
          Add Tag
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AssignmentTurnedIn sx={{ fontSize: '16px !important' }} />}
          disabled={!hasSelection}
          onClick={() => setStatusDialogOpen(true)}
          sx={{ ...actionBtnSx, borderColor: NEO_MINT.cardBorderSoft, color: NEO_MINT.textTitle, backgroundColor: '#fff', '&:hover': { backgroundColor: 'var(--primary-subtle)', borderColor: NEO_MINT.primary, color: NEO_MINT.primary } }}
        >
          Set Status
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Person sx={{ fontSize: '16px !important' }} />}
          disabled={!hasSelection}
          onClick={() => setAssigneeDialogOpen(true)}
          sx={{ ...actionBtnSx, borderColor: NEO_MINT.cardBorderSoft, color: NEO_MINT.textTitle, backgroundColor: '#fff', '&:hover': { backgroundColor: 'var(--primary-subtle)', borderColor: NEO_MINT.primary, color: NEO_MINT.primary } }}
        >
          Assignee
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<VisibilityOff sx={{ fontSize: '16px !important' }} />}
          disabled={!hasSelection}
          onClick={() => handleHideSelected(actualSelectedIds)}
          sx={{ ...actionBtnSx, borderColor: NEO_MINT.cardBorderSoft, color: NEO_MINT.textBody, backgroundColor: '#fff', '&:hover': { backgroundColor: 'var(--surface-muted)', borderColor: NEO_MINT.cardBorderSoft } }}
        >
          Hide
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        {hasSelection && (
          <Typography sx={{ fontSize: TASK_LIST_TEXT.body, color: NEO_MINT.primary, fontWeight: 700 }}>
            {actualSelectedIds.length} items selected
          </Typography>
        )}

        <Button
          variant="text"
          size="small"
          onClick={() => setShowAll(!showAll)}
          sx={{
            ...actionBtnSx,
            color: NEO_MINT.textBody,
            '&:hover': { backgroundColor: 'var(--surface-muted)', color: NEO_MINT.textTitle },
          }}
        >
          {showAll ? 'Hide Completed' : 'Show All'}
        </Button>
      </Box>

      {/* Data Grid */}
      <Box sx={{
        minHeight: 500,
        height: rows.length > 0 ? Math.max(500, Math.min(rows.length * 56 + 112, 1200)) : 500,
        borderRadius: '12px',
        border: '1px solid var(--card-border)',
        overflowX: 'auto',
        overflowY: 'hidden',
        backgroundColor: 'var(--card-bg)',
        boxShadow: NEO_MINT.shadowSm,
      }}
        onDragOver={handleGridDragOver}
        onDrop={handleGridDrop}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragOverTaskId(null);
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          checkboxSelection
          disableRowSelectionOnClick
          rowHeight={56}
          sortModel={sortModel}
          onSortModelChange={(model) => setSortModel(model)}
          onRowSelectionModelChange={setSelectionModel}
          rowSelectionModel={selectionModel}
          onRowClick={(params) => onRowClick && onRowClick(params.row as Task)}
          getRowClassName={(params) => {
            const cls: string[] = ['custom-row'];
            if (params.row.status === 'URGENT') cls.push('row-urgent');
            if (draggedTaskId === params.row.id) cls.push('row-dragging');
            if (dragOverTaskId === params.row.id) cls.push('row-drag-over');
            if (statusBorderRows.has(params.row.id)) cls.push('row-group-last');
            return cls.join(' ');
          }}
          sx={{
            minWidth: 1020,
            border: 'none',
            fontFamily: 'var(--font-gilroy)',
            '& .MuiDataGrid-cell': {
              borderColor: 'var(--card-border-soft)',
              fontSize: TASK_LIST_TEXT.body,
              color: NEO_MINT.textTitle,
              alignItems: 'center',
              py: 1,
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'var(--surface-soft)',
              borderBottom: '1px solid var(--card-border)',
              fontSize: TASK_LIST_TEXT.header,
              fontWeight: 700,
              color: NEO_MINT.textTitle,
              textTransform: 'uppercase',
              letterSpacing: 0,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
            },
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                backgroundColor: 'var(--primary-subtle)',
              },
            },
            '& .row-urgent': {
              backgroundColor: NEO_MINT.dangerSoft,
              '&:hover': { backgroundColor: NEO_MINT.dangerSoft },
            },
            '& .row-group-last': {
              borderBottom: '2px solid var(--card-border)',
            },
            '& .row-dragging': {
              opacity: 0.55,
            },
            '& .row-drag-over': {
              backgroundColor: 'rgba(15,118,110,0.12)',
              outline: `2px solid ${NEO_MINT.primary}`,
              outlineOffset: '-2px',
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid var(--card-border-soft)',
              backgroundColor: 'var(--surface-soft)',
              fontSize: TASK_LIST_TEXT.body,
              color: NEO_MINT.textBody,
            },
            '& .MuiDataGrid-checkboxInput': {
              color: NEO_MINT.cardBorderSoft,
              '&.Mui-checked': { color: NEO_MINT.primary },
            },
            '& .MuiDataGrid-row.Mui-selected': {
              backgroundColor: 'rgba(15,118,110,0.06)',
              '&:hover': { backgroundColor: 'rgba(15,118,110,0.10)' },
            },
            '& .MuiDataGrid-columnSeparator': { display: 'none' },
          }}
        />
      </Box>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Delete confirm */}
      <Dialog 
        open={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: NEO_MINT.textTitle }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: TASK_LIST_TEXT.body, color: NEO_MINT.textBody }}>
            Are you sure you want to delete <strong style={{ color: NEO_MINT.danger }}>{actualSelectedIds.length}</strong> selected tasks?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} variant="text" sx={{ color: NEO_MINT.textBody, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button
            onClick={() => handleDeleteSelected(actualSelectedIds)}
            sx={{ borderRadius: '10px', backgroundColor: NEO_MINT.danger, color: '#fff', fontWeight: 700, px: 2.5, textTransform: 'none', '&:hover': { backgroundColor: '#b91c1c' } }}
            variant="contained"
            disableElevation
          >
            Delete Tasks
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Tag */}
      <Dialog 
        open={tagDialogOpen} 
        onClose={() => setTagDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: NEO_MINT.textTitle }}>Add Tag</DialogTitle>
        <DialogContent sx={{ minWidth: 360, pt: 2 }}>
          <FormControl fullWidth variant="outlined" sx={{ mt: 1 }}>
            <InputLabel>Select Tag</InputLabel>
            <Select 
              value={selectedTagToAssign} 
              label="Select Tag" 
              onChange={(e) => setSelectedTagToAssign(e.target.value)}
              sx={{ borderRadius: '8px' }}
            >
              {availableTags.map(tag => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setTagDialogOpen(false)} sx={{ color: NEO_MINT.textBody, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button 
            onClick={() => handleAssignTag(actualSelectedIds)} 
            variant="contained" 
            disableElevation
            sx={{ borderRadius: '10px', backgroundColor: NEO_MINT.primary, px: 2.5, textTransform: 'none', fontWeight: 700 }}
          >
            Apply Tag
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Status */}
      <Dialog 
        open={statusDialogOpen} 
        onClose={() => setStatusDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: NEO_MINT.textTitle }}>Update Status</DialogTitle>
        <DialogContent sx={{ minWidth: 360, pt: 2 }}>
          <FormControl fullWidth variant="outlined" sx={{ mt: 1 }}>
            <InputLabel>Select Status</InputLabel>
            <Select 
              value={selectedStatusToAssign} 
              label="Select Status" 
              onChange={(e) => setSelectedStatusToAssign(e.target.value as TaskStatus)}
              sx={{ borderRadius: '8px' }}
            >
              {Object.keys(STATUS_ORDER).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setStatusDialogOpen(false)} sx={{ color: NEO_MINT.textBody, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button 
            onClick={() => handleAssignStatus(actualSelectedIds)} 
            variant="contained" 
            disableElevation
            sx={{ borderRadius: '10px', backgroundColor: NEO_MINT.primary, px: 2.5, textTransform: 'none', fontWeight: 700 }}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Assignee */}
      <Dialog 
        open={assigneeDialogOpen} 
        onClose={() => setAssigneeDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: NEO_MINT.textTitle }}>Assign Tasks</DialogTitle>
        <DialogContent sx={{ minWidth: 360, pt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Assignee Name"
            fullWidth
            variant="outlined"
            value={selectedAssigneeToAssign}
            onChange={(e) => setSelectedAssigneeToAssign(e.target.value)}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAssigneeDialogOpen(false)} sx={{ color: NEO_MINT.textBody, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button 
            onClick={() => handleAssignAssignee(actualSelectedIds)} 
            variant="contained" 
            disableElevation
            sx={{ borderRadius: '10px', backgroundColor: NEO_MINT.primary, px: 2.5, textTransform: 'none', fontWeight: 700 }}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
