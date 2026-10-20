# Offerithm（薪筹）— Offer Compensation Domain

面向中国大陆应届生 Offer 薪酬分析与多 Offer 比较的领域词汇表。术语以标准英文为规范名，中文为译名；中文文档引用关键术语时写作「中文术语(English Term)」，如 税后到手现金(Net Cash)。

## 术语引用约定

- 文档（PRD、代码注释、issue）中首次出现关键术语时，后接括注的标准英文词汇：`年终奖(Annual Bonus)`。
- 英文规范名以本文件为准；`代码标识符` 仅为对照。术语与代码不一致时，映射以词条记录为准，代码改名是本文件之外的独立决定。

## Language

### Offer 与生命周期 (Offer & Lifecycle)

**Offer（正式 Offer）**:
一份公司录用报价的全局唯一正式事实记录；一处更新、处处生效，可被多个工作区引用。
_Avoid_: 临时估算、草稿

**Offer Draft（Offer 编辑草稿）**:
对已有 Offer 的未保存修改；每份 Offer 至多一份，仅在所属工作区内预览。
_Avoid_: Quick Estimate Draft（两者生命周期不同，不得合并）

**Quick Estimate Draft（快速估算草稿，即临时估算）**:
正式 Offer 创建之前的临时试算；可并行多份、可切换与比较，不自动进入正式库。
_Avoid_: 与 Offer Draft 混称"草稿"

**Workspace（工作区）**:
一次多 Offer 决策分析；引用正式 Offer，拥有独立的比较配置与草稿预览状态。

**Draft Preview（草稿预览）**:
工作区内让草稿值参与展示与比较的开关状态；草稿永不跨工作区共享。

**Scenario（模拟情景）**:
可命名、保存、比较、恢复的假设推演，与 Offer 事实分离；默认继承最新正式 Offer，被覆盖的参数可锁定。
_Avoid_: 解释为概率分布；与 Scenario Tier 混用

**Scenario Tier（情景档位，即三档情景）**:
保守(Conservative)/基准(Base)/乐观(Optimistic)三档假设取值，各含调薪幅度与年终奖倍数；是假设推演，不是概率分布。代码枚举 `pessimistic | base | optimistic`，其中 `pessimistic` 对应「保守」。
_Avoid_: 用 Scenario 指代档位

**Preference Profile（全局偏好模板）**:
多套、带 ID 与版本号的比较偏好模板；支持软删除/恢复/彻底删除。

**Workspace Preference（工作区偏好快照）**:
工作区对某偏好模板的独立快照，记录来源 ID 与版本；仅显式同步时更新，本地修改不回写模板。

**Data State（数据状态）**:
一条数据的五种口径状态：用户已确认事实 / 政策默认值 / 系统估算 / 未保存草稿 / 模拟情景；展示与导出必须标注。

**Provenance（数据来源标注）**:
字段级的来源与不确定性记录；四值枚举：已确认(confirmed) / 政策默认(policy-default) / 系统估算(system-estimate) / 未知(unknown)。「未保存草稿 / 模拟情景」是数据对象状态（Data State），不是字段级来源。

**Enterprise Type（企业类型）**:
私企 / 央国企快捷预设；仅决定默认参数，不得据此宣称两套法定社保比例。

### 薪资结构 (Salary Structure)

**Base Monthly Salary（月基本工资）**:
固定月薪；百分比类组件（如绩效 = 基数 × 20%）的计算锚点。
_Avoid_: 与缴费基数(Contribution Base)混用

**Salary Component（薪资组成部分）**:
带发放频次（monthly/quarterly/annual/oneTime）与金额类型（fixed/percentOfBase）的工资组成项；各自标注是否计入缴费基数、是否计税。

**Annual Bonus（年终奖）**:
按年计的年终奖金金额。
_Avoid_: 与绩效工资混同

**Bonus Tax Method（年终奖计税方式）**:
单独计税(separate) 或 并入综合所得(combined)，二选一。

**Tiered Bonus Rule（阶梯奖金规则）**:
超过阈值的部分按更高比例计提的奖金规则；阈值以月薪或年薪为基数。
_Avoid_: 压平为单一"奖金金额"

**One-time Payment（一次性收入）**:
签字费、安家费等一次性发放金额，标注是否应税；影响首年现金流。

**Subsidy（企业补贴）**:
企业发放的补贴条目：现金(Cash)／报销(Reimbursement)／实物(In-kind)三种形态，按月／按年／按事件／按资格发放；应税属性采用类型驱动的默认建议（政策默认或系统估算）并可被用户依据实际文件覆盖。实物类在完整批次交付前仅录入，不计入现金收入；政府补贴不属于本条目。
_Avoid_: 与 One-time Payment 混称；把示例税务归类当成普适法规

**Annual Package（年薪总包）**:
HR 报价的名义年度总薪酬；作为基准数字录入，与明细组件合计对账——不一致时警告并显示差额，由用户选择以哪边为准。不得未经对账直接相加。
_Avoid_: 强制拆解为组件之和

