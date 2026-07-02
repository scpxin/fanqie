# 番茄小说下载工具

两个番茄小说下载工具：油猴脚本（推荐，全功能）和网页版（搜索+浏览）。

---

## 方式一：油猴脚本（推荐）

**文件**: `userscript/fanqie.user.js`

进入任意番茄小说章节页面自动获取完整内容，一键下载整本 TXT。

### 功能

- 打开章节页面自动显示完整内容（跳过付费锁）
- 一键下载整本小说为 TXT 文件
- 下载过程支持暂停 / 继续，暂停后随时保存已下载部分
- 实时显示下载进度（章节数、速度）
- 右下角工具栏：获取全文、复制、下载整本

### 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开脚本安装链接：`https://raw.githubusercontent.com/scpxin/fanqie/master/userscript/fanqie.user.js`
3. 点击 Tampermonkey 弹出窗口中的「安装」
4. 访问任意番茄小说章节页面即可使用

---

## 方式二：网页版

**文件**: `docs/index.html` + `proxy-worker.js`

纯前端网页，支持搜索小说、浏览目录。完整下载功能需本地运行 Python 代理。

### 远程模式（GitHub Pages + Cloudflare Worker）

地址: https://scpxin.github.io/fanqie/

- 支持搜索小说、查看章节目录
- 下载功能受限（内容 API 仅限中国 IP，Worker 海外节点被拒）
- 需自建 Cloudflare Worker 代理（详见下方部署步骤）

### 本地模式（完整功能）

```bash
cd web-tool
python3 server.py
```

然后打开 `http://localhost:8000`，全功能可用（搜索、目录、内容、下载）。网页会自动检测运行环境切换 API 源。

### Worker 部署流程

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

### 验证代理

在浏览器中打开此地址（替换为你的实际域名）：

```
https://xxx.你的用户名.workers.dev/?url=https%3A%2F%2Fnovel.snssdk.com%2Fapi%2Fnovel%2Fchannel%2Fhomepage%2Fsearch%2Fsearch%2Fv1%2F%3Faid%3D1967%26q%3Dtest%26offset%3D0
```

如果返回 JSON 数据（而非白屏或报错），说明代理已成功运行。

---

## 项目结构

```
fanqie/
├── README.md
├── proxy-worker.js                   # Cloudflare Worker 代理脚本
├── userscript/
│   └── fanqie.user.js                # 油猴脚本（推荐）
├── web-tool/
│   ├── server.py                     # Python 本地后端
│   └── index.html                    # 网页前端源文件（双模式自适应）
├── docs/
│   └── index.html                    # GitHub Pages 部署文件
└── .monkeycode/specs/ai-novel-generator/
    ├── requirements.md               # AI 仿写需求文档
    └── design.md                     # AI 仿写技术设计
```

---

## 更新日志

### v2.0.3 (2026-07-02)
- 暂停下载后显示「保存 TXT」按钮，可随时保存已下载章节

### v2.0.2 (2026-07-02)
- 修复严格模式下 `_dlIds` 未声明导致的「获取目录失败」错误

### v2.0.1 (2026-07-02)
- 修复部分章节页面无法提取 bookId 的问题（增加多路径回退+HTML 正则提取）

### v2.0.0 (2026-06-27)
- 首个稳定版：自动获取完整内容、整本下载、暂停/继续、工具栏

---

## 计划中

- AI 小说风格分析 + 仿写生成（需求和技术设计已完成，待开发）

---

## 技术说明

### API 来源

- **章节内容**: 自建 API `101.35.133.34:5000`（来自 [addallno/fqdt](https://github.com/addallno/fqdt) 项目）
- **章节目录**: 番茄小说官方 API
- **搜索**: 番茄小说官方搜索 API

### 章节链接解析流程

```
章节链接 /reader/{item_id}
    → __INITIAL_STATE__ / HTML 提取 bookId
    → 官方目录 API 获取所有章节 ID 列表
    → 自建内容 API 逐章获取完整文本
```

---

## 注意事项

- 仅供学习交流使用
- 内容 API 服务器 `101.35.133.34` 为第三方维护，稳定性无法保证
- 下载全本需数分钟，取决于网络和章节数量
- 网页版需自行部署 Cloudflare Worker 代理（免费），详见上方说明
