import LRU from 'lru-cache';
import ioredis from 'ioredis';
import LRUCache from 'lru-cache';

type Fetcher<T> = (key: string) => Promise<T>;
interface StashOpts {
  createRedis?: () => ioredis.Redis
  LRUMax?: number
  log?: (...args: any[]) => void
  redisTtlMs?: number
}

function createLRU(opts: StashOpts) {
  const max = opts.LRUMax || 1000;
  const LRUOpts: LRUCache.Options<string, any> = { max };
  return new LRU(LRUOpts);
}

const TEN_MINS_IN_MS = 10 * 60 * 1000;

class Stash {
  lru: LRU<string, any>;
  redis: ioredis.Redis;
  log: (...args: any[]) => void;
  redisTtlMs: number;

  constructor(opts: StashOpts) {
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
    this.lru.del(key);
    await this.redis.del(key);
    return true;
  }
}

export function createStash(opts = {}) {
  return new Stash(opts);
}
