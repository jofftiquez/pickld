// fn:moderate (M2-19, M2-20, M3-10; FR-SAF-03, FR-SAF-04, FR-PUB-07, FR-JAR-03, FR-SOC-06). Checks what a
// moment would show and applies the verdict: checking → live, a replacement photo or edit swapped in,
// queued, removed, or blocked (a child-safety match: moderation_csam_block(), 0040, never queued). The
// database lets only moderation_apply() (0011) and moderation_csam_block() set live or removed, and only
// this function calls them. A block is answered as 'removed', so the uploader learns nothing more. Comments take the text path: a new comment is hidden until moderation_apply_comment() (0016)
// shows it, queues it or refuses it.
//
// Triggered by the app right after it inserts a moment (status `checking`) or changes one (the update
// lands in pending_*), as the last step of the upload pipeline. If the call is lost, the moment stays
// hidden, and the queue's retry calls again (the call is idempotent). A webhook or sweep can call
// moderateMoment() the same way later.
//
// POST { momentId }   (the caller's own moment)
//   → { data: { momentId, outcome, status } }
// POST { commentId }  (the caller's own comment, right after inserting it)
//   → { data: { commentId, outcome } }   outcome: visible | queued | removed | nothing_to_check
//   → { error: { code, message } }
import { type SupabaseClient, z } from '../_shared/deps.ts';
import { bearerToken, fail, ok, readJson } from '../_shared/http.ts';
import { MissingObjectError } from './pipeline.ts';
import type { ModerationContent, ModerationProvider } from './provider.ts';

export const ModerateInput = z.union([
  z.strictObject({ momentId: z.uuid() }),
  z.strictObject({ commentId: z.uuid() }),
]);

/** What moderation_apply_comment() did; see 0016_text_moderation.sql. */
export type CommentOutcome = 'visible' | 'queued' | 'removed' | 'nothing_to_check' | 'not_found';

/** What moderation_apply() did; see 0011_moderate.sql. 'stale' never escapes moderateMoment(). */
export type Outcome =
  | 'live'
  | 'swapped'
  | 'queued'
  | 'removed'
  | 'discarded'
  | 'blocked'
  | 'nothing_to_check'
  | 'not_found';
type ApplyResult = Outcome | 'stale';

/** A proposal that keeps changing while it is checked is checked again, up to this many times. */
export const MAX_ATTEMPTS = 3;

export interface ModerateDeps {
  userClient: (jwt: string) => SupabaseClient;
  serviceClient: () => SupabaseClient;
  provider: ModerationProvider;
}

interface MomentRow {
  id: string;
  user_id: string;
  status: 'uploading' | 'checking' | 'live' | 'removed';
  photo_path: string | null;
  thumb_path: string | null;
  caption: string | null;
  pending_photo_path: string | null;
  pending_thumb_path: string | null;
  pending_caption: string | null;
  pending_since: string | null;
}

const COLUMNS =
  'id, user_id, status, photo_path, thumb_path, caption, pending_photo_path, pending_thumb_path, pending_caption, pending_since';

async function load(db: SupabaseClient, momentId: string): Promise<MomentRow | null> {
  const { data, error } = await db.from('moments').select(COLUMNS).eq('id', momentId).maybeSingle();
  if (error) throw new Error(`moment lookup: ${error.message}`);
  return data as MomentRow | null;
}

/** The content that would become visible: the pending proposal when there is one. */
function contentOf(m: MomentRow): ModerationContent {
  const pending = m.pending_since !== null;
  return {
    momentId: m.id,
    userId: m.user_id,
    photoPath: pending ? m.pending_photo_path : m.photo_path,
    thumbPath: pending ? m.pending_thumb_path : m.thumb_path,
    caption: pending ? m.pending_caption : m.caption,
  };
}

/**
 * Checks one moment and applies the verdict. ownerId, when given, must own the moment (otherwise
 * 'not_found'). Returns null when the proposal changed on every attempt.
 */
