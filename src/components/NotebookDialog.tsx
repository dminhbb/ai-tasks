'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Delete, Edit, Launch } from '@mui/icons-material';
import type { Notebook } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';

type NotebookDialogProps = {
  open: boolean;
  notebooks: Notebook[];
  activeNotebook: Notebook | null;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onOpen: (id: number) => void;
};

export default function NotebookDialog({
  open,
  notebooks,
  activeNotebook,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onOpen,
}: NotebookDialogProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await onCreate(name);
    setNewName('');
  };

  const handleRename = async () => {
    if (editingId === null) return;
    const name = editingName.trim();
    if (!name) return;
    await onRename(editingId, name);
    setEditingId(null);
    setEditingName('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: '12px', p: 0.75 } } }}>
      <DialogTitle sx={{ fontWeight: 800, color: NEO_MINT.textTitle }}>Notebooks</DialogTitle>
      <DialogContent>
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
            sx={{ borderRadius: '10px', backgroundColor: NEO_MINT.primary, fontWeight: 700, textTransform: 'none' }}
          >
            Create
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {notebooks.map((notebook) => {
            const isActive = activeNotebook?.id === notebook.id;
            const isEditing = editingId === notebook.id;

            return (
              <Box
                key={notebook.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: '10px',
                  border: `1px solid ${isActive ? NEO_MINT.primary : NEO_MINT.cardBorderSoft}`,
                  backgroundColor: isActive ? 'var(--primary-subtle)' : NEO_MINT.surface,
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
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 800, color: isActive ? NEO_MINT.primary : NEO_MINT.textTitle, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
                      {notebook.name}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: NEO_MINT.textMuted }}>
                      Last active {notebook.lastAccessedAt.substring(0, 10)}
                    </Typography>
                  </Box>
                )}

                {isEditing ? (
                  <Button size="small" onClick={() => void handleRename()} sx={{ borderRadius: '8px', color: NEO_MINT.primary, fontWeight: 700, textTransform: 'none' }}>
                    Save
                  </Button>
                ) : (
                  <>
                    <IconButton size="small" onClick={() => onOpen(notebook.id)} sx={{ color: NEO_MINT.primary }}>
                      <Launch sx={{ fontSize: 18 }} />
                    </IconButton>
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
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm(`Delete notebook "${notebook.name}" and all of its data?`)) {
                          void onDelete(notebook.id);
                        }
                      }}
                      sx={{ color: NEO_MINT.danger }}
                    >
                      <Delete sx={{ fontSize: 18 }} />
                    </IconButton>
                  </>
                )}
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ borderRadius: '10px', color: NEO_MINT.textBody, fontWeight: 700, textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
