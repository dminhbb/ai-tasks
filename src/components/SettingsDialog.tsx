'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type {
  AppRole,
  AssistantConfiguredIntent,
  AssistantIntent,
  ManagedUser,
  Notebook,
  Settings,
  Space,
  SpaceMember,
  TaskStatus,
  UserProfile,
} from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { APP_THEME_OPTIONS, useThemeContext } from '@/components/ThemeProvider';
import {
  listSpaceMembers,
  readNotebookUserIds,
  removeSpace,
  saveSpace,
  setSpaceUsers,
  setNotebookUsers,
} from '@/lib/supabase/data';
import {
  deactivateManagedUser,
  listManagedUsers,
  permanentlyDeleteManagedUser,
  saveManagedUser,
} from '@/lib/supabase/functions';

type SettingsSection = 'appearance' | 'tags' | 'assistant' | 'notebookAccess' | 'users' | 'spaces';

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  profile: UserProfile;
  activeSpace: Space;
  spaces: Space[];
  notebooks: Notebook[];
  onClose: () => void;
  onSave: (settings: Settings) => void | Promise<void>;
  onSpacesChanged: () => void | Promise<void>;
}

const ASSISTANT_INTENTS: AssistantIntent[] = [
  'TASKS_BY_TAG',
  'DUE_WITHIN_DAYS',
  'STATUS_TASKS',
  'AVERAGE_COMPLETION_TIME',
  'COMPLETED_IN_PERIOD',
  'UNFINISHED_BY_TAG',
  'OVERDUE_TASKS',
  'SEARCH_TASKS',
];
const TASK_STATUSES: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'];
const PERIODS: NonNullable<AssistantConfiguredIntent['period']>[] = ['week', 'month', 'all'];
const APP_ROLES: AppRole[] = ['superadmin', 'admin', 'user'];

function createBlankIntent(): AssistantConfiguredIntent {
  return {
    id: `assistant-intent-${crypto.randomUUID()}`,
    label: '',
    question: '',
    intent: 'SEARCH_TASKS',
    enabled: true,
  };
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '18px', fontWeight: 800, color: NEO_MINT.textTitle }}>{title}</Typography>
      <Typography sx={{ mt: 0.4, fontSize: '12px', color: NEO_MINT.textMuted }}>{description}</Typography>
    </Box>
  );
}