export async function moderateMoment(
  db: SupabaseClient,
  provider: ModerationProvider,
  momentId: string,
  ownerId?: string,
): Promise<{ outcome: Outcome; status: MomentRow['status'] | null } | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const m = await load(db, momentId);
    if (!m || (ownerId !== undefined && m.user_id !== ownerId)) return { outcome: 'not_found', status: null };
    if (m.status === 'uploading' || m.status === 'removed' || (m.status === 'live' && m.pending_since === null)) {
      return { outcome: 'nothing_to_check', status: m.status };
    }

    const content = contentOf(m);
    const verdict = await provider.check(content);
    const { data, error } = verdict.decision === 'block'
      ? await db.rpc('moderation_csam_block', {
        p_moment_id: m.id,
        p_pending_since: m.pending_since,
        p_matcher: verdict.matcher,
        p_match: verdict.match,
        p_photo_path: content.photoPath,
        p_thumb_path: content.thumbPath,
      })
      : await db.rpc('moderation_apply', {
        p_moment_id: m.id,
        p_pending_since: m.pending_since,
        p_decision: verdict.decision,
        p_provider: provider.name,
        p_scores: verdict.scores ?? {},
        p_reason: verdict.decision === 'approve' ? null : verdict.reason,
        p_second_opinion: verdict.decision === 'approve' ? null : verdict.secondOpinion ?? null,
      });
    if (error) throw new Error(`moderation (${verdict.decision}): ${error.message}`);
    const result = data as ApplyResult;
    if (result === 'stale') continue; // the owner changed it meanwhile: check the new version

    const after = await load(db, m.id);
    return { outcome: result, status: after?.status ?? null };
  }
  return null;
}

/** Checks one comment's text and applies the verdict. ownerId, when given, must have written it. */
export async function moderateComment(
  db: SupabaseClient,
  provider: ModerationProvider,
  commentId: string,
  ownerId?: string,
): Promise<CommentOutcome> {
  const { data, error } = await db.from('comments').select('id, user_id, body').eq('id', commentId).maybeSingle();
  if (error) throw new Error(`comment lookup: ${error.message}`);
  const c = data as { id: string; user_id: string; body: string } | null;
  if (!c || (ownerId !== undefined && c.user_id !== ownerId)) return 'not_found';

  const verdict = await provider.checkText({ kind: 'comment', userId: c.user_id, text: c.body });
  const applied = await db.rpc('moderation_apply_comment', {
    p_comment_id: c.id,
    p_decision: verdict.decision,
    p_provider: provider.name,
    p_scores: verdict.scores ?? {},
    p_reason: verdict.decision === 'approve' ? null : verdict.reason,
  });
  if (applied.error) throw new Error(`moderation_apply_comment: ${applied.error.message}`);
  return applied.data as CommentOutcome;
}

export async function handleModerate(req: Request, deps: ModerateDeps): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const jwt = bearerToken(req);
  if (!jwt) return fail(401, 'unauthorized', 'Sign in first.');
  const { data: auth } = await deps.userClient(jwt).auth.getUser(jwt);
  const userId = auth.user?.id;
  if (!userId) return fail(401, 'unauthorized', 'Sign in first.');

  const body = await readJson(req);
  if (body === null) return fail(400, 'invalid_json', 'The request body must be JSON.');
  const parsed = ModerateInput.safeParse(body);
  if (!parsed.success) {
    return fail(
      400,
      'invalid_input',
      'The request is not valid.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    );
  }
  if ('commentId' in parsed.data) {
    const { commentId } = parsed.data;
    const outcome = await moderateComment(deps.serviceClient(), deps.provider, commentId, userId);
    if (outcome === 'not_found') return fail(404, 'not_found', 'Comment not found.');
    return ok({ commentId, outcome });
  }
  const { momentId } = parsed.data;

  let result;
  try {
    result = await moderateMoment(deps.serviceClient(), deps.provider, momentId, userId);
  } catch (error) {
    // The photo isn't in the bucket (yet): the moment stays in Checking and the app's retry calls again.
    if (error instanceof MissingObjectError) return fail(409, 'not_ready', 'The photo is not uploaded yet.');
    throw error;
  }
  if (!result) return fail(409, 'changed', 'The moment changed while it was checked. Try again.');
  if (result.outcome === 'not_found') return fail(404, 'not_found', 'Moment not found.');
  const outcome = result.outcome === 'blocked' ? 'removed' : result.outcome;
  return ok({ momentId, outcome, status: result.status });
}
