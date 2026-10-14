import type { InsuranceBreakdownItem, RegionPolicy } from '../types';

export interface InsuranceResult {
  /** 个人月缴合计 */
  employeeMonthly: number;
  /** 企业月缴合计 */
  employerMonthly: number;
  /** 公积金（含补充）月入账（个人+企业） */
  housingFundMonthly: number;
  /** 医保个人账户月入账 */
  medicalAccountMonthly: number;
  breakdown: InsuranceBreakdownItem[];
}

function clampBase(base: number, floor: number, ceiling: number): number {
  return Math.min(Math.max(base, floor), ceiling);
}

/** 按地区政策计算五险一金月缴（社保与公积金基数分别取上下限）。 */
export function calculateInsurance(policy: RegionPolicy, monthlyInsuranceBase: number): InsuranceResult {
  const socialBase = clampBase(monthlyInsuranceBase, policy.baseFloor, policy.baseCeiling);
  const hfBase = clampBase(monthlyInsuranceBase, policy.hfBaseFloor, policy.hfBaseCeiling);
  const r = policy.rates;
  const breakdown: InsuranceBreakdownItem[] = [];

  const push = (name: string, base: number, rate: { employee: number; employer: number; personalAccount: boolean }) => {
    const employee = base * rate.employee;
    const employer = base * rate.employer;
    breakdown.push({
      name,
      employeeMonthly: employee,
      employerMonthly: employer,
      toPersonalAccount: rate.personalAccount ? employee + employer : 0,
    });
    return { employee, employer };
  };

  let employeeMonthly = 0;
  let employerMonthly = 0;
  let housingFundMonthly = 0;
  let medicalAccountMonthly = 0;

  const pension = push('养老保险', socialBase, r.pension);
  const medical = push('医疗保险', socialBase, r.medical);
  const unemployment = push('失业保险', socialBase, r.unemployment);
  const injury = push('工伤保险', socialBase, r.injury);
  const maternity = push('生育保险', socialBase, r.maternity);
  employeeMonthly += pension.employee + medical.employee + unemployment.employee + injury.employee + maternity.employee;
  employerMonthly += pension.employer + medical.employer + unemployment.employer + injury.employer + maternity.employer;

  // 医保个人账户：以个人缴纳部分近似（各地单位划拨规则不同，UI 需标注）
  medicalAccountMonthly += medical.employee;

  if (r.medical.extraEmployee) {
    employeeMonthly += r.medical.extraEmployee;
    breakdown.push({
      name: '大额医疗互助',
      employeeMonthly: r.medical.extraEmployee,
      employerMonthly: 0,
      toPersonalAccount: 0,
    });
  }

  for (const [key, label, base] of [
    ['supplementaryMedical', '补充医疗', socialBase],
    ['longTermCare', '长期护理险', socialBase],
  ] as const) {
    const rate = r[key];
    if (rate) {
      const res = push(label, base, rate);
      employeeMonthly += res.employee;
      employerMonthly += res.employer;
    }
  }

  const hf = push('住房公积金', hfBase, r.housingFund);
  employeeMonthly += hf.employee;
  employerMonthly += hf.employer;
  housingFundMonthly += hf.employee + hf.employer;

  if (r.supplementaryHousingFund) {
    const shf = push('补充公积金', hfBase, r.supplementaryHousingFund);
    employeeMonthly += shf.employee;
    employerMonthly += shf.employer;
    housingFundMonthly += shf.employee + shf.employer;
  }

  if (r.enterpriseAnnuity) {
    const ann = push('企业年金', socialBase, r.enterpriseAnnuity);
    employeeMonthly += ann.employee;
    employerMonthly += ann.employer;
  }

  return {
    employeeMonthly,
    employerMonthly,
    housingFundMonthly,
    medicalAccountMonthly,
    breakdown,
  };
}
