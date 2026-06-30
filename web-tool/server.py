#!/usr/bin/env python3
"""番茄小说下载器 - 后端代理服务器"""
import http.server, urllib.request, urllib.parse, urllib.error, json, os, time, re, threading, uuid

PORT = 8000
SEARCH_API   = 'https://novel.snssdk.com/api/novel/channel/homepage/search/search/v1/?aid=1967&q={}&offset=0'
DIR_API      = 'https://fanqienovel.com/api/reader/directory/detail?bookId={}'
CONTENT_API  = 'http://101.35.133.34:5000/api/content?tab=%E5%B0%8F%E8%AF%B4&item_id={}'
TIMEOUT = 20
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

# 下载会话管理: {session_id: {status, book_id, item_ids, current, total, paused, content, started_at}}
sessions = {}
sessions_lock = threading.Lock()


def http_get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def resolve_book_id(q):
    m = re.search(r'(\d{16,20})', q)
    if not m:
        return None, None, None
    candidate = m.group(1)

    def extract(url):
        try:
            page = http_get(url).decode('utf-8', errors='ignore')
            m2 = re.search(r'"bookId"\s*:\s*"(\d+)"', page); bid = m2.group(1) if m2 else None
            m2 = re.search(r'"bookName"\s*:\s*"([^"]+)"', page); title = m2.group(1) if m2 else None
            m2 = re.search(r'"author"\s*:\s*"([^"]+)"', page); author = m2.group(1) if m2 else None
            return bid, title, author
        except:
            return None, None, None

    if '/reader/' in q:
        return extract(f'https://fanqienovel.com/reader/{candidate}')
    if '/page/' in q:
        bid, title, author = extract(f'https://fanqienovel.com/page/{candidate}')
        return candidate if not bid else bid, title, author

    bid, title, author = extract(f'https://fanqienovel.com/reader/{candidate}')
    if bid:
        return bid, title, author

    try:
        http_get(DIR_API.format(candidate))
        return candidate, *extract(f'https://fanqienovel.com/page/{candidate}')[1:]
    except:
        pass

    return candidate, None, None


def get_chapter_count(book_id):
    try:
        data = http_get(DIR_API.format(book_id))
        return len(json.loads(data).get('data', {}).get('allItemIds', []))
    except:
        return 0


