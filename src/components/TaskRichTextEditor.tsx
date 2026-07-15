'use client';

import { useEffect, useState } from 'react';
import type { ComponentType, CSSProperties } from 'react';
import { Box, Button, TextField } from '@mui/material';
import 'react-quill-new/dist/quill.snow.css';
import { NEO_MINT } from '@/styles/neoMintTokens';
import { MAX_RICH_TEXT_LENGTH, richTextToPlainText, sanitizeRichText } from '@/utils/richText';

interface RichTextEditorProps {
  theme: string;
  value: string;
  onChange: (value: string) => void;
  style?: CSSProperties;
  modules?: Record<string, unknown>;
}

interface TaskRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TaskRichTextEditor({ value, onChange }: TaskRichTextEditorProps) {
  const [Editor, setEditor] = useState<ComponentType<RichTextEditorProps> | null>(null);

  useEffect(() => {
    let active = true;
    void import('react-quill-new').then((module) => {
      if (active) setEditor(() => module.default as unknown as ComponentType<RichTextEditorProps>);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          size="small"
          onClick={() => onChange(richTextToPlainText(value))}
          variant="text"
          sx={{
            fontSize: '11px',
            fontWeight: 700,
            color: NEO_MINT.textBody,
            borderRadius: '10px',
            px: 1.5,
            py: 0.5,
            border: `1px solid ${NEO_MINT.cardBorderSoft}`,
            '&:hover': { backgroundColor: 'var(--surface-muted)' },
          }}
        >
          Clear Format
        </Button>
      </Box>
      <Box
        sx={{
          height: 250,
          mb: 4,
          borderRadius: '12px',
          border: '1px solid var(--card-border-soft)',
          overflow: 'hidden',
          backgroundColor: NEO_MINT.surface,
          '& .ql-toolbar': {
            borderBottom: '1px solid var(--card-border-soft)',
            backgroundColor: 'var(--surface-soft)',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderRadius: '12px 12px 0 0',
          },
          '& .ql-container': { border: 'none', fontSize: '14px', fontFamily: "'Inter', sans-serif" },
          '& .ql-editor': { color: NEO_MINT.textBlack, minHeight: 180 },
        }}
      >
        {Editor ? (
          <Editor
            theme="snow"
            value={sanitizeRichText(value)}
            onChange={(nextValue) => onChange(sanitizeRichText(nextValue))}
            style={{ height: '100%' }}
            modules={{
              toolbar: [
                [{ header: [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['link', 'clean'],
              ],
            }}
          />
        ) : (
          <TextField
            fullWidth
            multiline
            rows={9}
            value={richTextToPlainText(value)}
            onChange={(event) => onChange(event.target.value.slice(0, MAX_RICH_TEXT_LENGTH))}
          />
        )}
      </Box>
    </>
  );
}
