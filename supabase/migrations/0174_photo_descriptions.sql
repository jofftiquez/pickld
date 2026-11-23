-- 0174 — Photo descriptions (alt text): the owner can describe a moment's photo, and screen readers read the
-- description to everyone who can see the moment (NFR-A11Y; rule 11).
-- Additive only: two check constraints, no column or data changes.
--
-- The description is `alt` in the moment's `edits` JSON, next to the filter and overlays. That way it follows
-- the content path edits already take: a change to a submitted moment lands in pending_edits and only shows
-- once fn:moderate approves it (0004, 0011), fn:moderate scores it with the caption, and it reaches exactly the
-- people who can see the moment (feeds, the jar page, the public web page), never anyone else (rule 9).
-- The database refuses anything but a non-empty string of at most 250 characters.

alter table public.moments
  add constraint moments_edits_alt_check check (
    edits -> 'alt' is null
    or (jsonb_typeof(edits -> 'alt') = 'string' and char_length(edits ->> 'alt') between 1 and 250)
  ),
  add constraint moments_pending_edits_alt_check check (
    pending_edits -> 'alt' is null
    or (jsonb_typeof(pending_edits -> 'alt') = 'string' and char_length(pending_edits ->> 'alt') between 1 and 250)
  );