**Reconciliation Basis（对账依据）**:
年薪总包与明细合计不一致时用户选择的计算基准：以总包为准(package)或以明细为准(detail)；系统仅警告并显示差额，不得暗自合并或相加。

**Salary Input Mode（薪资输入方式）**:
快速估算的三种表达：年薪总包 / 月薪×发薪月数 / 自定义结构。

### 社保与公积金 (Social Insurance & Housing Fund)

**Region Policy（地区政策）**:
按「地区 + 年度」组织的法定参数：各险种与公积金的缴费比例、基数上下限；必须携带来源；缺失时显式警告，不得静默按 0。代码 `RegionPolicy`。

**Contribution Base（缴费基数）**:
计算社保/公积金缴费的工资基数，超出 [下限, 上限] 区间时截断。

**Five Insurances & One Fund（五险一金）**:
法定核心组合：养老、医疗、失业、工伤、生育 + 住房公积金。

**Seven Insurances & Two Funds（七险二金）**:
扩展组合：五险一金 + 补充医疗、长期护理 + 补充公积金、企业年金；各项目逐项可启用/关闭。

**Employee / Employer Contribution（个人缴费 / 企业缴费）**:
同一险种的两侧缴费；工伤、生育仅企业缴纳；两侧金额分别列示。
_Avoid_: 只看个人侧而低估企业成本

**Personal Account（个人账户）**:
划入个人名下的权益（医保个账、公积金）；非即时现金，与现金收入分开列示。

### 个税 (Income Tax)

**Comprehensive Income（综合所得）**:
适用年度超额累进税率表的年度合并应税所得。

**Annual Tax Bracket（年度税率表）**:
7 级超额累进税率，每级含税率与速算扣除数。

**Quick Deduction（速算扣除数）**:
超额累进计算中按级简化的扣除额。

**Basic Deduction（基本减除费用）**:
每月固定减除费用（5000 元/月）。

**Special Additional Deductions（专项附加扣除）**:
用户填报的年度扣除项（子女教育、赡养老人等）。

### 计算口径 (Metrics)

**Gross Annual Cash（税前年度总现金）**:
含各组件折算的年度税前现金总额。

**Net Cash（税后到手现金）**:
扣除个人缴费与个税后的年度/月度可用现金；不含公积金、医保个账等权益。
_Avoid_: 到手工资、到手收入（混入权益口径）

**Housing Fund Annual Inflow（公积金年入账额）**:
个人 + 企业（含补充公积金）的年度公积金入账；权益而非现金。

**Medical Account Annual Inflow（医保个账年入账额）**:
医保个人账户年度入账；权益而非现金。

**Employer Total Cost（企业总用人成本）**:
企业视角的年度总用工成本。

**Living Cost（生活成本）**:
住房/餐饮/交通/水电/其他（元/月）+ 年度非月度支出（元/年）。

**Cash Savings（现金储蓄）**:
税后现金(Net Cash) − 现金生活成本(Living Cost)；默认排序使用的储蓄口径。

**Equity-inclusive Savings（含权益储蓄）**:
现金储蓄 + 公积金年入账额（个人入账）；医保个账因不可自由支配不计入。与现金储蓄并列展示，不合并为单一"年度净储蓄"。

**Effective Hourly Rate（有效时薪）**:
年税前现金 ÷ 实际年工作小时；通勤时间折半计入。

**Work Intensity（工作强度）**:
每周工时（上班到下班时刻，不扣除就餐）+ 单程通勤分钟 + 每月出差天数 + 年假天数。

**Projection（收入预测）**:
第 1/3/10 年税前现金预测；一律为不确定性标注的估计值。

### 不确定性 (Uncertainty)

**Uncertainty Annotation（不确定性标注）**:
字段级来源标注：值 + 来源(Provenance) + 备注。未提供的数据保持 undefined，不得伪装为确定；估计值必须携带非 confirmed 的来源。
_Avoid_: 浮点「置信度」数值（伪精确）

**Explicit Zero（明确零值）**:
用户确认为真实 0 的字段值（如「已知无补贴」）；与「未提供」(undefined) 语义不同，展示与导出不得混同。

**Range Amount（区间金额）**:
以 {min, max} 表达的不确定金额（如年终奖区间）；计算取中值并整体标注为系统估算(System Estimate)，完整区间分析属后续能力。

### 比较与偏好 (Comparison)

**Criterion（比较维度）**:
六个维度：税后现金(netCash)、储蓄(savings)、工作生活平衡(workLifeBalance)、成长(growth)、稳定(stability)、福利(benefits)。

**Comparison Weights（比较权重）**:
各维度 0–100 的权重；工作区级，来源于偏好快照，可独立修改。

**Pareto Relation（帕累托关系）**:
在哪些条件下谁占优的多目标权衡关系；系统不得强制唯一最优解。

**Rank Stability / Sensitivity（排名稳定性 / 敏感度）**:
结论的稳健程度：排名是否随假设变化而翻转；单个参数变动对结果的影响幅度。
