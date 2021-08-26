import ioredis from 'ioredis';
import QuickLRU, { Options as QLRUOpts } from '@gosquared/quick-lru-cjs';

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

export class Stash {
  lru: QuickLRU<string, any>;
  redis: ioredis.Redis;
  log: (...args: any[]) => void;
  redisTtlMs: number;

  constructor(opts: StashOpts = {}) {
    this.lru = createLRU(opts);
    if (opts.createRedis) {
      this.redis = opts.createRedis();
    } else {
      this.redis = new ioredis();
    }
    this.log = opts.log || (() => {});
    this.redisTtlMs = opts.redisTtlMs || TEN_MINS_IN_MS;
  }

  async get<T>(key: string, fetch: Fetcher<T>): Promise<T> {
    let value: string | undefined | null | T = this.lru.get(key);
    if (value) {
      return value;
    }

    value = await this.redis.get(key);

    if (!value) {
      value = await fetch(key);
      this.lru.set(key, value);
      const stringified = JSON.stringify(value);
      this.redis.psetex(key, this.redisTtlMs, stringified);
      return value;
    }

    try {
      value = JSON.parse(value);
    } catch (e) {
      this.log('json parse error', e.stack);
      throw e;
    }

    this.lru.set(key, value);
    return value;
  }

  async del(key: string) {
    this.lru.delete(key);
    await this.redis.del(key);
    return true;
  }
}

export function createStash(opts = {}) {
  return new Stash(opts);
}
