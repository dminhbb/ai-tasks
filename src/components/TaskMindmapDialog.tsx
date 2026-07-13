'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Box,
  Checkbox,
  Dialog,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  Edit as EditIcon,
  FilterList as FilterListIcon,
  Person as PersonIcon,
  RestartAlt as RestartAltIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import type { Subtask, Task } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { getTaskProgress } from '@/utils/taskProgress';
import { STATUS_ORDER, compareSubtaskOrder, compareTaskListOrder, normalizeSubtaskSortOrders, reorderTasksWithinStatus } from '@/utils/taskOrdering';

const STORAGE_KEY = 'task-manager-mindmap-state';

const ROOT_X = 80;
const TAG_X = 360;
const TASK_X = 620;
const TAG_MODE_TASK_X = 360;
const TAG_MODE_SUBTASK_X = 820;
const SUBTASK_X = 1080;
const TOP_OFFSET = 96;
const RIGHT_PADDING = 220;
const BOTTOM_PADDING = 120;
const TAG_HEIGHT = 29;
const TASK_HEIGHT = 23;
const SUBTASK_HEIGHT = 22;
const TASK_GAP = 24;
const SUBTASK_GAP = 16;
const TAG_GAP = 40;
const MIN_NODE_WIDTH = 56;
const TAG_MAX_WIDTH = 200;
const TASK_MAX_WIDTH = 400;
const SUBTASK_MAX_WIDTH = 600;
const NODE_ACTION_ZONE_WIDTH = 48;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 1.14;
const MINDMAP_BADGE_SIZE = 26;

type MindmapViewMode = 'tag' | 'assignee' | 'status';
type MindmapNodeType = 'root' | 'tag' | 'task' | 'subtask';

type MindmapNode = {
  id: string;
  type: MindmapNodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  urgent?: boolean;
  completed?: boolean;
  childCount?: number;
  expandId?: string;
  task?: Task;
  subtask?: Subtask;
  parentTask?: Task;
  tag?: string;
};

type MindmapConnection = {
  id: string;
  from: MindmapNode;
  to: MindmapNode;
};

type PersistedMindmapState = {
  expandedTags: string[];
  expandedTaskIds: number[];
  filteredTags: string[];
  showAllTasks: boolean;
  viewMode: MindmapViewMode;
  pan: { x: number; y: number };
  zoom: number;
};

interface TaskMindmapDialogProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  availableTags: string[];
  notebookId: number;
  isTaskDetailsOpen: boolean;
  onRequestTaskDetails: (task: Task) => void;
  onSaveTasks: (tasks: Task[]) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNodeWidth(label: string, type: MindmapNodeType) {
  const maxWidth = type === 'root' || type === 'tag'
    ? TAG_MAX_WIDTH
    : type === 'task'
      ? TASK_MAX_WIDTH
      : SUBTASK_MAX_WIDTH;

  const actionSpace = type === 'task' || type === 'subtask' ? NODE_ACTION_ZONE_WIDTH : 0;
  return clamp(label.trim().length * 8 + 52 + actionSpace, MIN_NODE_WIDTH, maxWidth);
}

function normalizeAssignee(value: string) {
  return value.trim() || 'Unassigned';
}

function getVisibleSubtasks(task: Task, showAllTasks: boolean) {
  const subtasks = [...(task.subtasks || [])].sort(compareSubtaskOrder);
  return showAllTasks ? subtasks : subtasks.filter((subtask) => !subtask.completed);
}

function createPath(from: MindmapNode, to: MindmapNode) {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const controlOffset = Math.max(56, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
}

function storageKeyForNotebook(notebookId: number) {
  return `${STORAGE_KEY}:${notebookId || 'default'}`;
}

function readPersistedState(notebookId: number): PersistedMindmapState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKeyForNotebook(notebookId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedMindmapState>;
    return {
      expandedTags: Array.isArray(parsed.expandedTags) ? parsed.expandedTags.filter((tag): tag is string => typeof tag === 'string') : [],
      expandedTaskIds: Array.isArray(parsed.expandedTaskIds)
        ? parsed.expandedTaskIds.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
        : [],
      filteredTags: Array.isArray(parsed.filteredTags) ? parsed.filteredTags.filter((tag): tag is string => typeof tag === 'string') : [],
      showAllTasks: parsed.showAllTasks === true,
      viewMode: parsed.viewMode === 'assignee' || parsed.viewMode === 'status' ? parsed.viewMode : 'tag',
      pan: {
        x: typeof parsed.pan?.x === 'number' ? parsed.pan.x : 0,
        y: typeof parsed.pan?.y === 'number' ? parsed.pan.y : 0,
      },
      zoom: typeof parsed.zoom === 'number' ? clamp(parsed.zoom, MIN_ZOOM, MAX_ZOOM) : 1,
    };
  } catch {
    return null;
  }
}

function getInitialMindmapState(notebookId: number): PersistedMindmapState {
  return readPersistedState(notebookId) || getDefaultMindmapState();
}

function getDefaultMindmapState(): PersistedMindmapState {
  return {
    expandedTags: [],
    expandedTaskIds: [],
    filteredTags: [],
    showAllTasks: false,
    viewMode: 'tag',
    pan: { x: 24, y: 16 },
    zoom: 1,
  };
}

