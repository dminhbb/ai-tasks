import { describe, expect, it } from 'vitest';
import type { Space } from '@/types';
import { requestedSpaceFromPath, spaceUrl } from '@/utils/spaceRouting';

const spaces: Space[] = [
  {
    id: 'space-1',
    name: 'Main',
    slug: 'main',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    isAdmin: true,
  },
];

describe('space routing', () => {
  it('requires an exact accessible slug and never falls back to the first Space', () => {
    expect(requestedSpaceFromPath(spaces, '/')).toBeNull();
    expect(requestedSpaceFromPath(spaces, '/s/not-allowed')).toBeNull();
    expect(requestedSpaceFromPath(spaces, '/s/main/tasks')).toBeNull();
    expect(requestedSpaceFromPath(spaces, '/s/main')).toEqual(spaces[0]);
  });

  it('builds a slug-scoped notebook URL', () => {
    expect(spaceUrl(spaces[0], 'notebook 1')).toBe('/s/main?notebookId=notebook+1');
  });
});
