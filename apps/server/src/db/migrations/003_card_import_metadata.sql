CREATE TABLE IF NOT EXISTS card_import_metadata (
  id           INTEGER PRIMARY KEY,
  last_import_at TIMESTAMPTZ,
  parquet_mtime  TIMESTAMPTZ,
  parquet_count  INTEGER
);
