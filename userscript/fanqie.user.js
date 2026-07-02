// ==UserScript==
// @name              番茄小说免费阅读
// @namespace         https://github.com/scpxin/fanqie
// @version           2.0.3
// @description       自动获取番茄小说锁定章节的完整内容，支持下载整本
// @license           MIT License
// @match             https://fanqienovel.com/*
// @run-at            document-start
// @connect           101.35.133.34
// @connect           fanqienovel.com
// @icon              https://www.google.com/s2/favicons?sz=64&domain=fanqienovel.com
// @grant             GM_xmlhttpRequest
// @grant             GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    var CONTENT_API = 'http://101.35.133.34:5000/api/content?tab=%E5%B0%8F%E8%AF%B4&item_id=';
    var DIR_API = 'https://fanqienovel.com/api/reader/directory/detail?bookId=';

    GM_addStyle([
        '.fq-toolbar{position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px}',
        '.fq-btn{border:none;border-radius:6px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);transition:all .2s}',
        '.fq-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.3)}',
        '.fq-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}',
        '.fq-btn-copy{background:linear-gradient(135deg,#11998e,#38ef7d)}',
        '.fq-btn-fetch{background:linear-gradient(135deg,#667eea,#764ba2)}',
        '.fq-btn-book{background:linear-gradient(135deg,#f093fb,#f5576c)}',
        '.fq-status{font-size:12px;color:#999;text-align:center;margin-top:4px;max-width:150px;word-break:break-all}',
        '.fq-notice{margin:12px 0;padding:10px 14px;border-radius:4px;font-size:13px;line-height:1.6}',
        '.fq-notice-info{background:#d4edda;border:1px solid #28a745;color:#155724}',
        '.fq-notice-warn{background:#fff3cd;border:1px solid #ffc107;color:#856404}',
        '@keyframes fq-spin{to{transform:rotate(360deg)}}',
        '.fq-loader{text-align:center;padding:40px 0;color:#666}',
        '.fq-spinner{display:inline-block;width:24px;height:24px;border:3px solid #ddd;border-top-color:#667eea;border-radius:50%;animation:fq-spin .8s linear infinite}',
        '.fq-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:999999;display:flex;align-items:center;justify-content:center}',
        '.fq-modal-box{background:#fff;border-radius:12px;padding:30px;min-width:360px;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,.2)}',
        '.fq-modal-title{font-size:18px;font-weight:600;margin-bottom:16px}',
        '.fq-modal-bar{height:10px;background:#eee;border-radius:5px;overflow:hidden;margin-bottom:12px}',
        '.fq-modal-fill{height:100%;background:linear-gradient(90deg,#f093fb,#f5576c);border-radius:5px;transition:width .3s;width:0}',
        '.fq-modal-text{font-size:13px;color:#666;margin-bottom:4px}',
        '.fq-modal-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}',
        '.fq-modal-btn{border:none;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer}',
        '.fq-modal-btn-close{background:#eee;color:#666}',
        '.fq-modal-btn-save{background:linear-gradient(135deg,#11998e,#38ef7d);color:#fff}'
    ].join(''));

    var _fetched = false, _start = 0;
    var _dlRunning = false, _dlPaused = false, _dlCurrent = 0, _dlTotal = 0, _dlContent = [], _dlIds = [];

    function $(sel) { return document.querySelector(sel); }

    function findContent() {
        return $('.muye-reader-content') || (function() {
            var h = document.getElementById('html_0');
            return h ? (h.children[2] || h.children[0]) : null;
        })();
    }

    function getMeta() {
        var m = location.pathname.match(/\/reader\/(\d+)/);
        if (!m) return null;

        function tryState() {
            var st = window.__INITIAL_STATE__ || {};
            var rd = st.reader || st.Reader || {};
            var cd = rd.chapterData || rd.chapter || rd.data || {};
            return {
                bookId: cd.bookId || cd.book_id || st.bookId || st.book_id || '',
                title: cd.title || '',
                bookName: cd.bookName || cd.book_name || cd.title || ''
            };
        }

        function tryHtml() {
            var html = document.documentElement.innerHTML;
            var re = /"bookId"\s*:\s*"(\d+)"/;
            var match = html.match(re);
            return match ? match[1] : '';
        }

        var fromState = tryState();
        var bookId = fromState.bookId || tryHtml();

        return {
            itemId: m[1],
            bookId: bookId,
            title: fromState.title,
            bookName: fromState.bookName || ''
        };
    }

    function gmGet(url) {
        return new Promise(function(resolve, reject) {
            GM_xmlhttpRequest({
                method: 'GET', url: url, timeout: 20000,
                onload: function(r) { resolve(r.responseText); },
                onerror: function() { reject(new Error('network')); },
                ontimeout: function() { reject(new Error('timeout')); }
            });
        });
    }

    function fetchContent(itemId) {
        return gmGet(CONTENT_API + itemId).then(function(text) {
            var d = JSON.parse(text);
            if (d.code === 200 && d.data && d.data.content) return d.data.content;
            throw new Error(d.message || 'unknown');
        });
    }

    function showNotice(cdiv, msg, type) {
        var old = cdiv.querySelector('.fq-notice');
        if (old) old.remove();
        var el = document.createElement('div');
        el.className = 'fq-notice fq-notice-' + (type || 'info');
        el.textContent = msg;
        cdiv.insertBefore(el, cdiv.firstChild);
    }

    function render(cdiv, text) {
        var ps = text.split('\n').filter(function(l) { return l.trim(); });
        if (!ps.length) return;
        cdiv.innerHTML = '<div style="padding:20px 0">' +
            ps.map(function(t) { return '<p style="text-indent:2em;margin:12px 0">' + t + '</p>'; }).join('') +
            '</div>';
        cdiv.classList.remove('noselect');
    }

    function setStatus(msg) {
        var el = document.getElementById('fq-status');
        if (el) el.textContent = msg;
    }

    function autoFetch() {
        if (_fetched) return;
        _fetched = true;
        _start = Date.now();
        var meta = getMeta();
        if (!meta) return;
        setStatus('获取全文...');
        var cdiv = findContent();
        if (cdiv && !document.getElementById('fq-loading')) {
            var el = document.createElement('div');
            el.id = 'fq-loading';
            el.className = 'fq-loader';
            el.innerHTML = '<div class="fq-spinner"></div><div style="margin-top:12px;font-size:13px">正在获取完整内容...</div>';
            cdiv.innerHTML = '';
            cdiv.appendChild(el);
        }
        fetchContent(meta.itemId).then(function(content) {
            var cdiv2 = findContent();
            if (!cdiv2) return;
            render(cdiv2, content);
            var t = ((Date.now() - _start) / 1000).toFixed(1);
            showNotice(cdiv2, '已获取完整内容 (' + content.length + '字, ' + t + 's)', 'info');
            setStatus('完成');
        }).catch(function(err) {
            setStatus('获取失败');
            var cdiv2 = findContent();
            if (cdiv2) showNotice(cdiv2, '获取失败: ' + err.message, 'warn');
        });
    }

    function copyText() {
        var cdiv = findContent();
        var text = cdiv ? (cdiv.innerText || cdiv.textContent) : '';
        if (!text.trim()) { setStatus('无内容'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() { setStatus('已复制'); })
                .catch(function() { fallbackCopy(text); });
        } else { fallbackCopy(text); }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); setStatus('已复制'); } catch(e) { setStatus('复制失败'); }
        document.body.removeChild(ta);
    }

    // ======================
    // 整本下载
    // ======================

    function showDownloadModal() {
        var old = document.getElementById('fq-modal');
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.id = 'fq-modal';
        modal.className = 'fq-modal';
        modal.innerHTML = [
            '<div class="fq-modal-box">',
            '  <div class="fq-modal-title">下载整本小说</div>',
            '  <div class="fq-modal-bar"><div class="fq-modal-fill" id="fq-fill"></div></div>',
            '  <div class="fq-modal-text" id="fq-text">准备中...</div>',
            '  <div class="fq-modal-text" style="font-size:12px;color:#aaa" id="fq-detail"></div>',
            '  <div class="fq-modal-btns">',
            '    <button class="fq-modal-btn fq-modal-btn-close" id="fq-modal-close">关闭</button>',
            '    <button class="fq-modal-btn fq-modal-btn-save" id="fq-modal-save" style="display:none">保存 TXT</button>',
            '    <button class="fq-modal-btn fq-modal-btn-save" id="fq-modal-pause" style="display:none">暂停</button>',
            '  </div>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);

        document.getElementById('fq-modal-close').addEventListener('click', closeModal);
        document.getElementById('fq-modal-save').addEventListener('click', saveBook);
        document.getElementById('fq-modal-pause').addEventListener('click', togglePause);
    }

    function updateModal(pct, text, detail) {
        var fill = document.getElementById('fq-fill');
        var txt = document.getElementById('fq-text');
        var det = document.getElementById('fq-detail');
        if (fill) fill.style.width = pct + '%';
        if (txt) txt.textContent = text;
        if (det) det.textContent = detail || '';
    }

    function closeModal() {
        _dlRunning = false;
        _dlPaused = false;
        var modal = document.getElementById('fq-modal');
        if (modal) modal.remove();
        setStatus('');
    }

    function togglePause() {
        _dlPaused = !_dlPaused;
        var btn = document.getElementById('fq-modal-pause');
        if (btn) btn.textContent = _dlPaused ? '继续' : '暂停';
        var saveBtn = document.getElementById('fq-modal-save');
        if (saveBtn && _dlPaused && _dlContent.length > 0) saveBtn.style.display = 'inline-block';
        if (!_dlPaused) dlWorker();
    }

    function saveBook() {
        var text = _dlContent.join('');
        var blob = new Blob(['\uFEFF' + text], {type: 'text/plain;charset=utf-8'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (_dlBookName || 'fanqie') + '.txt';
        a.click();
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
        closeModal();
    }

    var _dlBookName = '';

    function startBookDownload() {
        var meta = getMeta();
        if (!meta) { alert('未检测到章节页面，请确认当前 URL 包含 /reader/'); return; }
        if (!meta.bookId) { alert('未找到书籍 ID，请刷新页面重试。\n\n如问题持续存在，请安装最新版脚本:\nhttps://raw.githubusercontent.com/scpxin/fanqie/master/userscript/fanqie.user.js'); return; }

        _dlRunning = true;
        _dlPaused = false;
        _dlCurrent = 0;
        _dlTotal = 0;
        _dlContent = [];
        _dlBookName = meta.bookName || meta.title || 'fanqie';

        showDownloadModal();
        updateModal(0, '获取章节目录...');

        document.getElementById('fq-modal-pause').style.display = 'inline-block';

        gmGet(DIR_API + meta.bookId).then(function(text) {
            var data = JSON.parse(text);
            var ids = data.data.allItemIds || [];
            _dlTotal = ids.length;
            _dlIds = ids;
            if (_dlTotal === 0) { updateModal(100, '无章节'); return; }
            dlWorker();
        }).catch(function(err) {
            updateModal(0, '获取目录失败: ' + err.message);
            document.getElementById('fq-modal-pause').style.display = 'none';
        });
    }

    function dlWorker() {
        if (!_dlRunning) return;

        function step() {
            if (_dlPaused || !_dlRunning) {
                if (_dlPaused) updateModal(Math.round(_dlCurrent / _dlTotal * 100),
                    '已暂停 (' + _dlCurrent + '/' + _dlTotal + ')');
                return;
            }

            if (_dlCurrent >= _dlTotal) {
                updateModal(100, '下载完成！共 ' + _dlTotal + ' 章');
                document.getElementById('fq-modal-pause').style.display = 'none';
                document.getElementById('fq-modal-save').style.display = 'inline-block';
                setStatus('整本下载完成');
                _dlRunning = false;
                return;
            }

            var idx = _dlCurrent;
            var itemId = _dlIds[idx];

            updateModal(Math.round(idx / _dlTotal * 100),
                '下载中 ' + (idx + 1) + '/' + _dlTotal,
                '速度约 1.5 章/秒');

            fetchContent(itemId).then(function(content) {
                _dlContent.push('\n\n第' + (idx + 1) + '章\n\n' + content);
                _dlCurrent++;
                setTimeout(step, 600);
            }).catch(function() {
                _dlContent.push('\n\n第' + (idx + 1) + '章\n\n[下载失败]');
                _dlCurrent++;
                setTimeout(step, 100);
            });
        }

        step();
    }

    // ======================
    // TOOLBAR
    // ======================
    function createToolbar() {
        if (document.getElementById('fq-toolbar')) return;
        var el = document.createElement('div');
        el.id = 'fq-toolbar';
        el.className = 'fq-toolbar';
        el.innerHTML = [
            '<button class="fq-btn fq-btn-fetch" id="fq-btn-fetch">获取全文</button>',
            '<button class="fq-btn fq-btn-copy" id="fq-btn-copy">复制</button>',
            '<button class="fq-btn fq-btn-book" id="fq-btn-book">下载整本</button>',
            '<div class="fq-status" id="fq-status"></div>'
        ].join('');
        document.body.appendChild(el);
        document.getElementById('fq-btn-fetch').addEventListener('click', function() { _fetched = false; autoFetch(); });
        document.getElementById('fq-btn-copy').addEventListener('click', copyText);
        document.getElementById('fq-btn-book').addEventListener('click', startBookDownload);
    }

    function start() {
        if (!/\/reader\//.test(location.pathname)) return;
        createToolbar();
        autoFetch();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(start, 200); });
    } else {
        setTimeout(start, 200);
    }

    var _href = location.href;
    setInterval(function() {
        if (location.href !== _href) {
            _href = location.href;
            _fetched = false;
            _dlRunning = false;
            _dlPaused = false;
            var modal = document.getElementById('fq-modal');
            if (modal) modal.remove();
            if (/\/reader\//.test(location.pathname)) setTimeout(start, 300);
        }
    }, 1000);

})();
