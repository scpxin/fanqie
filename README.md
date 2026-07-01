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

**限制**：番茄 API 有 CORS 限制，公共代理已被封，需自建 Cloudflare Worker 代理（免费，约 3 分钟完成）。

---

### 完整部署流程

#### 第 1 步：注册 Cloudflare 账号

1. 打开 https://dash.cloudflare.com/sign-up
2. 用邮箱注册（Google/GitHub/Apple 均可快速登录）
3. 登录后会进入 Cloudflare 仪表盘

#### 第 2 步：创建 Worker

1. 打开 https://dash.cloudflare.com/ ，在左侧菜单点击 **Workers & Pages**
    > 如果没看到这个菜单，可以直达 https://dash.cloudflare.com/workers-and-pages

2. 点击页面右侧蓝色按钮 **「创建」**（Create）

3. 选择 **「创建 Worker」**（Create Worker）

4. 你会看到一个代码编辑器。**把里面默认的代码全部删除**，然后粘贴 `proxy-worker.js` 的全部内容：
   - 可以在 GitHub 上打开这个文件：https://raw.githubusercontent.com/scpxin/fanqie/master/proxy-worker.js
   - 全选复制，粘贴到编辑器中

5. 点击右上角 **「部署」**（Deploy）按钮

6. 部署成功后，你会看到一个域名，格式为：
   ```
   xxx.你的用户名.workers.dev
   ```
   把它记下来。完整代理地址就是：
   ```
   https://xxx.你的用户名.workers.dev/?url=
   ```

#### 第 3 步：配置网页

1. 打开仓库中的 `docs/index.html`
2. 找到第 3 行的 `var CORS_PROXY = '';`
3. 把空字符串替换为你的代理地址：
   ```javascript
   var CORS_PROXY = 'https://xxx.你的用户名.workers.dev/?url=';
   ```
4. 提交并推送这个改动

#### 第 4 步：启用 GitHub Pages（只需做一次）

1. 打开 https://github.com/scpxin/fanqie/settings/pages
2. **Source** 选 **Deploy from a branch**
3. **Branch** 选 `master`，目录选 `/docs`，点击 **Save**
4. 约 1 分钟后访问 https://scpxin.github.io/fanqie/

---

### 验证代理是否部署成功

在浏览器中打开这个地址（替换为你的实际域名）：

```
https://xxx.你的用户名.workers.dev/?url=https%3A%2F%2Fnovel.snssdk.com%2Fapi%2Fnovel%2Fchannel%2Fhomepage%2Fsearch%2Fsearch%2Fv1%2F%3Faid%3D1967%26q%3Dtest%26offset%3D0
```

如果返回一堆 JSON 数据（而不是白屏或报错），说明代理已成功运行。

---

### 使用方法

打开 https://scpxin.github.io/fanqie/ 后：
- 输入书名 → 点搜索 → 选择搜索结果 → 点击「下载整本 TXT」

### 原理

```
浏览器 → Cloudflare Worker 代理 → 番茄 API 服务器
        (添加 CORS 响应头)
```

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
