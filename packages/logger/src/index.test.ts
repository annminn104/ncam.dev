import { describe, expect, it } from 'vitest';
import { createLogger, type LogRecord } from './index';

describe('createLogger', () => {
  it('filters out records below the configured level', () => {
    const levels: string[] = [];
    const log = createLogger({
      level: 'warn',
      console: false,
      events: false,
      sink: (r) => levels.push(r.level),
    });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(levels).toEqual(['warn', 'error']);
  });

  it('derives a child scope as parent:child and inherits options', () => {
    const scopes: string[] = [];
    const log = createLogger({
      scope: 'host',
      console: false,
      events: false,
      sink: (r) => scopes.push(r.scope),
    });
    log.child('remote').info('hi');
    expect(scopes).toEqual(['host:remote']);
  });

  it('passes message + structured data through to the sink', () => {
    const records: LogRecord[] = [];
    const log = createLogger({ console: false, events: false, sink: (r) => records.push(r) });
    log.info('msg', { a: 1 });
    expect(records).toHaveLength(1);
    expect(records[0].message).toBe('msg');
    expect(records[0].data).toEqual({ a: 1 });
    expect(typeof records[0].time).toBe('number');
  });
});
