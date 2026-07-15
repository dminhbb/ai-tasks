import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TaskDetailDialog from '@/components/TaskDetailDialog';
import { makeSubtask, makeTask } from '@/test/taskFactory';

vi.mock('@/components/TaskRichTextEditor', () => ({
  default: () => <div data-testid="rich-text-editor" />,
}));

describe('TaskDetailDialog', () => {
  it('opens the Move subtask dialog from a subtask row', async () => {
    const user = userEvent.setup();
    const source = makeTask({
      id: 'source-task',
      title: 'Source task',
      subtasks: [makeSubtask({ id: 'subtask-1', title: 'Move this work' })],
    });
    const target = makeTask({ id: 'target-task', title: 'Target task' });

    render(
      <TaskDetailDialog
        open
        task={source}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        availableTags={[]}
        availableAssignees={[]}
        availableTasks={[source, target]}
        onMoveSubtask={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Move subtask' }));
    expect(screen.getByRole('heading', { name: 'Move subtask' })).toBeInTheDocument();
    expect(screen.getByText('Target task')).toBeInTheDocument();
  });
});
