-- Times are Unix milliseconds, the same clock as SolveRecord.createdAt.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at INTEGER NOT NULL
);

-- Only the SHA-256 of each session token is stored, so a leaked table cannot be replayed as cookies.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_user_id ON sessions (user_id);

-- payload is the full SolveRecord as JSON; created_at is copied out of it for ordering.
CREATE TABLE solves (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX solves_user_created_at ON solves (user_id, created_at DESC);
