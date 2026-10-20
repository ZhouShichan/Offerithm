/**
 * Offerithm 核心领域类型 v2（已落地）。
 * 决策记录：issue #4（契约）+ #10（effectiveFrom/To 增补）。
 * 计算引擎（src/core/engine）与 UI 共享的唯一契约；
 * 诚信原则：未提供 = undefined；估计值必须携带 provenance；不得把未知伪装成确定值。
 */

/* ---------------- 来源与不确定性 ---------------- */

/**
 * 字段级数据来源（PRD §3 四值）。第四值 unknown 不进枚举：
 * 「未提供」直接表达为字段缺省（undefined），不与 0 混淆。
 */
export type Provenance = "confirmed" | "policy-default" | "system-estimate";

/**
 * 带来源字段：只用于**可能携带非用户来源**的字段（租金预填、补贴应税建议、
 * 生活成本样例等）。用户明确填 0 / false 是 confirmed 的真实零值，不是「未提供」。
 * 取代 v1 的 `Uncertain<T>`（浮点置信度是伪精确，违反诚信原则）。
 */
export interface Sourced<T> {
  value: T;
  provenance: Provenance;
  note?: string;
}

/** 区间金额（PRD-M03：年终奖等不确定金额须可录入区间并标注）。 */
export interface MoneyRange {
  min: number;
  max: number;
}

/** 金额规格：确定值或区间；区间按中值参与计算并整体标 system-estimate。 */
export type AmountSpec = number | MoneyRange;

/* ---------------- 结果警示 ---------------- */

/** 结构化警告。code 全集见 issue #11 决议；展示层按 code 决定图标/文案。 */
export type WarningCode =
  | "policy-missing-fallback" // 地区政策缺失，回退全国样例，整体低置信度
  | "package-reconciliation-mismatch" // 年薪总包与明细合计不一致，已按对账依据取值
  | "range-amount-midpoint" // 区间金额按中值计算
  | "missing-required-input" // 必填输入缺失，部分指标无法计算
  | "insurance-base-clamped" // 缴费基数超出政策上下限被截断（信息性）
  | "insurance-item-disabled"; // 有停用险种（信息性）

export interface Warning {
  code: WarningCode;
  message: string;
}

/* ---------------- 薪资结构 ---------------- */

/** 发放频次。金额单位：元/期，除非另有注释。 */
export type SalaryFrequency = "monthly" | "quarterly" | "annual" | "oneTime";

/**
 * 薪资组成部分（仅 custom 模式使用）。
 * 应税属性：工资薪金类组件默认应税，由用户断言（plain boolean）；
 * 补贴的应税「默认建议 + 覆盖」语义见 SubsidyItem.taxable（Sourced<boolean>）。
 */
export interface SalaryComponent {
  id: string;
  name: string;
  frequency: SalaryFrequency;
  /** fixed：元/期；percentOfBase：比率（0.2 = 20%），基数为月基本工资合计（锚点定义由引擎规格票定） */
  amountType: "fixed" | "percentOfBase";
  amount: number;
  /** 是否计入社保/公积金缴费基数 */
  countsTowardInsuranceBase: boolean;
  taxable: boolean;
}

/** 奖金规则基数锚点。精确语义见 issue #11 决议。 */
export type BonusBase = "monthlyBase" | "annualBase";

/**
 * 奖金规则：可判别联合，四变体平铺（PRD-M03 三类，其中阶梯含两个子型）。
 * - fixed：固定金额（可录区间）
 * - performanceMultiplier：绩效系数 × 基数
 * - tieredMarginal：分档累进——超过阈值的部分按更高比例计提
 * - tieredBracket：分档区间——落在哪一档给该档定额
 */
export type BonusRule =
  | { kind: "fixed"; amount: AmountSpec }
  | { kind: "performanceMultiplier"; coefficient: number; base: BonusBase }
  | {
      kind: "tieredMarginal";
      base: BonusBase;
      tiers: Array<{ upTo: number | null; rate: number }>;
    }
  | {
      kind: "tieredBracket";
      base: BonusBase;
      tiers: Array<{
        rangeMin: number;
        rangeMax: number | null;
        amount: number;
      }>;
    };

