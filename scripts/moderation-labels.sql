-- Labelled beta items for the threshold replay test (M5-05). Run read-only against staging or production
-- with a role that can read moderation_items, e.g.
--   psql "$DATABASE_URL" -At -f scripts/moderation-labels.sql > /tmp/labels.json
-- then append the items you want to keep to supabase/functions/tests/fixtures/moderation/labelled.json.
--
-- Only scores leave the database: no photo, caption, comment text or user id (AGENTS.md rules 9 and 10).
-- human is the final verdict: removed and not overturned on appeal = remove; kept, or overturned = keep.
-- expect is what the thresholds of that time decided (removed with no moderator = remove, else review);
-- review the list before committing it and set expect to what the new thresholds should decide.
-- Approved items never create a row, so beta data can only label queued and removed items; approvals
-- are covered by the synthetic items.
select coalesce(json_agg(row_to_json(l) order by l.id), '[]'::json)
from (
  select
    'beta-' || left(mi.id::text, 8) as id,
    'beta' as source,
    case when mi.comment_id is not null then 'text' else 'photo' end as kind,
    case
      when mi.status = 'removed' and not exists (
        select 1 from appeals a where a.moderation_item_id = mi.id and a.status = 'overturned'
      ) then 'remove'
      else 'keep'
    end as human,
    case when mi.status = 'removed' and mi.decided_by is null then 'remove' else 'review' end as expect,
    (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      from jsonb_each(mi.scores)
      where jsonb_typeof(value) = 'number'
    ) as scores,
    'thresholds ' || coalesce(mi.scores ->> 'thresholds', '?') || ', model ' || coalesce(mi.scores ->> 'model', '?')
      || ', decided ' || to_char(mi.decided_at, 'YYYY-MM-DD') as note
  from moderation_items mi
  where mi.source = 'auto_check'
    and mi.status in ('kept', 'removed')
    and mi.scores ? 'thresholds'
) l;
