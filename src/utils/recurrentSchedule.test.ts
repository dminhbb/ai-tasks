import { describe, expect, it } from 'vitest';
import type { RecurrentSubtask } from '@/types';
import { occursOnDate } from '@/utils/recurrentSchedule';

const baseSubtask: RecurrentSubtask = {
  id: 'subtask',
  title: 'Review',
  assignee: '',
  tags: [],
  notes: '',
  recurrence: 'weekly',
  anchorDate: '2026-07-13',
  weekdays: [1, 3],
  sortOrder: 0,
};

describe('recurrent schedule', () => {
  it('supports multiple weekly weekdays', () => {
    expect(occursOnDate(baseSubtask, new Date('2026-07-13T00:00:00'))).toBe(true);
    expect(occursOnDate(baseSubtask, new Date('2026-07-15T00:00:00'))).toBe(true);
    expect(occursOnDate(baseSubtask, new Date('2026-07-14T00:00:00'))).toBe(false);
  });

  it('uses the anchor week for bi-weekly recurrences', () => {
    const subtask = { ...baseSubtask, recurrence: 'bi-weekly' as const, weekdays: [1] };
    expect(occursOnDate(subtask, new Date('2026-07-13T00:00:00'))).toBe(true);
    expect(occursOnDate(subtask, new Date('2026-07-20T00:00:00'))).toBe(false);
    expect(occursOnDate(subtask, new Date('2026-07-27T00:00:00'))).toBe(true);
  });

  it('clamps a monthly day to the last day of shorter months', () => {
    const subtask = {
      ...baseSubtask,
      recurrence: 'monthly' as const,
      anchorDate: '2026-01-31',
      weekdays: [],
    };
    expect(occursOnDate(subtask, new Date('2026-02-28T00:00:00'))).toBe(true);
  });
});
