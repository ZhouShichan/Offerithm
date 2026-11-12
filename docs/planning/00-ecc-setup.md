# ECC 安装与本次分析方法

日期：2026-11-12（Asia/Shanghai）。应用分析基线：`59000b92d971e0fd3a1ec8885cb1654336018177`。

## 安装结果

- 来源：用户指定的 https://github.com/affaan-m/ECC 。
- 本地参考源码：`/workspace/ECC`，检出 `d2ef2680594f9a17526a6e1a2e18b3d242c5d17b`。
- 使用官方 Codex 原生插件路径，依次执行 `codex plugin marketplace add affaan-m/ECC`、`codex plugin add ecc@ecc`。
- `codex plugin list --json` 确认 `ecc@ecc` **2.2.3**，`installed=true`、`enabled=true`。
- 缓存目录：`/home/agent/.codex/plugins/cache/ecc/ecc/2.2.3`。
- `node /workspace/ECC/scripts/codex/check-plugin-cache.js` 通过：skills、MCP 配置、hooks 和图标等 manifest 引用均存在。
- 远端插件目录查询出现网络错误；本地安装记录及缓存校验成功。未将该结果解读为所有 MCP 服务、hooks 或新会话动态发现均已验证。未运行额外的 hooks 信任或第三方 MCP 配置流程。

安装发生在当前云机器。后续新机器是否保留此安装取决于环境快照的发布和恢复；本次没有发布环境，也没有把 ECC 的整仓规则覆盖到 Offerithm 中。

## 本次采用的 ECC 指导

- [Planner 工作流](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/agents/planner.md)：从需求、现状与验收条件拆解有依赖关系的实施阶段。
- [Architect 工作流](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/agents/architect.md)：现状/目标分离、职责划分、接口契约、权衡及 ADR。
- [Frontend Patterns 技能](https://github.com/affaan-m/ECC/blob/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/frontend-patterns/SKILL.md)：React 组件组合、hooks、表单验证及错误处理；按项目实际规模选用。

这些文档仅作为工作方法；其中其它项目示例、模型默认值、后端技术栈或扩展建议不是 Offerithm 已批准需求。没有安装重复的 legacy sync 层，也没有替换现有 Codex 模型与会话设置。

## 实际代理分工

| 层级 | 模型与思考度 | 职责 |
| --- | --- | --- |
| 主会话 | 当前会话模型 | 安装技能、范围与决策复核、成果校验 |
| 负责人 | GPT-6.1 Sol / high | 任务分发、证据综合、需求优先级与架构决策 |
| 探索 | GPT-6.1 Terra / medium | 领域模型、算法、架构草案 |
| 探索 | GPT-6.1 Terra / low | IndexedDB、导入导出、部署和技术债 |
| 探索 | GPT-6 Luna / medium | 页面与功能覆盖、用户故事草案 |
| 探索 | GPT-6 Luna / low | 文档承诺、测试覆盖与验收草案 |

用户点名的 GPT-6 Terra 未在当前工具列表中提供，因此使用可用的 GPT-6.1 Terra，并已在进度说明中披露。子代理完成代码探索和方案草案；Sol 与主会话做汇总与取舍。

## 证据边界

- 需求恢复以当前 README、CONTRIBUTING、类型、引擎、页面、存储和测试为依据；没有凭空恢复历史待办。
- 本次未接入 GitHub Issues/PR API，因此不声称已复原所有外部历史需求。
- 当前提交仅有初始版本历史；建议与必须确认的产品口径在分析中分别标记。
- 上一环境准备阶段已通过 typecheck、lint、16项测试、build 和浏览器 Offer 保存/重载/删除验证；这些成功不能证明未覆盖的复杂薪酬及导入路径正确。
- 本次只新增分析文档和图，不修改应用源码、测试、依赖声明或锁文件，不代表方案已落地。
