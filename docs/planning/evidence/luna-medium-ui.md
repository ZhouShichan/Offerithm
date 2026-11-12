# Offerithm UI 与需求覆盖证据

> 范围：仅核对当前 React 页面、表单、样式、数据存储与计算层契约；不将产品介绍页里的文案自动视为已确认需求。路径行号对应本次检查的仓库版本。状态说明：**已实现**=存在可操作 UI；**仅引擎/数据层**=有类型、算法或存储但没有可操作 UI；**缺失**=相关用户功能在界面和链路中都未实现；**待确认**=README/宣传文案提到，但业务口径或交互未定义。

## 页面与主要用户旅程

| 旅程 | 当前界面证据 | 现状与断点 |
|---|---|---|
| 首页 → 创建 Offer | 首页入口跳到 `/offers`，见 [HomePage.tsx](/workspace/Offerithm/src/pages/HomePage.tsx:21)；导航路由见 [App.tsx](/workspace/Offerithm/src/App.tsx:23) | **已实现**入口。 |
| 录入 → 即时看结果 → 保存/存草稿 | 编辑视图字段和实时计算见 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:68)、结果卡片 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:115)、保存按钮 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:134) | **已实现但字段不完整**。编辑时计算结果随当前编辑对象即时重算；草稿写入 IndexedDB 后退出编辑，但无草稿列表或恢复入口。 |
| 列表 → 编辑/删除 | 列表/空态见 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:143)，编辑和删除见 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:164) | **已实现**保存 Offer 的增删改查（父会话已做持久化 smoke）。没有删除确认/撤销；删除异常未呈现。 |
| 比较 → 选情景/调权重 → 导出 | [ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:45) 至 [ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:118) | **已实现**情景切换、六项滑杆、表格和 CSV 导出。分数行存在顺序错配风险（见下）。无单 Offer 勾选筛选、评分准则细分说明。 |
| 设置 → 导入/导出 → 查看政策 | [SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:16) 至 [SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:68) | JSON 导入导出和政策说明可用；无政策编辑、CSV 导入、草稿管理、工作区/全数据清理或导入预览。 |

## README 声明逐项验证

README 功能列表在 [README.md](/workspace/Offerithm/README.md:7)。下面按每一项验证用户可操作性，避免把计算代码误判为 UI 已交付。