function makeTaskForTag(tag: string): Task {
  const now = new Date().toISOString();

  return {
    id: Date.now(),
    createdAt: now,
    inProgressAt: null,
    doneAt: null,
    title: 'New task',
    details: '',
    assignee: '',
    tags: [tag],
    status: 'TO DO',
    progress: 0,
    sortOrder: undefined,
    startDate: null,
    dueDate: null,
    dueDateChangeCount: 0,
    notes: '',
    subtasks: [],
  };
}

export default function TaskMindmapDialog({
  open,
  onClose,
  tasks,
  availableTags,
  notebookId,
  isTaskDetailsOpen,
  onRequestTaskDetails,
  onSaveTasks,
}: TaskMindmapDialogProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);

  const [mindmapState, setMindmapState] = useState<PersistedMindmapState>(() => getInitialMindmapState(notebookId));
  const [isPanning, setIsPanning] = useState(false);
  const [tagFilterAnchor, setTagFilterAnchor] = useState<HTMLElement | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  const [draggedSubtask, setDraggedSubtask] = useState<{ taskId: number; subtaskId: number } | null>(null);
  const [dragOverSubtask, setDragOverSubtask] = useState<{ taskId: number; subtaskId: number } | null>(null);
  const { expandedTags, expandedTaskIds, filteredTags, showAllTasks, viewMode, pan, zoom } = mindmapState;

  const setExpandedTags = (value: React.SetStateAction<string[]>) => {
    setMindmapState((current) => ({
      ...current,
      expandedTags: typeof value === 'function' ? value(current.expandedTags) : value,
    }));
  };

  const setExpandedTaskIds = (value: React.SetStateAction<number[]>) => {
    setMindmapState((current) => ({
      ...current,
      expandedTaskIds: typeof value === 'function' ? value(current.expandedTaskIds) : value,
    }));
  };

  const setFilteredTags = (value: React.SetStateAction<string[]>) => {
    setMindmapState((current) => ({
      ...current,
      filteredTags: typeof value === 'function' ? value(current.filteredTags) : value,
    }));
  };

  const setShowAllTasks = (value: React.SetStateAction<boolean>) => {
    setMindmapState((current) => ({
      ...current,
      showAllTasks: typeof value === 'function' ? value(current.showAllTasks) : value,
    }));
  };

  const setViewMode = (mode: MindmapViewMode) => {
    setMindmapState((current) => ({
      ...current,
      viewMode: current.viewMode === mode ? 'tag' : mode,
      expandedTags: [],
      expandedTaskIds: [],
    }));
  };

  const setPan = (value: React.SetStateAction<{ x: number; y: number }>) => {
    setMindmapState((current) => ({
      ...current,
      pan: typeof value === 'function' ? value(current.pan) : value,
    }));
  };

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    window.localStorage.setItem(storageKeyForNotebook(notebookId), JSON.stringify(mindmapState));
  }, [mindmapState, notebookId, open]);

  const allTagLabels = useMemo(() => {
    const tagMap = new Map<string, string>();
    for (const tag of availableTags) {
      const normalized = tag.trim();
      if (normalized) tagMap.set(normalized.toLocaleLowerCase(), normalized);
    }
    for (const task of tasks) {
      for (const tag of task.tags || []) {
        const normalized = tag.trim();
        if (normalized && !tagMap.has(normalized.toLocaleLowerCase())) {
          tagMap.set(normalized.toLocaleLowerCase(), normalized);
        }
      }
    }
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [availableTags, tasks]);

  const visibleTasks = useMemo(() => {
    if (showAllTasks) return tasks;
    return tasks.filter((task) => task.status !== 'CANCELLED' && task.status !== 'DONE');
  }, [showAllTasks, tasks]);

  const tagLabels = useMemo(() => {
    const visibleTaskCounts = new Map<string, number>();
    for (const task of visibleTasks) {
      for (const tag of task.tags || []) {
        visibleTaskCounts.set(tag, (visibleTaskCounts.get(tag) || 0) + 1);
      }
    }

    const selected = new Set(filteredTags);
    return allTagLabels.filter((tag) => {
      if ((visibleTaskCounts.get(tag) || 0) === 0) return false;
      return filteredTags.length === 0 || selected.has(tag);
    });
  }, [allTagLabels, filteredTags, visibleTasks]);

  const tagTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of allTagLabels) counts.set(tag, 0);
    for (const task of visibleTasks) {
      for (const tag of task.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return counts;
  }, [allTagLabels, visibleTasks]);

  const layout = useMemo(() => {
    const nodes: MindmapNode[] = [];
    const connections: MindmapConnection[] = [];
    const expandedTagSet = new Set(expandedTags);
    const expandedTaskSet = new Set(expandedTaskIds);
    let cursorY = TOP_OFFSET;

    const addTaskBranch = (
      branchTasks: Task[],
      x: { task: number; subtask: number },
      startY: number,
      connectionParent?: MindmapNode,
      connectionPrefix?: string
    ) => {
      let branchCursorY = startY;
      const taskNodes: MindmapNode[] = [];

      for (const task of [...branchTasks].sort(compareTaskListOrder)) {
        const subtasks = getVisibleSubtasks(task, showAllTasks);
        const isTaskExpanded = expandedTaskSet.has(task.id) && subtasks.length > 0;
        const groupHeight = isTaskExpanded
          ? Math.max(TASK_HEIGHT, subtasks.length * SUBTASK_HEIGHT + (subtasks.length - 1) * SUBTASK_GAP)
          : TASK_HEIGHT;

        const taskNode: MindmapNode = {
          id: `task:${connectionPrefix || 'branch'}:${task.id}`,
          type: 'task',
          label: task.title,
          x: x.task,
          y: branchCursorY + (groupHeight - TASK_HEIGHT) / 2,
          width: getNodeWidth(task.title, 'task'),
          height: TASK_HEIGHT,
          urgent: task.status === 'URGENT',
          childCount: subtasks.length,
          task,
        };
        nodes.push(taskNode);
        taskNodes.push(taskNode);
        if (connectionParent) {
          connections.push({ id: `${connectionPrefix}:${task.id}`, from: connectionParent, to: taskNode });
        }

        if (isTaskExpanded) {
          subtasks.forEach((subtask: Subtask, index: number) => {
            const subtaskNode: MindmapNode = {
              id: `subtask:${connectionPrefix || 'branch'}:${task.id}:${subtask.id}`,
              type: 'subtask',
              label: subtask.title,
              x: x.subtask,
              y: branchCursorY + index * (SUBTASK_HEIGHT + SUBTASK_GAP),
              width: getNodeWidth(subtask.title, 'subtask'),
              height: SUBTASK_HEIGHT,
              completed: subtask.completed,
              subtask,
              parentTask: task,
            };
            nodes.push(subtaskNode);
            connections.push({ id: `task-subtask:${connectionPrefix || 'branch'}:${task.id}:${subtask.id}`, from: taskNode, to: subtaskNode });
          });
        }

        branchCursorY += groupHeight + TASK_GAP;
      }

      return {
        endY: branchTasks.length > 0 ? branchCursorY - TASK_GAP : startY,
        taskNodes,
      };
    };

    if (viewMode === 'tag') {
      for (const tag of tagLabels) {
        const tagTasks = visibleTasks
          .filter((task) => (task.tags || []).includes(tag))
          .sort(compareTaskListOrder);
        const expandId = `tag:${tag}`;
        const isTagExpanded = expandedTagSet.has(expandId) || expandedTagSet.has(tag);
        const tagHasUrgent = tagTasks.some((task) => task.status === 'URGENT');
        const tagNode: MindmapNode = {
          id: expandId,
          type: 'tag',
          label: tag,
          x: ROOT_X,
          y: cursorY,
          width: getNodeWidth(tag, 'tag'),
          height: TAG_HEIGHT,
          urgent: tagHasUrgent,
          childCount: tagTasks.length,
          expandId,
          tag,
        };

        if (!isTagExpanded || tagTasks.length === 0) {
          nodes.push(tagNode);
          cursorY += TAG_HEIGHT + TAG_GAP;
          continue;
        }

        const blockStartY = cursorY;
        const { endY } = addTaskBranch(
          tagTasks,
          { task: TAG_MODE_TASK_X, subtask: TAG_MODE_SUBTASK_X },
          cursorY,
          tagNode,
          `tag-task:${tag}`
        );
        const blockEndY = endY;
        tagNode.y = blockStartY + (blockEndY - blockStartY - TAG_HEIGHT) / 2;
        nodes.push(tagNode);

        cursorY = blockEndY + TAG_GAP;
      }
    } else {
      const rootEntries = new Map<string, { label: string; tasks: Task[] }>();
      for (const task of visibleTasks) {
        const key = viewMode === 'assignee' ? normalizeAssignee(task.assignee || '') : task.status;
        const current = rootEntries.get(key) || { label: key, tasks: [] };
        current.tasks.push(task);
        rootEntries.set(key, current);
      }

      const sortedRootEntries = Array.from(rootEntries.entries()).sort(([aKey, a], [bKey, b]) => {
        if (viewMode === 'status') {
          return STATUS_ORDER[aKey as keyof typeof STATUS_ORDER] - STATUS_ORDER[bKey as keyof typeof STATUS_ORDER];
        }
        return a.label.localeCompare(b.label);
      });

      for (const [rootKey, root] of sortedRootEntries) {
        const selectedTags = new Set(filteredTags);
        const rootTags = allTagLabels
          .map((tag) => ({
            tag,
            tasks: root.tasks.filter((task) => (task.tags || []).includes(tag)),
          }))
          .filter((entry) => entry.tasks.length > 0 && (filteredTags.length === 0 || selectedTags.has(entry.tag)));

        if (rootTags.length === 0) continue;

        const expandId = `${viewMode}:${rootKey}`;
        const isRootExpanded = expandedTagSet.has(expandId);
        const rootHasUrgent = rootTags.some((entry) => entry.tasks.some((task) => task.status === 'URGENT'));
        const rootTaskCount = new Set(rootTags.flatMap((entry) => entry.tasks.map((task) => task.id))).size;
        const rootNode: MindmapNode = {
          id: expandId,
          type: 'root',
          label: root.label,
          x: ROOT_X,
          y: cursorY,
          width: getNodeWidth(root.label, 'root'),
          height: TAG_HEIGHT,
          urgent: rootHasUrgent,
          childCount: rootTaskCount,
          expandId,
        };

        if (!isRootExpanded) {
          nodes.push(rootNode);
          cursorY += TAG_HEIGHT + TAG_GAP;
          continue;
        }

        const rootBlockStartY = cursorY;
        const tagNodes: MindmapNode[] = [];

        for (const entry of rootTags) {
          const tagExpandId = `${viewMode}:${rootKey}:tag:${entry.tag}`;
          const isTagExpanded = expandedTagSet.has(tagExpandId);
          const tagHasUrgent = entry.tasks.some((task) => task.status === 'URGENT');
          const tagGroupHeight = isTagExpanded
            ? Math.max(TAG_HEIGHT, entry.tasks.reduce((total, task) => {
                const subtasks = getVisibleSubtasks(task, showAllTasks);
                const isTaskExpanded = expandedTaskSet.has(task.id) && subtasks.length > 0;
                const taskHeight = isTaskExpanded
                  ? Math.max(TASK_HEIGHT, subtasks.length * SUBTASK_HEIGHT + (subtasks.length - 1) * SUBTASK_GAP)
                  : TASK_HEIGHT;
                return total + taskHeight + TASK_GAP;
              }, -TASK_GAP))
            : TAG_HEIGHT;
          const tagNode: MindmapNode = {
            id: tagExpandId,
            type: 'tag',
            label: entry.tag,
            x: TAG_X,
            y: cursorY + (tagGroupHeight - TAG_HEIGHT) / 2,
            width: getNodeWidth(entry.tag, 'tag'),
            height: TAG_HEIGHT,
            urgent: tagHasUrgent,
            childCount: entry.tasks.length,
            expandId: tagExpandId,
            tag: entry.tag,
          };
          nodes.push(tagNode);
          tagNodes.push(tagNode);
          connections.push({ id: `root-tag:${rootKey}:${entry.tag}`, from: rootNode, to: tagNode });

          if (isTagExpanded) {
            addTaskBranch(
              entry.tasks,
              { task: TASK_X, subtask: SUBTASK_X },
              cursorY,
              tagNode,
              `tag-task:${rootKey}:${entry.tag}`
            );
          }

          cursorY += tagGroupHeight + TASK_GAP;
        }

        const rootBlockEndY = cursorY - TASK_GAP;
        rootNode.y = rootBlockStartY + (rootBlockEndY - rootBlockStartY - TAG_HEIGHT) / 2;
        nodes.push(rootNode);

        cursorY = rootBlockEndY + TAG_GAP;
      }
    }

    const maxX = Math.max(SUBTASK_X + SUBTASK_MAX_WIDTH, TASK_X + TASK_MAX_WIDTH, TAG_X + TAG_MAX_WIDTH);
    const maxY = Math.max(cursorY, TOP_OFFSET + 320);

    return {
      nodes,
      connections,
      width: maxX + RIGHT_PADDING,
      height: maxY + BOTTOM_PADDING,
      rootCount: viewMode === 'tag' ? tagLabels.length : nodes.filter((node) => node.type === 'root').length,
    };
  }, [allTagLabels, expandedTags, expandedTaskIds, filteredTags, showAllTasks, tagLabels, viewMode, visibleTasks]);

  const applyZoom = (nextZoom: number, originX?: number, originY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const screenX = originX ?? rect.left + rect.width / 2;
    const screenY = originY ?? rect.top + rect.height / 2;
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;

    setMindmapState((current) => {
      const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const worldX = (localX - current.pan.x) / current.zoom;
      const worldY = (localY - current.pan.y) / current.zoom;

      return {
        ...current,
        zoom: clampedZoom,
        pan: {
          x: localX - worldX * clampedZoom,
          y: localY - worldY * clampedZoom,
        },
      };
    });
  };

  const resetMindmap = () => {
    const nextState = getDefaultMindmapState();
    setMindmapState(nextState);
    setIsPanning(false);
    panStartRef.current = null;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKeyForNotebook(notebookId), JSON.stringify(nextState));
    }
  };

  const toggleTagFilter = (tag: string) => {
    setFilteredTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    applyZoom(zoom * factor, event.clientX, event.clientY);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('[data-mindmap-node="true"], [data-mindmap-control="true"]')) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panStart = panStartRef.current;
    if (!panStart || panStart.pointerId !== event.pointerId) return;

    setPan({
      x: panStart.panX + event.clientX - panStart.x,
      y: panStart.panY + event.clientY - panStart.y,
    });
  };

  const stopPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId === event.pointerId) {
      panStartRef.current = null;
      setIsPanning(false);
    }
  };

  const toggleExpandId = (expandId: string) => {
    setExpandedTags((current) =>
      current.includes(expandId) ? current.filter((item) => item !== expandId) : [...current, expandId]
    );
  };

  const toggleTask = (task: Task) => {
    if (getVisibleSubtasks(task, showAllTasks).length === 0) return;
    setExpandedTaskIds((current) =>
      current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id]
    );
  };

  const handleCreateTaskForTag = (event: React.MouseEvent, tag: string) => {
    event.stopPropagation();
    onRequestTaskDetails(makeTaskForTag(tag));
  };

  const handleOpenTaskDetails = (event: React.MouseEvent, task: Task) => {
    event.stopPropagation();
    onRequestTaskDetails(task);
  };

  const clearDragState = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDraggedSubtask(null);
    setDragOverSubtask(null);
  };

  const handleTaskDragStart = (event: DragEvent<HTMLElement>, task: Task) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-task-id', String(task.id));
    event.dataTransfer.setData('text/plain', String(task.id));
    setDraggedTaskId(task.id);
    setDraggedSubtask(null);
  };

  const handleTaskDragOver = (event: DragEvent<HTMLElement>, targetTask: Task) => {
    const sourceTask = draggedTaskId === null ? null : tasks.find((task) => task.id === draggedTaskId);
    if (!sourceTask || sourceTask.id === targetTask.id || sourceTask.status !== targetTask.status) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTaskId(targetTask.id);
  };

  const handleTaskDrop = (event: DragEvent<HTMLElement>, targetTask: Task) => {
    event.preventDefault();
    event.stopPropagation();

    const draggedId = Number(event.dataTransfer.getData('application/x-task-id') || draggedTaskId);
    const sourceTask = tasks.find((task) => task.id === draggedId);
    if (sourceTask && sourceTask.id !== targetTask.id && sourceTask.status === targetTask.status) {
      onSaveTasks(reorderTasksWithinStatus(tasks, sourceTask.id, targetTask.id));
    }

    clearDragState();
  };

  const handleSubtaskDragStart = (event: DragEvent<HTMLElement>, task: Task, subtask: Subtask) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-subtask', JSON.stringify({ taskId: task.id, subtaskId: subtask.id }));
    event.dataTransfer.setData('text/plain', String(subtask.id));
    setDraggedSubtask({ taskId: task.id, subtaskId: subtask.id });
    setDraggedTaskId(null);
  };

  const handleSubtaskDragOver = (event: DragEvent<HTMLElement>, targetTask: Task, targetSubtask: Subtask) => {
    if (!draggedSubtask || draggedSubtask.taskId !== targetTask.id || draggedSubtask.subtaskId === targetSubtask.id) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDragOverSubtask({ taskId: targetTask.id, subtaskId: targetSubtask.id });
  };

  const handleSubtaskDrop = (event: DragEvent<HTMLElement>, targetTask: Task, targetSubtask: Subtask) => {
    event.preventDefault();
    event.stopPropagation();

    let source = draggedSubtask;
    if (!source) {
      try {
        source = JSON.parse(event.dataTransfer.getData('application/x-subtask'));
      } catch {
        source = null;
      }
    }
    if (!source || source.taskId !== targetTask.id || source.subtaskId === targetSubtask.id) {
      clearDragState();
      return;
    }

    const orderedSubtasks = [...(targetTask.subtasks || [])].sort(compareSubtaskOrder);
    const sourceSubtask = orderedSubtasks.find((subtask) => subtask.id === source.subtaskId);
    if (!sourceSubtask) {
      clearDragState();
      return;
    }

    const reorderedSubtasks = orderedSubtasks.filter((subtask) => subtask.id !== sourceSubtask.id);
    const targetIndex = reorderedSubtasks.findIndex((subtask) => subtask.id === targetSubtask.id);
    if (targetIndex === -1) {
      clearDragState();
      return;
    }

    reorderedSubtasks.splice(targetIndex, 0, sourceSubtask);
    onSaveTasks(tasks.map((task) =>
      task.id === targetTask.id ? { ...task, subtasks: normalizeSubtaskSortOrders(reorderedSubtasks) } : task
    ));
    clearDragState();
  };

  const renderNode = (node: MindmapNode) => {
    const isTag = node.type === 'tag';
    const isRoot = node.type === 'root';
    const isTask = node.type === 'task';
    const isSubtask = node.type === 'subtask';
    const hasSubtasks = Boolean(node.task && getVisibleSubtasks(node.task, showAllTasks).length > 0);
    const progress = node.task ? getTaskProgress(node.task) : 0;
    const shouldShowChildCount = Boolean(node.childCount);
    const shouldShowProgress = isTask && progress > 0;
    const shouldShowTaskBadges = isTask && (shouldShowChildCount || shouldShowProgress);
    const isTaskDragOver = isTask && node.task?.id === dragOverTaskId;
    const isSubtaskDragOver = isSubtask && node.parentTask && node.subtask
      ? dragOverSubtask?.taskId === node.parentTask.id && dragOverSubtask.subtaskId === node.subtask.id
      : false;

    const backgroundColor = isRoot || isTag
      ? NEO_MINT.primary
      : isSubtask
        ? node.completed
          ? '#E5E7EB'
          : '#F9A826'
        : node.task?.status === 'TO DO'
          ? '#E5E7EB'
          : node.urgent
            ? NEO_MINT.dangerSoft
            : '#DBEAFE';
    const borderColor = (isRoot || isTag) && node.urgent
      ? NEO_MINT.danger
      : node.urgent
        ? NEO_MINT.danger
        : isRoot || isTag
          ? NEO_MINT.primaryHover
          : 'rgba(15, 23, 42, 0.10)';
    const borderWidth = node.urgent ? 3 : 1;
    const color = isRoot || isTag
      ? NEO_MINT.surface
      : isSubtask && node.completed
        ? NEO_MINT.textMuted
      : node.urgent
        ? NEO_MINT.danger
        : NEO_MINT.textTitle;

    return (
      <Box
        key={node.id}
        data-mindmap-node="true"
        title={node.label}
        onClick={() => {
          if (node.expandId) toggleExpandId(node.expandId);
          if (node.type === 'task' && node.task) toggleTask(node.task);
        }}
        onDragOver={(event) => {
          if (node.type === 'task' && node.task) handleTaskDragOver(event, node.task);
          if (node.type === 'subtask' && node.parentTask && node.subtask) handleSubtaskDragOver(event, node.parentTask, node.subtask);
        }}
        onDrop={(event) => {
          if (node.type === 'task' && node.task) handleTaskDrop(event, node.task);
          if (node.type === 'subtask' && node.parentTask && node.subtask) handleSubtaskDrop(event, node.parentTask, node.subtask);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          if (node.type === 'task') setDragOverTaskId(null);
          if (node.type === 'subtask') setDragOverSubtask(null);
        }}
        sx={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: isRoot || isTag ? '20px' : '10px',
          backgroundColor,
          border: `${isTaskDragOver || isSubtaskDragOver ? 2 : borderWidth}px solid ${isTaskDragOver || isSubtaskDragOver ? NEO_MINT.primary : borderColor}`,
          color,
          boxShadow: isTag ? '0 10px 22px rgba(15, 23, 42, 0.16)' : '0 8px 20px rgba(15, 23, 42, 0.10)',
          cursor: node.expandId || hasSubtasks ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease',
          '&:hover': {
            boxShadow: '0 12px 26px rgba(15, 23, 42, 0.18)',
            transform: 'translateY(-1px)',
          },
          '&:hover .mindmap-node-action': {
            opacity: 1,
            pointerEvents: 'auto',
          },
          '&:hover .mindmap-node-inline-actions': {
            opacity: 0.9,
          },
        }}
      >
        {(isTask || isSubtask) && (
          <Box
            className="mindmap-node-inline-actions"
            component="span"
            data-mindmap-control="true"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            sx={{
              position: 'absolute',
              left: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 3,
              width: NODE_ACTION_ZONE_WIDTH - 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 0.25,
              opacity: 0.46,
              transition: 'opacity 0.15s ease',
            }}
          >
            {(isTask && node.task) && (
              <Tooltip title="Drag to reorder within this status">
                <Box
                  component="span"
                  draggable
                  onDragStart={(event) => handleTaskDragStart(event, node.task!)}
                  onDragEnd={clearDragState}
                  sx={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    color: isSubtask ? NEO_MINT.textBody : NEO_MINT.textMuted,
                    cursor: 'grab',
                    '&:hover': {
                      color: NEO_MINT.primary,
                      backgroundColor: 'rgba(255, 255, 255, 0.64)',
                    },
                    '&:active': {
                      cursor: 'grabbing',
                    },
                  }}
                >
                  <DragIndicatorIcon sx={{ fontSize: 15 }} />
                </Box>
              </Tooltip>
            )}

            {(isSubtask && node.parentTask && node.subtask) && (
              <Tooltip title="Drag to reorder within this task">
                <Box
                  component="span"
                  draggable
                  onDragStart={(event) => handleSubtaskDragStart(event, node.parentTask!, node.subtask!)}
                  onDragEnd={clearDragState}
                  sx={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    color: NEO_MINT.textBody,
                    cursor: 'grab',
                    '&:hover': {
                      color: NEO_MINT.primary,
                      backgroundColor: 'rgba(255, 255, 255, 0.64)',
                    },
                    '&:active': {
                      cursor: 'grabbing',
                    },
                  }}
                >
                  <DragIndicatorIcon sx={{ fontSize: 15 }} />
                </Box>
              </Tooltip>
            )}

            {((isTask && node.task) || (isSubtask && node.parentTask)) && (
              <Tooltip title={isTask ? 'Open details' : 'Open task details'}>
                <Box
                  component="button"
                  type="button"
                  onClick={(event) => handleOpenTaskDetails(event, isTask ? node.task! : node.parentTask!)}
                  style={{
                    border: 'none',
                    padding: 0,
                    background: 'transparent',
                    font: 'inherit',
                  }}
                  sx={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    color: isSubtask ? NEO_MINT.textBody : NEO_MINT.textMuted,
                    cursor: 'pointer',
                    '&:hover': {
                      color: NEO_MINT.primary,
                      backgroundColor: 'rgba(255, 255, 255, 0.64)',
                    },
                  }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </Box>
              </Tooltip>
            )}
          </Box>
        )}

        <Typography
          sx={{
            minWidth: 0,
            width: '100%',
            pl: isTask || isSubtask ? `${NODE_ACTION_ZONE_WIDTH}px` : 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: isSubtask ? '12px' : '13px',
            fontWeight: isRoot || isTag ? 800 : 700,
            lineHeight: 1.2,
            textDecoration: node.completed ? 'line-through' : 'none',
          }}
        >
          {node.label}
        </Typography>

        {shouldShowTaskBadges && (
          <Box
            component="span"
            sx={{
              position: 'absolute',
              left: 'calc(100% + 8px)',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              pointerEvents: 'none',
            }}
          >
            {shouldShowProgress && (
              <Box
                component="span"
                title={`Progress ${progress}%`}
                sx={{
                  width: MINDMAP_BADGE_SIZE,
                  height: MINDMAP_BADGE_SIZE,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '999px',
                  backgroundColor: '#F1F5F9',
                  border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  color: progress >= 100 ? NEO_MINT.success : NEO_MINT.primary,
                  fontSize: '8px',
                  fontWeight: 900,
                  lineHeight: 1,
                  boxShadow: '0 4px 10px rgba(15, 23, 42, 0.16)',
                }}
              >
                {progress}%
              </Box>
            )}

            {shouldShowChildCount && (
              <Box
                component="span"
                title={`${node.childCount} subtasks`}
                sx={{
                  width: MINDMAP_BADGE_SIZE,
                  height: MINDMAP_BADGE_SIZE,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '999px',
                  backgroundColor: NEO_MINT.primary,
                  border: `1px solid ${NEO_MINT.surface}`,
                  color: NEO_MINT.surface,
                  fontSize: '10px',
                  fontWeight: 900,
                  lineHeight: 1,
                  boxShadow: '0 4px 10px rgba(15, 23, 42, 0.16)',
                }}
              >
                {node.childCount}
              </Box>
            )}
          </Box>
        )}

        {!isTask && Boolean(node.childCount) && (
          <Box
            component="span"
            sx={{
              position: 'absolute',
              right: -8,
              bottom: -8,
              width: MINDMAP_BADGE_SIZE,
              height: MINDMAP_BADGE_SIZE,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '999px',
              backgroundColor: isRoot || isTag ? NEO_MINT.surface : NEO_MINT.primary,
              border: `1px solid ${isRoot || isTag ? NEO_MINT.primaryHover : NEO_MINT.surface}`,
              color: isRoot || isTag ? NEO_MINT.primary : NEO_MINT.surface,
              fontSize: '10px',
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: '0 4px 10px rgba(15, 23, 42, 0.16)',
            }}
          >
            {node.childCount}
          </Box>
        )}

        {isTag && node.tag && (
          <Tooltip title="Add task">
            <IconButton
              className="mindmap-node-action"
              size="small"
              onClick={(event) => handleCreateTaskForTag(event, node.tag!)}
              onPointerDown={(event) => event.stopPropagation()}
              sx={{
                position: 'absolute',
                right: -12,
                top: -12,
                zIndex: 2,
                width: 24,
                height: 24,
                opacity: 0,
                pointerEvents: 'none',
                color: NEO_MINT.surface,
                backgroundColor: NEO_MINT.primary,
                border: `1px solid ${NEO_MINT.surface}`,
                transition: 'opacity 0.15s ease',
                '&:hover': { backgroundColor: NEO_MINT.primaryHover },
              }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

      </Box>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        disableEnforceFocus={isTaskDetailsOpen}
        disableAutoFocus={isTaskDetailsOpen}
        disableRestoreFocus={isTaskDetailsOpen}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: '#F8FAFC',
              color: NEO_MINT.textTitle,
            },
          },
        }}
      >
        <Box
          sx={{
            height: 64,
            px: { xs: 2, md: 3 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
            backgroundColor: NEO_MINT.surface,
            flexShrink: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.2 }}>
              Task mindmap
            </Typography>
            <Typography sx={{ fontSize: '12px', color: NEO_MINT.textMuted, fontWeight: 600 }}>
              {viewMode === 'tag' ? 'Tag' : viewMode === 'assignee' ? 'Assignee' : 'Status'} view - {layout.rootCount} roots - {visibleTasks.length}/{tasks.length} tasks
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={showAllTasks ? 'Hide Done, Cancelled, and completed subtasks' : 'Show all tasks'}>
              <IconButton
                onClick={() => setShowAllTasks((current) => !current)}
                sx={{
                  borderRadius: '8px',
                  color: showAllTasks ? NEO_MINT.primary : NEO_MINT.textTitle,
                  border: `1px solid ${showAllTasks ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                  backgroundColor: showAllTasks ? 'var(--primary-subtle)' : NEO_MINT.surfaceSoft,
                  '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
                }}
              >
                {showAllTasks ? <VisibilityIcon sx={{ fontSize: 22 }} /> : <VisibilityOffIcon sx={{ fontSize: 22 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title={viewMode === 'assignee' ? 'Back to Tag view' : 'View by assignee'}>
              <IconButton
                onClick={() => setViewMode('assignee')}
                sx={{
                  borderRadius: '8px',
                  color: viewMode === 'assignee' ? NEO_MINT.primary : NEO_MINT.textTitle,
                  border: `1px solid ${viewMode === 'assignee' ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                  backgroundColor: viewMode === 'assignee' ? 'var(--primary-subtle)' : NEO_MINT.surfaceSoft,
                  '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
                }}
              >
                <PersonIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={viewMode === 'status' ? 'Back to Tag view' : 'View by status'}>
              <IconButton
                onClick={() => setViewMode('status')}
                sx={{
                  borderRadius: '8px',
                  color: viewMode === 'status' ? NEO_MINT.primary : NEO_MINT.textTitle,
                  border: `1px solid ${viewMode === 'status' ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                  backgroundColor: viewMode === 'status' ? 'var(--primary-subtle)' : NEO_MINT.surfaceSoft,
                  '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
                }}
              >
                <AssignmentTurnedInIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Tag filter">
              <IconButton
                onClick={(event) => setTagFilterAnchor(event.currentTarget)}
                sx={{
                  position: 'relative',
                  borderRadius: '8px',
                  color: filteredTags.length > 0 ? NEO_MINT.primary : NEO_MINT.textTitle,
                  border: `1px solid ${filteredTags.length > 0 ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                  backgroundColor: filteredTags.length > 0 ? 'var(--primary-subtle)' : NEO_MINT.surfaceSoft,
                  '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
                }}
              >
                <FilterListIcon sx={{ fontSize: 22 }} />
                {filteredTags.length > 0 && (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      right: -6,
                      top: -6,
                      minWidth: 18,
                      height: 18,
                      px: 0.5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '999px',
                      backgroundColor: NEO_MINT.primary,
                      border: `1px solid ${NEO_MINT.surface}`,
                      color: NEO_MINT.surface,
                      fontSize: '10px',
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    {filteredTags.length}
                  </Box>
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset mindmap">
              <IconButton
                onClick={resetMindmap}
                sx={{
                  borderRadius: '8px',
                  color: NEO_MINT.textTitle,
                  border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  backgroundColor: NEO_MINT.surfaceSoft,
                  '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
                }}
              >
                <RestartAltIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close canvas">
              <IconButton
                onClick={onClose}
                sx={{
                  borderRadius: '8px',
                  color: NEO_MINT.textTitle,
                  border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  backgroundColor: NEO_MINT.surfaceSoft,
                  '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
                }}
              >
                <CloseIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Popover
          open={!!tagFilterAnchor}
          anchorEl={tagFilterAnchor}
          onClose={() => setTagFilterAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                width: 320,
                maxWidth: 'calc(100vw - 32px)',
                maxHeight: 'min(520px, calc(100vh - 96px))',
                mt: 1,
                borderRadius: '12px',
                border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                boxShadow: NEO_MINT.shadowSm,
                overflow: 'hidden',
              },
            },
          }}
        >
          <Box sx={{ p: 1.5, borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`, backgroundColor: NEO_MINT.surface }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 800, color: NEO_MINT.textTitle }}>
                  Tag filter
                </Typography>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: NEO_MINT.textMuted }}>
                  {filteredTags.length === 0 ? 'Showing all tags' : `${filteredTags.length} selected`}
                </Typography>
              </Box>
              <Box
                component="button"
                type="button"
                onClick={() => setFilteredTags([])}
                disabled={filteredTags.length === 0}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: filteredTags.length === 0 ? NEO_MINT.textMuted : NEO_MINT.primary,
                  cursor: filteredTags.length === 0 ? 'default' : 'pointer',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '6px 8px',
                }}
              >
                Show all
              </Box>
            </Box>
          </Box>

          <Box sx={{ maxHeight: 420, overflowY: 'auto', p: 1 }}>
            {allTagLabels.length === 0 ? (
              <Typography sx={{ p: 1.5, fontSize: '13px', color: NEO_MINT.textMuted, fontWeight: 600 }}>
                No tags available
              </Typography>
            ) : (
              allTagLabels.map((tag) => {
                const checked = filteredTags.includes(tag);
                const taskCount = tagTaskCounts.get(tag) || 0;

                return (
                  <Box
                    key={tag}
                    onClick={() => toggleTagFilter(tag)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      minHeight: 38,
                      px: 0.5,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'var(--primary-subtle)' },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={checked}
                      onChange={() => toggleTagFilter(tag)}
                      onClick={(event) => event.stopPropagation()}
                      sx={{
                        p: 0.5,
                        color: NEO_MINT.cardBorderSoft,
                        '&.Mui-checked': { color: NEO_MINT.primary },
                      }}
                    />
                    <Typography
                      title={tag}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: NEO_MINT.textTitle,
                      }}
                    >
                      {tag}
                    </Typography>
                    {taskCount > 0 && (
                      <Box
                        component="span"
                        sx={{
                          minWidth: 22,
                          height: 20,
                          px: 0.75,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '999px',
                          backgroundColor: NEO_MINT.surfaceMuted,
                          color: NEO_MINT.textBody,
                          fontSize: '11px',
                          fontWeight: 900,
                        }}
                      >
                        {taskCount}
                      </Box>
                    )}
                  </Box>
                );
              })
            )}
          </Box>
        </Popover>

        <Box
          ref={viewportRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPanning}
          onPointerCancel={stopPanning}
          sx={{
            position: 'relative',
            flex: 1,
            overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : 'grab',
            touchAction: 'none',
            backgroundColor: '#F8FAFC',
            backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.13) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {tagLabels.length === 0 ? (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: NEO_MINT.textMuted, fontSize: '14px', fontWeight: 600 }}>
                {allTagLabels.length === 0 ? 'No tags available' : 'No nodes match the current view'}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: layout.width,
                height: layout.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              <svg
                width={layout.width}
                height={layout.height}
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
              >
                {layout.connections.map((connection) => (
                  <path
                    key={connection.id}
                    d={createPath(connection.from, connection.to)}
                    fill="none"
                    stroke="rgba(15, 23, 42, 0.18)"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              {layout.nodes.map(renderNode)}
            </Box>
          )}

          <Box
            data-mindmap-control="true"
            onPointerDown={(event) => event.stopPropagation()}
            sx={{
              position: 'absolute',
              right: 24,
              bottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              py: 0.75,
              borderRadius: '12px',
              backgroundColor: NEO_MINT.surface,
              border: `1px solid ${NEO_MINT.cardBorderSoft}`,
              boxShadow: NEO_MINT.shadowSm,
            }}
          >
            <Tooltip title="Zoom out">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  applyZoom(zoom / ZOOM_STEP);
                }}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  color: NEO_MINT.textTitle,
                  '&:hover': { backgroundColor: NEO_MINT.surfaceMuted, color: NEO_MINT.primary },
                }}
              >
                <ZoomOutIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Typography sx={{ width: 44, textAlign: 'center', fontSize: '12px', fontWeight: 800, color: NEO_MINT.textBody }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <Tooltip title="Zoom in">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  applyZoom(zoom * ZOOM_STEP);
                }}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  color: NEO_MINT.textTitle,
                  '&:hover': { backgroundColor: NEO_MINT.surfaceMuted, color: NEO_MINT.primary },
                }}
              >
                <ZoomInIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Dialog>

    </>
  );
}
