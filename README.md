# 番茄小说下载工具

两个番茄小说阅读/下载工具，对普通用户推荐方式一。

---

## 方式一：油猴脚本（推荐）

**文件**: `userscript/fanqie.user.js`

安装油猴脚本后，打开任意番茄小说章节页面即可自动获取完整内容，并支持一键下载整本小说。

### 功能

- 进入章节页面自动获取完整内容（无需手动操作）
- 一键下载整本小说为 TXT 文件
- 下载过程支持暂停/继续
- 实时显示下载进度（已下载 X/总章数）
- 右下角工具栏：获取全文、复制、下载整本

### 安装步骤

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开脚本安装链接：[fanqie.user.js](https://raw.githubusercontent.com/scpxin/fanqie/master/userscript/fanqie.user.js)
3. 在 Tampermonkey 弹出窗口中点击"安装"
4. 访问任意番茄小说章节页面（如 https://fanqienovel.com/reader/xxxxx），脚本自动生效

### 使用方法

- **看当前章节**：打开页面自动获取完整内容
- **复制内容**：点击右下角"复制"按钮
- **下载整本**：点击右下角"下载整本"按钮，等待下载完成后点击"保存 TXT"

---

## 方式二：网页下载工具

**文件**: `web-tool/`（server.py + index.html）

一个独立的网页版下载器，后台代理 API 请求，无需安装浏览器扩展。

### 启动方式

```bash
cd web-tool
python3 server.py
```

然后浏览器打开 http://localhost:8000

### 功能

- 按书名搜索
- 粘贴章节链接直接定位书籍
- 下载整本为 TXT
- 下载过程支持暂停/继续
- 显示速度、预计剩余时间等详细信息

---

## 技术说明

### API 来源

- **章节内容**: 自建 API `101.35.133.34:5000`（来自 [addallno/fqdt](https://github.com/addallno/fqdt) 项目）
- **章节目录**: 番茄小说官方 API `fanqienovel.com/api/reader/directory/detail`
- **搜索**: 番茄小说官方搜索 API `novel.snssdk.com`

### 文件说明

| 文件 | 说明 |
|------|------|
| `userscript/fanqie.user.js` | 油猴脚本 v2.0，支持章节阅读 + 整本下载 |
| `web-tool/server.py` | 网页工具后端，Python 代理服务器 |
| `web-tool/index.html` | 网页工具前端，搜索和下载界面 |

---

## 注意事项

- 仅供学习交流使用
- API 服务器 `101.35.133.34` 为第三方维护，稳定性无法保证
- 下载全本需数分钟，取决于网络和章节数量
