# Offerithm 测试覆盖与验收草案

## 范围与证据口径

本文只审阅 `/workspace/Offerithm` 的 README、package 脚本、实际源码和测试文件；不扩展到 ECC 仓库。Offerithm 内未发现 `AGENTS.md`。规划格式参照 `/workspace/ECC/agents/planner.md`，但下文是证据盘点与验收建议，不是实现计划。

- **事实**：能由当前文件内容和行号直接核对。
- **缺失**：在仓库现有自动化测试文件中没有对应覆盖；这不等同于功能必然错误。
- **待确认**：声明/行为或产品口径不能仅凭当前证据定论。
- **建议**：未来验收或测试工作项，不代表已完成。

主会话已报告执行 16 项测试、typecheck、lint、build，以及浏览器增删改和持久化 smoke。本文不重复运行这些命令。Smoke 是手工验证结果，不能据此称为自动化回归覆盖。

## 声明与实现的对照

| 状态 | 声明/能力 | 可核对的证据 | 测试证据与限制 |
|---|---|---|---|
| 事实 | 项目使用 Vitest，`npm test` 执行一次性测试 | [package.json](/workspace/Offerithm/package.json:7) 的 `test: vitest run`；[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:1) 是仓库唯一测试文件 | 16 个用例均在该引擎测试文件中；未发现页面、存储、导入导出测试文件 |
| 事实 | 核心引擎覆盖税、保险、工资聚合、单 Offer 计算、比较 | [engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:14)、[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:28)、[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:60)、[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:90)、[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:149)、[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:176) | 这些是直接调用函数的单元测试，不会渲染 React UI 或验证浏览器交互 |
| 事实 | README 声明本地 IndexedDB、JSON/CSV 导入导出 | [README.md](/workspace/Offerithm/README.md:5)、[README.md](/workspace/Offerithm/README.md:17)；[db.ts](/workspace/Offerithm/src/storage/db.ts:13) 至 [db.ts](/workspace/Offerithm/src/storage/db.ts:56) 实现 IndexedDB；[io.ts](/workspace/Offerithm/src/storage/io.ts:15) 至 [io.ts](/workspace/Offerithm/src/storage/io.ts:56) 实现 JSON/CSV 序列化 | 当前 16 项测试没有测试这些 API，也没有验证浏览器刷新后的真实持久化、导入/导出文件内容 |
| 事实 | 页面提供 Offer 的新建、编辑、保存、草稿、删除交互 | [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:56)、[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:134)、[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:147)、[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:164) | 无 UI 自动化测试；主会话另行报告的浏览器 smoke 覆盖了增删改/持久化，但其可重复性、浏览器版本和步骤未见仓库记录 |
| 事实 | 比较页展示情景、权重、结果与 CSV 下载 | [ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:16)、[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:25)、[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:28)、[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:49) | 引擎测试只验证默认权重下高储蓄 Offer 排名前；没有验证 UI 控件变化、表格一致性或下载内容 |
| 待确认 | README 称“地区政策可配置” | README [README.md](/workspace/Offerithm/README.md:9) 和 [README.md](/workspace/Offerithm/README.md:24)；设置页只展示内置税务/地区政策及来源，[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:52) 至 [SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:68)；Offer 编辑页可以选地区，[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:90) | 目前观察到的是选择既有政策；未见页面编辑费率/基数的 UI。若“可配置”意指用户可编辑，需要产品/文档确认其具体含义 |
| 待确认 | README 称“出差 → 有效时薪” | README [README.md](/workspace/Offerithm/README.md:14)；引擎的年工时计算读取周工时和通勤时间，[index.ts](/workspace/Offerithm/src/core/engine/index.ts:68) 至 [index.ts](/workspace/Offerithm/src/core/engine/index.ts:71)；`travelDaysPerMonth` 出现在测试数据中但上述公式未使用，[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:141) | 当前实现和测试证据没有显示出差影响时薪；需确认是预期未纳入、未来功能，还是声明与实现需要对齐 |
| 事实 | 税务为年度口径，源码注明不模拟逐月预扣节奏 | [tax.ts](/workspace/Offerithm/src/core/engine/tax.ts:39) 至 [tax.ts](/workspace/Offerithm/src/core/engine/tax.ts:42) | 现有测试覆盖几个税率算例及专项扣除、单独计税的一个例子，未覆盖完整税阶边界、奖金方法对照和负数/异常输入 |

