import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TodayBatchAddDialog from '@/components/TodayBatchAddDialog';

describe('TodayBatchAddDialog', () => {
  it('parses multiple lines and returns them through the Add action', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<TodayBatchAddDialog open disabled={false} onClose={vi.fn()} onAdd={onAdd} />);

    await user.type(screen.getByPlaceholderText(/Prepare weekly report/i), 'First task\n\nSecond task');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith(['First task', 'Second task']);
  });
});
