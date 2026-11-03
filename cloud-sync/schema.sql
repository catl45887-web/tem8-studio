CREATE TABLE IF NOT EXISTS sync_items (
  sync_hash TEXT NOT NULL,
  item_key TEXT NOT NULL,
  value TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (sync_hash, item_key)
);
