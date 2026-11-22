type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const logObj = {
    timestamp,
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  return JSON.stringify(logObj);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(formatLog('info', msg, meta));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(formatLog('warn', msg, meta));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(formatLog('error', msg, meta));
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', msg, meta));
    }
  },
};
