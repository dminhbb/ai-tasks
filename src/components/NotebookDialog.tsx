'use client';

import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import { Apps, Delete, Edit, Launch } from '@mui/icons-material';
import type { Notebook, Space } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';

type NotebookDialogProps = {
  open: boolean;
  spaces: Space[];
  activeSpace: Space;
  notebooks: Notebook[];
  activeNotebook: Notebook | null;
  onClose: () => void;
  onLoadNotebooks: (space: Space) => Promise<Notebook[]>;
  onCreate: (space: Space, name: string) => Promise<void>;
  onRename: (space: Space, id: string, name: string) => Promise<void>;
  onDelete: (space: Space, id: string) => Promise<void>;
  onOpen: (space: Space, id: string) => void;
  onOpenInNewTab: (space: Space, id: string) => void;
};

export default function NotebookDialog({
  open,
  spaces,
  activeSpace,
  notebooks,
  activeNotebook,
  onClose,
  onLoadNotebooks,
  onCreate,
  onRename,
  onDelete,
  onOpen,
  onOpenInNewTab,
}: NotebookDialogProps) {
  const [selectedSpace, setSelectedSpace] = useState<Space>(activeSpace);
  const [visibleNotebooks, setVisibleNotebooks] = useState<Notebook[]>(notebooks);
  const [loadingNotebooks, setLoadingNotebooks] = useState(false);
  const [error, setError] = useState('');
  const loadRequestId = useRef(0);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setError('');
    try {
      await onCreate(selectedSpace, name);
      setNewName('');
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Unable to create notebook.');
    }
  };

  const handleRename = async () => {
    if (editingId === null) return;
    const name = editingName.trim();
    if (!name) return;
    setError('');
    try {
      await onRename(selectedSpace, editingId, name);
      setVisibleNotebooks(await onLoadNotebooks(selectedSpace));
      setEditingId(null);
      setEditingName('');
    } catch (renameError: unknown) {
      setError(renameError instanceof Error ? renameError.message : 'Unable to rename notebook.');
    }
  };

  const handleSelectSpace = async (space: Space) => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    setSelectedSpace(space);
    setNewName('');
    setEditingId(null);
    setError('');
    setLoadingNotebooks(true);
    try {
      const nextNotebooks = await onLoadNotebooks(space);
      if (loadRequestId.current === requestId) setVisibleNotebooks(nextNotebooks);
    } catch (loadError: unknown) {
      if (loadRequestId.current === requestId) {
        setVisibleNotebooks([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load notebooks.');
      }
    } finally {
      if (loadRequestId.current === requestId) setLoadingNotebooks(false);
    }
  };

  const handleDelete = async (notebook: Notebook) => {
    const firstConfirmation = window.confirm(`Delete notebook "${notebook.name}" and all of its data?`);
    if (!firstConfirmation) return;

    const typedName = window.prompt(
      `This action cannot be undone. Type the exact notebook name "${notebook.name}" to continue.`
    );
    if (typedName !== notebook.name) {
      if (typedName !== null) setError('Notebook name confirmation did not match.');
      return;
    }

    setError('');
    try {
      await onDelete(selectedSpace, notebook.id);
      setVisibleNotebooks(await onLoadNotebooks(selectedSpace));
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete notebook.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        paper: { sx: { borderRadius: '20px', p: { xs: 0, sm: 0.5 }, boxShadow: NEO_MINT.shadowLg } },
      }}
    >
      <DialogTitle
        sx={{
          px: { xs: 2, sm: 2.5 },
          pt: { xs: 2, sm: 2.5 },
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: NEO_MINT.textTitle,
        }}
      >
        Spaces and Notebooks
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 2.5 } }}>
        <Typography sx={{ mb: 1, fontSize: '12px', fontWeight: 800, color: NEO_MINT.textMuted }}>
          SPACE
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
            gap: 1.25,
            mb: 2.5,
          }}
        >
          {spaces.map((space) => {
            const isSelected = selectedSpace.id === space.id;
            return (
              <Button
                key={space.id}
                onClick={() => void handleSelectSpace(space)}
                aria-pressed={isSelected}
                aria-label={`Select ${space.name}`}
                sx={{
                  aspectRatio: '1 / 1',
                  minHeight: 118,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  borderRadius: '14px',
                  border: `1px solid ${isSelected ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                  backgroundColor: isSelected ? 'var(--primary-subtle)' : NEO_MINT.surface,
                  color: isSelected ? NEO_MINT.primary : NEO_MINT.textTitle,
                  textTransform: 'none',
                  transition:
                    'transform var(--transition-fast), border-color var(--transition-fast), background-color var(--transition-fast)',
                  '&:hover': { transform: 'translateY(-1px)', backgroundColor: 'var(--primary-subtle)' },
                }}
              >
                <Apps sx={{ fontSize: 28 }} />
                <Typography
                  sx={{
                    width: '100%',
                    fontSize: '12px',
                    fontWeight: 800,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {space.name}
                </Typography>
              </Button>
            );
          })}
        </Box>

        <Typography sx={{ mb: 1, fontSize: '12px', fontWeight: 800, color: NEO_MINT.textMuted }}>
          NOTEBOOKS IN {selectedSpace.name.toLocaleUpperCase()}
        </Typography>
        {error && (
          <Typography role="alert" sx={{ mb: 1, color: NEO_MINT.danger }}>
            {error}
          </Typography>
        )}
        {selectedSpace.isAdmin && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="New notebook name..."
              value={newName}
              onChange={(event) => setNewName(event.target.value.slice(0, 80))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <Button
              variant="contained"
              disableElevation
              onClick={() => void handleCreate()}
              disabled={!newName.trim()}
              sx={{
                borderRadius: '10px',
                backgroundColor: NEO_MINT.primary,
                fontWeight: 700,
                textTransform: 'none',
              }}
            >
              Create
            </Button>
          </Box>
        )}

        {loadingNotebooks ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 160 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {visibleNotebooks.map((notebook) => {
              const isActive = activeSpace.id === selectedSpace.id && activeNotebook?.id === notebook.id;
              const isEditing = editingId === notebook.id;

              return (
                <Box
                  key={notebook.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: '12px',
                    border: `1px solid ${isActive ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                    backgroundColor: isActive ? 'var(--primary-subtle)' : 'var(--surface-raised)',
                  }}
                >
                  {isEditing ? (
                    <TextField
                      size="small"
                      autoFocus
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value.slice(0, 80))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleRename();
                        }
                      }}
                      sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                    />
                  ) : (
                    <ButtonBase
                      aria-label={`Open notebook ${notebook.name}`}
                      onClick={() => onOpen(selectedSpace, notebook.id)}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'block',
                        borderRadius: '8px',
                        px: 0.5,
                        py: 0.25,
                        textAlign: 'left',
                        '&:hover': { backgroundColor: 'var(--surface-muted)' },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: isActive ? NEO_MINT.primary : NEO_MINT.textTitle,
                          textTransform: 'uppercase',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {notebook.name}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: NEO_MINT.textMuted }}>
                        Last active {notebook.lastAccessedAt.substring(0, 10)}
                      </Typography>
                    </ButtonBase>
                  )}

                  {isEditing ? (
                    <Button
                      size="small"
                      onClick={() => void handleRename()}
                      sx={{
                        borderRadius: '8px',
                        color: NEO_MINT.primary,
                        fontWeight: 700,
                        textTransform: 'none',
                      }}
                    >
                      Save
                    </Button>
                  ) : (
                    <>
                      <IconButton
                        size="small"
                        aria-label={`Open notebook ${notebook.name} in new tab`}
                        onClick={() => onOpenInNewTab(selectedSpace, notebook.id)}
                        sx={{ color: NEO_MINT.primary }}
                      >
                        <Launch sx={{ fontSize: 18 }} />
                      </IconButton>
                      {notebook.permissions.manageNotebook && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingId(notebook.id);
                            setEditingName(notebook.name);
                          }}
                          sx={{ color: NEO_MINT.textBody }}
                        >
                          <Edit sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                      {notebook.permissions.manageNotebook && (
                        <IconButton
                          size="small"
                          aria-label={`Delete notebook ${notebook.name}`}
                          onClick={() => void handleDelete(notebook)}
                          sx={{ color: NEO_MINT.danger }}
                        >
                          <Delete sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                    </>
                  )}
                </Box>
              );
            })}
            {visibleNotebooks.length === 0 && (
              <Typography sx={{ py: 3, textAlign: 'center', color: NEO_MINT.textMuted }}>
                No accessible notebook in this Space.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          sx={{ borderRadius: '10px', color: NEO_MINT.textBody, fontWeight: 700, textTransform: 'none' }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