| README 声明 | 状态 | 实际证据/覆盖 |
|---|---|---|
| 复杂薪资结构：基本工资、绩效、阶梯奖金、年终奖、补贴及叠加规则 | **部分已实现；其余仅引擎/数据层** | UI 只有月基本工资、年度年终奖和计税方式，见 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:98)。绩效/补贴组件、频率、计入缴费基数/计税标志及阶梯规则存在类型/引擎（[types.ts](/workspace/Offerithm/src/core/types.ts:16)、[salary.ts](/workspace/Offerithm/src/core/engine/salary.ts:1)），无增删编辑界面。 |
| 七险二金 + 企业年金：缴费比例、基数上下限、地区政策可配置 | **仅引擎/内置示例；UI 部分缺失** | 结果计算支持政策类型和可选险种（[types.ts](/workspace/Offerithm/src/core/types.ts:61)、[insurance.ts](/workspace/Offerithm/src/core/engine/insurance.ts:19)）；仅内置北京/上海示例（[regions.ts](/workspace/Offerithm/src/policies/regions.ts:9)）。Offer 表单只能选示例地区（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:90)），设置只读展示政策及“在政策文件中修改”提示（[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:52)），用户不能配置费率/上下限。README 所称“可配置”对普通用户不成立。 |
| 个税：综合所得年度税率、年终奖单独/合并计税、专项附加扣除 | **部分已实现；扣除项仅引擎/政策数据层** | 年终奖两种方式可在 Offer 表单选择（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:106)）；税率算法及七项扣除默认值存在引擎/政策（[tax.ts](/workspace/Offerithm/src/core/engine/tax.ts:22)、[policies/tax.ts](/workspace/Offerithm/src/policies/tax.ts:20)），但 UI 未提供任何专项附加扣除输入；计算调用实际传默认 0（[engine/index.ts](/workspace/Offerithm/src/core/engine/index.ts:43)）。 |
| 全口径结果：税后现金、公积金、医保个账、企业总用人成本 | **已实现（摘要口径）** | Offer 编辑结果卡显示上述项目和个税、年净储蓄（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:115)）；未展示逐险种明细，尽管结果类型有 `insuranceBreakdown`。 |
| 生活成本：住房/餐饮/交通等 → 年度净储蓄 | **仅引擎/数据层** | Offer 类型与计算有生活成本字段/年度储蓄（[types.ts](/workspace/Offerithm/src/core/types.ts:103)、[engine/index.ts](/workspace/Offerithm/src/core/engine/index.ts:63)），编辑 UI 无对应输入；结果显示储蓄但其支出假设默认全为 0。 |
| 工作强度：工时、通勤、出差 → 有效时薪 | **仅引擎/数据层** | 工时、单程通勤、出差、年假有类型/部分计算（[types.ts](/workspace/Offerithm/src/core/types.ts:116)、[engine/index.ts](/workspace/Offerithm/src/core/engine/index.ts:68)），UI 无输入；出差天数和年假当前计算中也未参与时薪公式。比较页只显示结果数值。 |
| 收入预测：3 年/10 年、三情景、置信度 | **计算已实现；UI 部分已实现** | 三档情景在比较页可切换且影响结果（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:49)）；引擎产生一年/三年/十年估算及置信度（[engine/index.ts](/workspace/Offerithm/src/core/engine/index.ts:73)），比较表显示 3/10 年和置信度（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:91)）。Offer 的三档调薪率/奖金倍数没有输入 UI，只有代码默认值（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:21)）；结果卡不显示预测。 |
| 多 Offer 决策：自定义权重、不确定性提示、比较仪表盘 | **部分已实现；“仪表盘”待确认** | 六项权重可调、数值比较表和综合分条可见（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:60)）。引擎将成长/稳定/福利以代理指标估算（[compare.ts](/workspace/Offerithm/src/core/engine/compare.ts:12)），页面有统一提示（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:116)），但没有分项得分/公式解释。纯表格分数条是否足以称“仪表盘”需产品确认。 |
| 数据：草稿、工作区、本地持久化、JSON/CSV（Excel）导入导出 | **本地持久化/JSON/CSV 导出已实现；草稿 UI、CSV 导入、工作区概念缺失** | IndexedDB 有 offers/drafts store（[db.ts](/workspace/Offerithm/src/storage/db.ts:8)）；草稿仅写入、Offer 页面只读 offers（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:48)、[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:56)），没有 draft list/read/delete UI。JSON 全量导入导出只处理正式 offers（[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:16)）；CSV 在比较页仅导出（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:28)），没有 CSV 导入；“工作区”未在 UI/存储模型中定义。 |

README 诚实原则另核：政策源码提供 `source` 且页面标示示例，符合部分披露（[regions.ts](/workspace/Offerithm/src/policies/regions.ts:3)、[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:66)）；结果警告会显示，但只展示实际生成的警告（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:127)）。专项扣除、可配置的三情景假设和生活/工作输入欠缺，故输出中若无明确提示，使用者可能把默认假设当作实际条款。预测数值有置信度（[engine/index.ts](/workspace/Offerithm/src/core/engine/index.ts:77)），三年/十年假设说明 `note` 并未展示，只显示置信数字。

## 用户可编辑字段与交互边界

| 分组 | 当前 UI 可编辑 | 数据模型存在但 UI 不可编辑 |
|---|---|---|
| 标识/地区 | Offer 名称、公司、地区政策选择（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:82)） | 备注 `notes`。 |
| 薪资 | 月基本工资、年终奖、年终奖计税方式（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:98)） | 薪资组件/绩效/补贴/频率/缴费基数和计税标志、阶梯奖金规则、一次性签字费/安家费。 |
| 假设 | 无 | 悲观/基准/乐观调薪率与奖金倍数。 |
| 扣除/社保 | 只能选择内置地区 ID | 专项附加扣除金额、地区费率/上下限/政策来源编辑。 |
| 生活/工作 | 无 | 住房/餐饮/交通/水电/其他月支出、年度额外支出；工时、通勤、出差、年假。 |
| 比较 | 当前情景、六项 0–100 权重 | 不持久化权重/情景；无自选 Offer 集合/逐项准则分。 |

当前数值输入为裸 `type="number"`，未声明 `min`/`step` 或界面校验；可输入负数，字符串被 `Number(...)` 转为数值（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:98)）。新建 Offer 默认零基本工资，仍能保存并显示零值；无必填/合理范围错误提示。`saveError` 仅保存异常时显示（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:63)）。列表加载 `offerStore.list()` 被 `void` 调用且无 loading/error 处理（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:48)）；比较和设置页读取也没有错误态（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:21)、[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:12)）。