## 现有 16 项测试实际证明了什么

按 `engine.test.ts` 的 `it` 计数：

| 测试组 | 数量 | 覆盖事实 | 不可由这些用例推出的结论 |
|---|---:|---|---|
| `comprehensiveTax`，[第 14–26 行](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:14) | 3 | 2025 税表下 30,000 元、144,000 元及 0 元的算例结果 | 不能证明所有税率档边界、负数、异常税表或其他年度税表正确 |
| `calculateAnnualTax`，[第 28–58 行](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:28) | 3 | 基本减除后的一个综合税额、专项附加扣除降低税额、36,000 元奖金单独计税结果 | 未直接验证合并计税结果、奖金边界/零奖金、扣除超过收入、各税档切换及逐月到手 |
| `calculateInsurance`，[第 60–88 行](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:60) | 4 | 北京社保基数封顶、北京公积金比例、上海补充公积金叠加、企业年金双方缴纳的算例 | 未直接覆盖下限、社保与公积金上下限不同、其他险种组合、地区策略缺省/未知地区及非法数值 |
| `tieredBonus / aggregateSalary`，[第 90–121 行](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:90) | 2 | 阶梯提成跨两档累计；月度、季度、年终奖聚合的一个案例 | 未覆盖刚好在档位阈值、空档/无上限档、百分比组件、免税/不计社保组件和 oneTime 组合 |
| `calculateOffer`，[第 149–174 行](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:149) | 3 | 税后现金/储蓄恒等关系、奖金情景排序、长工时降低有效时薪 | 未分别核验医保、公积金、雇主成本、生活成本、预测值/置信度、未知政策及一次性付款的结果 |
| `compareOffers`，[第 176–183 行](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:176) | 1 | 默认权重下高储蓄且薪资更高的样例排在前面 | 未证明自定义权重生效、空列表/单元素/完全相同输入、权重全零、并列稳定性或定性代理指标有效 |

### UI 与引擎覆盖差异

- **事实**：唯一测试文件导入并调用 `tax`、`insurance`、`salary`、`calculateOffer`、`compareOffers` 及政策数据，未导入页面组件或 `storage` 模块（[engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:1) 至 [engine.test.ts](/workspace/Offerithm/src/core/engine/__tests__/engine.test.ts:9)）。因此 16 项属于引擎单元测试。
- **事实**：Offer UI 的保存/草稿/删除通过 `offerStore` 调用 IndexedDB（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:56) 至 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:66)；[db.ts](/workspace/Offerithm/src/storage/db.ts:45) 至 [db.ts](/workspace/Offerithm/src/storage/db.ts:56)）；设置页的 JSON 导入和导出调用 `fromJson`/`toJson`（[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:16) 至 [SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:29)）。这些 UI 与浏览器 API 都没有自动化测试。
- **事实**：README 的“Excel”路径是生成 CSV 文件而非 Excel 工作簿；CSV 编码/字段生成见 [io.ts](/workspace/Offerithm/src/storage/io.ts:37) 至 [io.ts](/workspace/Offerithm/src/storage/io.ts:56)。当前没有测试 Excel 打开效果、逗号/换行/中文/引号内容或 CSV 注入处理。
- **待确认**：比较页渲染 3 年/10 年预测与置信度（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:91)），但单测没有核对显示值和引擎输出的一致性。

## 验收场景建议

以下是**建议**，尚未实现为自动化验收。优先覆盖 README 对用户承诺的端到端路径。

### Phase 1：核心流程与数据安全

1. **新建并保存 Offer**：从空列表创建 Offer，填写名称、公司、地区、月薪和奖金，保存后列表展示该记录及合理计算结果；刷新页面后记录仍存在。检查浏览器 IndexedDB `offers` 仓库数据。
2. **编辑与删除**：编辑已保存记录并保存，刷新后新值仍在；删除后列表和比较页都不再出现此记录。
3. **草稿语义**：保存为草稿后，验证草稿存入 `drafts`，不会被比较页或正式 Offer 列表当作已保存 Offer。**待确认**：当前页面对草稿的查看、恢复和删除入口需产品定义。
4. **两份 Offer 比较**：创建在税后现金、储蓄、工时上有明确差别的两份 Offer；切换悲观/基准/乐观情景和权重，确认表格数值、排序、综合分数随输入更新且与引擎输出吻合。

