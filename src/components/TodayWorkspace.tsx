'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Snackbar,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { Close, Delete, DragIndicator, DriveFileMoveOutlined, PlaylistAdd } from '@mui/icons-material';
import type { Subtask, Task, UserProfile } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import {
  compareTodaySubtaskItems,
  getSuggestedTodaySubtaskItems,
  getTodaySubtaskItems,
  reorderTodaySubtasks,
} from '@/utils/todayTasks';
import type { TodaySubtaskItem } from '@/utils/todayTasks';
import { addBatchSubtasksToTodayTask } from '@/utils/todayBatch';
import TodayBatchAddDialog from '@/components/TodayBatchAddDialog';
import SubtaskWorkLogSelect from '@/components/SubtaskWorkLogSelect';
import TodayMoveSubtaskDialog from '@/components/TodayMoveSubtaskDialog';
import SubtaskStatusControl from '@/components/SubtaskStatusControl';
import { cycleSubtaskStatus, setSubtaskWorkHours } from '@/utils/subtaskWork';

const VISIBILITY_REFRESH_INTERVAL_MS = 60 * 1000;
const PENDING_DELETE_DURATION_MS = 5 * 1000;
const TODAY_DIALOG_GRID_COLUMNS = {
  xs: '68px 58px minmax(320px, 1fr) 90px 58px 64px 74px 56px',
  md: '68px 58px minmax(0, 1fr) 90px 58px 64px 74px 56px',
};
const TODAY_DIALOG_TABLE_MIN_WIDTH = 900;
const TODAY_TABLE_BORDER = '1px solid color-mix(in srgb, var(--outline) 72%, transparent)';

interface TodayWorkspaceProps {
  tasks: Task[];
  profile: UserProfile;
  canManageTasks: boolean;
  isDialogOpen: boolean;
  onCloseDialog: () => void;
  onSaveTasks: (tasks: Task[]) => void | Promise<void>;
  onMoveSubtask: (subtaskId: string, targetTaskId: string) => void | Promise<void>;
  onOpenTask: (task: Task) => void;
}

