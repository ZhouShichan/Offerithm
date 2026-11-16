import type { Offer } from '../core/types';
import { isIsoDateTime, validateOffer } from '../core/validation';

/**
 * 导入导出：JSON 全量 + CSV（Excel 可直接打开）。
 * 不引入第三方依赖；CSV 写 UTF-8 BOM 以便 Excel 识别中文。
 */

export interface WorkspaceSnapshot {
  app: 'offerithm';
  version: 1;
  exportedAt: string; // ISO 8601
  offers: Offer[];
}

export function toJson(snapshot: WorkspaceSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_OFFERS = 1000;

export function fromJson(text: string): WorkspaceSnapshot {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error('文件大小超过 5 MiB 限制。');
  const data: unknown = JSON.parse(text);
  if (typeof data !== 'object' || data === null || !('app' in data) || data.app !== 'offerithm' || !('version' in data) || data.version !== 1 || !('offers' in data) || !Array.isArray(data.offers) || !('exportedAt' in data) || !isIsoDateTime(data.exportedAt)) {
    throw new Error('文件格式或版本不正确。');
  }
  if (data.offers.length > MAX_IMPORT_OFFERS) throw new Error('Offer 数量超过 1000 条限制。');
  const ids = new Set<string>();
  for (const [index, offer] of data.offers.entries()) {
    const issues = validateOffer(offer);
    if (issues.length) throw new Error(`Offer ${index + 1}: ${issues.map(i => `${i.path}: ${i.message}`).join('；')}`);
    const id = (offer as Offer).id;
    if (ids.has(id)) throw new Error(`重复的 Offer ID: ${id}`);
    ids.add(id);
  }
  return data as WorkspaceSnapshot;
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([mime.includes('csv') ? '\uFEFF' + content : content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CSV_COLUMNS = [
  '名称', '公司', '月基本工资', '年终奖', '税前年现金', '税后年现金', '公积金年入账',
  '医保个账年入账', '企业年成本', '年生活成本', '年净储蓄', '更新时间',
] as const;

export function offersToCsv(rows: Array<{ offer: Offer; summary: Record<string, number | string> }>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const { offer, summary } of rows) {
    const cells = [
      offer.name, offer.companyName,
      offer.salary.baseMonthly, offer.salary.annualBonus,
      summary.grossAnnualCash ?? '', summary.netAnnualCash ?? '',
      summary.housingFundAnnual ?? '', summary.medicalAccountAnnual ?? '',
      summary.employerTotalCostAnnual ?? '', summary.livingCostAnnual ?? '',
      summary.annualSavings ?? '', offer.updatedAt,
    ];
    lines.push(cells.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','));
  }
  return lines.join('\n');
}
