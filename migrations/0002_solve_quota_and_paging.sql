-- Per-account totals that the solve quota is checked against. Triggers keep them current on every write, so a
-- write never has to scan the account's solves. Bytes are the UTF-8 length of the stored payload.

ALTER TABLE users ADD COLUMN solve_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN solve_bytes INTEGER NOT NULL DEFAULT 0;

UPDATE users SET
  solve_count = (SELECT COUNT(*) FROM solves WHERE solves.user_id = users.id),
  solve_bytes = (SELECT COALESCE(SUM(length(CAST(payload AS BLOB))), 0) FROM solves WHERE solves.user_id = users.id);

CREATE TRIGGER solves_totals_insert AFTER INSERT ON solves BEGIN
  UPDATE users SET solve_count = solve_count + 1, solve_bytes = solve_bytes + length(CAST(NEW.payload AS BLOB))
  WHERE id = NEW.user_id;
END;

CREATE TRIGGER solves_totals_update AFTER UPDATE OF payload ON solves BEGIN
  UPDATE users SET solve_bytes = solve_bytes - length(CAST(OLD.payload AS BLOB)) + length(CAST(NEW.payload AS BLOB))
  WHERE id = NEW.user_id;
END;

CREATE TRIGGER solves_totals_delete AFTER DELETE ON solves BEGIN
  UPDATE users SET solve_count = solve_count - 1, solve_bytes = solve_bytes - length(CAST(OLD.payload AS BLOB))
  WHERE id = OLD.user_id;
END;

-- Pages are read newest first by (created_at, id), the id breaking ties between solves saved in the same millisecond.
DROP INDEX solves_user_created_at;
CREATE INDEX solves_user_page ON solves (user_id, created_at DESC, id DESC);
