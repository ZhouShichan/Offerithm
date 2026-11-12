# 存储、导入导出与部署：现状证据及建议

本文是基于当前代码的静态调查和建议，不代表既有需求或已经实现的功能。主会话已完成 16 项测试、typecheck、lint、build，以及浏览器新建、录入薪资、保存、删除和持久化 smoke；这些检查不能证明下面的失败和迁移路径。

## 现状与边界

- **已实现：IndexedDB，而非 localStorage。** `src/storage/db.ts:8` 定义数据库 `offerithm`、版本 1；`src/storage/db.ts:16` 在升级事件中创建 `offers` 和 `drafts`，均以 `id` 为 keyPath。代码搜索未发现 localStorage 使用或其 schema。两个仓库存放 `Offer`，结构见 `src/core/types.ts:133`：包括薪资、三个情景、生活成本、工作强度、一次性款项和 ISO 时间；类型声明不是运行时校验。`offerStore.put` 使用 IndexedDB `put`，同 ID 替换整条记录（`src/storage/db.ts:45`）。
- **已实现：保存与草稿写入；草稿恢复缺失。** 新建时生成 UUID、默认值与时间（`src/pages/OffersPage.tsx:7`）；保存时更新 `updatedAt`，写入目标仓库（`src/pages/OffersPage.tsx:56`）。正式保存后仍停留编辑页；草稿保存后返回列表。`draftStore.list/remove` 有封装（`src/storage/db.ts:52`），但未见页面调用，草稿没有列出、恢复或删除入口；正式保存也不会清理同 ID 草稿。
- **已实现：仅初始建库，无数据迁移。** `onupgradeneeded` 仅按仓库是否存在创建仓库（`src/storage/db.ts:16`），没有旧版本记录转换、导入格式迁移或更高版本处理。未来改结构需区分 IndexedDB 版本与快照格式版本；历史兼容性取决于未来迁移代码，不能视为已实现。
- **失败路径不足。** `withStore` 在 request 成功时就 resolve，而非事务 `complete`（`src/storage/db.ts:30`）；后续事务 abort 可能发生在调用方认为成功之后。只在事务完成时关闭连接，未处理事务 abort/error、同步异常、打开 blocked/versionchange（`src/storage/db.ts:13`）。保存捕获异常但未重置旧错误，且 refresh 失败会显示为保存失败，即便写入可能已提交（`src/pages/OffersPage.tsx:56`）。初始列表与删除没有明确错误处理（`src/pages/OffersPage.tsx:48`、`src/pages/OffersPage.tsx:164`；`src/pages/SettingsPage.tsx:12`；`src/pages/ComparePage.tsx:21`）。配额、浏览器禁用存储、升级被其他标签阻塞等需实测；本地数据也受浏览器站点数据清除及设备限制。

## 导入与导出

- **JSON 已实现，但不是完整工作区备份。** `WorkspaceSnapshot` 为 `{app: 'offerithm', version: 1, exportedAt, offers}`（`src/storage/io.ts:8`），设置页从加载时的 `offers` state 导出（`src/pages/SettingsPage.tsx:12`、`src/pages/SettingsPage.tsx:16`），不包含 drafts、比较权重或情景。跨标签变更后 state 可能陈旧；初始读取失败也可能导出空列表。
- **导入已实现，校验很浅。** `JSON.parse` 后只检查 `app` 和 `offers` 数组（`src/storage/io.ts:19`），不校验 version、日期、Offer 及嵌套字段、重复 ID 或大小；非对象或错误数据也可能抛出原生错误。`accept` 仅是文件选择提示（`src/pages/SettingsPage.tsx:43`）。无效记录可写入后在计算或展示时出错。
- **当前行为是逐条按 ID 合并，不是整体替换。** `src/pages/SettingsPage.tsx:21` 按数组顺序逐条 `put`：同 ID 整条覆盖，未出现的现有记录保留，文件内重复 ID 后一条覆盖前一条；没有预览、冲突确认、备份或批次原子性。中途失败会留下已写入记录但显示导入失败；成功数量是输入数组长度，不是新增数。各记录单独事务加上过早 resolve 会放大结果不确定性。
- **CSV 只有导出，不是可恢复备份。** 比较页使用当前选定情景的计算结果（`src/pages/ComparePage.tsx:25`），生成固定 12 列、字段双引号转义的摘要（`src/storage/io.ts:37`），下载时加 UTF-8 BOM（`src/storage/io.ts:27`）。未见 CSV 导入；CSV 不含完整 Offer 或情景标识。用户文本以公式前缀开头时，表格软件可能解释为公式，需在设计 CSV 安全处理时权衡数据保真。

## 部署与构建

