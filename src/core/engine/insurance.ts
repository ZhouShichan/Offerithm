import type {
  InsuranceBreakdownItem,
  InsuranceConfig,
  InsuranceItemKey,
  RegionPolicy,
} from "../types";
import type { ResolvedSalary } from "./salary";

export interface InsuranceResult {
  /** 个人五险一金年缴（元/年，月值按分四舍五入后 ×12） */
  employeeAnnual: number;
  employerAnnual: number;
  /** 公积金拆两侧：含权益储蓄只取个人侧 */
  housingFundPersonalAnnual: number;
  housingFundEmployerAnnual: number;
  /** 医保个账年入账（受限权益单列） */
  medicalAccountAnnual: number;
  breakdown: InsuranceBreakdownItem[];
  disabledItems: InsuranceItemKey[];
}

/** 按政策计算五险一金（截断顺序/停用/舍入规格见 issue #11）。TODO(IMP-05)。 */
export function computeInsurance(
  resolved: ResolvedSalary,
  policy: RegionPolicy,
  config?: InsuranceConfig
): InsuranceResult {
  void resolved;
  void policy;
  void config;
  throw new Error("TODO(IMP-05): computeInsurance 未实现");
}
