# 拾页同步码服务

网站继续由 GitHub Pages 托管；Cloudflare Worker 提供同步接口，D1 保存逐条学习记录。使用者无需注册，26 位随机同步码就是访问凭据。服务器仅保存同步码的 SHA-256 哈希。

## 已实现

- 同步码创建、输入、复制和本设备停止同步。
- 页面打开时拉取，有新记录时延迟上传，页面切到后台时尝试上传。
- 错题、生词、收藏、笔记等逐条合并；删除以墓碑记录传播，旧设备不会自动恢复已删除项。
- 同一条记录按修改时间及设备 ID 决定最终版本；网络失败时本机做题不受影响。
- 云端有变化时，在安全页面刷新应用；做题进行中提示到「我的」应用，避免打断作答。
- 备份文件继续可用；导入旧备份时停止本设备同步，避免旧备份覆盖云端删除记录。

## 部署到用户的 Cloudflare 免费账户

在此目录执行：

```sh
npm ci
npx wrangler login
npm run deploy
npm run migrate
```

`wrangler deploy` 会根据配置创建并绑定 D1 数据库。记录部署输出的 `https://...workers.dev` 地址，填入 `config.js` 的 `TEM8_SYNC_ENDPOINT`，再把网站文件推送到 GitHub `main`。部署前保持该值为空，网页不会启用同步按钮。

测试接口：访问 Worker 的 `/health` 应返回 `{"ok":true}`。上线后先在国内常用网络测连接时间与成功率。不要将真实同步码写入仓库、日志或工单。

本地测试：

```sh
npm test
npx wrangler d1 execute tem8-study-sync --file=./schema.sql --local
npm run dev
```

API 只允许 `https://mytemtime.com` 的浏览器跨域访问。同步码持有者可以读取和修改这组记录，因此必须像密码一样保管。用户丢失同步码时，可以从之前导出的备份文件恢复本机记录。
