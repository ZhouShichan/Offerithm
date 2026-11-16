import { useEffect, useState } from 'react';
import type { ComparisonWeights, Offer, ScenarioKey } from '../core/types';
import { calculateOffer } from '../core/engine';
import { compareOffers, defaultWeights, criterionLabels } from '../core/engine/compare';
import { validateOffer, type ValidationIssue } from '../core/validation';
import { offerStore } from '../storage/db';
import { offersToCsv, download } from '../storage/io';

const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const SCENARIOS: ScenarioKey[] = ['pessimistic', 'base', 'optimistic'];
const scenarioLabels: Record<ScenarioKey, string> = {
  pessimistic: '悲观',
  base: '基准',
  optimistic: '乐观',
};
const describeIssues = (issues: ValidationIssue[]) => issues.map((issue) => `${issue.path || 'Offer'}：${issue.message}`).join('；');

export default function ComparePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [weights, setWeights] = useState<ComparisonWeights>(defaultWeights);
  const [scenario, setScenario] = useState<ScenarioKey>('base');

  useEffect(() => {
    void offerStore.list().then(setOffers);
  }, []);

  const diagnosed = offers.map((offer) => ({ offer, issues: validateOffer(offer) }));
  const validOffers = diagnosed.filter((row) => row.issues.length === 0).map((row) => row.offer);
  const invalidOffers = diagnosed.filter((row) => row.issues.length > 0);
  const results = validOffers.map((o) => calculateOffer(o, { scenario }));
  const ranked = compareOffers(validOffers, results, weights);
  const scoresByOfferId = new Map(ranked.map((comparison) => [comparison.offerId, comparison.totalScore]));

  const exportCsv = () => {
    const rows = results.map((r, i) => ({
      offer: validOffers[i]!,
      summary: r as unknown as Record<string, number | string>,
    }));
    download('offerithm-compare.csv', offersToCsv(rows), 'text/csv');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">多 Offer 比较</h1>
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={exportCsv}>
          导出 CSV（Excel）
        </button>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-slate-500">请先在「我的 Offer」中保存至少一个 Offer。</p>
      ) : validOffers.length === 0 ? (
        <p className="text-sm text-slate-500">目前没有可比较的有效 Offer，请先修复下方记录。</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">情景：</span>
            {SCENARIOS.map((s) => (
              <button key={s}
                className={`rounded-md px-3 py-1 ${scenario === s ? 'bg-emerald-600 text-white' : 'border border-slate-300 dark:border-slate-600'}`}
                onClick={() => setScenario(s)}>
                {scenarioLabels[s]}
              </button>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 font-semibold">自定义权重（0-100）</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(weights) as Array<keyof ComparisonWeights>).map((k) => (
                <label key={k} className="text-sm">
                  {criterionLabels[k]}：{weights[k]}
                  <input type="range" min={0} max={100} value={weights[k]} className="w-full"
                    onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left dark:bg-slate-800">
                <tr>
                  <th className="p-2">指标</th>
                  {validOffers.map((o) => <th key={o.id} className="p-2">{typeof o.name === 'string' ? o.name : '无效名称'}</th>)}
                </tr>
              </thead>
              <tbody>
                {([
                  ['税前年现金', (r: ReturnType<typeof calculateOffer>) => fmt(r.grossAnnualCash)],
                  ['税后年现金', (r: ReturnType<typeof calculateOffer>) => fmt(r.netAnnualCash)],
                  ['个税', (r: ReturnType<typeof calculateOffer>) => fmt(r.incomeTaxAnnual)],
                  ['公积金年入账', (r: ReturnType<typeof calculateOffer>) => fmt(r.housingFundAnnual)],
                  ['企业年成本', (r: ReturnType<typeof calculateOffer>) => fmt(r.employerTotalCostAnnual)],
                  ['年生活成本', (r: ReturnType<typeof calculateOffer>) => fmt(r.livingCostAnnual)],
                  ['年净储蓄', (r: ReturnType<typeof calculateOffer>) => fmt(r.annualSavings)],
                  ['有效时薪', (r: ReturnType<typeof calculateOffer>) => fmt(r.effectiveHourlyRate)],
                  ['3 年预测', (r: ReturnType<typeof calculateOffer>) => `${fmt(r.projection.year3.value)}（置信 ${r.projection.year3.confidence}）`],
                  ['10 年预测', (r: ReturnType<typeof calculateOffer>) => `${fmt(r.projection.year10.value)}（置信 ${r.projection.year10.confidence}）`],
                ] as const).map(([label, fn]) => (
                  <tr key={label} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-2 text-slate-500">{label}</td>
                    {results.map((r) => <td key={r.offerId} className="p-2">{fn(r)}</td>)}
                  </tr>
                ))}
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-2 font-semibold">综合得分</td>
                  {validOffers.map((o) => {
                    const score = scoresByOfferId.get(o.id) ?? 0;
                    return (
                      <td key={o.id} className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded bg-slate-200 dark:bg-slate-700">
                            <div className="h-2 rounded bg-emerald-500" style={{ width: `${score}%` }} />
                          </div>
                          <span className="font-semibold">{score}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </section>

          <p className="text-xs text-slate-400">
            成长性 / 稳定性 / 福利价值为代理指标估计，仅供参考；预测值标注了置信度，长期预测不确定性高。
          </p>
        </>
      )}

      {invalidOffers.length > 0 && <section aria-label="排除的 Offer" className="rounded-xl border border-amber-300 p-4 text-sm dark:border-amber-900">
        <h2 className="font-semibold text-amber-800 dark:text-amber-300">以下记录未参与比较，需修复后再使用</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">{invalidOffers.map(({ offer, issues }, index) => (
          <li key={typeof offer?.id === 'string' ? offer.id : `invalid-${index}`}>
            {typeof offer?.name === 'string' ? offer.name : '无效名称'}：{describeIssues(issues)}
          </li>
        ))}</ul>
      </section>}
    </div>
  );
}