/** 总包对账依据：明细合计与总包基准不一致时，以谁为准参与计算（用户显式选择）。 */
export type ReconciliationBasis = "package" | "detail";

/**
 * 薪资输入：三种表达的判别联合（PRD-M01），用户真实输入进契约，
 * 引擎用纯函数 resolveSalary() 归一为内部形态——总包与明细是**对账关系**，永不相加。
 */
export type SalaryInput =
  | { mode: "annualPackage"; annualPackage: number }
  | { mode: "monthlyTimesMonths"; baseMonthly: number; payMonths: number }
  | {
      mode: "custom";
      components: SalaryComponent[];
      bonusRules: BonusRule[];
      /** 年薪总包对账基准（可选；填写后与明细合计对账） */
      annualPackageBaseline?: number;
      /** 填了基准且与明细不一致时，用户选择的对账依据 */
      reconciliationBasis?: ReconciliationBasis;
    };

/* ---------------- 社保、公积金与个税政策 ---------------- */

/** 险种/年金条目键。扩展条目按适用情况逐项启用，不推定「七险二金」人人都有。 */
export type InsuranceItemKey =
  | "pension"
  | "medical"
  | "unemployment"
  | "injury" // 仅企业缴纳
  | "maternity" // 仅企业缴纳
  | "supplementaryMedical"
  | "longTermCare"
  | "housingFund"
  | "supplementaryHousingFund"
  | "enterpriseAnnuity";

/** 缴费比例：比率（0.08 = 8%）。personalAccount = 是否划入个人账户（医保个账、公积金）。 */
export interface InsuranceRate {
  employee: number;
  employer: number;
  personalAccount: boolean;
}

/** 地区政策：按「地区 + 政策适用期」组织的法定参数；scope 显式区分真实城市政策与全国样例。 */
export interface RegionPolicy {
  id: string;
  region: string;
  /** 标称年度（如 2025 = 2025 社保年度）；精确适用期见 effectiveFrom/To */
  year: number;
  /**
   * 政策适用期（ISO 日期，含两端）。文件粒度 = 城市 × 政策期；
   * 同城社保年度与公积金年度错期时按主导体系建文件，字段级差异写 note（#10 决议）。
   */
  effectiveFrom: string;
  effectiveTo: string;
  /** region = 可核实的城市/省政策；national-sample = 全国通用样例，不得伪装为城市政策 */
  scope: "region" | "national-sample";
  /** 社保缴费基数上下限（元/月） */
  baseFloor: number;
  baseCeiling: number;
  /** 公积金缴费基数上下限（元/月） */
  hfBaseFloor: number;
  hfBaseCeiling: number;
  /** 法定五项必填；扩展条目按政策实际情况可选 */
  rates: Partial<Record<InsuranceItemKey, InsuranceRate & { note?: string }>>;
  /** 必填：官方来源链接；无可核实来源的数据不得进种子（#3 调研结论） */
  source: string;
}

/** 个税政策：年度汇算口径。租金三档预填值的政策数据落点由「政策数据规格」票决定。 */
export interface TaxPolicy {
  year: number;
  /** 综合所得年度税率表（7 级超额累进） */
  annualBrackets: Array<{
    upTo: number | null;
    rate: number;
    quickDeduction: number;
  }>;
  /** 每月基本减除费用（5000 元） */
  basicDeductionMonthly: number;
  /** 住房租金扣除城市档位（元/月）：majorCity=直辖市/省会，largeCity=市辖区户籍人口>100 万，other=其余 */
  rentDeductionTiers?: { majorCity: number; largeCity: number; other: number };
  /** 必填：官方来源链接 */
  source: string;
}

/* ---------------- 用户输入：扣除、保险配置、补贴、生活成本 ---------------- */

/** 专项附加扣除中除租金外的固定枚举键（用户填写即 confirmed，默认 0、可补充）。 */
export type SpecialDeductionKey =
  | "childrenEducation"
  | "continuingEducation"
  | "majorIllness"
  | "housingLoanInterest"
  | "elderlyCare"
  | "infantCare";

