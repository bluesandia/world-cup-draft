create table if not exists leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[A-Z0-9]{1,9}$'),
  score integer not null check (score >= 0 and score <= 150),
  result text not null,
  roster jsonb not null,
  created_at timestamptz not null default now()
);

alter table leaderboard_scores enable row level security;

drop policy if exists "Public leaderboard read" on leaderboard_scores;
create policy "Public leaderboard read"
on leaderboard_scores
for select
using (true);

drop policy if exists "Public leaderboard insert" on leaderboard_scores;
create policy "Public leaderboard insert"
on leaderboard_scores
for insert
with check (
  name ~ '^[A-Z0-9]{1,9}$'
  and score >= 0
  and score <= 150
  and jsonb_typeof(roster) = 'array'
  and jsonb_array_length(roster) = 11
);

create index if not exists leaderboard_scores_rank_idx
on leaderboard_scores (score desc, created_at asc);
