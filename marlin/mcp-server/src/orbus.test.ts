import assert from 'node:assert/strict';
import test from 'node:test';
import { buildObjectSearchUrl } from './orbus.js';

const baseUrl = new URL('https://demo-api.iserver365.com');

test('builds a bounded Orbus OData search URL and escapes apostrophes', () => {
  const url = buildObjectSearchUrl(baseUrl, "People's Hub", 12);

  assert.equal(url.origin, baseUrl.origin);
  assert.equal(url.pathname, '/odata/Objects');
  assert.equal(url.searchParams.get('$select'), 'objectId,name,objectTypeId,modelId');
  assert.equal(url.searchParams.get('$filter'), "substringof('People''s Hub',name) eq true");
  assert.equal(url.searchParams.get('$top'), '12');
});
