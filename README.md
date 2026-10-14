# Offerithm 薪筹

> 算清薪酬，筹划前程。

面向中国大陆应届生及求职者的综合薪酬分析与多 Offer 决策工具。Local-first：无需登录、无后端，所有数据保存在浏览器 IndexedDB 中。

## 功能

- **复杂薪资结构**：基本工资、绩效、阶梯奖金、年终奖、各类补贴及叠加规则
- **七险二金 + 企业年金**：缴费比例、基数上下限、地区政策可配置
- **个税计算**：综合所得年度税率、年终奖单独/合并计税、专项附加扣除
- **全口径结果**：税后到手现金、公积金、医保个账、企业总用人成本
- **生活成本**：住房/餐饮/交通等支出 → 年度净储蓄
- **工作强度**：工时、通勤、出差 → 有效时薪
- **收入预测**：3 年 / 10 年，三档情景（悲观/基准/乐观），附置信度
- **多 Offer 决策**：自定义权重评分、不确定性提示、比较仪表盘
- **数据**：草稿、工作区、本地持久化、JSON/CSV（Excel）导入导出

## 诚实原则

未知数据不伪装为确定值：

- 所有估计值（长期收入预测、代理指标）都标注置信度与假设
- 政策参数（税率表、缴费比例、基数）独立存放于 `src/policies/`，附来源说明
- 内置地区政策为示例配置，使用前请核对当地官方当年口径

## 快速开始

```bash
npm install
npm run dev        # 本地开发
npm test           # 运行单元测试
npm run build      # 构建产物（dist/）
```

## 部署到 GitHub Pages

1. Fork / 推送到仓库名为 `Offerithm` 的仓库
2. Settings → Pages → Source 选择 GitHub Actions
3. 推送到 `main` 即自动部署（`.github/workflows/deploy.yml`）

若仓库名不同，请同步修改 `vite.config.ts` 中的 `base` 或构建时设置 `VITE_BASE`。

## 项目结构

```
src/
  core/           # 领域类型与计算引擎（与 UI 解耦，纯函数，可独立测试）
    types.ts
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
