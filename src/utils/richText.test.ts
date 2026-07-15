import { describe, expect, it } from 'vitest';
import { MAX_RICH_TEXT_LENGTH, richTextToPlainText, sanitizeRichText } from '@/utils/richText';

describe('richText security', () => {
  it('removes scripts, event handlers, images, and unsafe links', () => {
    const result = sanitizeRichText(
      '<p onclick="steal()">Safe<script>alert(1)</script><img src=x onerror=steal()><a href="javascript:steal()">link</a></p>'
    );
    expect(result).toContain('<p>Safe');
    expect(result).not.toMatch(/script|onclick|onerror|<img|javascript:/i);
  });

  it('preserves supported Quill formatting', () => {
    expect(sanitizeRichText('<h2>Title</h2><p><strong>Bold</strong></p>')).toBe(
      '<h2>Title</h2><p><strong>Bold</strong></p>'
    );
  });

  it('bounds input and converts sanitized HTML to text', () => {
    expect(sanitizeRichText('a'.repeat(MAX_RICH_TEXT_LENGTH + 5))).toHaveLength(MAX_RICH_TEXT_LENGTH);
    expect(richTextToPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });
});
