import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TodayMoveSubtaskDialog from '@/components/TodayMoveSubtaskDialog';
import { makeTask } from '@/test/taskFactory';

describe('TodayMoveSubtaskDialog', () => {
  it('opens tag and status menus above the nested Move dialog and applies both filters', async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: 'source', title: '(Untitle Tasks)' }),
      makeTask({ id: 'alm-todo', title: 'ALM todo', tags: ['ALM'], status: 'TO DO' }),
      makeTask({ id: 'alm-progress', title: 'ALM progress', tags: ['ALM'], status: 'IN PROGRESS' }),
      makeTask({ id: 'fraud-progress', title: 'Fraud progress', tags: ['Fraud'], status: 'IN PROGRESS' }),
    ];

    render(
      <TodayMoveSubtaskDialog
        open
        sourceTaskId="source"
        subtaskTitle="Move me"
        tasks={tasks}
        onClose={vi.fn()}
        onMove={vi.fn()}
      />
    );

    const dialogRoot = screen.getByRole('dialog').closest('.MuiModal-root');
    await user.click(screen.getByRole('combobox', { name: 'Tag' }));
    const tagMenuRoot = screen.getByRole('listbox').closest('.MuiPopover-root');
    expect(Number(window.getComputedStyle(tagMenuRoot!).zIndex)).toBeGreaterThan(
      Number(window.getComputedStyle(dialogRoot!).zIndex)
    );
    await user.click(screen.getByRole('option', { name: 'ALM' }));

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'IN PROGRESS' }));

    expect(screen.getByText('ALM progress')).toBeInTheDocument();
    expect(screen.queryByText('ALM todo')).not.toBeInTheDocument();
    expect(screen.queryByText('Fraud progress')).not.toBeInTheDocument();
  });
});
