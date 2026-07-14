'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { 
  Box, AppBar, Toolbar, Typography, IconButton, Button, 
  Drawer, CircularProgress
} from '@mui/material';
import { Settings as SettingsIcon, Add as AddIcon, Menu as MenuIcon, Close as CloseIcon, AccountTree as AccountTreeIcon, Logout as LogoutIcon } from '@mui/icons-material';
import TaskList from '@/components/TaskList';
import FilterPanel, { type FilterState } from '@/components/FilterPanel';
import AddTaskDialog from '@/components/AddTaskDialog';
import SettingsDialog from '@/components/SettingsDialog';
import TaskDetailDialog from '@/components/TaskDetailDialog';
import TaskAssistantPanel from '@/components/TaskAssistantPanel';
import TaskMindmapDialog from '@/components/TaskMindmapDialog';
import NotebookDialog from '@/components/NotebookDialog';
import type { Notebook, Task, Settings, UserProfile } from '@/types';
import { applyTaskTimestamps } from '@/utils/taskTimestamps';
import { applyProgressRules } from '@/utils/taskProgress';
import { NEO_MINT } from '@/styles/neoMintTokens';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LoginScreen from '@/components/LoginScreen';
import { useAuth } from '@/components/AuthProvider';
import {
  createNotebook,
  deleteNotebook,
  listNotebooks,
  readSettings,
  readTasks,
  renameNotebook,
  saveTasks,
  touchNotebook,
  writeSettings,
} from '@/lib/supabase/data';

const DEFAULT_DRAWER_WIDTH = 288;
const MIN_DRAWER_WIDTH = 220;
const MAX_DRAWER_WIDTH = 520;

const normalizeAssigneeName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase());

const todayLabel = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
}).format(new Date());


export default function Home() {
  const { loading, profile, session, signOut } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', backgroundColor: 'var(--app-bg)' }}>
        <CircularProgress sx={{ color: NEO_MINT.primary }} />
      </Box>
    );
  }

  if (!session || !profile) return <LoginScreen />;

  return <TaskManagerApp profile={profile} onSignOut={signOut} />;
}