- **已配置，线上部署待确认。** `.github/workflows/deploy.yml:3` 在 main push 或手动触发；Node 20、`npm ci`、测试、构建、上传 `dist` 并部署 Pages（`.github/workflows/deploy.yml:18`）。未检查实际线上部署、Pages 设置或运行效果。`package.json:7` 定义 build 为 `tsc -b && vite build`，测试为 Vitest；生产依赖为 React 18、React DOM、React Router 6（`package.json:16`），锁文件存在。TypeScript 目标 ES2022、strict（`tsconfig.app.json:2`），需与目标浏览器能力一起验证，包括 IndexedDB 和 `crypto.randomUUID`。
- **子路径路由风险。** Vite 生产默认 base `/Offerithm/`，可用 `VITE_BASE` 覆盖（`vite.config.ts:5`）；但 `BrowserRouter` 未设置 basename（`src/main.tsx:9`），路由为根路径（`src/App.tsx:33`），仓库未见 SPA 深链接回退配置。静态 Pages 子路径导航及直接刷新可能失败，需在真实 Pages 预览验证；资源 base 本身不能解决路由匹配或服务器 404。域名/协议/端口变化也会改变浏览器存储来源，部署迁移前应提供导出恢复路径。
- **文档差异。** README 将草稿、工作区、JSON/CSV 导入导出列为功能（`README.md:17`），实际草稿无恢复界面，CSV 无导入。引擎和类型覆盖范围不等同页面可编辑范围；以实际入口为准。

## 建议方案与顺序（待产品确认）

1. **先保证一次保存的真实结果。** 修改 `src/storage/db.ts`：request 成功只暂存结果，以事务 complete 作为成功；统一处理 request/transaction error、abort、同步异常并关闭连接；处理版本升级阻塞及 versionchange。页面区分保存失败与保存后刷新失败，保留用户编辑内容，允许重试。删除与初次加载同样展示可操作错误。先修复基础事务语义，再依赖其反馈实现其他功能。
2. **定义备份契约和导入预览。** 在 `src/storage/io.ts` 为未知输入建立运行时校验：明确支持的版本、完整嵌套结构、有限数值、ID、日期、文件大小和重复 ID；对未来版本拒绝并保留原文件。导出前重新读取已提交数据，说明包含范围。导入先解析、验证、迁移、比较 ID，展示新增/覆盖数量及冲突；默认行为和是否允许覆盖由产品决定，不静默改变现有语义。CSV 明确为报告，评估公式前缀处理并记录其对文本的影响。
3. **原子批量导入。** 确认后在单个 `offers` 读写事务中写入所有记录，等事务完成再刷新并报告实际结果；任意失败回滚并保留现有记录。先提供下载现有 JSON 备份；如将 drafts 纳入备份，明确版本、冲突规则和跨仓库同一事务。并发标签需防止预览后数据变化导致意外覆盖，可在提交时重新核对冲突并要求重新确认。大文件限制及错误信息须明确。
4. **增量迁移与恢复。** 按快照格式版本实现纯函数迁移链及历史 fixture，先校验可识别的旧版本，再迁移并校验新结构；保留原始文件，不对未知未来版本降级。数据库升级按 oldVersion 分步、在升级事务中完成，失败回滚；处理旧标签阻塞、提示关闭并重试。升级前后导出、回滚到旧应用版本时的兼容性应实际演练。不要用默认值掩盖未知数据。
5. **补齐草稿生命周期与发布验证。** 明确草稿与正式记录如何恢复、覆盖、删除以及是否导出；实现前不要把草稿称为完整备份。修复并验证 Pages 的 base、路由策略和深链接刷新，覆盖根部署及子路径部署。保持本地优先：当前没有证据要求账户、同步或服务端，备份通过用户控制的文件即可；跨设备自动同步若日后成为需求，再单独评估隐私与运维成本。

## 验收建议

针对存储增加真实浏览器或可信 IndexedDB 测试：请求成功后事务 abort、quota/禁用存储、打开 blocked、升级失败与重试、编辑内容保留；验证保存完成才提示成功。导入测试覆盖非法 JSON、缺字段/类型/非有限数、未知版本、重复和冲突 ID、中途失败全回滚、跨标签冲突以及旧版 fixture 往返；验证 JSON 与 CSV 各自范围和特殊字符。部署测试使用实际配置的 Pages 子路径，检查首页、导航、直接访问与刷新，并核对导出恢复。以上为建议测试，当前 smoke 并未覆盖。

### 本地生产预览复现（2026-11-12）

使用已有 `dist`，Node 20 启动 `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`，以 Playwright 和 `/usr/bin/chromium` 访问 `http://127.0.0.1:4173/Offerithm/`：HTTP 200，页头与页脚可见，但 `main` 文本为空。生产构建的控制台未观察到 `No routes matched` 文案；因此证据是页面内容缺失，不是该警告出现。点击“我的 Offer”后地址变成根路径 `/offers`，页面可显示 Offer 列表，而非保持 `/Offerithm/` 子路径。控制台另有资源 404，未定位其具体资源。此结果仅证明本地 Vite 生产预览下的行为，不能代替真实 GitHub Pages 的部署和深链接验证。
