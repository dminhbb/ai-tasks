export type TaskStatus = 'URGENT' | 'IN PROGRESS' | 'TO DO' | 'PENDING' | 'CANCELLED' | 'DONE';
export type SubtaskStatus = 'TO DO' | 'IN PROGRESS' | 'DONE';
export type AppRole = 'superadmin' | 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role: AppRole;
  isActive: boolean;
}

export type SpaceMemberRole = 'admin' | 'user';

export interface Space {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  isAdmin: boolean;
}

export interface SpaceMember {
  userId: string;
  email: string;
  nickname: string;
  role: SpaceMemberRole;
}

export interface ManagedUser {
  id: string;
  email: string;
  nickname: string;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
  canManage: boolean;
}

export interface NotebookPermissions {
  manageTasks: boolean;
  manageNotebook: boolean;
  manageSettings: boolean;
}
export type AssistantIntent =
  | 'TASKS_BY_TAG'
  | 'DUE_WITHIN_DAYS'
  | 'STATUS_TASKS'
  | 'AVERAGE_COMPLETION_TIME'
  | 'COMPLETED_IN_PERIOD'
  | 'UNFINISHED_BY_TAG'
  | 'OVERDUE_TASKS'
  | 'SEARCH_TASKS'
  | 'UNKNOWN';

export interface Subtask {
  id: string;
  title: string;
  status: SubtaskStatus;
  completed: boolean;
  isToday: boolean;
  completedAt: string | null;
  workHours: number;
  sortOrder?: number;
}

export interface Task {
  id: string;
  createdAt: string; // ISO String
  inProgressAt: string | null; // ISO String or empty
  doneAt: string | null; // ISO String or empty
  title: string;
  details: string; // HTML string or plain text
  assignee: string;
  tags: string[]; // Stored as comma-separated string in CSV
  status: TaskStatus;
  progress: number;
  sortOrder?: number;
  startDate: string | null; // ISO String or empty
  dueDate: string | null; // ISO String or empty
  dueDateChangeCount?: number;
  notes: string;
  subtasks: Subtask[];
}

export interface Notebook {
  id: string;
  spaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  ownerId: string;
  permissions: NotebookPermissions;
}

export interface Settings {
  tags: string[];
  assistantIntents: AssistantConfiguredIntent[];
}

export interface AssistantConfiguredIntent {
  id: string;
  label: string;
  question: string;
  intent: AssistantIntent;
  enabled: boolean;
  tag?: string;
  days?: number;
  status?: TaskStatus;
  query?: string;
  period?: 'week' | 'month' | 'all';
}

export type RecurrenceType = 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
export type RecurrentOccurrenceStatus = SubtaskStatus;

export interface RecurrentOccurrenceState {
  recurrentSubtaskId: string;
  occurrenceDate: string;
  status: RecurrentOccurrenceStatus;
  workHours: number;
}

export interface RecurrentSubtask {
  id: string;
  title: string;
  assignee: string;
  tags: string[];
  notes: string;
  recurrence: RecurrenceType;
  anchorDate: string;
  weekdays: number[];
  sortOrder: number;
}

export interface RecurrentTask {
  id: string;
  title: string;
  assignee: string;
  tags: string[];
  notes: string;
  sortOrder: number;
  subtasks: RecurrentSubtask[];
}
