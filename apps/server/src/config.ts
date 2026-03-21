export interface Config {
  port: number;
  dbPath: string;
  nodeEnv: 'development' | 'test' | 'production';
}

export function loadConfig(): Config {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as Config['nodeEnv'];

  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    // In test mode, always use in-memory DuckDB — no files written to disk.
    dbPath: nodeEnv === 'test' ? ':memory:' : (process.env['DB_PATH'] ?? './binder.duckdb'),
    nodeEnv,
  };
}
