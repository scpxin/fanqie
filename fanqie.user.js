// ==UserScript==
// @name              番茄小说免费阅读
// @namespace         https://github.com/scpxin/fanqie
// @version           1.0.0
// @description       自动获取番茄小说锁定章节的完整内容
// @license           MIT License
// @match             https://fanqienovel.com/*
// @run-at            document-start
// @connect           101.35.133.34
// @icon              https://www.google.com/s2/favicons?sz=64&domain=fanqienovel.com
// @grant             GM_xmlhttpRequest
// @grant             GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    var API = 'http://101.35.133.34:5000/api/content?tab=小说&item_id=';

    GM_addStyle([
        '.fq-toolbar{position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px}',
        '.fq-btn{border:none;border-radius:6px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);transition:all .2s}',
        '.fq-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.3)}',
        '.fq-btn-copy{background:linear-gradient(135deg,#11998e,#38ef7d)}',
        '.fq-btn-fetch{background:linear-gradient(135deg,#667eea,#764ba2)}',
        '.fq-status{font-size:12px;color:#999;text-align:center;margin-top:4px;max-width:150px;word-break:break-all}',
        '.fq-notice{margin:12px 0;padding:10px 14px;border-radius:4px;font-size:13px;line-height:1.6}',
        '.fq-notice-info{background:#d4edda;border:1px solid #28a745;color:#155724}',
        '.fq-notice-warn{background:#fff3cd;border:1px solid #ffc107;color:#856404}',
        '@keyframes fq-spin{to{transform:rotate(360deg)}}',
        '.fq-loader{text-align:center;padding:40px 0;color:#666}',
        '.fq-spinner{display:inline-block;width:24px;height:24px;border:3px solid #ddd;border-top-color:#667eea;border-radius:50%;animation:fq-spin .8s linear infinite}'
    ].join(''));

    var _fetched = false;
    var _start = 0;

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
        var cd = (window.__INITIAL_STATE__ || {}).reader || {};
        cd = cd.chapterData || {};
        return { itemId: m[1], title: cd.title || '', locked: cd.isChapterLock };
    }

    function fetchContent(itemId) {
        return new Promise(function(resolve, reject) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: API + itemId,
                timeout: 15000,
                onload: function(r) {
                    try {
                        var d = JSON.parse(r.responseText);
                        if (d.code === 200 && d.data && d.data.content) {
                            resolve(d.data.content);
                        } else {
                            reject(new Error(d.message || 'unknown'));
                        }
                    } catch(e) { reject(e); }
                },
                onerror: function() { reject(new Error('network')); },
                ontimeout: function() { reject(new Error('timeout')); }
            });
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

    function showLoader() {
        var cdiv = findContent();
        if (!cdiv || document.getElementById('fq-loading')) return;
        var el = document.createElement('div');
        el.id = 'fq-loading';
        el.className = 'fq-loader';
        el.innerHTML = '<div class="fq-spinner"></div><div style="margin-top:12px;font-size:13px">正在获取完整内容...</div>';
        cdiv.innerHTML = '';
        cdiv.appendChild(el);
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
        showLoader();

        fetchContent(meta.itemId).then(function(content) {
            var cdiv = findContent();
            if (!cdiv) return;
            render(cdiv, content);
            var t = ((Date.now() - _start) / 1000).toFixed(1);
            showNotice(cdiv, '已获取完整内容 (' + content.length + '字, ' + t + 's)', 'info');
            setStatus('完成');
        }).catch(function(err) {
            setStatus('获取失败');
            var cdiv = findContent();
            if (cdiv) showNotice(cdiv, '获取失败: ' + err.message, 'warn');
        });
    }

    function copyText() {
        var cdiv = findContent();
        var text = cdiv ? (cdiv.innerText || cdiv.textContent) : '';
        if (!text.trim()) { setStatus('无内容'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() { setStatus('已复制'); })
                .catch(function() { fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); setStatus('已复制'); } catch(e) { setStatus('复制失败'); }
        document.body.removeChild(ta);
    }

    function createToolbar() {
        if (document.getElementById('fq-toolbar')) return;
        var el = document.createElement('div');
        el.id = 'fq-toolbar';
        el.className = 'fq-toolbar';
        el.innerHTML = [
            '<button class="fq-btn fq-btn-fetch" id="fq-btn-fetch">获取全文</button>',
            '<button class="fq-btn fq-btn-copy" id="fq-btn-copy">复制</button>',
            '<div class="fq-status" id="fq-status"></div>'
        ].join('');
        document.body.appendChild(el);
        document.getElementById('fq-btn-fetch').addEventListener('click', function() { _fetched = false; autoFetch(); });
        document.getElementById('fq-btn-copy').addEventListener('click', copyText);
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
            if (/\/reader\//.test(location.pathname)) setTimeout(start, 300);
        }
    }, 1000);

})();