/**
 * 专项附加扣除输入（PRD-M04）：租金按城市档位预填（policy-default，
 * 不代表用户自动符合扣除条件），用户修改后变 confirmed；其余项默认 0、可补充。
 */
export interface DeductionInputs {
  /** 元/月；预填参考值须核实资格与政策年度 */
  rent?: Sourced<number>;
  /** 元/年 */
  others?: Partial<Record<SpecialDeductionKey, number>>;
}

/** 保险参与配置（PRD-M04：逐项启用/停用 + 高级配置改基数与比例）。 */
export interface InsuranceConfig {
  disabledItems?: InsuranceItemKey[];
  /** 手动基数（元/月）；仍受政策上下限截断 */
  baseOverrideMonthly?: number;
  rateOverrides?: Partial<
    Record<InsuranceItemKey, { employee?: number; employer?: number }>
  >;
}

/** 企业类型：快捷参数预设（私企/央国企），仅决定默认参数，不构成两套法定社保比例。 */
export type EnterpriseType = "private" | "soe";

/**
 * 企业补贴（PRD-M05，核心企业补贴属 MVP；政府补贴不纳入）。
 * 应税属性由类型驱动默认建议（policy-default / system-estimate）并可被用户
 * 依据实际文件覆盖为 confirmed——示例税务归类不得固化为法规。
 */
export interface SubsidyItem {
  id: string;
  name: string;
  /** 现金 / 报销 / 实物（in-kind 完整抵减批次交付前仅录入，不计现金收入） */
  form: "cash" | "reimbursement" | "inKind";
  /** 按月 / 按年 / 按事件 / 按资格 */
  frequency: "monthly" | "annual" | "perEvent" | "qualificationBased";
  /** 单期金额（元）。reimbursement/in-kind 同样记录名义金额供参考 */
  amount: number;
  /** 应税默认建议 + 用户覆盖（Sourced 在布尔上的首个应用） */
  taxable: Sourced<boolean>;
  /** 资格/触发条件说明（按资格、按事件发放时建议填写） */
  conditionNote?: string;
}

/**
 * 生活成本：每字段独立来源——城市档位样例为 system-estimate，
 * 用户改过的字段变 confirmed，未改字段保持样例来源。
 */
export interface LivingCost {
  housing: Sourced<number>; // 元/月
  food: Sourced<number>; // 元/月
  transport: Sourced<number>; // 元/月
  utilities: Sourced<number>; // 元/月
  other: Sourced<number>; // 元/月
  annualExtra: Sourced<number>; // 元/年（保险、旅行等非月度支出）
}

/** 快速估算草稿中的生活成本覆盖：只存用户显式修改（天然全是 confirmed）。 */
export type LivingCostOverride = Partial<
  Record<
    "housing" | "food" | "transport" | "utilities" | "other" | "annualExtra",
    number
  >
>;

/* ---------------- 工作强度（可选输入；分析能力属 PRD-F04，图外） ---------------- */

export interface WorkIntensity {
  /** 每周工作小时数（上班到下班时刻，不扣就餐） */
  weeklyHours: number;
  /** 单程通勤时间（分钟） */
  commuteMinutesOneWay: number;
  /** 每月出差天数 */
  travelDaysPerMonth: number;
  /** 年假天数 */
  annualLeaveDays: number;
}

/* ---------------- 领域对象 ---------------- */

/**
 * 正式 Offer：用户显式保存的事实记录；全局唯一 ID，可被多个 Workspace 引用。
 * v2 移除：scenarios（PRD-F03）、oneTimePayments（批次待定）、regionPolicyId（改为存查找意图）。
 */
