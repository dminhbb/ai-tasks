import { describe, expect, it } from 'vitest';
import { APP_VERSION, FOOTER_TEXT } from './version';

describe('version config', () => {
  it('has a valid version ID with format yymmdd.hhmm', () => {
    expect(APP_VERSION).toMatch(/^\d{6}\.\d{4}$/);
  });

  it('formats footer text correctly', () => {
    expect(FOOTER_TEXT).toBe(`(C) AI TASK by @minh.d - mx.io.vn - v.${APP_VERSION}`);
  });
});
