import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  Divider,
  Button,
  MenuItem,
  Select,
} from '@mui/material';
import { TaskStatus } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  URGENT: { bg: NEO_MINT.dangerSoft, color: NEO_MINT.danger, border: NEO_MINT.dangerBorder },
  'IN PROGRESS': { bg: 'var(--primary-subtle)', color: NEO_MINT.primary, border: 'var(--primary-soft)' },
  'TO DO': { bg: NEO_MINT.surfaceMuted, color: NEO_MINT.primaryHover, border: NEO_MINT.cardBorderSoft },
  PENDING: { bg: NEO_MINT.surfaceSoft, color: NEO_MINT.textBody, border: NEO_MINT.cardBorderSoft },
  CANCELLED: { bg: NEO_MINT.outline, color: NEO_MINT.textMuted, border: NEO_MINT.cardBorderSoft },
  DONE: { bg: NEO_MINT.successSoft, color: NEO_MINT.success, border: NEO_MINT.successBorder },
};

export interface FilterState {
  searchQuery: string;
  dueToday: boolean;
  dueInWeek: boolean;
  dueNextWeek: boolean;
  overdue: boolean;
  tags: string[];
  tagsOperator: 'AND' | 'OR' | 'NOT';
  statuses: TaskStatus[];
  statusOperator: 'AND' | 'OR' | 'NOT';
  quickUrgent: boolean;
  quickNotFinished: boolean;
  quickIncompleteToday: boolean;
  quickAssignee: string;
}

export const INITIAL_FILTERS: Partial<FilterState> = {
  searchQuery: '',
  dueToday: false,
  dueInWeek: false,
  dueNextWeek: false,
  overdue: false,
  tags: [],
  tagsOperator: 'OR',
  statuses: [],
  statusOperator: 'OR',
  quickUrgent: false,
  quickNotFinished: false,
  quickIncompleteToday: false,
  quickAssignee: '',
};

interface FilterPanelProps {
  filters: Partial<FilterState>;
  onChangeFilters: (filters: Partial<FilterState>) => void;
  availableTags: string[];
  availableAssignees: string[];
  panelWidth?: number;
}

const ALL_STATUSES: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'];

// ── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 'clamp(10px, 4.5cqw, 11px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0,
        color: 'var(--sidebar-text-muted)',
        mb: 1,
        fontFamily: 'var(--font-gilroy)',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </Typography>
  );
}

// ── Pill toggle chip ─────────────────────────────────────────────────────────
function PillChip({
  label,
  selected,
  color,
  onClick,
}: {
  label: string;
  selected: boolean;
  color?: { bg: string; color: string; border: string };
  onClick: () => void;
}) {
  const activeBg = color ? color.bg : 'var(--primary-subtle)';
  const activeColor = color ? color.color : NEO_MINT.primary;
  const activeBorder = color ? color.border : 'var(--primary-soft)';

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: 0,
        maxWidth: '100%',
        px: 'clamp(8px, 4cqw, 10px)',
        py: 0.4,
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: 'clamp(10px, 4.8cqw, 12px)',
        fontWeight: 600,
        lineHeight: 1.35,
        overflowWrap: 'anywhere',
        textAlign: 'center',
        userSelect: 'none',
        transition:
          'background-color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
        backgroundColor: selected ? activeBg : NEO_MINT.surfaceMuted,
        color: selected ? activeColor : NEO_MINT.textBody,
        border: `1px solid ${selected ? activeBorder : NEO_MINT.cardBorderSoft}`,
        '&:hover': {
          backgroundColor: selected ? activeBg : 'var(--sidebar-hover)',
          boxShadow: selected ? NEO_MINT.shadowSm : 'none',
        },
      }}
    >
      {label}
    </Box>
  );
}

