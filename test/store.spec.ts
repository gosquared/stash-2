import { spy, stub } from 'sinon';
import { Stash, StashOpts } from '../src/main';
import { expect, use } from 'chai';
import sinonChai  from 'sinon-chai';
import faker from 'faker';
import IORedis from 'ioredis';

use(sinonChai);
const redis = new IORedis(6391);
const createRedis = () => redis;
const clearRedis = () => redis.flushall();


describe('redis', () => {
  before(clearRedis);
  it('getting nonexistent key', async () => {
    const key = faker.datatype.uuid();
    const result = await redis.get(key);
    expect(result).to.be.null;
  })
  it('getting empty key', async () => {
    const key = faker.datatype.uuid();
    await redis.set(key, '');
    const result = await redis.get(key);
    expect(result).equals('');
  })
});

describe('stashing new value', () => {
  it('should store in lru');
  it('should store in redis');
});

describe('getting stashed value', () => {
  it('should come from lru');
  it('should come from redis if not in lru');
})

describe('getting a value', () => {
  it('should come from lru if stashed');
  it('should come from redis if not in lru');
  it('should fetch if not in redis');
  it('should save value in lru', async () => {
    const key = faker.datatype.uuid();
    const fetch = async () => 'test';
    const opts: StashOpts  = { createRedis };
    const stash = new Stash(opts);
    await stash.get(key, fetch);
    expect(stash.lru.has(key)).equals(true);
  });
  it('should save value in redis', async () => {
    const key = faker.datatype.uuid();
    const fetch = async () => 'test';
    const opts: StashOpts  = { createRedis };
    const stash = new Stash(opts);
    await stash.get(key, fetch);
    const result = await redis.exists(key);
    expect(result).equals(1);
  });
})

describe('multiple get', () => {
  before(clearRedis);
  it('only calls fetch once', async () => {
    const key = faker.datatype.uuid();
    const fetch = async () => 'test';
    const _fetch = spy(fetch);
    const opts: StashOpts  = { createRedis };
    const stash = new Stash(opts);
    await Promise.all([
      stash.get(key, _fetch),
      stash.get(key, _fetch)
    ]);
    const result = await redis.exists(key);
    expect(result).equals(1);
    expect(_fetch).callCount(1);
  });
})
