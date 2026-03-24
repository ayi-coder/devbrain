import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHashParams, buildHashString } from '../js/router.js';

describe('parseHashParams', () => {
  it('parses view from plain hash', () => {
    assert.deepEqual(parseHashParams('#quiz'), { view: 'quiz', params: {} });
  });

  it('parses view and single query param', () => {
    assert.deepEqual(
      parseHashParams('#quiz?preload=my-concept'),
      { view: 'quiz', params: { preload: 'my-concept' } },
    );
  });

  it('parses multiple query params', () => {
    const { view, params } = parseHashParams('#home?foo=1&bar=2');
    assert.equal(view, 'home');
    assert.equal(params.foo, '1');
    assert.equal(params.bar, '2');
  });

  it('defaults to home for empty string', () => {
    assert.deepEqual(parseHashParams(''), { view: 'home', params: {} });
  });

  it('defaults to home for bare hash', () => {
    assert.deepEqual(parseHashParams('#'), { view: 'home', params: {} });
  });

  it('decodes URI-encoded param values', () => {
    const { params } = parseHashParams('#quiz?preload=my%20concept');
    assert.equal(params.preload, 'my concept');
  });
});

describe('buildHashString', () => {
  it('builds hash from view only', () => {
    assert.equal(buildHashString('home', {}), 'home');
  });

  it('builds hash with a single query param', () => {
    assert.equal(buildHashString('quiz', { preload: 'my-concept' }), 'quiz?preload=my-concept');
  });

  it('omits params with empty string values', () => {
    assert.equal(buildHashString('quiz', { preload: '' }), 'quiz');
  });

  it('round-trips through parseHashParams', () => {
    const original = { view: 'quiz', params: { preload: 'shell-terminal-mkdir' } };
    const hash = '#' + buildHashString(original.view, original.params);
    assert.deepEqual(parseHashParams(hash), original);
  });
});
