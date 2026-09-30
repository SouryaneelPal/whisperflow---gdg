// There is deliberately no request/access logging: access logs record IP addresses and
// user agents, which could identify a reporter. Only log application events.
type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, err?: unknown) {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
  const out = level === 'error' ? console.error : console.log;

  if (err === undefined) {
    out(line);
    return;
  }

  out(line, err instanceof Error ? err.stack : String(err));
}

export const logger = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string, err?: unknown) => write('error', message, err),
};
