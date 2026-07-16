import { addDays, differenceInCalendarWeeks, format, isSameDay, startOfWeek } from 'date-fns';
import type { RecurrentSubtask } from '@/types';

export const RECURRENCE_LABELS: Record<RecurrentSubtask['recurrence'], string> = {
  weekly: 'Weekly',
  'bi-weekly': 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  yearly: 'Yearly',
};

const WEEK_START_OPTIONS = { weekStartsOn: 1 as const };

export function getThreeWeekDays(referenceDate: Date): Date[] {
  const firstDay = startOfWeek(referenceDate, WEEK_START_OPTIONS);
  return Array.from({ length: 21 }, (_, index) => addDays(firstDay, index));
}

function toLocalDate(dateValue: string): Date {
  return new Date(`${dateValue}T00:00:00`);
}

function isMonthlyOccurrence(anchor: Date, date: Date, intervalMonths: number): boolean {
  const monthsApart = (date.getFullYear() - anchor.getFullYear()) * 12 + date.getMonth() - anchor.getMonth();
  if (monthsApart < 0 || monthsApart % intervalMonths !== 0) return false;
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(anchor.getDate(), lastDay);
}

export function occursOnDate(subtask: RecurrentSubtask, date: Date): boolean {
  const anchor = toLocalDate(subtask.anchorDate);
  if (Number.isNaN(anchor.getTime()) || date < anchor) return false;

  if (subtask.recurrence === 'weekly' || subtask.recurrence === 'bi-weekly') {
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    if (!subtask.weekdays.includes(weekday)) return false;
    if (subtask.recurrence === 'weekly') return true;
    return (
      differenceInCalendarWeeks(
        startOfWeek(date, WEEK_START_OPTIONS),
        startOfWeek(anchor, WEEK_START_OPTIONS),
        WEEK_START_OPTIONS
      ) %
        2 ===
      0
    );
  }
  if (subtask.recurrence === 'monthly') return isMonthlyOccurrence(anchor, date, 1);
  if (subtask.recurrence === 'quarterly') return isMonthlyOccurrence(anchor, date, 3);
  if (subtask.recurrence === 'half-yearly') return isMonthlyOccurrence(anchor, date, 6);
  return isMonthlyOccurrence(anchor, date, 12);
}

export function formatScheduleDate(date: Date): string {
  return format(date, 'EEE d');
}

export function isTodayScheduleDate(date: Date): boolean {
  return isSameDay(date, new Date());
}
