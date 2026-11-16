# Offerithm 薪筹

> 算清薪酬，筹划前程。

面向中国大陆应届生及求职者的综合薪酬分析与多 Offer 决策工具。Local-first：无需登录、无后端，所有数据保存在浏览器 IndexedDB 中。

## 功能

- **复杂薪资结构**：基本工资、绩效、阶梯奖金、年终奖、各类补贴及叠加规则
- **七险二金 + 企业年金**：缴费比例、基数上下限、地区政策可配置
- **个税计算**：综合所得年度税率、年终奖单独/合并计税、专项附加扣除
- **全口径结果**：税后到手现金、公积金、医保个账、企业总用人成本
- **生活成本**：住房/餐饮/交通等支出 → 年度净储蓄
- **工作强度**：工时、通勤 → 有效时薪；出差与年假可记录，暂不参与公式
- **收入预测**：3 年 / 10 年，三档情景（悲观/基准/乐观），附置信度
- **多 Offer 决策**：自定义权重评分、不确定性提示、比较仪表盘
- **数据**：IndexedDB 本地持久化、Offer JSON 导入导出、比较 CSV（Excel）导出

当前录入界面支持基本薪资、年终奖、地区、六项生活成本、每周工时和单程通勤；修改后实时重算，保存后可重新打开继续编辑。复杂薪资组件、阶梯奖金、一次性款项和情景参数主要已有引擎/模型能力，完整编辑入口仍待补齐。
草稿可保存、列出、恢复和删除；正式保存与同 ID 草稿清理使用一个事务。JSON 导入完整校验后预览新增/覆盖，用户确认后整批提交；失败不留下部分写入，预览后目标数据变化需重新预览。政策设置当前只读展示内置示例，不提供自定义编辑；CSV 暂不支持导入。

JSON v1 仅备份正式 Offer，不含草稿、比较权重、当前情景或政策快照。导入按 ID 整条覆盖，保留文件中未包含的本地记录；覆盖前请先导出备份。单次导入上限为 5 MiB、1000 份 Offer。未知地区政策或无效数据会显示诊断，不能直接导入或正式保存。

生活成本为月度住房、餐饮、交通、水电等、其他之和乘 12，再加年度额外支出；净储蓄沿用“税后现金 + 公积金 − 生活成本”。有效时薪沿用年税前现金除以每周工时 × 50 加全年双程通勤折半（每周 5 天）的小时数；年假与出差字段目前不参与该公式。成本默认 0、工时默认 40、单程通勤默认 30 分钟，使用前请按实际情况填写。以上口径本批未作调整。

## 诚实原则

未知数据不伪装为确定值：

- 所有估计值（长期收入预测、代理指标）都标注置信度与假设
- 政策参数（税率表、缴费比例、基数）独立存放于 `src/policies/`，附来源说明
- 内置地区政策为示例配置，使用前请核对当地官方当年口径

## 快速开始

```bash
npm ci
npm run dev        # 本地开发
npm test           # 运行单元测试
npm run build      # 构建产物（dist/）
```

开发环境与 CI 使用 Node.js 20。浏览器回归覆盖成本/工时持久化、草稿闭环、JSON 预览与恢复、故障回滚、比较列对应关系及根/子路径部署：

```bash
npx playwright install chromium
npm run test:e2e
```

Linux 缺少浏览器系统依赖时可使用 `npx playwright install --with-deps chromium`。
云环境已有 Chromium 时，设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` 即可复用。
测试会自动构建根路径和 `/Offerithm/` 两份产物，启动并关闭专用测试服务；结果位于忽略的 `test-results/`。

## 部署到 GitHub Pages

1. Fork / 推送到仓库名为 `Offerithm` 的仓库
2. Settings → Pages → Source 选择 GitHub Actions
3. 推送到 `main` 即自动部署（`.github/workflows/deploy.yml`）

若仓库名不同，请同步修改 `vite.config.ts` 中的 `base` 或构建时设置 `VITE_BASE`。

页面采用 HashRouter，发布后的页面地址形如 `/Offerithm/#/offers`。
`#` 后的路径由浏览器处理，直接打开或刷新子页无需服务器提供 SPA 回退；Vite 的 `base` 仍负责静态资源路径。

## 开发进度

需求、架构和后续计划见 [开发分析总览](docs/planning/README.md)。
首批正确性修复及验证记录见 [阶段 0 进展](docs/planning/04-phase0-progress.md)。
本批核心使用闭环、校验/事务策略和实际验证结果见 [P1 进展](docs/planning/05-p1-progress.md)。

## 项目结构

```
src/
  core/           # 领域类型与计算引擎（与 UI 解耦，纯函数，可独立测试）
    types.ts
    validation.ts # 表单、草稿和 JSON 共享运行时校验
    engine/       # salary / insurance / tax / compare / index(calculateOffer)
  policies/       # 政策参数（地区社保公积金、个税），独立管理
  storage/        # IndexedDB 封装与 JSON/CSV 导入导出
  pages/          # 页面：首页 / 我的 Offer / 比较 / 设置
  App.tsx         # 路由与布局
```

## 参与贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
