
```js
const stash = new Stash();
const key = 'test';
const fetch = async () => { return { test:1 } }
const value = await stash.get(key, fetch);
```

```bash
npm i
npm run watch
```