## 需优先确认/修复的 UI 正确性风险

以下错列场景为静态调用链和归一化公式推导，本次未在浏览器执行该数据集；与主会话已经通过的基础 CRUD smoke 是不同证据。

**比较页综合分可能错配 Offer 列，P0 候选。** 表头和指标行按原始 `offers` 顺序渲染（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:77)、[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:96)），但综合得分行按 `ranked` 排名顺序渲染（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:100)）。最小可复现数据：导入/写入两条 Offer，固定 `id: 'a'`、名称 A、税后现金低；`id: 'b'`、名称 B、税后现金高。IndexedDB `getAll()` 按 key 排序后得到 `[A,B]`；在比较页把 `netCash` 权重设为 100，其余五项权重均设为 0。两条 Offer 的 `netCash` 归一化分分别是 A=0、B=100；`compareOffers` 得分顺序为 `[B(100),A(0)]`，但表头及普通指标列仍为 `[A,B]`，所以 A 列会显示 100、B 列显示 0。这里复现依赖给定的可排序固定 ID，不能用随机 UUID 创建先后推断 `getAll()` 顺序。用户可能据此做相反决策。建议按 `offerId` 映射综合分，保留同一列顺序；同时给最高分单独标识或另显排名。

其他缺口：草稿保存后无法恢复（写入口 [OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:135)；无 UI 对应 `draftStore.list`）；导入 JSON 会按 ID 覆盖现存 Offer，导入前无预览/冲突选项（[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:21)）；导入后 Offers 页面/比较页未刷新联动是否即时可见需确认路由切换行为。文件选取后未清空 input value，同一文件重复选择可能不触发 change。

## 空态、错误、可访问性与移动布局

- **空态：已实现但简略。** Offers 列表为空有新建指引（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:151)）；比较为空引导先保存 Offer（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:45)）。没有 draft 空态（没有 draft 页面）、正在加载/存储不可用状态。
- **错误：覆盖不一致。** Offer 保存失败会显示原始异常字符串（[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:138)）；JSON 导入成功/失败有普通提示（[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:21)）。IndexedDB 首次打开失败、页面读取失败、删除失败、导出失败无可见恢复操作。导入仅校验 app 标识和 `offers` 为数组（[io.ts](/workspace/Offerithm/src/storage/io.ts:19)），数据结构字段未校验，错误也没有 `role="alert"`/状态播报。
- **可访问性：基础语义有，控件状态与数据关联仍有缺口。** 有 header/nav/main/footer、标题、label 包裹表单控件、比较表格语义（[App.tsx](/workspace/Offerithm/src/App.tsx:17)、[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:82)、[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:73)）。React Router 的 `NavLink` 默认对 active 项输出 `aria-current="page"`（[App.tsx](/workspace/Offerithm/src/App.tsx:23)），不应列为缺失；当前未做 DOM/读屏实测。情景按钮没有 `aria-pressed`，滑杆 label 未显式说明 min/max；比较数据单元没有 `scope="col/row"`。得分条旁有可见数字文本（[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:103)），因此不是仅以颜色传达；合理缺口是该条没有 progressbar 语义、数字/条没有明确关联到对应 Offer 身份，且综合得分列错位风险会破坏身份关联。错误/成功 message 无 live region。键盘原生按钮/输入可用，但隐藏文件 input 的 label 键盘焦点样式未定义。建议做 WCAG 2.2 AA 实测后定优先级。
- **移动布局：部分响应式实现。** 页头允许换行，卡片网格从单列到多列，编辑字段 md 两列，比较表格横向滚动（[App.tsx](/workspace/Offerithm/src/App.tsx:18)、[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:81)、[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:73)）。[index.html](/workspace/Offerithm/index.html:5) 已含 viewport meta；仍无窄屏设备实测证据。顶部导航在极窄宽度可能拥挤，比较表横向滚动的键盘/触摸可发现性需验证。

## 需求追踪矩阵草案

下表是基于现状的可追踪需求候选；只有前两列“用户需要/证据”可由代码确认，优先级是建议，不代表现有承诺。P0 优先保护决策结果正确，P1 覆盖核心输入闭环，P2 增强完整性/便利性。此处为子任务草案，汇总决策以 `../01-requirements.md` 和 `../03-implementation-plan.md` 为准，其中基础生活/工时为P1，高级薪资和政策编辑器为P2。

