import assert from 'assert';
import deepEqual from 'deep-equal';
import { parse } from '../../src/index'; // Adjust the import path as necessary

const invalidTypes: string[] = [
  ' ',
  'null',
  'undefined',
  '/',
  'text / plain',
  'text/;plain',
  'text/"plain"',
  'text/p£ain',
  'text/(plain)',
  'text/@plain',
  'text/plain,wrong',
];

describe('parseMediaType(string)', function () {
  it('should parse basic type', function () {
    const type = parse('text/html');
    assert.strictEqual(type?.type, 'text/html');
  });

  it('should parse with suffix', function () {
    const type = parse('image/svg+xml');
    assert.strictEqual(type?.type, 'image/svg+xml');
  });

  it('should parse basic type with surrounding OWS', function () {
    const type = parse(' text/html ');
    assert.strictEqual(type?.type, 'text/html');
  });

  it('should parse parameters', function () {
    const type = parse('text/html; charset=utf-8; foo=bar');
    assert.strictEqual(type?.type, 'text/html');
    assert.ok(deepEqual(type?.parameters, { charset: 'utf-8', foo: 'bar' }));
  });

  it('should parse parameters with extra LWS', function () {
    const type = parse('text/html ; charset=utf-8 ; foo=bar');
    assert.strictEqual(type?.type, 'text/html');
    assert.ok(deepEqual(type?.parameters, { charset: 'utf-8', foo: 'bar' }));
  });

  it('should lower-case type', function () {
    const type = parse('IMAGE/SVG+XML');
    assert.strictEqual(type?.type, 'image/svg+xml');
  });

  it('should lower-case parameter names', function () {
    const type = parse('text/html; Charset=UTF-8');
    assert.strictEqual(type?.type, 'text/html');
    assert.ok(deepEqual(type?.parameters, { charset: 'UTF-8' }));
  });

  it('should unquote parameter values', function () {
    const type = parse('text/html; charset="UTF-8"');
    assert.strictEqual(type?.type, 'text/html');
    assert.ok(deepEqual(type?.parameters, { charset: 'UTF-8' }));
  });

  it('should unquote parameter values with escapes', function () {
    const type = parse('text/html; charset = "UT\\F-\\\\\\"8\\""');
    assert.strictEqual(type?.type, 'text/html');
    assert.ok(deepEqual(type?.parameters, { charset: 'UTF-\\"8"' }));
  });

  it('should handle balanced quotes', function () {
    const type = parse('text/html; param="charset=\\"utf-8\\"; foo=bar"; bar=foo');
    assert.strictEqual(type?.type, 'text/html');
    assert.ok(deepEqual(type?.parameters, { param: 'charset="utf-8"; foo=bar', bar: 'foo' }));
  });

  invalidTypes.forEach((type) => {
    it(`should throw on invalid media type ${type}`, function () {
      assert.throws(() => parse(type), /Invalid media type/)
    });
  });

  it('should throw on invalid media type', function () {
    assert.throws(() => parse('text/plain; foo="bar'), /Invalid media type/);
    assert.throws(() => parse('text/plain; profile=http://localhost; foo=bar'), /Invalid media type/);
    assert.throws(() => parse('text/plain; profile=http://localhost'), /Invalid media type/);
  });

  it('should require argument', function () {
    assert.throws(() => parse(undefined as unknown as string), /Invalid media type/);
  });

  it('should reject non-strings', function () {
    assert.throws(() => parse(7 as unknown as string), /Invalid media type/);
  });
});

describe('parseMediaType(req)', function () {
  it('should parse content-type header', function () {
    const req = new Request('https://example.com', {
      headers: new Headers({
        'Content-Type': 'text/html'
      })
    });
    const type = parse(req);
    assert.strictEqual(type?.type, 'text/html');
  });

  it('should reject objects without headers property', function () {
    assert.throws(() => parse({} as unknown as Request), /Invalid media type/);
  });

  it('should reject missing content-type', function () {
    var res = new Request('https://example.com', {
      headers: new Headers({
        'Content-Type': ''
      })
    });
    assert.throws(parse.bind(null, res), /Invalid media type/)
  });
})