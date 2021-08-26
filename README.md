# Install

    npm i @gosquared/stash-2

# Usage
```js
const stash = new Stash();
const key = 'test';
const fetch = async () => { return { test: 1 } }
const value = await stash.get(key, fetch);
```
# Development

```bash
npm i
npm run watch
npm test
```
