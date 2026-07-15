import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  ButtonBase,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
} from '@mui/material';
import { AssistantConfiguredIntent, AssistantIntent, Settings, TaskStatus } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { APP_THEME_OPTIONS, useThemeContext } from '@/components/ThemeProvider';

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (settings: Settings) => void;
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

const createBlankIntent = (): AssistantConfiguredIntent => ({
  id: `assistant-intent-${Date.now()}`,
  label: '',
  question: '',
  intent: 'SEARCH_TASKS',
  enabled: true,
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0,
        color: NEO_MINT.textBody,
        mb: 1.5,
        fontFamily: 'var(--font-gilroy)',
      }}
    >
      {children}
    </Typography>
  );
}
export default function SettingsDialog({ open, settings, onClose, onSave }: SettingsDialogProps) {
  const { themeName, setThemeName } = useThemeContext();
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [newTag, setNewTag] = useState('');
  const [intentDraft, setIntentDraft] = useState<AssistantConfiguredIntent>(() => createBlankIntent());
  const [editingIntentId, setEditingIntentId] = useState<string | null>(null);
  const [showAssistantIntents, setShowAssistantIntents] = useState(false);

  const handleAddTag = () => {
    if (newTag && !localSettings.tags.includes(newTag)) {
      setLocalSettings({ ...localSettings, tags: [...localSettings.tags, newTag] });
      setNewTag('');
    }
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setLocalSettings({ ...localSettings, tags: localSettings.tags.filter((tag) => tag !== tagToDelete) });
  };

  const handleSaveIntent = () => {
    const question = intentDraft.question.trim().slice(0, 255);
    if (!question) return;

    const nextIntent: AssistantConfiguredIntent = {
      ...intentDraft,
      id: editingIntentId || intentDraft.id || `assistant-intent-${Date.now()}`,
      label: intentDraft.label.trim() || question.slice(0, 80),
      question,
    };
    const current = localSettings.assistantIntents || [];
    const nextIntents = editingIntentId
      ? current.map((intent) => (intent.id === editingIntentId ? nextIntent : intent))
      : [...current, nextIntent];

    setLocalSettings({ ...localSettings, assistantIntents: nextIntents });
    setEditingIntentId(null);
    setIntentDraft(createBlankIntent());
  };

  const handleEditIntent = (intent: AssistantConfiguredIntent) => {
    setEditingIntentId(intent.id);
    setIntentDraft({ ...intent });
  };

  const handleDeleteIntent = (id: string) => {
    setLocalSettings({
      ...localSettings,
      assistantIntents: (localSettings.assistantIntents || []).filter((intent) => intent.id !== id),
    });
    if (editingIntentId === id) {
      setEditingIntentId(null);
      setIntentDraft(createBlankIntent());
    }
  };

  const handleToggleIntent = (id: string) => {
    setLocalSettings({
      ...localSettings,
      assistantIntents: (localSettings.assistantIntents || []).map((intent) =>
        intent.id === id ? { ...intent, enabled: !intent.enabled } : intent
      ),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        paper: {
          sx: {
            borderRadius: '12px',
            p: 0.5,
            border: '1px solid var(--card-border)',
            boxShadow: NEO_MINT.shadowSm,
            '& .MuiDialogTitle-root': { py: 1.5, px: 2, fontSize: '18px' },
            '& .MuiDialogContent-root': { px: 2 },
            '& .MuiDialogActions-root': { p: 2 },
            '& .MuiButton-root': {
              minHeight: 30,
              px: 1.5,
              py: 0.35,
              fontSize: '12px',
              lineHeight: 1.2,
            },
            '& .MuiButton-startIcon': { mr: 0.5 },
            '& .MuiInputBase-root': { minHeight: 36, fontSize: '13px' },
            '& .MuiInputBase-input': { py: '7px' },
            '& .MuiInputLabel-root': { fontSize: '13px' },
            '& .MuiCheckbox-root': { p: 0.35 },
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, color: NEO_MINT.textTitle }}>System Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <SectionLabel>Appearance</SectionLabel>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {APP_THEME_OPTIONS.map((option) => {
                const selected = option.id === themeName;
                return (
                  <ButtonBase
                    key={option.id}
                    onClick={() => setThemeName(option.id)}
                    aria-pressed={selected}
                    sx={{
                      minWidth: 0,
                      p: 1.25,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 0.75,
                      textAlign: 'left',
                      borderRadius: '12px',
                      border: `2px solid ${selected ? 'var(--primary)' : 'var(--card-border-soft)'}`,
                      backgroundColor: selected ? 'var(--primary-subtle)' : 'var(--surface-soft)',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      '&:hover': {
                        borderColor: 'var(--primary)',
                        backgroundColor: 'var(--primary-subtle)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {option.swatches.map((color) => (
                        <Box
                          key={color}
                          component="span"
                          sx={{
                            width: 22,
                            height: 22,
                            borderRadius: '7px',
                            backgroundColor: color,
                            border: '1px solid rgba(15, 23, 42, 0.18)',
                          }}
                        />
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-title)' }}>
                      {option.label}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', lineHeight: 1.4, color: 'var(--text-muted)' }}>
                      {option.description}
                    </Typography>
                  </ButtonBase>
                );
              })}
            </Box>
            <Typography sx={{ mt: 0.75, fontSize: '10px', color: 'var(--text-muted)' }}>
              Theme selection is saved only in this browser.
            </Typography>
          </Box>

          {/* Tags management */}
          <Box>
            <SectionLabel>Tag Management</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
              <TextField
                placeholder="New tag name..."
                size="small"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '13px' },
                }}
              />
              <Button
                onClick={handleAddTag}
                variant="contained"
                disableElevation
                sx={{
                  borderRadius: '10px',
                  backgroundColor: NEO_MINT.primary,
                  color: NEO_MINT.surface,
                  fontWeight: 700,
                  px: 2,
                  textTransform: 'none',
                  '&:hover': { backgroundColor: NEO_MINT.primaryHover },
                }}
              >
                Add
              </Button>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.6,
                p: 1.25,
                minHeight: 52,
                borderRadius: '12px',
                backgroundColor: 'var(--surface-soft)',
                border: '1px solid var(--card-border-soft)',
              }}
            >
              {localSettings.tags.length === 0 && (
                <Typography
                  sx={{
                    fontSize: '13px',
                    color: NEO_MINT.textMuted,
                    fontStyle: 'italic',
                    alignSelf: 'center',
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  No tags defined yet
                </Typography>
              )}
              {localSettings.tags.map((tag) => (
                <Box
                  key={tag}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface-muted)',
                    border: `1px solid ${NEO_MINT.cardBorderSoft}`,
                    fontSize: '12px',
                    fontWeight: 600,
                    color: NEO_MINT.textBody,
                  }}
                >
                  {tag}
                  <Box
                    component="span"
                    onClick={() => handleDeleteTag(tag)}
                    sx={{
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      '&:hover': { color: NEO_MINT.danger },
                    }}
                  >
                    ×
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Assistant intents */}
          <Box>
            <Box
              sx={{
                p: 1.25,
                borderRadius: '12px',
                backgroundColor: 'var(--surface-soft)',
                border: '1px solid var(--card-border-soft)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <SectionLabel>Assistant Advanced</SectionLabel>
                  <Typography sx={{ mt: -1, fontSize: '12px', fontWeight: 600, color: NEO_MINT.textMuted }}>
                    Optional quick-question presets for the AI assistant.
                  </Typography>
                </Box>
                <Button
                  onClick={() => setShowAssistantIntents((current) => !current)}
                  variant="outlined"
                  sx={{
                    flexShrink: 0,
                    borderRadius: '10px',
                    borderColor: NEO_MINT.cardBorderSoft,
                    color: NEO_MINT.textTitle,
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: 'var(--primary-subtle)',
                      borderColor: NEO_MINT.primary,
                      color: NEO_MINT.primary,
                    },
                  }}
                >
                  {showAssistantIntents ? 'Hide' : 'Configure'}
                </Button>
              </Box>

              {showAssistantIntents && (
                <Box sx={{ mt: 1.25 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.75,
                      p: 1.25,
                      mb: 1.25,
                      borderRadius: '12px',
                      backgroundColor: 'var(--panel-bg)',
                      border: '1px solid var(--panel-border)',
                    }}
                  >
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
                      <TextField
                        label="Label"
                        size="small"
                        value={intentDraft.label}
                        onChange={(e) =>
                          setIntentDraft({ ...intentDraft, label: e.target.value.slice(0, 80) })
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            fontSize: '13px',
                            backgroundColor: NEO_MINT.surface,
                          },
                        }}
                      />
                      <FormControl size="small">
                        <InputLabel>Intent</InputLabel>
                        <Select
                          label="Intent"
                          value={intentDraft.intent}
                          onChange={(e) =>
                            setIntentDraft({ ...intentDraft, intent: e.target.value as AssistantIntent })
                          }
                          sx={{ borderRadius: '10px', fontSize: '13px', backgroundColor: NEO_MINT.surface }}
                        >
                          {ASSISTANT_INTENTS.map((intent) => (
                            <MenuItem key={intent} value={intent}>
                              {intent}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    <TextField
                      label="Suggestion question"
                      size="small"
                      value={intentDraft.question}
                      onChange={(e) =>
                        setIntentDraft({ ...intentDraft, question: e.target.value.slice(0, 255) })
                      }
                      slotProps={{ htmlInput: { maxLength: 255 } }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          fontSize: '13px',
                          backgroundColor: NEO_MINT.surface,
                        },
                      }}
                    />

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 104px 144px 104px' },
                        gap: 1,
                      }}
                    >
                      <TextField
                        label="Tag"
                        size="small"
                        value={intentDraft.tag || ''}
                        onChange={(e) => setIntentDraft({ ...intentDraft, tag: e.target.value })}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            fontSize: '13px',
                            backgroundColor: NEO_MINT.surface,
                          },
                        }}
                      />
                      <TextField
                        label="Days"
                        size="small"
                        type="number"
                        value={intentDraft.days ?? ''}
                        onChange={(e) =>
                          setIntentDraft({
                            ...intentDraft,
                            days: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            fontSize: '13px',
                            backgroundColor: NEO_MINT.surface,
                          },
                        }}
                      />
                      <FormControl size="small">
                        <InputLabel>Status</InputLabel>
                        <Select
                          label="Status"
                          value={intentDraft.status || ''}
                          onChange={(e) =>
                            setIntentDraft({
                              ...intentDraft,
                              status: e.target.value ? (e.target.value as TaskStatus) : undefined,
                            })
                          }
                          sx={{ borderRadius: '10px', fontSize: '13px', backgroundColor: NEO_MINT.surface }}
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
                          value={intentDraft.period || ''}
                          onChange={(e) =>
                            setIntentDraft({
                              ...intentDraft,
                              period: e.target.value
                                ? (e.target.value as AssistantConfiguredIntent['period'])
                                : undefined,
                            })
                          }
                          sx={{ borderRadius: '10px', fontSize: '13px', backgroundColor: NEO_MINT.surface }}
                        >
                          <MenuItem value="">None</MenuItem>
                          {PERIODS.map((period) => (
                            <MenuItem key={period} value={period}>
                              {period}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    <TextField
                      label="Search query override"
                      size="small"
                      value={intentDraft.query || ''}
                      onChange={(e) =>
                        setIntentDraft({ ...intentDraft, query: e.target.value.slice(0, 255) })
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          fontSize: '13px',
                          backgroundColor: NEO_MINT.surface,
                        },
                      }}
                    />

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box
                        onClick={() => setIntentDraft({ ...intentDraft, enabled: !intentDraft.enabled })}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.35,
                          cursor: 'pointer',
                          color: NEO_MINT.textBody,
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        <Checkbox size="small" checked={intentDraft.enabled} />
                        Enabled
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {editingIntentId && (
                          <Button
                            onClick={() => {
                              setEditingIntentId(null);
                              setIntentDraft(createBlankIntent());
                            }}
                            variant="text"
                            sx={{ color: NEO_MINT.textBody, fontWeight: 600, textTransform: 'none' }}
                          >
                            Cancel edit
                          </Button>
                        )}
                        <Button
                          onClick={handleSaveIntent}
                          variant="contained"
                          disableElevation
                          sx={{
                            borderRadius: '10px',
                            backgroundColor: NEO_MINT.primary,
                            color: NEO_MINT.surface,
                            fontWeight: 700,
                            px: 1.5,
                            textTransform: 'none',
                          }}
                        >
                          {editingIntentId ? 'Update Intent' : 'Add Intent'}
                        </Button>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.65 }}>
                    {(localSettings.assistantIntents || []).map((intent) => (
                      <Box
                        key={intent.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          p: 0.8,
                          borderRadius: '8px',
                          backgroundColor: NEO_MINT.surface,
                          border: '1px solid var(--card-border-soft)',
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={intent.enabled}
                          onChange={() => handleToggleIntent(intent.id)}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: NEO_MINT.textTitle,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {intent.label || intent.question}
                          </Typography>
                          <Typography
                            sx={{ fontSize: '11px', color: NEO_MINT.textMuted, overflowWrap: 'anywhere' }}
                          >
                            {intent.intent} - {intent.question}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={() => handleEditIntent(intent)}
                          sx={{
                            borderRadius: '8px',
                            color: NEO_MINT.primary,
                            fontWeight: 700,
                            textTransform: 'none',
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          onClick={() => handleDeleteIntent(intent.id)}
                          sx={{
                            borderRadius: '8px',
                            color: NEO_MINT.danger,
                            fontWeight: 700,
                            textTransform: 'none',
                          }}
                        >
                          Delete
                        </Button>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: '10px',
            color: NEO_MINT.textBody,
            fontWeight: 600,
            textTransform: 'none',
            px: 2,
            '&:hover': { backgroundColor: 'var(--surface-muted)' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onSave(localSettings)}
          variant="contained"
          disableElevation
          sx={{
            borderRadius: '10px',
            backgroundColor: NEO_MINT.primary,
            color: NEO_MINT.surface,
            fontWeight: 700,
            px: 2.5,
            textTransform: 'none',
            '&:hover': {
              backgroundColor: NEO_MINT.primaryHover,
              boxShadow: 'rgba(15, 118, 110, 0.16) 0px 8px 24px',
            },
          }}
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}
