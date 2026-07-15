import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NotebookDialog from '@/components/NotebookDialog';
import type { Notebook, Space } from '@/types';

const activeSpace: Space = {
  id: 'space-main',
  name: 'Main Space',
  slug: 'main',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
  isAdmin: true,
};
const projectSpace: Space = {
  ...activeSpace,
  id: 'space-project',
  name: 'Project Space',
  slug: 'project',
  isAdmin: false,
};

function notebook(id: string, spaceId: string, name: string): Notebook {
  return {
    id,
    spaceId,
    name,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    lastAccessedAt: '2026-07-15T00:00:00.000Z',
    ownerId: 'owner-1',
    permissions: { manageTasks: true, manageNotebook: false, manageSettings: false },
  };
}

describe('NotebookDialog', () => {
  it('loads only the selected Space notebooks before opening one', async () => {
    const user = userEvent.setup();
    const mainNotebook = notebook('notebook-main', activeSpace.id, 'Main Notebook');
    const projectNotebook = notebook('notebook-project', projectSpace.id, 'Project Notebook');
    const onLoadNotebooks = vi.fn().mockResolvedValue([projectNotebook]);
    const onOpen = vi.fn();

    render(
      <NotebookDialog
        open
        spaces={[activeSpace, projectSpace]}
        activeSpace={activeSpace}
        notebooks={[mainNotebook]}
        activeNotebook={mainNotebook}
        onClose={vi.fn()}
        onLoadNotebooks={onLoadNotebooks}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onOpen={onOpen}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Select Project Space' }));
    expect(await screen.findByText('Project Notebook')).toBeInTheDocument();
    expect(screen.queryByText('Main Notebook')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open notebook Project Notebook' }));
    expect(onOpen).toHaveBeenCalledWith(projectSpace, projectNotebook.id);
  });
});
