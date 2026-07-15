import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SettingsDialog from '@/components/SettingsDialog';
import type { Space, UserProfile } from '@/types';

vi.mock('@/components/ThemeProvider', () => ({
  APP_THEME_OPTIONS: [
    { id: 'neo-mint', label: 'Neo Mint', description: 'Default', swatches: ['#fff', '#fff', '#fff'] },
  ],
  useThemeContext: () => ({ themeName: 'neo-mint', setThemeName: vi.fn() }),
}));

const profile: UserProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'owner@example.com',
  nickname: 'Owner',
  role: 'superadmin',
  isActive: true,
};

const space: Space = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Main Space',
  slug: 'main',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
  isAdmin: true,
};

describe('SettingsDialog', () => {
  it('shows the section navigation and keeps save actions available', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <SettingsDialog
        open
        settings={{ tags: ['ALM'], assistantIntents: [] }}
        profile={profile}
        activeSpace={space}
        spaces={[space]}
        notebooks={[]}
        onClose={vi.fn()}
        onSave={onSave}
        onSpacesChanged={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notebook access' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Space manager' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tag management' }));
    expect(screen.getByText('Tags are shared by every notebook in this space.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(onSave).toHaveBeenCalledWith({ tags: ['ALM'], assistantIntents: [] });
  });

  it('shows Space-scoped management sections to a Space admin', () => {
    render(
      <SettingsDialog
        open
        settings={{ tags: [], assistantIntents: [] }}
        profile={{ ...profile, role: 'admin' }}
        activeSpace={{ ...space, isAdmin: true }}
        spaces={[space, { ...space, id: '00000000-0000-4000-8000-000000000003', name: 'Other' }]}
        notebooks={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSpacesChanged={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'User management' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Space manager' })).toBeInTheDocument();
  });
});
