import React, { useState } from 'react';
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { RestartAlt, Send } from '@mui/icons-material';
import type { AssistantConfiguredIntent, Task } from '@/types';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { askTaskAssistant } from '@/lib/supabase/functions';


type AssistantTask = Pick<Task, 'id' | 'title' | 'assignee' | 'status' | 'dueDate' | 'tags'>;

type AssistantResponse = {
  answer: string;
  tasks: AssistantTask[];
  metrics: Record<string, string | number | null>;
  error?: string;
};

type TaskAssistantPanelProps = {
  tasks: Task[];
  assistantIntents: AssistantConfiguredIntent[];
  notebookId: string;
  onTaskClick: (task: Task) => void;
};

export default function TaskAssistantPanel({ tasks, assistantIntents, notebookId, onTaskClick }: TaskAssistantPanelProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [relatedTasks, setRelatedTasks] = useState<AssistantTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAsk = async (nextQuestion = question) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;

    setQuestion(trimmed);
    setLoading(true);
    setError('');

    try {
      const data: AssistantResponse = await askTaskAssistant(trimmed, notebookId);

      setAnswer(data.answer || '');
      setRelatedTasks(data.tasks || []);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Assistant query failed.');
      setAnswer('');
      setRelatedTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuestion('');
    setAnswer('');
    setRelatedTasks([]);
    setError('');
  };

  return (
    <Box
      sx={{
        p: 0.5,
        backgroundColor: 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
        <TextField
          fullWidth
          multiline
          maxRows={3}
          size="small"
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, 255))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleAsk();
            }
          }}
          slotProps={{ htmlInput: { maxLength: 255 } }}
          placeholder="Ask about tags, due dates, status, completion time..."
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              backgroundColor: 'var(--input-bg)',
              fontSize: '13px',
              py: 0,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--input-border)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'var(--input-focus)',
              },
            },
            '& .MuiInputBase-input': {
              py: 0.75,
            },
          }}
        />
        <Button
          variant="outlined"
          disableElevation
          startIcon={<RestartAlt sx={{ fontSize: '14px !important' }} />}
          disabled={loading && !question && !answer && !error}
          onClick={handleReset}
          sx={{
            minWidth: 70,
            height: 31,
            px: 1.25,
            borderRadius: '10px',
            borderColor: NEO_MINT.cardBorderSoft,
            color: NEO_MINT.textBody,
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'none',
            backgroundColor: NEO_MINT.surface,
            '&:hover': { backgroundColor: 'var(--surface-muted)', borderColor: NEO_MINT.cardBorderSoft },
          }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          disableElevation
          startIcon={loading ? <CircularProgress size={16} sx={{ color: NEO_MINT.surface }} /> : <Send sx={{ fontSize: '16px !important' }} />}
          disabled={!question.trim() || loading}
          onClick={() => void handleAsk()}
          sx={{
            minWidth: 62,
            height: 31,
            px: 1.25,
            borderRadius: '10px',
            backgroundColor: NEO_MINT.primary,
            color: NEO_MINT.surface,
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { backgroundColor: NEO_MINT.primaryHover },
          }}
        >
          Ask
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1 }}>
        {assistantIntents.filter((intent) => intent.enabled).map((intent) => (
          <Button
            key={intent.id}
            size="small"
            variant="outlined"
            disabled={loading}
            onClick={() => setQuestion(intent.question.slice(0, 255))}
            sx={{
              borderRadius: '10px',
              borderColor: NEO_MINT.cardBorderSoft,
              color: NEO_MINT.textBody,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: 'var(--panel-card-bg)',
              minHeight: 24,
              px: 1,
              py: 0.2,
              '&:hover': {
                backgroundColor: 'var(--primary-subtle)',
                borderColor: 'var(--primary)',
                color: NEO_MINT.primary,
              },
            }}
          >
            {intent.label || intent.question}
          </Button>
        ))}
      </Box>

      {(answer || error) && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: '12px',
            backgroundColor: 'var(--panel-card-bg)',
            border: '1px solid var(--card-border-soft)',
          }}
        >
          {error ? (
            <Typography sx={{ fontSize: '13px', color: '#dc2626', lineHeight: 1.6 }}>
              {error}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '13px', color: NEO_MINT.textTitle, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
              {answer}
            </Typography>
          )}

          {relatedTasks.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
              {relatedTasks.slice(0, 8).map((task) => {
                const fullTask = tasks.find((item) => item.id === task.id);
                return (
                  <Box
                    key={task.id}
                    onClick={() => fullTask && onTaskClick(fullTask)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1,
                      py: 0.5,
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface-muted)',
                      cursor: fullTask ? 'pointer' : 'default',
                      border: '1px solid transparent',
                      '&:hover': fullTask ? { backgroundColor: 'var(--primary-subtle)', borderColor: 'var(--primary-soft)' } : undefined,
                    }}
                  >
                    <Typography sx={{ flex: 1, minWidth: 0, fontSize: '11px', fontWeight: 700, color: NEO_MINT.textTitle, overflowWrap: 'anywhere' }}>
                      {task.title}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: NEO_MINT.textBody, whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.assignee || 'Unassigned'}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: NEO_MINT.textMuted, whiteSpace: 'nowrap' }}>
                      {task.dueDate ? task.dueDate.substring(0, 10) : task.status}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
