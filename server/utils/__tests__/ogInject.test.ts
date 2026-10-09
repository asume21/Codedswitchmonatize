import { describe, it, expect } from 'vitest';
import { injectOgMeta } from '../ogInject';

const page = `<html><head><title>Old</title>
<link rel="canonical" href="x" />
<meta name="description" content="old" />
<meta property="og:title" content="old" />
<meta property="og:description" content="old" />
<meta property="og:url" content="x" />
<meta property="og:image" content="x" />
<meta name="twitter:title" content="old" />
<meta name="twitter:description" content="old" />
<meta name="twitter:url" content="x" />
<meta name="twitter:image" content="x" />
</head><body>APP</body></html>`;

// Security review 2026-10-09: song names and usernames now reach this, and
// String.replace treats $&, $\`, $' and $1 in a replacement STRING as patterns
// that splice page HTML back in. User text must land literally.
describe('injectOgMeta', () => {
  it('inserts the values', () => {
    const out = injectOgMeta(page, 'https://a.b/s/1', 'https://a.b/og.png', { title: 'T', description: 'D' });
    expect(out).toContain('<title>T</title>');
    expect(out).toContain('<meta property="og:title" content="T" />');
    expect(out).toContain('<meta name="twitter:image" content="https://a.b/og.png" />');
  });

  it("treats $&, $' and $1 in user text literally", () => {
    const out = injectOgMeta(page, 'u', 'i', { title: "a$'b$&c$1", description: 'd$`e' });
    expect(out).toContain('<title>a$\'b$&amp;c$1</title>');
    expect(out).toContain('content="d$`e"');
    expect(out).not.toContain('APP</body></html>b'); // nothing spliced in from the page
    expect(out.match(/<body>APP<\/body>/g)).toHaveLength(1);
  });

  it('escapes quotes and angle brackets', () => {
    const out = injectOgMeta(page, 'u', 'i', { title: '"><script>x</script>', description: 'd' });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&quot;&gt;&lt;script&gt;');
  });
});
