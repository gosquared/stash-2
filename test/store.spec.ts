import { spy, stub } from 'sinon';
import { Stash } from '../src/main';
import { expect } from 'chai';
import faker from 'faker';
import IORedis from 'ioredis';

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
    const stash = new Stash();
    await stash.get(key, fetch);
    expect(stash.lru.has(key)).equals(true);
  });
  it('should save value in redis', async () => {
    const key = faker.datatype.uuid();
    const fetch = async () => 'test';
    const stash = new Stash();
    await stash.get(key, fetch);
    const redis = new IORedis();
    const result = await redis.exists(key);
    expect(result).equals(1);
  });
})
