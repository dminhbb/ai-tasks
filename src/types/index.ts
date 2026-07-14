export type TaskStatus = 'URGENT' | 'IN PROGRESS' | 'TO DO' | 'PENDING' | 'CANCELLED' | 'DONE';
export type AppRole = 'superadmin' | 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  role: AppRole;
  isActive: boolean;
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
  completed: boolean;
  isToday: boolean;
  completedAt: string | null;
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
