type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

function formatLog(entry: LogEntry): string {
  const { level, message, timestamp, data } = entry;
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m', // Green
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
  };
  const reset = '\x1b[0m';
  const color = levelColors[level];

  let output = `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;
  if (data) {
    output += ` ${JSON.stringify(data)}`;
  }
  return output;
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, data?: unknown): void => log('debug', message, data),
  info: (message: string, data?: unknown): void => log('info', message, data),
  warn: (message: string, data?: unknown): void => log('warn', message, data),
  error: (message: string, data?: unknown): void => log('error', message, data),
};
