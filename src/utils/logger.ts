// There is deliberately no request/access logging: access logs record IP addresses and
// user agents, which could identify a reporter. Only log application events.
type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string) {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;

  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message),
};
