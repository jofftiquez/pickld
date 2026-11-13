// Push copy for fn:send-push (FR-NOT-02; designs: LockScreen, Notifications). One push per notification,
// except likes: every due like on one jar becomes one push ("Aya and 12 others liked it"). Copy is gender
// neutral (D-7). Photos never ride in a push, and a comment's text is shown only to the person it was for.

export interface DueNotification {
  id: string;
  user_id: string;
  type: string;
  actor_name: string | null;
  jar_id: string | null;
  jar_local_date: string | null;
  moment_id: string | null;
  comment_id: string | null;
  comment_body: string | null;
  tokens: string[];
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { type: string; notificationIds: string[]; jarId?: string; momentId?: string; commentId?: string };
}

/** A push before it is copied to each of the person's devices. */
export interface Push {
  userId: string;
  tokens: string[];
  title: string;
  body: string;
  data: PushMessage['data'];
}

const someone = 'Someone';

function weekday(localDate: string | null): string | null {
  if (!localDate) return null;
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${localDate}T12:00:00Z`));
}

function quote(text: string | null): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  return t.length > 100 ? `“${t.slice(0, 99)}…”` : `“${t}”`;
}

/** "Aya", "Aya and Jun", "Aya and 12 others" (newest first, each person once). */
export function likers(names: (string | null)[]): string {
  const unique = [...new Set(names.map((n) => n?.trim() || someone))];
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]} and ${unique.length - 1} others`;
}

function one(n: DueNotification): Push | null {
  const actor = n.actor_name?.trim() || someone;
  const base = { userId: n.user_id, tokens: n.tokens };
  const data = {
    type: n.type,
    notificationIds: [n.id],
    ...(n.jar_id ? { jarId: n.jar_id } : {}),
    ...(n.moment_id ? { momentId: n.moment_id } : {}),
    ...(n.comment_id ? { commentId: n.comment_id } : {}),
  };
  switch (n.type) {
    case 'new_reader':
      return { ...base, title: actor, body: 'started reading your days. Read back?', data };
    case 'comment': {
      // A comment in a moment's own thread carries the moment (0068, D-51).
      const said = n.comment_body ? quote(n.comment_body) : null;
      const body = n.moment_id
        ? said
          ? `commented on your moment: ${said}`
          : 'commented on your moment.'
        : said
          ? `commented: ${said}`
          : 'commented on your jar.';
      return { ...base, title: actor, body, data };
    }
    case 'reply':
      return { ...base, title: actor, body: n.comment_body ? `replied: ${quote(n.comment_body)}` : 'replied to your comment.', data };
    case 'removed':
      return { ...base, title: 'We removed one of your moments', body: 'Tap to see why and ask for a review.', data };
    case 'appeal_decided':
      return { ...base, title: 'Your review is done', body: 'Tap to see what we decided.', data };
    case 'friend_joined':
      return { ...base, title: actor, body: 'joined Pickld. Say hi?', data };
    default:
      return null;
  }
}

function likesPush(group: DueNotification[]): Push {
  const first = group[0]!;
  const day = weekday(first.jar_local_date);
  return {
    userId: first.user_id,
    tokens: first.tokens,
    title: day ? `Your ${day} jar` : 'Your jar',
    // Newest liker first: rows arrive oldest first.
    body: `${likers([...group].reverse().map((g) => g.actor_name))} liked it.`,
    data: { type: 'like', notificationIds: group.map((g) => g.id), ...(first.jar_id ? { jarId: first.jar_id } : {}) },
  };
}

/**
 * Due notifications as pushes, oldest first: likes grouped per person and jar (the group sits where its
 * first like was), everything else one each. Rows of a type that isn't pushed, or for someone with no
 * device, produce nothing.
 */
export function composePushes(rows: DueNotification[]): Push[] {
  const entries: (Push | DueNotification[])[] = [];
  const likeGroups = new Map<string, DueNotification[]>();
  for (const row of rows) {
    if (row.tokens.length === 0) continue;
    if (row.type !== 'like') {
      const push = one(row);
      if (push) entries.push(push);
      continue;
    }
    const key = `${row.user_id}:${row.jar_id ?? row.moment_id ?? row.id}`;
    const group = likeGroups.get(key);
    if (group) group.push(row);
    else {
      const created = [row];
      likeGroups.set(key, created);
      entries.push(created);
    }
  }
  return entries.map((e) => (Array.isArray(e) ? likesPush(e) : e));
}

/** One Expo message per device. */
export function toMessages(pushes: Push[]): { message: PushMessage; push: Push }[] {
  return pushes.flatMap((push) =>
    push.tokens.map((to) => ({
      push,
      message: { to, title: push.title, body: push.body, sound: 'default' as const, data: push.data },
    }))
  );
}