export interface Offer {
  id: string;
  name: string;
  companyName: string;
  /** 工作城市（政策查找默认键之一） */
  workCity: string;
  /** 参保城市：缺省同 workCity，允许手动修改（PRD-M04） */
  insuranceCity?: string;
  /** 入职年度：政策年度默认值（PRD-M04） */
  entryYear: number;
  /** 记录估算来源预设；仅默认参数，不影响法定规则 */
  enterpriseType?: EnterpriseType;
  salary: SalaryInput;
  insuranceConfig?: InsuranceConfig;
  deductions?: DeductionInputs;
  subsidies?: SubsidyItem[];
  livingCost: LivingCost;
  /** 可选纯数据块：保留供比较维度使用；有效时薪等派生分析属 PRD-F04 */
  work?: WorkIntensity;
  notes?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** 快速估算草稿：只存用户输入与显式覆盖；默认假设不落库，计算时取政策/样例并标注来源。 */
export interface QuickEstimateDraft {
  id: string;
  city: string;
  enterpriseType?: EnterpriseType;
  salaryInput: SalaryInput;
  livingCostOverride?: LivingCostOverride;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Offer 编辑草稿：全量拷贝（不存 diff/patch）；同一 Offer 至多一份，主键即 offerId。 */
export interface OfferDraft {
  offerId: string;
  draft: Offer;
  updatedAt: string; // ISO 8601
}

/**
 * 工作区：一次多 Offer 比较决策。MVP 比较仅正式 Offer；
 * 草稿预览选择（PRD-F01）待排期，届时再加字段。
 */
export interface Workspace {
  id: string;
  name: string;
  offerIds: string[];
  weights: ComparisonWeights;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/* ---------------- 计算结果 ---------------- */

export interface InsuranceBreakdownItem {
  key: InsuranceItemKey;
  employeeMonthly: number;
  employerMonthly: number;
  toPersonalAccountMonthly: number;
}

/** 政策基准：本次计算实际使用的政策配置；全国样例回退在此显式记录。 */
export interface PolicyBasis {
  configUsed: "region" | "national-sample";
  /** configUsed === 'region' 时必填 */
  regionPolicyId?: string;
  year: number;
}

/**
 * 年度个税：双口径并列输出（PRD-M04）。v1 的 bonusTaxMethod 输入字段删除——
 * 引擎总是双算，默认展示单独计税由展示层决定，不宣称单独计税对所有人最优。
 * difference = combined − separate；> 0 表示单独计税少缴 difference 元。
 */
export interface IncomeTaxResult {
  separate: number;
  combined: number;
  difference: number;
}

/**
 * 计算结果：派生值不逐字段包 Sourced——政策回退是整体性事件，
 * 由 policyBasis + warnings 在结果级表达；展示层据此打「低置信度」标。
 * v2 移除：annualSavings、projection、effectiveHourlyRate（PRD-F03/F04，图外）。
 */
export interface OfferCalcResult {
  offerId: string;
  /** 税前年度总现金（元/年） */
  grossAnnualCash: number;
  /** 个人五险一金及企业年金缴纳（元/年） */
  employeeInsuranceAnnual: number;
  employerInsuranceAnnual: number;
  incomeTaxAnnual: IncomeTaxResult;
  netAnnualCash: number;
  netMonthlyCash: number;
  /** 公积金拆两侧：含权益储蓄只取个人侧 */
  housingFundPersonalAnnual: number;
  housingFundEmployerAnnual: number;
  /** 医保个账：受限权益单列，不并入任何储蓄口径 */
  medicalAccountAnnual: number;
  /** 企业总用人成本：独立输出，不混入个人现金 */
  employerTotalCostAnnual: number;
  livingCostAnnual: number;
  /** 现金储蓄 = 税后现金 − 现金生活成本；默认排序口径 */
  cashSavingsAnnual: number;
  /** 含权益储蓄 = 现金储蓄 + 个人侧公积金入账 */
  equityInclusiveSavingsAnnual: number;
  insuranceBreakdown: InsuranceBreakdownItem[];
  policyBasis: PolicyBasis;
  warnings: Warning[];
}

/* ---------------- 比较与权重（维度集合与算法见 issue #8 决议） ---------------- */

export type Criterion =
  | "netCash"
  | "savings"
  | "workLifeBalance"
  | "growth"
  | "stability"
  | "benefits";

export type ComparisonWeights = Record<Criterion, number>; // 0-100

export interface ComparisonResult {
  offerId: string;
  name: string;
  totalScore: number;
  criterionScores: Record<Criterion, number>; // 归一化 0-100
}
