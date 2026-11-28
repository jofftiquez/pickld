# Member numbers

Every account gets a member number when it is let in (migration 0182), shown as `#000000001`. Numbers are
never reused, and a failed sign-up doesn't use one up. #1 is held for the founder and is given by hand, once.

## Give #1

Run once per database (local, staging, production) in the SQL editor or `psql` as `postgres`, right after the
founder's account exists:

```sql
select public.give_member_number_one('<founder username>');
```

- It refuses if someone already holds #1, or if no profile has that username.
- If the founder's account had the newest number, that number goes to the next person. Otherwise the old
  number stays unused for good, so run it before anyone else signs up.

## Check

```sql
select member_number, username, hide_member_number from public.profiles order by member_number limit 10;
select last_number from public.member_number_counter;
```

## Hiding

People turn their number off in Settings → Privacy → Show my member number. While it's off, other people,
pickld.me and share cards don't get it (`public_member_number` is null); the owner still sees it in Settings.
