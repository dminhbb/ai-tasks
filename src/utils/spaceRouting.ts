import type { Space } from '@/types';

const SPACE_PATH_PATTERN = /^\/s\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

export function requestedSpaceFromPath(spaces: Space[], pathname: string): Space | null {
  const slug = pathname.match(SPACE_PATH_PATTERN)?.[1];
  if (!slug) return null;
  return spaces.find((space) => space.slug === slug) ?? null;
}

export function spaceUrl(space: Space, notebookId?: string): string {
  const path = `/s/${space.slug}`;
  if (!notebookId) return path;
  return `${path}?${new URLSearchParams({ notebookId }).toString()}`;
}
