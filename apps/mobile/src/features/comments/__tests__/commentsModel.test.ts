import { buildThread, COMMENT_MAX, sendable, type CommentRow } from '../commentsModel';

const OWNER = 'owner-id';
const ME = 'me-id';
const OTHER = 'other-id';

function row(over: Partial<CommentRow> & Pick<CommentRow, 'id' | 'created_at'>): CommentRow {
  return {
    jar_id: 'jar-1',
    user_id: OTHER,
    parent_id: null,
    body: 'hi',
    is_hidden: false,
    author: { display_name: 'Other', username: 'other' },
    ...over,
  };
}

describe('buildThread', () => {
  const rows = [
    row({ id: 'reply-late', parent_id: 'a', created_at: '2026-11-08T10:30:00Z' }),
    row({ id: 'b', created_at: '2026-11-08T10:10:00Z', user_id: ME }),
    row({ id: 'a', created_at: '2026-11-08T10:00:00Z' }),
    row({ id: 'reply-early', parent_id: 'a', created_at: '2026-11-08T10:20:00Z', user_id: ME }),
    // The parent was deleted or is from someone the viewer blocked: RLS didn't return it.
    row({ id: 'orphan', parent_id: 'gone', created_at: '2026-11-08T10:05:00Z' }),
  ];

  it('orders top-level comments and their replies oldest first, one level deep', () => {
    const thread = buildThread(rows, ME, OWNER);
    expect(thread.map((c) => c.id)).toEqual(['a', 'orphan', 'b']);
    expect(thread[0]?.replies.map((r) => r.id)).toEqual(['reply-early', 'reply-late']);
    expect(thread[1]?.replies).toEqual([]);
  });

  it('lets only top-level comments take replies, including an orphaned reply shown on its own', () => {
    const thread = buildThread(rows, ME, OWNER);
    expect(thread.map((c) => c.canReply)).toEqual([true, false, true]);
    expect(thread[0]?.replies.every((r) => !r.canReply)).toBe(true);
  });

  it('lets the author delete their own comments and nobody else’s', () => {
    const thread = buildThread(rows, ME, OWNER);
    expect(thread.find((c) => c.id === 'b')?.canDelete).toBe(true);
    expect(thread.find((c) => c.id === 'a')?.canDelete).toBe(false);
    expect(thread[0]?.replies.map((r) => r.canDelete)).toEqual([true, false]);
  });

  it('lets the jar owner delete every comment on their jar', () => {
    const thread = buildThread(rows, OWNER, OWNER);
    expect(thread.every((c) => c.canDelete && c.replies.every((r) => r.canDelete))).toBe(true);
  });

  it('marks the viewer’s own hidden comment as pending, and it can’t take replies yet', () => {
    const thread = buildThread(
      [row({ id: 'p', created_at: '2026-11-08T10:00:00Z', user_id: ME, is_hidden: true })],
      ME,
      OWNER,
    );
    expect(thread[0]).toMatchObject({ pending: true, canReply: false, canDelete: true });
  });
});

describe('sendable', () => {
  it('trims and refuses empty or over-long text', () => {
    expect(sendable('  hello  ')).toBe('hello');
    expect(sendable('   ')).toBeNull();
    expect(sendable('x'.repeat(COMMENT_MAX))).toHaveLength(COMMENT_MAX);
    expect(sendable('x'.repeat(COMMENT_MAX + 1))).toBeNull();
    // Surrounding spaces don't count against the limit.
    expect(sendable(` ${'x'.repeat(COMMENT_MAX)} `)).toHaveLength(COMMENT_MAX);
  });
});
