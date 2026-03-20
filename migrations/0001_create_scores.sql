CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  enemies_destroyed INTEGER NOT NULL DEFAULT 0,
  highest_combo INTEGER NOT NULL DEFAULT 0,
  waves_survived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_scores_score ON scores (score DESC);