function TaskManagerApp({ profile, onSignOut }: { profile: UserProfile; onSignOut: () => Promise<void> }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings>({ tags: [], assistantIntents: [] });
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [isMindmapOpen, setIsMindmapOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [filters, setFilters] = useState<Partial<FilterState>>({});

  const uniqueAssignees = Array.from(
    new Map(
      tasks
        .map((task) => normalizeAssigneeName(task.assignee || ''))
        .filter(Boolean)
        .map((assignee) => [assignee.toLocaleLowerCase(), assignee])
    ).values()
  ).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const url = new URL(window.location.href);
        const requestedNotebookId = url.searchParams.get('notebookId');
        let availableNotebooks = await listNotebooks(profile);
        if (availableNotebooks.length === 0 && profile.role === 'superadmin') {
          const mainNotebook = await createNotebook('MAIN', profile);
          availableNotebooks = [mainNotebook];
        }
        const currentNotebook =
          availableNotebooks.find((notebook) => notebook.id === requestedNotebookId) ?? availableNotebooks[0] ?? null;
        if (!currentNotebook) {
          if (isActive) setNotebooks([]);
          return;
        }
        await touchNotebook(currentNotebook.id, currentNotebook.permissions.manageNotebook);
        if (!requestedNotebookId) {
          url.searchParams.set('notebookId', currentNotebook.id);
          window.history.replaceState(null, '', url.toString());
        }

        const [tasksData, settingsData] = await Promise.all([
          readTasks(currentNotebook.id),
          readSettings(currentNotebook.id),
        ]);

        if (!isActive) return;
        setNotebooks(availableNotebooks);
        setActiveNotebook(currentNotebook);
        setTasks(tasksData);
        setSettings(settingsData);
      } catch (loadError: unknown) {
        window.alert(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu ứng dụng.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [profile]);

  const reloadNotebookData = async (notebook: Notebook) => {
    setLoading(true);
    try {
      const [tasksData, settingsData, notebooksData] = await Promise.all([
        readTasks(notebook.id),
        readSettings(notebook.id),
        listNotebooks(profile),
      ]);
      setTasks(tasksData);
      setSettings(settingsData);
      setNotebooks(notebooksData);
      setActiveNotebook(notebook);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const savedWidth = Number(window.localStorage.getItem('task-manager-sidebar-width'));
      if (!Number.isNaN(savedWidth) && savedWidth >= MIN_DRAWER_WIDTH && savedWidth <= MAX_DRAWER_WIDTH) {
        setDrawerWidth(savedWidth);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleStartResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = drawerWidth;
    let latestWidth = startWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        MAX_DRAWER_WIDTH,
        Math.max(MIN_DRAWER_WIDTH, startWidth + moveEvent.clientX - startX)
      );
      latestWidth = nextWidth;
      setDrawerWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.localStorage.setItem('task-manager-sidebar-width', String(latestWidth));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [drawerWidth]);

  const handleSaveTasks = async (newTasks: Task[]) => {
    if (!activeNotebook?.permissions.manageTasks) {
      window.alert('Bạn không có quyền thay đổi task trong notebook này.');
      return;
    }
    const tasksWithTimestamps = applyTaskTimestamps(applyProgressRules(newTasks), tasks);
    setTasks(tasksWithTimestamps);
    try {
      setTasks(await saveTasks(activeNotebook.id, tasks, tasksWithTimestamps));
    } catch (saveError: unknown) {
      setTasks(tasks);
      window.alert(saveError instanceof Error ? saveError.message : 'Không thể lưu task.');
    }
  };

  const openNotebookWindow = (notebookId: string) => {
    window.open(`/?notebookId=${notebookId}`, '_blank');
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--app-bg)', fontFamily: 'var(--font-gilroy)' }}>
      {/* ── AppBar ── */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'var(--surface)',
          borderBottom: `1px solid ${NEO_MINT.cardBorderSoft}`,
          boxShadow: 'none',
          color: NEO_MINT.textTitle,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, md: 3 }, minHeight: '64px !important', gap: { xs: 1, md: 2 } }}>
          {/* Left: hamburger + brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, minWidth: 0 }}>
            <IconButton
              edge="start"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              sx={{
                p: 0.9,
                color: NEO_MINT.textTitle,
                border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                borderRadius: '8px',
                backgroundColor: 'var(--surface-soft)',
                '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
              }}
            >
              {isDrawerOpen ? <CloseIcon sx={{ fontSize: 24 }} /> : <MenuIcon sx={{ fontSize: 24 }} />}
            </IconButton>

            {/* Logo mark — Action Blue square with radius */}
            <Box sx={{
              width: 32, height: 32,
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              boxShadow: '0 6px 16px rgba(15, 118, 110, 0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Typography sx={{ color: NEO_MINT.surface, fontWeight: 700, fontSize: '16px', lineHeight: 1 }}>C</Typography>
            </Box>

            <Typography
              component="div"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '18px', md: '20px' },
                color: NEO_MINT.textTitle,
                letterSpacing: 0,
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              AI TASK
            </Typography>
          </Box>

          {/* Center: primary actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 } }}>
            {/* Primary CTA — Action Blue */}
            <Button
              variant="text"
              startIcon={<MenuBookIcon sx={{ fontSize: '19px !important' }} />}
              onClick={() => setIsNotebookOpen(true)}
              sx={{
                borderRadius: '12px',
                px: { xs: 1.25, md: 1.75 },
                py: 0.85,
                fontSize: '13px',
                fontWeight: 600,
                color: NEO_MINT.textBody,
                textTransform: 'none',
                '&:hover': { backgroundColor: 'var(--surface-muted)', color: NEO_MINT.textTitle },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Notebook{activeNotebook ? ` | ${activeNotebook.name.toUpperCase()}` : ''}
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                NB{activeNotebook ? ` | ${activeNotebook.name.toUpperCase()}` : ''}
              </Box>
            </Button>

            <Button
              variant="contained"
              disableElevation
              startIcon={<AddIcon sx={{ fontSize: '20px !important' }} />}
              onClick={() => setIsAddOpen(true)}
              sx={{
                borderRadius: '12px',
                px: { xs: 1.25, md: 2 },
                py: 0.85,
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: NEO_MINT.primary,
                color: NEO_MINT.surface,
                textTransform: 'none',
                '&:hover': { 
                  backgroundColor: NEO_MINT.primaryHover,
                  boxShadow: 'rgba(15, 118, 110, 0.16) 0px 8px 24px'
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Create via AI</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>AI</Box>
            </Button>

            {/* Ghost button — secondary action */}
            <Button
              variant="text"
              startIcon={<AddIcon sx={{ fontSize: '20px !important' }} />}
              onClick={() => setIsAddManualOpen(true)}
              sx={{
                borderRadius: '12px',
                px: { xs: 1.25, md: 1.75 },
                py: 0.85,
                fontSize: '13px',
                fontWeight: 600,
                color: NEO_MINT.textBody,
                textTransform: 'none',
                '&:hover': { backgroundColor: 'var(--surface-muted)', color: NEO_MINT.textTitle },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Manual Entry</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Manual</Box>
            </Button>

            <Button
              variant="text"
              startIcon={<AccountTreeIcon sx={{ fontSize: '20px !important' }} />}
              onClick={() => setIsMindmapOpen(true)}
              sx={{
                borderRadius: '12px',
                px: { xs: 1.25, md: 1.75 },
                py: 0.85,
                fontSize: '13px',
                fontWeight: 600,
                color: NEO_MINT.textBody,
                textTransform: 'none',
                '&:hover': { backgroundColor: 'var(--surface-muted)', color: NEO_MINT.textTitle },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Mindmap</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Map</Box>
            </Button>
          </Box>

          {/* Right: icon actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            <Typography
              sx={{
                display: { xs: 'none', md: 'block' },
                color: 'var(--text-subtle)',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              {todayLabel}
            </Typography>
            <IconButton
              onClick={() => void onSignOut()}
              sx={{
                p: 0.9,
                color: NEO_MINT.textTitle,
                borderRadius: '8px',
                border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                backgroundColor: 'var(--surface-soft)',
                '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
              }}
            >
              <LogoutIcon sx={{ fontSize: 22 }} />
            </IconButton>
            {activeNotebook?.permissions.manageSettings && (
              <IconButton
                onClick={() => setIsSettingsOpen(true)}
                sx={{
                  p: 0.9,
                  color: NEO_MINT.textTitle,
                  borderRadius: '8px',
                  border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                  backgroundColor: 'var(--surface-soft)',
                  '&:hover': { backgroundColor: 'var(--primary-subtle)', color: NEO_MINT.primary },
                }}
              >
                <SettingsIcon sx={{ fontSize: 22 }} />
              </IconButton>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Sidebar Drawer ── */}
      <Drawer
        variant="persistent"
        open={isDrawerOpen}
        sx={{
          width: isDrawerOpen ? drawerWidth : 0,
          flexShrink: 0,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: 'var(--sidebar-bg)',
            borderRight: `1px solid ${NEO_MINT.cardBorderSoft}`,
            boxShadow: 'none',
            overflow: 'visible',
            transition: 'width 0.15s ease',
          },
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }} />
        <Box
          onMouseDown={handleStartResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize filters panel"
          sx={{
            position: 'absolute',
            top: 64,
            right: -5,
            bottom: 0,
            width: 10,
            cursor: 'col-resize',
            zIndex: 2,
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 12,
              bottom: 12,
              left: '50%',
              width: 2,
              borderRadius: 1,
              backgroundColor: NEO_MINT.cardBorderSoft,
              opacity: 0,
              transition: 'opacity 0.15s ease, background-color 0.15s ease',
            },
            '&:hover::after': {
              opacity: 1,
              backgroundColor: NEO_MINT.primary,
            },
          }}
        />
        <Box
          sx={{
            overflow: 'auto',
            height: 'calc(100vh - 64px)',
            p: drawerWidth < 260 ? 1.5 : 2,
            minWidth: 0,
          }}
        >
          {/* Sidebar header */}
          <Typography
            variant="subtitle2"
            sx={{
              color: 'var(--sidebar-text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0,
              mb: 2,
            }}
          >
            Filters
          </Typography>
          <FilterPanel
            filters={filters}
            onChangeFilters={setFilters}
            availableTags={settings.tags}
            availableAssignees={uniqueAssignees}
            panelWidth={drawerWidth}
          />
        </Box>
      </Drawer>

      {/* ── Main content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, md: 4 },
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          overflowY: 'auto',
          backgroundColor: 'var(--main-bg)',
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 3 }}>
            <CircularProgress size={40} sx={{ color: NEO_MINT.primary }} />
            <Typography sx={{ color: NEO_MINT.textBody, fontSize: '16px', fontWeight: 500 }}>Gathering your tasks...</Typography>
          </Box>
        ) : (
          <Box sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            maxWidth: '1280px',
            width: '100%',
            mx: 'auto',
            minHeight: 0,
          }}>
            <TaskAssistantPanel
              tasks={tasks}
              assistantIntents={settings.assistantIntents || []}
              notebookId={activeNotebook?.id || ''}
              onTaskClick={(task) => setSelectedTask(task)}
            />

            <TaskList
              tasks={tasks}
              filters={filters}
              onSaveTasks={handleSaveTasks}
              availableTags={settings.tags}
              onRowClick={(task) => setSelectedTask(task)}
            />

            {/* Footer */}
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography sx={{ color: NEO_MINT.textMuted, fontSize: '13px', fontWeight: 500 }}>
                (C) AI TASK v1.5
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Dialogs ── */}
      {isAddOpen && (
        <AddTaskDialog
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAddTasks={(newTasks) => handleSaveTasks([...tasks, ...newTasks])}
          availableTags={settings.tags}
          availableAssignees={uniqueAssignees}
        />
      )}

      {isAddManualOpen && (
        <AddTaskDialog
          open={isAddManualOpen}
          onClose={() => setIsAddManualOpen(false)}
          onAddTasks={(newTasks) => handleSaveTasks([...tasks, ...newTasks])}
          availableTags={settings.tags}
          availableAssignees={uniqueAssignees}
          skipAI
        />
      )}

      {isSettingsOpen && (
        <SettingsDialog
          open={isSettingsOpen}
          settings={settings}
          onClose={() => setIsSettingsOpen(false)}
          onSave={async (newSettings) => {
            if (!activeNotebook) return;
            await writeSettings(activeNotebook.id, newSettings);
            setSettings(newSettings);
            setIsSettingsOpen(false);
          }}
        />
      )}

      {isNotebookOpen && (
        <NotebookDialog
          open={isNotebookOpen}
          notebooks={notebooks}
          activeNotebook={activeNotebook}
          onClose={() => setIsNotebookOpen(false)}
          canCreate={profile.role === 'superadmin'}
          onOpen={openNotebookWindow}
          onCreate={async (name) => {
            const notebook = await createNotebook(name, profile);
            setNotebooks(await listNotebooks(profile));
            openNotebookWindow(notebook.id);
          }}
          onRename={async (id, name) => {
            await renameNotebook(id, name);
            const nextNotebooks = await listNotebooks(profile);
            setNotebooks(nextNotebooks);
            if (activeNotebook?.id === id) {
              setActiveNotebook(nextNotebooks.find((notebook) => notebook.id === id) ?? null);
            }
          }}
          onDelete={async (id) => {
            await deleteNotebook(id);
            const nextNotebooks = await listNotebooks(profile);
            setNotebooks(nextNotebooks);
            if (activeNotebook?.id === id && nextNotebooks[0]) {
              await reloadNotebookData(nextNotebooks[0]);
              const url = new URL(window.location.href);
              url.searchParams.set('notebookId', nextNotebooks[0].id);
              window.history.replaceState(null, '', url.toString());
            }
          }}
        />
      )}

      {isMindmapOpen && (
        <TaskMindmapDialog
          open={isMindmapOpen}
          onClose={() => setIsMindmapOpen(false)}
          tasks={tasks}
          availableTags={settings.tags}
          notebookId={activeNotebook?.id || ''}
          isTaskDetailsOpen={!!selectedTask}
          onRequestTaskDetails={(task) => setSelectedTask(task)}
          onSaveTasks={handleSaveTasks}
        />
      )}

      {selectedTask && (
        <TaskDetailDialog
          key={selectedTask.id}
          open={!!selectedTask}
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          availableTags={settings.tags}
          availableAssignees={uniqueAssignees}
          onDelete={(id) => {
            handleSaveTasks(tasks.filter(t => t.id !== id));
            setSelectedTask(null);
          }}
          onSave={(updatedTask) => {
            const exists = tasks.some(t => t.id === updatedTask.id);
            handleSaveTasks(exists
              ? tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
              : [...tasks, updatedTask]
            );
            setSelectedTask(null);
          }}
        />
      )}
    </Box>
  );
}