export default function FilterPanel({
  filters,
  onChangeFilters,
  availableTags,
  availableAssignees,
  panelWidth = 288,
}: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<Partial<FilterState>>({ ...INITIAL_FILTERS, ...filters });
  const isCompact = panelWidth < 260;

  useEffect(() => {
    onChangeFilters(localFilters);
  }, [localFilters, onChangeFilters]);

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setLocalFilters((prev) => ({ ...prev, [key]: value }));

  const handleClear = () => setLocalFilters({ ...INITIAL_FILTERS });

  const toggleTag = (tag: string) => {
    const current = localFilters.tags || [];
    update('tags', current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
  };

  const toggleStatus = (status: TaskStatus) => {
    const current = localFilters.statuses || [];
    update('statuses', current.includes(status) ? current.filter((s) => s !== status) : [...current, status]);
  };

  return (
    <Box
      sx={{
        containerType: 'inline-size',
        display: 'flex',
        flexDirection: 'column',
        gap: isCompact ? 2 : 2.5,
        minWidth: 0,
      }}
    >
      {/* Search */}
      <Box>
        <SectionLabel>Search Tasks</SectionLabel>
        <TextField
          placeholder={'Keywords, AND, OR...'}
          variant="outlined"
          size="small"
          fullWidth
          value={localFilters.searchQuery || ''}
          onChange={(e) => update('searchQuery', e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              backgroundColor: NEO_MINT.surface,
              fontSize: 'clamp(12px, 5.5cqw, 14px)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: NEO_MINT.cardBorderSoft,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: NEO_MINT.textMuted,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: NEO_MINT.primary,
              },
            },
          }}
        />
      </Box>

      {/* Clear button */}
      <Button
        onClick={handleClear}
        size="small"
        fullWidth
        variant="outlined"
        sx={{
          borderRadius: '10px',
          fontSize: 'clamp(11px, 5cqw, 12px)',
          fontWeight: 700,
          color: NEO_MINT.danger,
          borderColor: NEO_MINT.dangerBorder,
          textTransform: 'none',
          py: 0.65,
          backgroundColor: NEO_MINT.surface,
          '&:hover': { backgroundColor: NEO_MINT.dangerSoft, borderColor: NEO_MINT.danger },
        }}
      >
        Clear Filters
      </Button>

      <Divider sx={{ borderColor: NEO_MINT.cardBorderSoft }} />

      {/* Due Date */}
      <Box>
        <SectionLabel>Timeline</SectionLabel>
        <FormGroup sx={{ gap: 0.5 }}>
          {[
            { key: 'dueToday', label: 'Due Today' },
            { key: 'dueInWeek', label: 'Due This Week' },
            { key: 'dueNextWeek', label: 'Due Next Week' },
            { key: 'overdue', label: 'Overdue' },
          ].map(({ key, label }) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  size="small"
                  checked={!!localFilters[key as keyof FilterState]}
                  onChange={(e) => update(key as keyof FilterState, e.target.checked)}
                  sx={{
                    color: NEO_MINT.cardBorderSoft,
                    '&.Mui-checked': { color: NEO_MINT.primary },
                    p: 0.75,
                  }}
                />
              }
              label={
                <Typography
                  sx={{
                    fontSize: 'clamp(12px, 5.5cqw, 14px)',
                    color: NEO_MINT.textTitle,
                    fontWeight: 500,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {label}
                </Typography>
              }
              sx={{
                ml: 0,
                gap: 0.5,
                alignItems: 'flex-start',
                minWidth: 0,
                '& .MuiFormControlLabel-label': { minWidth: 0 },
              }}
            />
          ))}
        </FormGroup>
      </Box>

      <Divider sx={{ borderColor: NEO_MINT.cardBorderSoft }} />

      {/* Tags */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            mb: 1.5,
            minWidth: 0,
          }}
        >
          <SectionLabel>Tags</SectionLabel>
          <Select
            size="small"
            variant="standard"
            value={localFilters.tagsOperator || 'OR'}
            onChange={(e) => update('tagsOperator', e.target.value as FilterState['tagsOperator'])}
            disableUnderline
            sx={{
              fontSize: 'clamp(11px, 5cqw, 12px)',
              fontWeight: 700,
              color: NEO_MINT.primary,
              minWidth: 44,
              flexShrink: 0,
            }}
          >
            <MenuItem value="OR">OR</MenuItem>
            <MenuItem value="AND">AND</MenuItem>
            <MenuItem value="NOT">NOT</MenuItem>
          </Select>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
          {availableTags.length === 0 && (
            <Typography
              sx={{
                fontSize: 'clamp(12px, 5.2cqw, 13px)',
                color: NEO_MINT.textMuted,
                fontStyle: 'italic',
                overflowWrap: 'anywhere',
              }}
            >
              No tags available
            </Typography>
          )}
          {availableTags.map((tag) => (
            <PillChip
              key={tag}
              label={tag}
              selected={(localFilters.tags || []).includes(tag)}
              onClick={() => toggleTag(tag)}
            />
          ))}
        </Box>
      </Box>

      <Divider sx={{ borderColor: NEO_MINT.cardBorderSoft }} />

      {/* Status */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            mb: 1.5,
            minWidth: 0,
          }}
        >
          <SectionLabel>Status</SectionLabel>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Typography
              sx={{ fontSize: 'clamp(10px, 4.5cqw, 11px)', fontWeight: 700, color: NEO_MINT.textBody }}
            >
              OR
            </Typography>
            <Switch
              size="small"
              checked={localFilters.statusOperator === 'NOT'}
              onChange={(e) => update('statusOperator', e.target.checked ? 'NOT' : 'OR')}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: NEO_MINT.primary },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: NEO_MINT.primary,
                },
              }}
            />
            <Typography
              sx={{ fontSize: 'clamp(10px, 4.5cqw, 11px)', fontWeight: 700, color: NEO_MINT.danger }}
            >
              NOT
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
          {ALL_STATUSES.map((status) => (
            <PillChip
              key={status}
              label={status}
              selected={(localFilters.statuses || []).includes(status)}
              color={STATUS_COLORS[status]}
              onClick={() => toggleStatus(status)}
            />
          ))}
        </Box>
      </Box>

      <Divider sx={{ borderColor: NEO_MINT.cardBorderSoft }} />

      {/* Quick Filters */}
      <Box>
        <SectionLabel>Quick Views</SectionLabel>
        <FormGroup sx={{ gap: 0.5 }}>
          {[
            { key: 'quickUrgent', label: 'Only Urgent' },
            { key: 'quickNotFinished', label: 'Exclude Finished' },
            { key: 'quickIncompleteToday', label: 'Incomplete & Due' },
          ].map(({ key, label }) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  size="small"
                  checked={!!localFilters[key as keyof FilterState]}
                  onChange={(e) => update(key as keyof FilterState, e.target.checked)}
                  sx={{
                    color: NEO_MINT.cardBorderSoft,
                    '&.Mui-checked': { color: NEO_MINT.primary },
                    p: 0.75,
                  }}
                />
              }
              label={
                <Typography
                  sx={{
                    fontSize: 'clamp(12px, 5.5cqw, 14px)',
                    color: NEO_MINT.textTitle,
                    fontWeight: 500,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {label}
                </Typography>
              }
              sx={{
                ml: 0,
                gap: 0.5,
                alignItems: 'flex-start',
                minWidth: 0,
                '& .MuiFormControlLabel-label': { minWidth: 0 },
              }}
            />
          ))}
        </FormGroup>
      </Box>

      {/* Assignee quick filter */}
      <Box>
        <SectionLabel>Assignee</SectionLabel>
        <TextField
          select
          variant="outlined"
          size="small"
          fullWidth
          value={localFilters.quickAssignee || ''}
          onChange={(e) => update('quickAssignee', e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              backgroundColor: NEO_MINT.surface,
              fontSize: 'clamp(12px, 5.5cqw, 14px)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: NEO_MINT.cardBorderSoft,
              },
            },
          }}
        >
          <MenuItem value="">
            <em>All Assignees</em>
          </MenuItem>
          {availableAssignees.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </Box>
  );
}
