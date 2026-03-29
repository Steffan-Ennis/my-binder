-- Card data tables (populated by card importer from MTGJSON parquet files).
-- These are empty stubs so queries don't fail before the first import.
-- The card importer replaces these with the full parquet schema on first run.

CREATE TABLE IF NOT EXISTS mtgjson_cards (
  uuid          VARCHAR PRIMARY KEY,
  name          VARCHAR,
  setCode       VARCHAR,
  number        VARCHAR,
  availability  VARCHAR,
  colorIdentity VARCHAR,
  manaCost      VARCHAR,
  manaValue     DOUBLE
);

CREATE TABLE IF NOT EXISTS mtgjson_card_identifiers (
  uuid       VARCHAR PRIMARY KEY,
  scryfallId VARCHAR
);

CREATE TABLE IF NOT EXISTS mtgjson_card_legalities (
  uuid      VARCHAR PRIMARY KEY,
  commander VARCHAR
);