function AppearancePanel() {
  const { themeName, setThemeName } = useThemeContext();
  return (
    <Box>
      <SectionTitle title="Appearance" description="Choose a theme for this browser." />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.25 }}>
        {APP_THEME_OPTIONS.map((option) => {
          const selected = option.id === themeName;
          return (
            <ButtonBase
              key={option.id}
              onClick={() => setThemeName(option.id)}
              aria-pressed={selected}
              sx={{
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 1,
                textAlign: 'left',
                borderRadius: '12px',
                border: `2px solid ${selected ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                backgroundColor: selected ? 'var(--primary-subtle)' : 'var(--surface-soft)',
              }}
            >
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {option.swatches.map((color) => (
                  <Box
                    key={color}
                    component="span"
                    sx={{ width: 26, height: 26, borderRadius: '7px', backgroundColor: color }}
                  />
                ))}
              </Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 800 }}>{option.label}</Typography>
              <Typography sx={{ fontSize: '11px', color: NEO_MINT.textMuted }}>
                {option.description}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

function TagPanel({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const [newTag, setNewTag] = useState('');
  const addTag = () => {
    const tag = newTag.trim().replace(/\s+/g, ' ').slice(0, 100);
    if (!tag || settings.tags.some((current) => current.toLocaleLowerCase() === tag.toLocaleLowerCase()))
      return;
    onChange({ ...settings, tags: [...settings.tags, tag] });
    setNewTag('');
  };
  return (
    <Box>
      <SectionTitle title="Tag management" description="Tags are shared by every notebook in this space." />
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="New tag"
          value={newTag}
          onChange={(event) => setNewTag(event.target.value.slice(0, 100))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTag();
            }
          }}
        />
        <Button variant="contained" onClick={addTag} disabled={!newTag.trim()}>
          Add
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {settings.tags.map((tag) => (
          <Button
            key={tag}
            variant="outlined"
            onClick={() => onChange({ ...settings, tags: settings.tags.filter((item) => item !== tag) })}
            sx={{ textTransform: 'none' }}
          >
            {tag} ×
          </Button>
        ))}
      </Box>
    </Box>
  );
}

function AssistantPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const [draft, setDraft] = useState<AssistantConfiguredIntent>(() => createBlankIntent());
  const [editingId, setEditingId] = useState<string | null>(null);
  const saveIntent = () => {
    const question = draft.question.trim().slice(0, 255);
    if (!question) return;
    const next = { ...draft, label: draft.label.trim().slice(0, 80) || question.slice(0, 80), question };
    const intents = editingId
      ? settings.assistantIntents.map((intent) => (intent.id === editingId ? next : intent))
      : [...settings.assistantIntents, next];
    onChange({ ...settings, assistantIntents: intents });
    setEditingId(null);
    setDraft(createBlankIntent());
  };

  return (
    <Box>
      <SectionTitle
        title="Assistant Advanced"
        description="Configure quick-question presets for AI Search."
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
        <TextField
          size="small"
          label="Label"
          value={draft.label}
          onChange={(event) => setDraft({ ...draft, label: event.target.value.slice(0, 80) })}
        />
        <FormControl size="small">
          <InputLabel>Intent</InputLabel>
          <Select
            label="Intent"
            value={draft.intent}
            onChange={(event) => setDraft({ ...draft, intent: event.target.value as AssistantIntent })}
          >
            {ASSISTANT_INTENTS.map((intent) => (
              <MenuItem key={intent} value={intent}>
                {intent}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Suggestion question"
          value={draft.question}
          onChange={(event) => setDraft({ ...draft, question: event.target.value.slice(0, 255) })}
          sx={{ gridColumn: { md: '1 / -1' } }}
        />
        <TextField
          size="small"
          label="Tag"
          value={draft.tag ?? ''}
          onChange={(event) => setDraft({ ...draft, tag: event.target.value.slice(0, 100) || undefined })}
        />
        <TextField
          size="small"
          type="number"
          label="Days"
          value={draft.days ?? ''}
          onChange={(event) =>
            setDraft({ ...draft, days: event.target.value ? Number(event.target.value) : undefined })
          }
        />
        <FormControl size="small">
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={draft.status ?? ''}
            onChange={(event) =>
              setDraft({
                ...draft,
                status: event.target.value ? (event.target.value as TaskStatus) : undefined,
              })
            }
          >
            <MenuItem value="">None</MenuItem>
            {TASK_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Period</InputLabel>
          <Select
            label="Period"
            value={draft.period ?? ''}
            onChange={(event) =>
              setDraft({
                ...draft,
                period: event.target.value
                  ? (event.target.value as AssistantConfiguredIntent['period'])
                  : undefined,
              })
            }
          >
            <MenuItem value="">None</MenuItem>
            {PERIODS.map((period) => (
              <MenuItem key={period} value={period}>
                {period}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Search query override"
          value={draft.query ?? ''}
          onChange={(event) => setDraft({ ...draft, query: event.target.value.slice(0, 255) || undefined })}
          sx={{ gridColumn: { md: '1 / -1' } }}
        />
      </Box>
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
          <Checkbox
            size="small"
            checked={draft.enabled}
            onChange={() => setDraft({ ...draft, enabled: !draft.enabled })}
          />
          Enabled
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {editingId && (
            <Button
              onClick={() => {
                setEditingId(null);
                setDraft(createBlankIntent());
              }}
            >
              Cancel edit
            </Button>
          )}
          <Button variant="contained" onClick={saveIntent} disabled={!draft.question.trim()}>
            {editingId ? 'Update Intent' : 'Add Intent'}
          </Button>
        </Box>
      </Box>
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {settings.assistantIntents.map((intent) => (
          <Box
            key={intent.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              border: `1px solid ${NEO_MINT.cardBorderSoft}`,
            }}
          >
            <Checkbox
              size="small"
              checked={intent.enabled}
              onChange={() =>
                onChange({
                  ...settings,
                  assistantIntents: settings.assistantIntents.map((item) =>
                    item.id === intent.id ? { ...item, enabled: !item.enabled } : item
                  ),
                })
              }
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 800 }}>{intent.label}</Typography>
              <Typography sx={{ fontSize: '11px', color: NEO_MINT.textMuted }}>{intent.question}</Typography>
            </Box>
            <Button
              onClick={() => {
                setEditingId(intent.id);
                setDraft({ ...intent });
              }}
            >
              Edit
            </Button>
            <Button
              color="error"
              onClick={() =>
                onChange({
                  ...settings,
                  assistantIntents: settings.assistantIntents.filter((item) => item.id !== intent.id),
                })
              }
            >
              Delete
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function NotebookAccessPanel({ space, notebooks }: { space: Space; notebooks: Notebook[] }) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [accessByNotebook, setAccessByNotebook] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      listSpaceMembers(space.id),
      Promise.all(
        notebooks.map(async (notebook) => [notebook.id, await readNotebookUserIds(notebook.id)] as const)
      ),
    ]).then(([nextMembers, accessEntries]) => {
      if (!active) return;
      setMembers(nextMembers.filter((member) => member.role === 'user'));
      setAccessByNotebook(Object.fromEntries(accessEntries));
    });
    return () => {
      active = false;
    };
  }, [notebooks, space.id]);

  const saveAccess = async (notebookId: string) => {
    setMessage('');
    await setNotebookUsers(notebookId, accessByNotebook[notebookId] ?? []);
    setMessage('Notebook access saved.');
  };

  return (
    <Box>
      <SectionTitle
        title="Notebook access"
        description="Space admins see every notebook. Select which notebooks each regular user can access."
      />
      {message && <Typography sx={{ mb: 1, color: NEO_MINT.success }}>{message}</Typography>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {notebooks.map((notebook) => (
          <Box
            key={notebook.id}
            sx={{ p: 1.25, border: `1px solid ${NEO_MINT.cardBorderSoft}`, borderRadius: 2 }}
          >
            <Typography sx={{ mb: 1, fontWeight: 800 }}>{notebook.name}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {members.map((member) => {
                const checked = (accessByNotebook[notebook.id] ?? []).includes(member.userId);
                return (
                  <Box component="label" key={member.userId} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      size="small"
                      checked={checked}
                      onChange={() =>
                        setAccessByNotebook((current) => ({
                          ...current,
                          [notebook.id]: checked
                            ? (current[notebook.id] ?? []).filter((id) => id !== member.userId)
                            : [...(current[notebook.id] ?? []), member.userId],
                        }))
                      }
                    />
                    <Typography sx={{ fontSize: '12px' }}>{member.nickname || member.email}</Typography>
                  </Box>
                );
              })}
            </Box>
            <Button sx={{ mt: 1 }} variant="outlined" onClick={() => void saveAccess(notebook.id)}>
              Save access
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

interface UserDraft {
  id?: string;
  email: string;
  password: string;
  nickname: string;
  role: AppRole;
  isActive: boolean;
}

const EMPTY_USER: UserDraft = {
  email: '',
  password: '',
  nickname: '',
  role: 'user',
  isActive: true,
};

function UserManagementPanel({
  currentUserId,
  profileRole,
  spaceId,
}: {
  currentUserId: string;
  profileRole: AppRole;
  spaceId: string;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [draft, setDraft] = useState<UserDraft>(EMPTY_USER);
  const [error, setError] = useState('');
  const isSuperadmin = profileRole === 'superadmin';
  const scopedSpaceId = isSuperadmin ? undefined : spaceId;

  const reload = async () => setUsers(await listManagedUsers(scopedSpaceId));
  useEffect(() => {
    void listManagedUsers(scopedSpaceId)
      .then(setUsers)
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : 'Unable to load users.');
      });
  }, [scopedSpaceId]);

  const submit = async () => {
    setError('');
    try {
      await saveManagedUser(isSuperadmin ? draft : { ...draft, role: 'user' }, scopedSpaceId);
      setDraft(EMPTY_USER);
      await reload();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to save user.');
    }
  };

  return (
    <Box>
      <SectionTitle
        title="User management"
        description={
          isSuperadmin
            ? 'Manage every account synchronized with Supabase Auth.'
            : 'Manage regular users for this Space. Peer admins are shown as read-only.'
        }
      />
      {error && (
        <Typography role="alert" sx={{ mb: 1, color: NEO_MINT.danger }}>
          {error}
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr 1fr' }, gap: 1 }}>
        <TextField
          size="small"
          label="Email"
          value={draft.email}
          onChange={(event) => setDraft({ ...draft, email: event.target.value.slice(0, 254) })}
        />
        <TextField
          size="small"
          label={draft.id ? 'New password (optional)' : 'Password'}
          type="password"
          value={draft.password}
          onChange={(event) => setDraft({ ...draft, password: event.target.value.slice(0, 128) })}
        />
        <TextField
          size="small"
          label="Nickname"
          value={draft.nickname}
          onChange={(event) => setDraft({ ...draft, nickname: event.target.value.slice(0, 100) })}
        />
        {isSuperadmin ? (
          <FormControl size="small">
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={draft.role}
              onChange={(event) => setDraft({ ...draft, role: event.target.value as AppRole })}
            >
              {APP_ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <TextField size="small" label="Role" value="user" disabled />
        )}
        <Box component="label" sx={{ display: 'flex', alignItems: 'center' }}>
          <Checkbox
            checked={draft.isActive}
            onChange={() => setDraft({ ...draft, isActive: !draft.isActive })}
          />
          Active
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => void submit()}
            disabled={!draft.email || (!draft.id && draft.password.length < 8)}
          >
            {draft.id ? 'Update user' : 'Add user'}
          </Button>
          {draft.id && <Button onClick={() => setDraft(EMPTY_USER)}>Cancel</Button>}
        </Box>
      </Box>
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {users.map((user) => {
          const canManageUser = user.canManage;
          return (
            <Box
              key={user.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                border: `1px solid ${NEO_MINT.cardBorderSoft}`,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 800 }}>
                  {user.nickname || user.email}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: NEO_MINT.textMuted }}>
                  {user.email} · {user.role} · {user.isActive ? 'active' : 'inactive'}
                </Typography>
              </Box>
              <Button
                disabled={!canManageUser}
                onClick={() =>
                  setDraft({
                    id: user.id,
                    email: user.email,
                    password: '',
                    nickname: user.nickname,
                    role: user.role,
                    isActive: user.isActive,
                  })
                }
              >
                Edit
              </Button>
              <Button
                disabled={!canManageUser || user.id === currentUserId || !user.isActive}
                color="warning"
                onClick={() =>
                  void deactivateManagedUser(user.id, scopedSpaceId)
                    .then(reload)
                    .catch((failure: unknown) =>
                      setError(failure instanceof Error ? failure.message : 'Unable to deactivate user.')
                    )
                }
              >
                Deactivate
              </Button>
              {isSuperadmin && (
                <Button
                  disabled={user.id === currentUserId}
                  color="error"
                  onClick={() => {
                    if (window.confirm(`Permanently delete ${user.email}? This cannot be undone.`)) {
                      void permanentlyDeleteManagedUser(user.id)
                        .then(reload)
                        .catch((failure: unknown) =>
                          setError(failure instanceof Error ? failure.message : 'Unable to delete user.')
                        );
                    }
                  }}
                >
                  Permanent delete
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function SpaceManagerPanel({
  spaces,
  isSuperadmin,
  onChanged,
}: {
  spaces: Space[];
  isSuperadmin: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(spaces[0]?.id ?? null);
  const selected = spaces.find((space) => space.id === selectedId) ?? null;
  const [name, setName] = useState(selected?.name ?? '');
  const [slug, setSlug] = useState(selected?.slug ?? '');
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [sharedLink, setSharedLink] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    if (!selectedId) return;
    void Promise.all([listSpaceMembers(selectedId), listManagedUsers(isSuperadmin ? undefined : selectedId)])
      .then(([members, managedUsers]) => {
        setUsers(managedUsers);
        setAdminIds(members.filter((member) => member.role === 'admin').map((member) => member.userId));
        setUserIds(members.filter((member) => member.role === 'user').map((member) => member.userId));
      })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : 'Unable to load Space members.');
      });
  }, [isSuperadmin, selectedId]);

  const selectSpace = (space: Space | null) => {
    setSelectedId(space?.id ?? null);
    setName(space?.name ?? '');
    setSlug(space?.slug ?? '');
    setAdminIds([]);
    setUserIds([]);
  };

  const submit = async () => {
    setError('');
    try {
      if (!isSuperadmin) {
        if (!selected) throw new Error('Select a Space first.');
        await setSpaceUsers(selected.id, userIds);
        await onChanged();
        return;
      }
      const id = await saveSpace({ id: selected?.id ?? null, name, slug, adminIds, userIds });
      await onChanged();
      setSelectedId(id);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to save space.');
    }
  };

  const deleteSelectedSpace = async () => {
    if (!selected) return;
    const firstConfirmation = window.confirm(
      `Delete space "${selected.name}" and all of its notebooks, tasks and logs?`
    );
    if (!firstConfirmation) return;

    const typedName = window.prompt(
      `This action cannot be undone. Type the exact space name "${selected.name}" to continue.`
    );
    if (typedName !== selected.name) {
      if (typedName !== null) setError('Space name confirmation did not match.');
      return;
    }

    setError('');
    try {
      await removeSpace(selected.id, selected.slug);
      setSelectedId(null);
      await onChanged();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to delete space.');
    }
  };

  const copySharedLink = async () => {
    try {
      await navigator.clipboard.writeText(sharedLink);
      setCopyMessage('Copied to clipboard.');
    } catch {
      setCopyMessage('Copy failed. Select and copy the link manually.');
    }
  };

  return (
    <Box>
      <SectionTitle
        title="Space manager"
        description="Create spaces, manage slugs, members and assigned admins."
      />
      {error && (
        <Typography role="alert" sx={{ mb: 1, color: NEO_MINT.danger }}>
          {error}
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {isSuperadmin && (
            <Button variant={!selected ? 'contained' : 'outlined'} onClick={() => selectSpace(null)}>
              + New space
            </Button>
          )}
          {spaces.map((space) => (
            <Button
              key={space.id}
              variant={selectedId === space.id ? 'contained' : 'text'}
              onClick={() => selectSpace(space)}
              sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
            >
              {space.name}
            </Button>
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            size="small"
            label="Space name"
            value={name}
            disabled={!isSuperadmin}
            onChange={(event) => setName(event.target.value.slice(0, 100))}
          />
          <TextField
            size="small"
            label="Slug"
            value={slug}
            disabled={!isSuperadmin}
            onChange={(event) =>
              setSlug(
                event.target.value
                  .toLocaleLowerCase()
                  .replace(/[^a-z0-9-]/g, '')
                  .slice(0, 80)
              )
            }
          />
          <FormControl size="small">
            <InputLabel>Space admins</InputLabel>
            <Select
              multiple
              label="Space admins"
              value={adminIds}
              disabled={!isSuperadmin}
              onChange={(event) => setAdminIds(event.target.value as string[])}
              renderValue={(ids) =>
                ids.map((id) => users.find((user) => user.id === id)?.email ?? id).join(', ')
              }
            >
              {users
                .filter((user) => user.isActive && user.role === 'admin')
                .map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Checkbox checked={adminIds.includes(user.id)} /> {user.nickname || user.email}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Space users</InputLabel>
            <Select
              multiple
              label="Space users"
              value={userIds}
              onChange={(event) => setUserIds(event.target.value as string[])}
              renderValue={(ids) =>
                ids.map((id) => users.find((user) => user.id === id)?.email ?? id).join(', ')
              }
            >
              {users
                .filter((user) => user.isActive && !adminIds.includes(user.id))
                .map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Checkbox checked={userIds.includes(user.id)} /> {user.nickname || user.email}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => void submit()}
              disabled={
                (!selected && !isSuperadmin) || !name.trim() || slug.length < 2 || adminIds.length === 0
              }
            >
              {isSuperadmin ? (selected ? 'Update space' : 'Create space') : 'Save users'}
            </Button>
            {selected && isSuperadmin && (
              <Button
                onClick={() => {
                  setCopyMessage('');
                  setSharedLink(`${window.location.origin}/s/${selected.slug}`);
                }}
              >
                Share link
              </Button>
            )}
            {selected && (
              <Button color="error" onClick={() => void deleteSelectedSpace()}>
                Delete space
              </Button>
            )}
          </Box>
        </Box>
      </Box>
      <Dialog open={Boolean(sharedLink)} onClose={() => setSharedLink('')} fullWidth maxWidth="sm">
        <DialogTitle>Space shared link</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            value={sharedLink}
            slotProps={{ input: { readOnly: true } }}
            onFocus={(event) => event.target.select()}
          />
          {copyMessage && (
            <Typography role="status" sx={{ mt: 1, fontSize: '12px', color: NEO_MINT.textMuted }}>
              {copyMessage}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void copySharedLink()}>Copy</Button>
          <Button onClick={() => setSharedLink('')}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function SettingsDialog({
  open,
  settings,
  profile,
  activeSpace,
  spaces,
  notebooks,
  onClose,
  onSave,
  onSpacesChanged,
}: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');

  const menuItems = useMemo(() => {
    const items: { id: SettingsSection; label: string }[] = [
      { id: 'appearance', label: 'Appearance' },
      { id: 'tags', label: 'Tag management' },
      { id: 'assistant', label: 'Assistant Advanced' },
    ];
    if (activeSpace.isAdmin) {
      items.push(
        { id: 'notebookAccess', label: 'Notebook access' },
        { id: 'users', label: 'User management' },
        { id: 'spaces', label: 'Space manager' }
      );
    }
    return items;
  }, [activeSpace.isAdmin]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      slotProps={{
        paper: {
          sx: {
            height: '86vh',
            maxHeight: 920,
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle
        sx={{ flexShrink: 0, fontWeight: 800, borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}` }}
      >
        System Settings · {activeSpace.name}
      </DialogTitle>
      <DialogContent sx={{ p: '0 !important', minHeight: 0, overflow: 'hidden', flex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '160px 1fr', md: '240px 1fr' },
            height: '100%',
            minHeight: 0,
          }}
        >
          <Box sx={{ p: 1.25, overflowY: 'auto', borderRight: `1px solid ${NEO_MINT.cardBorderSoft}` }}>
            {menuItems.map((item) => (
              <Button
                key={item.id}
                fullWidth
                onClick={() => setActiveSection(item.id)}
                variant={activeSection === item.id ? 'contained' : 'text'}
                sx={{ mb: 0.5, justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700 }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
          <Box sx={{ p: { xs: 1.5, md: 2.5 }, minWidth: 0, overflowY: 'auto' }}>
            {activeSection === 'appearance' && <AppearancePanel />}
            {activeSection === 'tags' && <TagPanel settings={localSettings} onChange={setLocalSettings} />}
            {activeSection === 'assistant' && (
              <AssistantPanel settings={localSettings} onChange={setLocalSettings} />
            )}
            {activeSection === 'notebookAccess' && (
              <NotebookAccessPanel space={activeSpace} notebooks={notebooks} />
            )}
            {activeSection === 'users' && (
              <UserManagementPanel
                currentUserId={profile.id}
                profileRole={profile.role}
                spaceId={activeSpace.id}
              />
            )}
            {activeSection === 'spaces' && (
              <SpaceManagerPanel
                spaces={profile.role === 'superadmin' ? spaces : spaces.filter((space) => space.isAdmin)}
                isSuperadmin={profile.role === 'superadmin'}
                onChanged={onSpacesChanged}
              />
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexShrink: 0, p: 2, borderTop: `1px solid ${NEO_MINT.cardBorderSoft}` }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
        <Button variant="contained" onClick={() => void onSave(localSettings)} sx={{ textTransform: 'none' }}>
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}
