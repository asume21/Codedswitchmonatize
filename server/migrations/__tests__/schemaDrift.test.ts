import { describe, it, expect } from 'vitest';
import { findSchemaDrift, expectedSchemaFromDrizzle } from '../schemaDrift';

// Drift went unnoticed three times (Social Hub outage, blog_posts, jam_*).
// The boot check must name every missing table and column.
describe('findSchemaDrift', () => {
  it('reports missing tables and columns, ignores extras', () => {
    const drift = findSchemaDrift(
      { users: ['id', 'email'], blog_posts: ['id', 'slug'], jam_sessions: ['id', 'host_id'] },
      { users: new Set(['id', 'email', 'legacy']), jam_sessions: new Set(['id', 'title']), extra: new Set(['x']) },
    );
    expect(drift).toEqual({ missingTables: ['blog_posts'], missingColumns: ['jam_sessions.host_id'] });
  });

  it('reads the expected tables/columns from the real Drizzle schema', () => {
    const expected = expectedSchemaFromDrizzle();
    expect(expected.users).toContain('email');
    expect(expected.projects).toEqual(expect.arrayContaining(['id', 'user_id', 'name', 'data']));
    expect(expected.blog_posts).toContain('slug');
  });
});
