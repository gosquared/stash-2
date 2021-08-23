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
  it('should save value in redis');
  it('should save value in lru');
})