### Phase 2：导入导出与边界状态

5. **JSON 往返**：导出含多个 Offer 的 JSON，清空数据后重新导入；核对所有字段、数量与结果保持一致。另测试格式错误 JSON、缺少 `app`/`offers`、错误应用标识时显示可理解错误且原数据不被破坏。实现目前只校验应用标识和 `offers` 数组（[io.ts](/workspace/Offerithm/src/storage/io.ts:19) 至 [io.ts](/workspace/Offerithm/src/storage/io.ts:25)），对每个 Offer 的结构校验尚未见到，需作为边界项确认。
6. **CSV 导出**：验证文件有 UTF-8 BOM，列头和结果列正确；公司/名称含逗号、双引号、中文时仍能正确解析。确认公式前缀（如 `=`, `+`, `-`, `@`）是否需要作为表格软件公式注入风险处理。
7. **空状态与错误**：空 Offer 列表下比较页提示先创建；模拟 IndexedDB 禁用/写入拒绝时，操作失败应给出可恢复提示，不应显示成功状态。

### Phase 3：计算验收数据集

8. **税务边界样例**：逐档验证税率切换前、阈值处和阈值后；对比奖金单独与合并计税；覆盖零/负收入、扣除超过收入、专项扣除和社保扣除叠加。
9. **社保与住房公积金边界**：验证基数下限/上限夹取，分别检查社保与公积金基数；选择含补充医疗、长期护理、补充公积金、企业年金的政策组合并逐项核账。
10. **薪酬组成组合**：覆盖月/季度/年度/一次性组件、固定额/基薪百分比、计税开关、社保基数开关、多个阶梯奖金规则，核对税前现金、计税收入和基数。
11. **多 Offer 评分退化情况**：覆盖无 Offer、一个 Offer、指标完全相同、权重全零、单个维度权重为 100，并核对分数范围和排序确定性。
12. **政策缺失与估计披露**：未知地区政策时检查结果、警告和 UI 文案；验证 3 年/10 年预测值、置信度和假设随情景变化，UI 清楚表示代理指标与估算限制。

## 测试分层建议

| 层级 | 建议覆盖 | 目的/验收证据 |
|---|---|---|
| 单元 | 继续扩展 `src/core/engine/__tests__/engine.test.ts`，为税阶、社保基数、薪酬组件、未知政策、比较权重与边界输入增加独立算例 | 快速定位纯函数回归；关键金额采用已复核的手算或权威政策样例作为期望值 |
| 存储/集成 | 为 `src/storage/db.ts` 和 `src/storage/io.ts` 新增测试：IndexedDB CRUD、仓库升级/错误路径、JSON 往返/拒绝格式、CSV 编码/转义 | 证明浏览器持久化和数据格式契约，不只证明业务引擎函数 |
| UI 集成 | 覆盖 Offers、Compare、Settings 页面与 store/IO 的联动，包含空态、保存/草稿/编辑/删除、权重/情景、导入错误提示 | 证明用户操作真实调用了预期 API，展示状态与数据一致 |
| 浏览器 E2E | 自动化一条“新建两份 Offer → 比较 → 刷新 → 编辑 → 导出/导入 → 删除”的完整流程 | 复现主会话手工 smoke，并在浏览器中验证 IndexedDB、导航、文件交互和持久化 |
| 静态/打包检查 | `typecheck`、`lint`、`build` 保持为独立 CI 检查 | 这些检查是类型、风格和构建门槛，不替代行为测试；主会话已报告当前通过 |

**验收完成建议**：至少完成 Phase 1 全部场景并自动化；JSON/CSV 的基础往返与格式错误场景纳入集成测试；计算边界按风险分批覆盖。每条验收记录实际运行方式、浏览器/环境、结果和失败证据。当前 16 个引擎测试、手工 smoke 和静态检查应分别报告，避免合并成一个笼统的“功能测试通过”。