def download_worker(sid):
    """后台下载线程"""
    with sessions_lock:
        s = sessions.get(sid)
        if not s:
            return
    book_id = s['book_id']
    try:
        data = http_get(DIR_API.format(book_id))
        item_ids = json.loads(data).get('data', {}).get('allItemIds', [])
    except:
        with sessions_lock:
            if sid in sessions:
                sessions[sid]['status'] = 'error'
        return

    with sessions_lock:
        s['total'] = len(item_ids)
        s['item_ids'] = item_ids
        s['content'] = []
        if s['total'] == 0:
            s['status'] = 'done'
            return

    for i in range(s['current'], len(item_ids)):
        with sessions_lock:
            s = sessions.get(sid)
            if not s or s['status'] == 'cancelled':
                return
            if s['paused']:
                break

        item_id = item_ids[i]
        try:
            data = http_get(CONTENT_API.format(item_id))
            result = json.loads(data)
            if result.get('code') == 200:
                text = result['data']['content']
            else:
                text = '[获取失败]'
        except:
            text = '[下载失败]'

        with sessions_lock:
            s = sessions.get(sid)
            if not s:
                return
            s['content'].append(f'\n\n第{i+1}章\n\n{text}')
            s['current'] = i + 1
            if s['current'] >= s['total']:
                s['status'] = 'done'
                return

        if i < len(item_ids) - 1:
            time.sleep(0.5)

    # 如果因暂停退出，保持 paused 状态


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        path = p.path
        params = dict(urllib.parse.parse_qsl(p.query))

        try:
            # --- 下载相关 ---
            if path == '/api/download/start':
                book_id = params.get('book_id', '')
                if not book_id:
                    self.send_json({'error': 'missing book_id'}, 400); return

                sid = uuid.uuid4().hex[:12]
                with sessions_lock:
                    sessions[sid] = {
                        'book_id': book_id, 'status': 'downloading',
                        'total': 0, 'current': 0, 'paused': False,
                        'content': [], 'started_at': time.time()
                    }
                threading.Thread(target=download_worker, args=(sid,), daemon=True).start()
                self.send_json({'session_id': sid})

            elif path == '/api/download/status':
                sid = params.get('session_id', '')
                with sessions_lock:
                    s = sessions.get(sid)
                    if not s:
                        self.send_json({'error': 'session not found'}, 404); return
                    resp = {
                        'status': 'paused' if s['paused'] else s['status'],
                        'total': s['total'],
                        'current': s['current'],
                        'elapsed': time.time() - s['started_at']
                    }
                self.send_json(resp)

            elif path == '/api/download/pause':
                sid = params.get('session_id', '')
                with sessions_lock:
                    s = sessions.get(sid)
                    if not s:
                        self.send_json({'error': 'session not found'}, 404); return
                    s['paused'] = True
                self.send_json({'ok': True})

            elif path == '/api/download/resume':
                sid = params.get('session_id', '')
                with sessions_lock:
                    s = sessions.get(sid)
                    if not s:
                        self.send_json({'error': 'session not found'}, 404); return
                    if not s['paused']:
                        self.send_json({'ok': True, 'note': 'not paused'}); return
                    s['paused'] = False
                threading.Thread(target=download_worker, args=(sid,), daemon=True).start()
                self.send_json({'ok': True})

            elif path == '/api/download/file':
                sid = params.get('session_id', '')
                with sessions_lock:
                    s = sessions.get(sid)
                    if not s:
                        self.send_json({'error': 'session not found'}, 404); return
                    if s['status'] != 'done':
                        self.send_json({'error': f'not done yet, status={s["status"]}'}, 400); return
                    content = ''.join(s['content'])
                    sessions.pop(sid, None)

                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename=fanqie_{s.get("book_id","")}.txt')
                self.send_header('Content-Length', str(len(content.encode('utf-8'))))
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))

            # --- 其他 API ---
            elif path == '/api/resolve':
                q = params.get('q', '')
                if not q: self.send_json({'error': 'missing q'}, 400); return
                book_id, title, author = resolve_book_id(q)
                if book_id:
                    count = get_chapter_count(book_id)
                    self.send_json({'book_id': book_id, 'count': count, 'title': title, 'author': author})
                else:
                    self.send_json({'error': '无法识别链接'}, 400)

            elif path == '/api/search':
                q = params.get('q', '')
                if not q: self.send_json({'error': 'missing q'}, 400); return
                data = http_get(SEARCH_API.format(urllib.request.quote(q)))
                result = json.loads(data)
                books = [{
                    'book_id': i.get('book_id'), 'title': i.get('title', ''),
                    'author': i.get('author', ''), 'cover': i.get('thumb_url', ''),
                } for i in result.get('data', {}).get('ret_data', [])]
                self.send_json({'books': books})

            elif path == '/api/directory':
                book_id = params.get('book_id', '')
                if not book_id: self.send_json({'error': 'missing book_id'}, 400); return
                data = http_get(DIR_API.format(book_id))
                result = json.loads(data).get('data', {})
                self.send_json({'total': len(result.get('allItemIds', [])), 'ids': result.get('allItemIds', [])})

            elif path == '/api/content':
                item_id = params.get('item_id', '')
                if not item_id: self.send_json({'error': 'missing item_id'}, 400); return
                data = http_get(CONTENT_API.format(item_id))
                result = json.loads(data)
                self.send_json({'content': result['data']['content']} if result.get('code') == 200
                               else {'error': result.get('message', 'unknown')})

            else:
                super().do_GET()

        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))


if __name__ == '__main__':
    print(f'番茄小说下载器已启动: http://localhost:{PORT}')
    http.server.HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
