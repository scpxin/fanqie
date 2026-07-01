# 番茄小说下载工具

两个番茄小说下载工具，均无需安装任何软件。

---

## 方式一：油猴脚本（推荐）

**文件**: `userscript/fanqie.user.js`

进入任意番茄小说章节页面自动获取完整内容，一键下载整本 TXT。

### 功能

- 打开章节页面自动显示完整内容
- 一键下载整本小说为 TXT 文件
- 下载过程支持暂停 / 继续
- 实时显示下载进度（章节数、速度、预计剩余时间）
- 右下角工具栏：获取全文、复制、下载整本

### 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开脚本安装链接：`https://raw.githubusercontent.com/scpxin/fanqie/master/userscript/fanqie.user.js`
3. 点击 Tampermonkey 弹出窗口中的「安装」
4. 访问任意番茄小说章节页面即可使用

---

## 方式二：网页下载器（搭代理后才可用）

**文件**: `docs/index.html` + `proxy-worker.js`

一个纯前端网页，通过自建 CORS 代理访问 API，部署到 GitHub Pages。

### 限制说明

番茄小说 API 有 CORS 限制，浏览器无法直接调用。公共 CORS 代理（如 corsproxy.io）已被字节跳动 WAF 列入黑名单。需要自建一个代理。

### 第一步：部署代理（Cloudflare Workers，免费）

1. 打开 [Cloudflare Workers](https://workers.cloudflare.com/)，注册 / 登录
2. 点击 **Create a Service** → 选择 **HTTP handler**
3. 将 `proxy-worker.js` 的内容粘贴到编辑器
4. 点击 **Save and Deploy**
5. 记下分配的 URL，格式为 `https://xxx.workers.dev`

### 第二步：配置网页

1. 打开 `docs/index.html`
2. 找到顶部的 `var CORS_PROXY = '';` 
3. 填入你的代理地址：`var CORS_PROXY = 'https://xxx.workers.dev/?url=';`
4. 推送更新到 GitHub

### 部署到 GitHub Pages

1. 打开仓库 Settings 页面：`https://github.com/scpxin/fanqie/settings/pages`
2. **Source** 选择 **Deploy from a branch**
3. **Branch** 选择 `master`，目录选择 `/docs`
4. 点击 **Save**
5. 约 1 分钟后访问 `https://scpxin.github.io/fanqie/`

### 使用方法

- **按书名搜索**：输入书名，选择搜索结果中的书籍
- **下载整本**：点击「下载整本 TXT」，等待完成后保存

### 原理

```
浏览器 → Cloudflare Worker 代理 → 番茄 API 服务器
        (添加 CORS 头)
```

| API | 说明 |
|-----|------|
| 搜索 API | `novel.snssdk.com` / 搜索书名 |
| 目录 API | `fanqienovel.com/api/reader/directory/detail` / 章节目录 |
| 内容 API | `101.35.133.34:5000/api/content` / 完整文本 |

### 本地运行（备选，无需部署代理）

```bash
cd web-tool
python3 server.py
```

然后打开 `http://localhost:8000`

---

## 项目结构

```
fanqie/
├── README.md
├── proxy-worker.js            # Cloudflare Worker 代理脚本
├── userscript/
│   └── fanqie.user.js         # 油猴脚本（推荐，无需代理）
├── web-tool/
│   ├── server.py              # 本地 Python 后端（备选）
│   └── index.html             # 网页前端源文件
└── docs/
    └── index.html             # GitHub Pages 部署文件
```

---

## 技术说明

### API 来源

- **章节内容**: 自建 API `101.35.133.34:5000`（来自 [addallno/fqdt](https://github.com/addallno/fqdt) 项目）
- **章节目录**: 番茄小说官方 API
- **搜索**: 番茄小说官方搜索 API

### 章节链接解析流程

```
章节链接 /reader/{item_id}
    → 官方 API 获取 book_id
    → 官方目录 API 获取所有章节 ID 列表
    → 自建内容 API 逐章获取完整文本
```

---

## 注意事项

- 仅供学习交流使用
- 内容 API 服务器 `101.35.133.34` 为第三方维护，稳定性无法保证
- 下载全本需数分钟，取决于网络和章节数量
- 网页版需自行部署 Cloudflare Worker 代理（免费），详见上方说明
