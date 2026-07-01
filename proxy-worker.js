/**
 * CORS Proxy for fanqienovel.com APIs
 * Deploy to Cloudflare Workers (free tier: 100k req/day)
 */
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url param', { status: 400 });

    let parsed;
    try { parsed = new URL(target); } catch { return new Response('Invalid url', { status: 400 }); }

    const allowedHosts = [
      'novel.snssdk.com',
      'fanqienovel.com',
      '101.35.133.34',
    ];

    if (!allowedHosts.some(h => parsed.hostname.endsWith(h))) {
      return new Response('Host not allowed', { status: 403 });
    }

    const resp = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://fanqienovel.com/',
      }
    });

    return new Response(resp.body, {
      status: resp.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': resp.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=300',
      }
    });
  }
}
