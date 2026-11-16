# P1 核心使用闭环

日期：2026-11-12（Asia/Shanghai）。本批从远端 `main` 的 `b49304b90e2f86677c3926948dbe54314808b344` 继续；开始前已 fetch 并确认 HEAD 与 origin/main 一致、工作区干净。继续使用 `/workspace/Offerithm` 既有隔离检出，没有创建 worktree。本批不提交、推送或部署。

01—03 是原分析快照，04 是上一批验证记录；本批状态以本文和实际代码为准。

## 范围与决策

- 保留 React、纯函数计算核心、IndexedDB v1、Offer JSON 快照 v1 和静态部署；不引入后端、账户、运行时依赖或数据迁移。
- 表单、草稿恢复和 JSON 导入共用运行时校验。正式记录必须完整，草稿允许缺字段；草稿校验通过不代表可以计算。未知地区政策不得作为正式保存或导入的数据静默进入零缴费计算。
- 生活成本沿用现有六项模型；工作输入补齐每周工时及单程通勤。储蓄、公积金归属、时薪分母、预测口径、税表和缴费率均沿用现有代码，不以本批测试通过宣称政策已核验。
- 草稿是独立工作副本，恢复仅进入编辑态；正式保存与清除同 ID 草稿必须在同一跨仓库事务中一起成功或回滚。
- 合法的旧 partial 草稿恢复前明确说明：缺失情景采用新建默认情景，补齐空组件/一次性款项列表及技术日期；缺失金额、成本、工时、通勤、地区及计税方式留空，补齐后才能正式保存。已有值保留；结构非法的草稿诊断后保留原记录，不静默恢复。
- JSON 保留既有“同 ID 整条覆盖、文件未包含的本地记录保留”规则。先完整校验并预览新增/覆盖，确认后在读写事务内重新核对待写入 ID 的原记录（含原本不存在的 ID），再原子提交；发生并发变化需重新预览。
- 导入仅操作正式 Offer，保留独立草稿；单次最多 5 MiB、1000 份 Offer。这是导入资源限制，不是薪酬业务口径。
- 写入失败保留编辑内容或导入预览；写入已经提交后的列表读取失败独立提示，重试刷新不再次提交。

## ECC 与代理

当前环境重新执行 `codex plugin list --json`，确认 `ecc@ecc` 2.2.3 已安装且启用；`node /workspace/ECC/scripts/codex/check-plugin-cache.js` 检查通过。无需重装，未覆盖项目配置。远端插件目录查询失败不影响本地安装证据，也不代表第三方 MCP/hooks 已通过运行验收。

采用 ECC 的 [planner](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/agents/planner.md)、[frontend-patterns](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/frontend-patterns/SKILL.md)、[tdd-workflow](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/tdd-workflow/SKILL.md) 和 [verification-loop](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/verification-loop/SKILL.md)；用户不提交的要求优先于技能中的 checkpoint 提交要求。

本批通过代理工具以指定参数启动：GPT-6.1 Sol / high（接口建议、综合、独立审阅），GPT-6.1 Terra / medium（共享校验、存储及测试），GPT-6 Luna / medium（表单、草稿及导入界面、浏览器验收）。工具接受了这些模型参数，未报告替代型号；底层模型路由没有额外的独立证明。主会话负责范围取舍及最终验收，没有把指定模型参数表述为底层路由审计结果。

## 验证记录

当前主机最初为 Node 24.22.1；最终检查使用工作区 npm 缓存中的 Node 20.20.2，与 CI 的 Node 20 主版本一致。没有改动依赖清单或锁文件。`npm ci` 首次因默认缓存目录只读失败，指定工作区缓存后成功安装 224 个包。真实浏览器为系统 Chromium 156.0.8078.79，Playwright 1.56.1。

主会话在上述 Node 20 环境执行最终检查；以下均为本批实际运行结果，不继承上一批数字：

| 检查 | 本批结果 |
| --- | --- |
| `npm ci --cache <工作区缓存> --no-audit --no-fund` | 通过，依赖清单/锁文件无改动 |
| `npm run typecheck` | 通过，包含浏览器测试类型检查 |
| `npm run lint` | 通过 |
| `npm test` | **42/42**：原引擎 22 + 共享校验 15 + JSON 5 |
| `npm run test:e2e` | **20/20**，19.1 秒；真实 Chromium，单 worker、隔离上下文 |
| Pages/根路径生产构建 | 均通过，由 `test:e2e` 构建最新代码 |
| 浏览器项目拆分 | Pages 生产页面 5、根路径路由 1、实际存储模块/应用开发服务 14 |
| 375×812 窄屏补充验收 | 生产产物：键盘保存/导航/导入确认，刷新后成本与工时保持；编辑和预览无横向溢出、无 pageerror，截图已人工检查 |
| `git diff --check` | 通过 |
| 远端 CI、Pages 部署 | 本批不提交/推送/部署，未执行线上验收 |

复现（Node 20，已安装系统 Chromium）：