| ID / 优先级 | 用户需要（草案） | 状态 / 代码证据 | 验收标准草案 |
|---|---|---|---|
| UI-01 / P0 | 比较表每个 Offer 的得分显示在对应列 | 当前有错位风险；[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:99) | 创建至少两个分数相反于实际加载顺序的 Offer；表头、所有指标、综合分列始终按同一 Offer ID 对齐；排序/并列时仍正确。 |
| UI-02 / P1 | 用户可完整录入会影响计算的 Offer 假设 | 多数字段仅数据层；[types.ts](/workspace/Offerithm/src/core/types.ts:16) | Offer 表单可新增/编辑薪资组件、阶梯奖金、专项扣除、生活支出、工时/通勤、三情景假设和一次性款项；重开后值保持；结果明确反映每类输入。具体字段与业务口径待确认。 |
| UI-03 / P1 | 用户能恢复/管理草稿 | 当前仅保存；[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:135) | 草稿列表可查看/继续编辑/删除；恢复后可保存为正式 Offer；关闭再打开后仍存在。 |
| UI-04 / P1 | 用户可读懂计算结果的政策口径和假设 | 部分警告/置信度；[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:127)、[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:116) | 展示所用政策年度/地区、适用警告、预测值假设说明和置信度；零输入/缺政策/未填写生活成本时不让用户误读为可靠估值。具体免责声明文案待确认。 |
| UI-05 / P1 | 比较表的权重、情景选择可被辅助技术理解 | NavLink 默认 aria-current；情景和比较表语义仍待加强；[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:49) | 键盘可操作；情景暴露选中态；滑杆有名称、范围和值；得分数值/条与 Offer 身份明确关联并提供适当语义；表格标题关联行列；状态变化可被读屏播报。 |
| UI-06 / P1 | 用户能安全导入/导出并了解冲突影响 | 当前 JSON 直接 upsert；[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:21) | 导入先校验版本/字段并预览新增、覆盖数量；用户确认后应用；无效文件可解释且不会部分写入；重复选择同一文件有效。是否需要 CSV 导入待确认。 |
| UI-07 / P2 | 用户可管理地区政策参数 | 仅示例只读；[SettingsPage.tsx](/workspace/Offerithm/src/pages/SettingsPage.tsx:52) | 若确认该承诺：可新增/编辑费率、基数上下限、来源和年度；Offer 可选自定义政策；输入验证并显示该政策用于哪些 Offer。策略（配置 UI 或保持代码维护）待产品确认。 |
| UI-08 / P2 | 用户可查看险种明细及导出结果 | 结果类型有 breakdown、UI 未展示；[types.ts](/workspace/Offerithm/src/core/types.ts:181) | 按个人/企业/入账列出各险种月/年金额；导出与屏幕所选情景、计算结果一致。详细口径待确认。 |
| UI-09 / P2 | 移动端和窄屏仍能完成录入及比较 | 响应式类已存在；[ComparePage.tsx](/workspace/Offerithm/src/pages/ComparePage.tsx:73) | 320px/375px viewport 下无页面级横向溢出；导航、表单提交、比较表横向滚动可触达；放大/键盘操作不丢内容。 |
| UI-10 / P2 | 用户看到可恢复的数据读取/写入失败状态 | 当前仅保存/导入错误；[OffersPage.tsx](/workspace/Offerithm/src/pages/OffersPage.tsx:63) | IndexedDB 不可用、列表读取、删除、导入/导出失败有明确消息和重试/替代操作；不把异常堆栈原样展示给普通用户。 |

## 待产品确认的业务问题

1. README 的“工作区”是否指一个默认数据集，还是未来支持多个命名工作区/快照？当前代码只有单一 offers/drafts 两个 object store。
2. 是否把 README 中所有引擎字段都纳入第一版录入 UI？复杂薪资（频率、叠加、阶梯）、政策自定义会明显扩展编辑器。
3. “年净储蓄”是否把公积金计入可储蓄资产；个账、补充公积金、一次性款项税务和生活成本的默认处理口径需业务确认。
4. “稳定性”代理为企业总成本规模，“成长性”代理为乐观与悲观调薪差，指标是否合理、需不需要用户改值/看公式？[compare.ts](/workspace/Offerithm/src/core/engine/compare.ts:31)
5. 是否需要 CSV 导入？README 的“JSON/CSV 导入导出”目前歧义为两种格式均进出，实际 CSV 仅导出。
6. 专项附加扣除、税率/缴费政策是否由用户逐 Offer 设置、全局设置，或保持代码常量？年份更新和来源审核责任归属需定。
