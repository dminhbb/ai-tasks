import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SpaceSelectionScreen from '@/components/SpaceSelectionScreen';
import type { Space } from '@/types';

const spaces: Space[] = [
  {
    id: 'space-1',
    name: 'Main Space',
    slug: 'main',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    isAdmin: true,
  },
  {
    id: 'space-2',
    name: 'Project Space',
    slug: 'project',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    isAdmin: false,
  },
];

describe('SpaceSelectionScreen', () => {
  it('renders accessible Spaces as square choices and selects one', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SpaceSelectionScreen spaces={spaces} onSelect={onSelect} onSignOut={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Open Project Space' }));
    expect(onSelect).toHaveBeenCalledWith(spaces[1]);
  });
});