```bash
npm run typecheck
npm run lint
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

本机通过 `npm exec --package=node@20 --call '…'` 选择 Node 20.20.2；普通 Node 20 开发环境可直接执行以上命令。

### RED/GREEN 证据

旅程来自本批用户要求及 01 中 AC-01、AC-05、AC-06、AC-07；未创建 checkpoint 提交。

- 共享校验/JSON：先执行新测试，缺少校验模块、未来版本被接受产生 RED；随后补入未知地区、重复嵌套 ID、非法日历日期、稀疏数组、计算溢出、缺失草稿 ID、导入资源上限回归。独立审阅还确认非负阶梯比例不应任意限制到 100%，负调薪在 -100% 以内仍可表达。修复后在完整单元命令中验证。
- 可选备注：`notes: undefined` 是合法的 TypeScript 可选字段，新增回归先因“notes 必填”失败，最小修复后同一目标 8/8；`null` 仍拒绝。
- 跨仓库保存：新增浏览器测试先因 `offerStore.save is not a function` 失败；实现后验证正式保存清除草稿，以及预览后记录变化拒绝提交。
- 基础表单：生产构建成功后，新增浏览器旅程因缺少“住房（元/月）”入口失败；随后补齐成本和工时输入。成本独立期望为 `(1000+500+200+100+50)×12+600=22800`，净储蓄减少 22800；年税前现金 120000、周工时 50、单程通勤 45 分钟时，现有时薪公式结果约为 45 元/小时。
- 历史坏数据：注入 `salary: null` 的已保存记录后，旧页面崩溃导致标题缺失；增加诊断并跳过无效计算，保留原始记录。
- 导入界面审阅：`import-review.spec.ts` 两项实际 RED 分别为新选无效文件后旧预览仍有 1 个（预期 0），以及缺少“重新预览”按钮；修复后用同一用例验证。
- 旧 partial 草稿完整闭环最终通过：缺失值展示为空、补齐字段、正式保存保留原 ID、草稿消失。此前 UI 回归出现过精确文本/标签定位失败；改用独立名称元素及 combobox 角色定位后，同一闭环在最终全量运行中通过。定位失败不算业务缺陷的 RED 证据。
- 事务故障注入：独立真实浏览器测试验证最后一次 `put` 同步抛错时整批回滚、草稿 `delete` 失败时两仓库回滚、待写入目标变更时不提交，以及无效后项不会产生部分写入。不是配额耗尽的实测，不将模拟故障解释为所有存储故障均已覆盖。

### 用户保证与测试索引

| 用户保证 | 测试 |
| --- | --- |
| 嵌套数据、日期、数值、ID、政策及完整/草稿契约一致 | `src/core/__tests__/validation.test.ts`、`validation-review.test.ts` |
| v1 JSON 等价往返，未来版、重复 ID、后项无效、规模越界拒绝 | `src/storage/__tests__/io.test.ts` |
| 成本/工时实时联动、刷新重开保持、草稿恢复/删除、导出后重新导入 | `tests/browser/offer-flows.spec.ts` |
| 事务完成后成功、abort 回滚、跨仓清理、并发覆盖保护 | `tests/browser/transactions.spec.ts`、`p1-review.spec.ts` |
| 新文件清旧预览、取消零写入、冲突重新预览、失败保留输入及重试 | `tests/browser/import-review.spec.ts` |
| 保存与后续列表刷新失败分别提示，旧 partial 草稿及坏正式记录不崩溃 | `tests/browser/p1-review.spec.ts` |
| 比较身份、根/子路径静态导航不退化 | `tests/browser/comparison.spec.ts`、`routing.spec.ts` |

覆盖率百分比未测量，不宣称达到 ECC 的建议覆盖率目标。没有运行远端 CI 或实际 Pages 部署验收。

窄屏补充为 Playwright 模拟 viewport 下的键盘操作及截图检查，不代表真实手机、触屏或完整 WCAG 验收。所有浏览器记录使用独立上下文，不接触用户已有浏览器数据；本地验收服务均已关闭。

## 保留待办

- 0C：政策年度、来源、奖金税表等仍需权威样例核验；本批没有修改这些口径。
- 高级薪资组件/阶梯、一次性款项、情景参数、专项扣除及政策编辑器继续为后续范围。
- 储蓄、公积金归属、年假/出差与时薪、一次性收入预测、代理评分语义仍待独立定案。
- JSON 仍仅备份正式 Offer，不包括草稿、比较权重、当前情景及政策快照；CSV 仍为报告，不支持导入。
- 真实 Pages 发布、远端 CI 与跨浏览器/真实设备验收未在本批执行。
- 真实 blocked/versionchange 升级、配额耗尽、强制关闭等故障仍未完整覆盖；本批故障注入不替代这些环境验证。
- Compare 首次读取列表失败的专门反馈/重试仍为遗留项；本批已补的是无效历史记录诊断及不参与比较。结构非法草稿保留并诊断，未新增通用字段修复器。

## 后续发布准备（2026-11-16）

用户已在后续会话明确授权提交、推送并部署；上文“不提交/推送/部署”为 11 月 12 日实现批次的历史边界。本次重新 fetch 确认远端 main 仍为 `b49304b`，并在 Node 20.20.2 下重新通过类型检查、Lint、42 项单元测试、20 项 Chromium 回归（18.4 秒）及根/子路径生产构建。

提交推送至 main 后，由既有 `Deploy to GitHub Pages` 工作流部署，不修改部署配置。最终提交、CI 和线上验收结果以本次发布的 GitHub Actions 记录及交付说明为准；本段仅记录发布前检查，不预先声明部署成功。
