import DOMPurify from 'dompurify';

export const MAX_RICH_TEXT_LENGTH = 50_000;

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'em',
  'h1',
  'h2',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul',
];
const ALLOWED_ATTRIBUTES = ['class', 'href', 'rel', 'target'];

export function sanitizeRichText(value: string): string {
  const boundedValue = value.slice(0, MAX_RICH_TEXT_LENGTH);
  if (typeof window === 'undefined') return boundedValue;
  return DOMPurify.sanitize(boundedValue, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['form', 'iframe', 'img', 'object', 'script', 'style', 'svg', 'video'],
    FORBID_ATTR: ['style'],
  });
}

export function richTextToPlainText(value: string): string {
  const sanitized = sanitizeRichText(value);
  if (typeof document === 'undefined') return sanitized.replace(/<[^>]+>/g, ' ');
  const container = document.createElement('div');
  container.innerHTML = sanitized;
  return container.textContent ?? '';
}
