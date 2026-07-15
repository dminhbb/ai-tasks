'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { Close, Delete, DragIndicator, DriveFileMoveOutlined, PlaylistAdd } from '@mui/icons-material';
import type { Subtask, Task, UserProfile } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { compareSubtaskOrder } from '@/utils/taskOrdering';
import {
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
  const dialogItems = useMemo<TodaySubtaskItem[]>(
    () =>
      [...todayItems, ...suggestedItems].sort((left, right) =>
        compareSubtaskOrder(left.subtask, right.subtask)
      ),
    [suggestedItems, todayItems]
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

  const deleteSubtask = (item: TodaySubtaskItem) => {
    updateSubtask(item.task.id, item.subtask.id, () => null);
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
          {todayItems.length === 0 ? (
            <Typography sx={{ p: 2, fontSize: '12px', lineHeight: 1.6, color: NEO_MINT.textMuted }}>
              No subtasks selected for Today.
            </Typography>
          ) : (
            todayItems.map((item) => (
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
                {item.subtask.completed && (
                  <SubtaskWorkLogSelect
                    value={item.subtask.workHours}
                    disabled={!canManageTasks}
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
        maxWidth="md"
        disableEnforceFocus={isBatchAddOpen || movingItem !== null}
        disableAutoFocus={isBatchAddOpen || movingItem !== null}
        disableRestoreFocus={isBatchAddOpen || movingItem !== null}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '20px',
              border: `1px solid ${NEO_MINT.cardBorderSoft}`,
              boxShadow: NEO_MINT.shadowLg,
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
        <DialogContent
          dividers
          sx={{ p: 0, pb: 7.5, position: 'relative', borderColor: NEO_MINT.cardBorderSoft }}
        >
          {dialogItems.length === 0 ? (
            <Typography sx={{ p: 3, color: NEO_MINT.textMuted, textAlign: 'center' }}>
              No subtasks selected for Today.
            </Typography>
          ) : (
            dialogItems.map((item) => (
              <Box
                key={item.subtask.id}
                onDragOver={(event) => handleDragOver(event, item.subtask.id)}
                onDrop={(event) => handleDrop(event, item.subtask.id)}
                onDragLeave={() => setDragOverSubtaskId(null)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: { xs: 1, sm: 2 },
                  py: 1,
                  borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  backgroundColor: item.suggested ? NEO_MINT.surfaceMuted : NEO_MINT.surface,
                  outline: dragOverSubtaskId === item.subtask.id ? `2px solid ${NEO_MINT.primary}` : 'none',
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
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'flex-start',
                    gap: 0.75,
                    borderRadius: '6px',
                    textAlign: 'left',
                  }}
                >
                  <TruncatedText
                    sx={{
                      maxWidth: { xs: 110, sm: 220 },
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
                    width: { xs: 70, sm: 120 },
                    flexShrink: 0,
                    fontSize: '12px',
                    color: NEO_MINT.textBody,
                    textAlign: 'right',
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
                  />
                </Tooltip>
                {item.subtask.completed && (
                  <SubtaskWorkLogSelect
                    value={item.subtask.workHours}
                    disabled={!canManageTasks}
                    onChange={(workHours) => updateWorkHours(item, workHours)}
                  />
                )}
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
            ))
          )}
          <Box
            sx={{
              position: 'absolute',
              right: 16,
              bottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.25,
              borderRadius: '999px',
              border: `1px solid ${NEO_MINT.cardBorderSoft}`,
              backgroundColor: NEO_MINT.surface,
              boxShadow: NEO_MINT.shadowSm,
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
        </DialogContent>
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
    </>
  );
}
