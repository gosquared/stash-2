import ioredis from 'ioredis';
import QuickLRU, { Options as QLRUOpts } from '@gosquared/quick-lru-cjs';
import Redlock from 'redlock';

type Fetcher<T> = (key: string) => Promise<T>;
export interface StashOpts {
  createRedis?: () => ioredis.Redis
  LRUMax?: number
  log?: (...args: any[]) => void
  redisTtlMs?: number
}

function createLRU(opts: StashOpts) {
  const max = opts.LRUMax || 1000;
  const LRUOpts: QLRUOpts<string, any> = { maxSize: max };
  return new QuickLRU<string, any>(LRUOpts);
}

const TEN_MINS_IN_MS = 10 * 60 * 1000;

function createRedlock(redis: ioredis.Redis) {
  const opts = { retryCount: 0 };
  const redlock = new Redlock([ redis ], opts);
  return redlock;
}

async function getCached<T>(
  key: string,
  lru: QuickLRU<string, any>,
  redis: ioredis.Redis,
  log: (...args: any[]) => void,
): Promise<T | undefined | null | string> {
  let value: string | undefined | null | T = lru.get(key);
  if (value) {
    return value;
  }

  value = await redis.get(key);

  if (!value) return value;

  try {
    value = JSON.parse(value);
  } catch (e) {
    log('json parse error', e.stack);
    throw e;
  }

  return value;
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class LockErr extends Error {
  info: any;
  constructor(info: any) {
    super('Could not acquire lock');
    this.info = info;
  }
}

const topic = 'stash:invalidations';

export class Stash {
  lru: QuickLRU<string, any>;
  redis: ioredis.Redis;
  log: (...args: any[]) => void;
  redisTtlMs: number;
  redlock: Redlock;
  broadcast: ioredis.Redis;

  constructor(opts: StashOpts = {}) {
    let createRedis = opts.createRedis || (() => new ioredis());
    this.lru = createLRU(opts);
    this.redis = createRedis();
    this.broadcast = createRedis();
    this.log = opts.log || (() => {});
    this.redisTtlMs = opts.redisTtlMs || TEN_MINS_IN_MS;
    this.redlock = createRedlock(this.redis);
    this.subscribe();
  }

  async get<T>(key: string, fetch: Fetcher<T>) {
    const lockKey = `${key}:lock`;
    const _getCached = () => getCached<T>(key, this.lru, this.redis, this.log);
    const setLock = () => this.redlock.lock(lockKey, this.redisTtlMs);
    let attempts = 0;
    let waitMs = 200;
    let lock;
    let value = await _getCached();

    while (!value && !lock) {
      try {
        lock = await setLock();
      } catch (err) {
        attempts += 1;
        if (attempts === 5) {
          const info = { redlockErr: err, attempts };
          throw new LockErr(info);
        }
        await wait(waitMs);
        value = await _getCached();
        continue;
      }
    }

    if (lock) {
      value = await fetch(key);
      this.lru.set(key, value);
      const stringified = JSON.stringify(value);
      await this.redis.psetex(key, this.redisTtlMs, stringified);
      this.lru.set(key, value);
      await lock.unlock();
    }

    return value;
  }

  async del(key: string) {
    this.lru.delete(key);
    await this.redis.del(key);
    return true;
  }

  subscribe() {
    const handleMessage = (channel: string, message: string) => {
      if (channel !== topic) return;

      let msg;
      try {
        msg = JSON.parse(message);
      } catch (e) {
        return;
      }

      const key = msg.key;
      this.lru.delete(key);
    };

    this.broadcast.on('message', handleMessage);
    this.broadcast.subscribe(topic);
  }
}

export function createStash(opts = {}) {
  return new Stash(opts);
}
