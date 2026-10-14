import { useEffect, useState } from 'react';
import type { ComparisonWeights, Offer, ScenarioKey } from '../core/types';
import { calculateOffer } from '../core/engine';
import { compareOffers, defaultWeights, criterionLabels } from '../core/engine/compare';
import { offerStore } from '../storage/db';
import { offersToCsv, download } from '../storage/io';

const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const SCENARIOS: ScenarioKey[] = ['pessimistic', 'base', 'optimistic'];
const scenarioLabels: Record<ScenarioKey, string> = {
  pessimistic: '悲观',
  base: '基准',
  optimistic: '乐观',
};

export default function ComparePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [weights, setWeights] = useState<ComparisonWeights>(defaultWeights);
  const [scenario, setScenario] = useState<ScenarioKey>('base');

  useEffect(() => {
    void offerStore.list().then(setOffers);
  }, []);

  const results = offers.map((o) => calculateOffer(o, { scenario }));
  const ranked = compareOffers(offers, results, weights);

  const exportCsv = () => {
    const rows = results.map((r, i) => ({
      offer: offers[i]!,
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
                  {offers.map((o) => <th key={o.id} className="p-2">{o.name}</th>)}
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
                  {ranked.map((c) => (
                    <td key={c.offerId} className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded bg-slate-200 dark:bg-slate-700">
                          <div className="h-2 rounded bg-emerald-500" style={{ width: `${c.totalScore}%` }} />
                        </div>
                        <span className="font-semibold">{c.totalScore}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>

          <p className="text-xs text-slate-400">
            成长性 / 稳定性 / 福利价值为代理指标估计，仅供参考；预测值标注了置信度，长期预测不确定性高。
          </p>
        </>
      )}
    </div>
  );
}
