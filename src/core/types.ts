/**
 * Offerithm 核心领域类型。
 * 计算引擎（src/core/engine）与 UI 共享的唯一契约；
 * 未知/未提供的数据必须保持 `undefined` 或 `confidence < 1`，不得伪装为确定值。
 */

/** 不确定性标注：1 = 确定，< 1 = 估计值（附来源说明）。 */
export interface Uncertain<T> {
  value: T;
  confidence: number;
  note?: string;
}

/* ---------------- 薪资结构 ---------------- */

/** 薪资组成部分。金额单位：元/月，除非注明。 */
export interface SalaryComponent {
  id: string;
  name: string;
  /** monthly | quarterly | annual | oneTime */
  frequency: 'monthly' | 'quarterly' | 'annual' | 'oneTime';
  /** 固定金额或按基数百分比（如绩效 = base * 20%） */
  amountType: 'fixed' | 'percentOfBase';
  amount: number;
  /** 是否计入社保/公积金缴费基数 */
  countsTowardInsuranceBase: boolean;
  /** 是否计税 */
  taxable: boolean;
}

/** 阶梯奖金规则：超过阈值部分按更高比例计提。 */
export interface TieredBonusRule {
  id: string;
  name: string;
  /** 月薪基数 */
  base: 'monthlyBase' | 'annualBase';
  tiers: Array<{ upTo: number | null; rate: number }>;
}

export interface SalaryStructure {
  /** 月基本工资（元） */
  baseMonthly: number;
  /** 年终奖（元/年）。单独计税或并入综合所得，见 bonusTaxMethod */
  annualBonus: number;
  /** 年终奖计税方式 */
  bonusTaxMethod: 'separate' | 'combined';
  components: SalaryComponent[];
  tieredBonusRules: TieredBonusRule[];
}

/* ---------------- 社保与公积金政策 ---------------- */

export interface InsuranceRate {
  /** 比例，如 0.08 表示 8% */
  employee: number;
  employer: number;
  /** 是否进入个人账户（如医保个账、公积金） */
  personalAccount: boolean;
}

/** 七险二金：养老、医疗、失业、工伤、生育、补充医疗、长期护理；住房公积金、企业年金。 */
export interface RegionPolicy {
  id: string;
  /** 行政区，如 "北京市" */
  region: string;
  /** 政策年度 */
  year: number;
  /** 社保缴费基数上下限（元/月） */
  baseFloor: number;
  baseCeiling: number;
  /** 公积金缴费基数上下限（元/月） */
  hfBaseFloor: number;
  hfBaseCeiling: number;
  rates: {
    pension: InsuranceRate;
    medical: InsuranceRate & { /** 大额医疗（元/月固定额） */ extraEmployee?: number };
    unemployment: InsuranceRate;
    injury: InsuranceRate; // 仅企业缴纳
    maternity: InsuranceRate; // 仅企业缴纳
    supplementaryMedical?: InsuranceRate;
    longTermCare?: InsuranceRate;
    housingFund: InsuranceRate & { note?: string };
    supplementaryHousingFund?: InsuranceRate;
    enterpriseAnnuity?: InsuranceRate;
  };
  /** 政策来源与生效说明（必须可追溯，不允许凭空编造） */
  source?: string;
}

/* ---------------- 个税 ---------------- */

export interface TaxPolicy {
  year: number;
  /** 综合所得年度税率表（7 级超额累进） */
  annualBrackets: Array<{ upTo: number | null; rate: number; quickDeduction: number }>;
  /** 每月基本减除费用（5000 元） */
  basicDeductionMonthly: number;
  /** 专项附加扣除（元/年）：子女教育、赡养老人等，由用户填写 */
  specialAdditionalDeductions: Record<string, number>;
  source?: string;
}

/* ---------------- 生活成本 ---------------- */

export interface LivingCost {
  /** 元/月 */
  housing: number;
  food: number;
  transport: number;
  utilities: number;
  other: number;
  /** 元/年，非月度支出（保险、旅行等） */
  annualExtra: number;
}

/* ---------------- 工作强度 ---------------- */

export interface WorkIntensity {
  /** 每周工作小时数（含加班） */
  weeklyHours: number;
  /** 单程通勤时间（分钟） */
  commuteMinutesOneWay: number;
  /** 每月出差天数 */
  travelDaysPerMonth: number;
  /** 年假天数 */
  annualLeaveDays: number;
}

/* ---------------- Offer ---------------- */

export type ScenarioKey = 'pessimistic' | 'base' | 'optimistic';

export interface Offer {
  id: string;
  name: string;
  companyName: string;
  regionPolicyId: string;
  salary: SalaryStructure;
  /** 三档情景：调薪幅度与年终奖倍数的悲观/基准/乐观取值 */
  scenarios: Record<ScenarioKey, { raiseRate: number; bonusMultiplier: number }>;
  livingCost: LivingCost;
  work: WorkIntensity;
  /** 签约相关一次性金额（签字费、安家费等，元） */
  oneTimePayments: Array<{ name: string; amount: number; taxable: boolean }>;
  notes?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/* ---------------- 计算结果 ---------------- */

export interface InsuranceBreakdownItem {
  name: string;
  employeeMonthly: number;
  employerMonthly: number;
  toPersonalAccount: number;
}

export interface OfferCalcResult {
  offerId: string;
  /** 税前年度总现金（含各类组件折算，元/年） */
  grossAnnualCash: number;
  /** 个人五险一金及企业年金缴纳（元/年） */
  employeeInsuranceAnnual: number;
  employerInsuranceAnnual: number;
  /** 个人所得税（元/年，含年终奖处理） */
  incomeTaxAnnual: number;
  /** 税后到手现金（元/年 与 元/月） */
  netAnnualCash: number;
  netMonthlyCash: number;
  /** 公积金（含补充）年入账额（个人+企业） */
  housingFundAnnual: number;
  /** 医保个人账户年入账额 */
  medicalAccountAnnual: number;
  /** 企业年总用人成本 */
  employerTotalCostAnnual: number;
  /** 年度生活成本 */
  livingCostAnnual: number;
  /** 年度净储蓄 = 税后现金 + 公积金 - 生活成本 */
  annualSavings: number;
  insuranceBreakdown: InsuranceBreakdownItem[];
  /** 时薪（元/小时）= 年税前 / 实际年工作小时（含通勤折半） */
  effectiveHourlyRate: number;
  /** 未来收入预测（第 1/3/10 年税前现金，元） */
  projection: Record<'year1' | 'year3' | 'year10', Uncertain<number>>;
  warnings: string[];
}

/* ---------------- 比较与权重 ---------------- */

export type Criterion =
  | 'netCash'
  | 'savings'
  | 'workLifeBalance'
  | 'growth'
  | 'stability'
  | 'benefits';

export type ComparisonWeights = Record<Criterion, number>; // 0-100

export interface ComparisonResult {
  offerId: string;
  name: string;
  totalScore: number;
  criterionScores: Record<Criterion, number>; // 归一化 0-100
}
