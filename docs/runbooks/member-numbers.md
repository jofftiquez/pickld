# Member numbers

Every account gets a member number when it is let in (migration 0182), shown as `#000000101`. Numbers count up
from 101, are never reused, and a failed sign-up doesn't use one up. #1 to #100 are kept for the founders to hand
out by hand.

## Hand out a number from 1 to 100

Run in the SQL editor or `psql` as `postgres`, on each database (local, staging, production), once the person has
an account:

```sql
select public.give_member_number('<username>', 1);
```

- It refuses a number outside 1 to 100, a number someone already holds, or a username nobody has.
- The person's old number from 101 up stays unused for good, unless it was the newest one given out (then the
  next sign-up gets it). An old number from 1 to 100 is free to hand out again.
- Works for a waiting account too: it keeps the number when it is let in.

## Check

```sql
select member_number, username, hide_member_number from public.profiles where member_number <= 100 order by 1;
select last_number from public.member_number_counter;
```

## Hiding

People turn their number off in Settings → Privacy → Show my member number. While it's off, other people,
pickld.me and share cards don't get it (`public_member_number` is null); the owner still sees it in Settings.
