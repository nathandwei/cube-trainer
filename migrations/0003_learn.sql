-- The learn section: one settings document per account, and an append-only log of drill reps.

-- Last writer wins by updated_at (the client's clock, in ms).
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- payload is the full rep as JSON; created_at, item and kind are copied out of it for ordering and lookups.
CREATE TABLE reps (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  item TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX reps_user_page ON reps (user_id, created_at DESC, id DESC);

-- Per-account totals for the rep quota, kept current by triggers like the solve totals in 0002.
ALTER TABLE users ADD COLUMN rep_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN rep_bytes INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER reps_totals_insert AFTER INSERT ON reps BEGIN
  UPDATE users SET rep_count = rep_count + 1, rep_bytes = rep_bytes + length(CAST(NEW.payload AS BLOB))
  WHERE id = NEW.user_id;
END;

CREATE TRIGGER reps_totals_update AFTER UPDATE OF payload ON reps BEGIN
  UPDATE users SET rep_bytes = rep_bytes - length(CAST(OLD.payload AS BLOB)) + length(CAST(NEW.payload AS BLOB))
  WHERE id = NEW.user_id;
END;

CREATE TRIGGER reps_totals_delete AFTER DELETE ON reps BEGIN
  UPDATE users SET rep_count = rep_count - 1, rep_bytes = rep_bytes - length(CAST(OLD.payload AS BLOB))
  WHERE id = OLD.user_id;
END;