function TruncatedText({ children, sx = {} }: { children: string; sx?: Record<string, unknown> }) {
  return (
    <Typography
      component="span"
      title={children}
      sx={{
        display: 'block',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

export default function TodayWorkspace({
  tasks,
  profile,
  canManageTasks,
  isDialogOpen,
  onCloseDialog,
  onSaveTasks,
  onMoveSubtask,
  onOpenTask,
}: TodayWorkspaceProps) {
  const [visibilityReferenceTime, setVisibilityReferenceTime] = useState(0);
  const [includeSuggestedTasks, setIncludeSuggestedTasks] = useState(false);
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState<string | null>(null);
  const [isBatchAddOpen, setIsBatchAddOpen] = useState(false);
  const [movingItem, setMovingItem] = useState<TodaySubtaskItem | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<TodaySubtaskItem | null>(null);
  const latestTasksRef = useRef(tasks);
  const latestSaveTasksRef = useRef(onSaveTasks);
  const pendingDeletionRef = useRef<TodaySubtaskItem | null>(null);
  const deletionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    latestTasksRef.current = tasks;
    latestSaveTasksRef.current = onSaveTasks;
  }, [onSaveTasks, tasks]);

  useEffect(
    () => () => {
      if (deletionTimerRef.current !== null) window.clearTimeout(deletionTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const refreshVisibilityTime = () => setVisibilityReferenceTime(Date.now());
    refreshVisibilityTime();
    const intervalId = window.setInterval(refreshVisibilityTime, VISIBILITY_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  const todayItems = useMemo<TodaySubtaskItem[]>(
    () => getTodaySubtaskItems(tasks, visibilityReferenceTime),
    [tasks, visibilityReferenceTime]
  );
  const suggestedItems = useMemo<TodaySubtaskItem[]>(
    () => (includeSuggestedTasks ? getSuggestedTodaySubtaskItems(tasks, visibilityReferenceTime) : []),
    [includeSuggestedTasks, tasks, visibilityReferenceTime]
  );
  const pendingDeletionId = pendingDeletion?.subtask.id;
  const dialogItems = useMemo<TodaySubtaskItem[]>(
    () =>
      [...todayItems, ...suggestedItems]
        .filter((item) => item.subtask.id !== pendingDeletionId)
        .sort(compareTodaySubtaskItems),
    [pendingDeletionId, suggestedItems, todayItems]
  );

  const visiblePanelItems = useMemo(
    () => todayItems.filter((item) => item.subtask.id !== pendingDeletionId),
    [pendingDeletionId, todayItems]
  );

  const updateSubtask = (
    taskId: string,
    subtaskId: string,
    updater: (subtask: Subtask) => Subtask | null
  ) => {
    const nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        subtasks: task.subtasks.flatMap((subtask) => {
          if (subtask.id !== subtaskId) return [subtask];
          const updatedSubtask = updater(subtask);
          return updatedSubtask ? [updatedSubtask] : [];
        }),
      };
    });
    void onSaveTasks(nextTasks);
  };

  const cycleStatus = (item: TodaySubtaskItem) => {
    updateSubtask(item.task.id, item.subtask.id, (subtask) =>
      cycleSubtaskStatus(subtask, new Date().toISOString())
    );
  };

  const updateWorkHours = (item: TodaySubtaskItem, workHours: number) => {
    updateSubtask(item.task.id, item.subtask.id, (subtask) => setSubtaskWorkHours(subtask, workHours));
  };

  const toggleToday = (item: TodaySubtaskItem) => {
    updateSubtask(item.task.id, item.subtask.id, (subtask) => ({
      ...subtask,
      isToday: !subtask.isToday,
    }));
  };

  const commitSubtaskDeletion = (item: TodaySubtaskItem) => {
    const nextTasks = latestTasksRef.current.map((task) => {
      if (task.id !== item.task.id) return task;
      return { ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== item.subtask.id) };
    });
    pendingDeletionRef.current = null;
    deletionTimerRef.current = null;
    setPendingDeletion(null);
    void latestSaveTasksRef.current(nextTasks);
  };

  const deleteSubtask = (item: TodaySubtaskItem) => {
    const pendingItem = pendingDeletionRef.current;
    if (pendingItem) {
      if (deletionTimerRef.current !== null) window.clearTimeout(deletionTimerRef.current);
      commitSubtaskDeletion(pendingItem);
    }

    pendingDeletionRef.current = item;
    setPendingDeletion(item);
    deletionTimerRef.current = window.setTimeout(() => {
      const scheduledItem = pendingDeletionRef.current;
      if (scheduledItem?.subtask.id === item.subtask.id) commitSubtaskDeletion(scheduledItem);
    }, PENDING_DELETE_DURATION_MS);
  };

  const undoDeleteSubtask = () => {
    if (deletionTimerRef.current !== null) window.clearTimeout(deletionTimerRef.current);
    deletionTimerRef.current = null;
    pendingDeletionRef.current = null;
    setPendingDeletion(null);
  };

  const openParentTask = (task: Task) => {
    onCloseDialog();
    onOpenTask(task);
  };

  const closeTodayDialog = () => {
    setIsBatchAddOpen(false);
    setMovingItem(null);
    onCloseDialog();
  };

  const handleBatchAdd = (titles: string[]) => {
    if (!canManageTasks) return;
    void onSaveTasks(addBatchSubtasksToTodayTask(tasks, titles));
    setIsBatchAddOpen(false);
  };

  const clearDragState = () => {
    setDraggedSubtaskId(null);
    setDragOverSubtaskId(null);
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, subtaskId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-today-subtask-id', subtaskId);
    setDraggedSubtaskId(subtaskId);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, targetSubtaskId: string) => {
    if (!draggedSubtaskId || draggedSubtaskId === targetSubtaskId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverSubtaskId(targetSubtaskId);
  };

  const handleDrop = (event: DragEvent<HTMLElement>, targetSubtaskId: string) => {
    event.preventDefault();
    const sourceSubtaskId = event.dataTransfer.getData('application/x-today-subtask-id') || draggedSubtaskId;
    if (sourceSubtaskId) {
      void onSaveTasks(reorderTodaySubtasks(tasks, dialogItems, sourceSubtaskId, targetSubtaskId));
    }
    clearDragState();
  };

  return (
    <>
      <Box sx={{ height: '100%', minWidth: 0, backgroundColor: 'var(--sidebar-bg)' }}>
        <Box sx={{ px: 1.75, py: 1.5, borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}` }}>
          <Typography
            sx={{ fontSize: '12px', fontWeight: 800, letterSpacing: '-0.015em', color: NEO_MINT.textTitle }}
          >
            {profile.nickname || profile.email.split('@')[0]} | {profile.role}
          </Typography>
          <Typography sx={{ fontSize: '11px', color: NEO_MINT.textMuted, mt: 0.2 }} noWrap>
            {profile.email}
          </Typography>
          <Typography
            sx={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.09em',
              color: NEO_MINT.primary,
              mt: 1.25,
            }}
          >
            ##TODAY
          </Typography>
        </Box>
        <Box sx={{ overflowY: 'auto', height: 'calc(100% - 82px)' }}>
          {visiblePanelItems.length === 0 ? (
            <Typography sx={{ p: 2, fontSize: '12px', lineHeight: 1.6, color: NEO_MINT.textMuted }}>
              No subtasks selected for Today.
            </Typography>
          ) : (
            visiblePanelItems.map((item) => (
              <Box
                key={item.subtask.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.5,
                  borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
                }}
              >
                <SubtaskStatusControl
                  disabled={!canManageTasks}
                  status={item.subtask.status}
                  onCycle={() => cycleStatus(item)}
                />
                <Tooltip title={item.task.title} placement="left">
                  <ButtonBase
                    onClick={() => openParentTask(item.task)}
                    sx={{ minWidth: 0, flex: 1, justifyContent: 'flex-start', borderRadius: '6px' }}
                  >
                    <TruncatedText
                      sx={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: item.subtask.completed ? NEO_MINT.textMuted : NEO_MINT.textTitle,
                        textDecoration: item.subtask.completed ? 'line-through' : 'none',
                      }}
                    >
                      {item.subtask.title}
                    </TruncatedText>
                  </ButtonBase>
                </Tooltip>
                {item.subtask.completed && (
                  <SubtaskWorkLogSelect
                    value={item.subtask.workHours}
                    disabled={!canManageTasks}
                    compact
                    onChange={(workHours) => updateWorkHours(item, workHours)}
                  />
                )}
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Dialog
        open={isDialogOpen}
        onClose={closeTodayDialog}
        fullWidth
        maxWidth="xl"
        disableEnforceFocus={isBatchAddOpen || movingItem !== null}
        disableAutoFocus={isBatchAddOpen || movingItem !== null}
        disableRestoreFocus={isBatchAddOpen || movingItem !== null}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '20px',
              border: `1px solid ${NEO_MINT.cardBorderSoft}`,
              boxShadow: NEO_MINT.shadowLg,
              width: { xs: 'calc(100% - 24px)', md: 'calc(100% - 64px)', xl: 1320 },
              maxWidth: 1320,
              maxHeight: 'calc(100dvh - 48px)',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: { xs: 2, sm: 2.5 },
            py: 2,
          }}
        >
          <Typography component="span" sx={{ fontSize: '20px', fontWeight: 800, color: NEO_MINT.textTitle }}>
            ##TODAY
          </Typography>
          <IconButton aria-label="Close Today popup" onClick={closeTodayDialog}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ minHeight: 0, flex: '1 1 auto', overflowY: 'auto', p: 0 }}>
          {dialogItems.length === 0 ? (
            <Typography sx={{ p: 3, color: NEO_MINT.textMuted, textAlign: 'center' }}>
              No subtasks selected for Today.
            </Typography>
          ) : (
            <Box sx={{ overflowX: { xs: 'auto', md: 'visible' }, py: 0.75 }}>
              <Box sx={{ width: '100%', minWidth: { xs: TODAY_DIALOG_TABLE_MIN_WIDTH, md: 0 } }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: TODAY_DIALOG_GRID_COLUMNS,
                    alignItems: 'center',
                    columnGap: 0,
                    py: 0.75,
                    borderTop: TODAY_TABLE_BORDER,
                    borderLeft: TODAY_TABLE_BORDER,
                    borderBottom: TODAY_TABLE_BORDER,
                    backgroundColor: 'color-mix(in srgb, var(--surface-muted) 82%, var(--primary) 18%)',
                    '& > *': {
                      minWidth: 0,
                      px: 0.5,
                      borderRight: TODAY_TABLE_BORDER,
                    },
                  }}
                >
                  {['Priority', 'Status', 'Subtask', 'Assignee', 'Today', 'Parent', 'Log work', 'Delete'].map(
                    (label) => (
                      <Typography
                        key={label}
                        noWrap
                        sx={{
                          minWidth: 0,
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: NEO_MINT.textMuted,
                          textAlign: 'center',
                        }}
                      >
                        {label}
                      </Typography>
                    )
                  )}
                </Box>
                {dialogItems.map((item) => (
                  <Box
                    key={item.subtask.id}
                    onDragOver={(event) => handleDragOver(event, item.subtask.id)}
                    onDrop={(event) => handleDrop(event, item.subtask.id)}
                    onDragLeave={() => setDragOverSubtaskId(null)}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: TODAY_DIALOG_GRID_COLUMNS,
                      alignItems: 'center',
                      columnGap: 0,
                      py: 1,
                      borderLeft: TODAY_TABLE_BORDER,
                      borderBottom: TODAY_TABLE_BORDER,
                      backgroundColor: item.suggested ? NEO_MINT.surfaceMuted : NEO_MINT.surface,
                      '& > *': {
                        minWidth: 0,
                        px: 0.5,
                        borderRight: TODAY_TABLE_BORDER,
                      },
                      outline:
                        dragOverSubtaskId === item.subtask.id ? `2px solid ${NEO_MINT.primary}` : 'none',
                      outlineOffset: -2,
                    }}
                  >
                    <Tooltip title="Drag to change priority">
                      <Box
                        component="span"
                        draggable={canManageTasks}
                        onDragStart={(event) => handleDragStart(event, item.subtask.id)}
                        onDragEnd={clearDragState}
                        sx={{
                          display: 'inline-flex',
                          justifySelf: 'center',
                          color: NEO_MINT.textMuted,
                          cursor: canManageTasks ? 'grab' : 'default',
                          '&:active': { cursor: canManageTasks ? 'grabbing' : 'default' },
                        }}
                      >
                        <DragIndicator fontSize="small" />
                      </Box>
                    </Tooltip>
                    <SubtaskStatusControl
                      disabled={!canManageTasks}
                      status={item.subtask.status}
                      onCycle={() => cycleStatus(item)}
                    />
                    <ButtonBase
                      onClick={() => openParentTask(item.task)}
                      sx={{
                        minWidth: 0,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-start',
                        gap: 0.75,
                        borderRadius: '6px',
                        textAlign: 'left',
                      }}
                    >
                      <TruncatedText
                        sx={{
                          maxWidth: '45%',
                          fontSize: '13px',
                          fontWeight: 400,
                          color: item.subtask.completed ? NEO_MINT.textMuted : NEO_MINT.textTitle,
                          textDecoration: item.subtask.completed ? 'line-through' : 'none',
                        }}
                      >
                        {item.task.title}
                      </TruncatedText>
                      <Typography component="span" sx={{ flexShrink: 0, color: NEO_MINT.textMuted }}>
                        /
                      </Typography>
                      <TruncatedText
                        sx={{
                          flex: 1,
                          fontSize: '13px',
                          fontWeight: 700,
                          color: item.subtask.completed ? NEO_MINT.textMuted : NEO_MINT.textBody,
                          textDecoration: item.subtask.completed ? 'line-through' : 'none',
                        }}
                      >
                        {item.subtask.title}
                      </TruncatedText>
                    </ButtonBase>
                    <TruncatedText
                      sx={{
                        fontSize: '12px',
                        color: NEO_MINT.textBody,
                        textAlign: 'center',
                      }}
                    >
                      {item.task.assignee || 'Unassigned'}
                    </TruncatedText>
                    <Tooltip title={item.subtask.isToday ? 'Remove from Today' : 'Add to Today'}>
                      <Switch
                        size="small"
                        disabled={!canManageTasks}
                        checked={item.subtask.isToday}
                        onChange={() => toggleToday(item)}
                        color="primary"
                        slotProps={{ input: { 'aria-label': 'Toggle subtask Today status' } }}
                        sx={{ justifySelf: 'center' }}
                      />
                    </Tooltip>
                    <Tooltip title="Move to another parent task">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canManageTasks}
                          aria-label="Move subtask"
                          onClick={() => setMovingItem(item)}
                          sx={{ color: NEO_MINT.textMuted, '&:hover': { color: NEO_MINT.primary } }}
                        >
                          <DriveFileMoveOutlined fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    {item.subtask.completed ? (
                      <SubtaskWorkLogSelect
                        value={item.subtask.workHours}
                        disabled={!canManageTasks}
                        compact
                        onChange={(workHours) => updateWorkHours(item, workHours)}
                      />
                    ) : (
                      <Box />
                    )}
                    <Tooltip title="Delete subtask">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canManageTasks}
                          aria-label="Delete subtask"
                          onClick={() => deleteSubtask(item)}
                          sx={{ color: NEO_MINT.textMuted, '&:hover': { color: NEO_MINT.danger } }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexShrink: 0,
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 0.75,
            px: { xs: 1.5, sm: 2 },
            py: 1,
            borderTop: `1px solid ${NEO_MINT.cardBorderSoft}`,
            backgroundColor: NEO_MINT.surface,
          }}
        >
          <Button
            size="small"
            variant="text"
            disabled={!canManageTasks}
            startIcon={<PlaylistAdd sx={{ fontSize: '17px !important' }} />}
            onClick={() => setIsBatchAddOpen(true)}
            sx={{
              minHeight: 28,
              px: 1,
              py: 0.25,
              fontSize: '12px',
              fontWeight: 800,
              color: NEO_MINT.textBody,
            }}
          >
            Batch add
          </Button>
          <FormControlLabel
            label="Load more"
            labelPlacement="start"
            control={
              <Switch
                size="small"
                checked={includeSuggestedTasks}
                onChange={(_, checked) => setIncludeSuggestedTasks(checked)}
                slotProps={{ input: { 'aria-label': 'Show suggested upcoming subtasks' } }}
              />
            }
            sx={{
              m: 0,
              gap: 0.5,
              '& .MuiFormControlLabel-label': { fontSize: '12px', fontWeight: 800 },
            }}
          />
        </Box>
      </Dialog>

      <TodayBatchAddDialog
        open={isDialogOpen && isBatchAddOpen}
        disabled={!canManageTasks}
        onClose={() => setIsBatchAddOpen(false)}
        onAdd={handleBatchAdd}
      />
      <TodayMoveSubtaskDialog
        open={isDialogOpen && movingItem !== null}
        sourceTaskId={movingItem?.task.id ?? null}
        subtaskTitle={movingItem?.subtask.title ?? ''}
        tasks={tasks}
        disabled={!canManageTasks}
        onClose={() => setMovingItem(null)}
        onMove={async (targetTaskId) => {
          if (!movingItem) return;
          await onMoveSubtask(movingItem.subtask.id, targetTaskId);
          setMovingItem(null);
        }}
      />
      <Snackbar
        open={pendingDeletion !== null}
        autoHideDuration={PENDING_DELETE_DURATION_MS}
        message="Subtask will be deleted in 5 seconds."
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
        action={
          <Button color="inherit" size="small" onClick={undoDeleteSubtask} sx={{ fontWeight: 800 }}>
            Undo
          </Button>
        }
      />
    </>
  );
}
