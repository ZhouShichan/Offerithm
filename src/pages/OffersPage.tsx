import { useCallback, useEffect, useState } from 'react';
import type { Offer } from '../core/types';
import { calculateOffer } from '../core/engine';
import { offerStore, draftStore } from '../storage/db';
import { regionPolicies } from '../policies/regions';

function emptyOffer(regionPolicyId: string): Offer {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '新 Offer',
    companyName: '',
    regionPolicyId,
    salary: {
      baseMonthly: 0,
      annualBonus: 0,
      bonusTaxMethod: 'separate',
      components: [],
      tieredBonusRules: [],
    },
    scenarios: {
      pessimistic: { raiseRate: 0.02, bonusMultiplier: 0.5 },
      base: { raiseRate: 0.05, bonusMultiplier: 1 },
      optimistic: { raiseRate: 0.1, bonusMultiplier: 1.5 },
    },
    livingCost: { housing: 0, food: 0, transport: 0, utilities: 0, other: 0, annualExtra: 0 },
    work: { weeklyHours: 40, commuteMinutesOneWay: 30, travelDaysPerMonth: 0, annualLeaveDays: 5 },
    oneTimePayments: [],
    createdAt: now,
    updatedAt: now,
  };
}

const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });

const fieldCls =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800';
const btnPrimary =
  'rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700';
const btnSecondary =
  'rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700';

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setOffers(await offerStore.list());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (offer: Offer, asDraft: boolean) => {
    const next = { ...offer, updatedAt: new Date().toISOString() };
    try {
      await (asDraft ? draftStore : offerStore).put(next);
      if (asDraft) setEditing(null);
      else setEditing(next);
      await refresh();
    } catch (e) {
      setSaveError(String(e));
    }
  };

  if (editing) {
    const result = calculateOffer(editing);
    const set = (patch: Partial<Offer>) => setEditing({ ...editing, ...patch });
    const s = editing.salary;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">编辑 Offer</h1>
          <button className="text-sm text-slate-500 underline" onClick={() => setEditing(null)}>
            返回列表
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">名称
            <input className={fieldCls} value={editing.name}
              onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="text-sm">公司
            <input className={fieldCls} value={editing.companyName}
              onChange={(e) => set({ companyName: e.target.value })} />
          </label>
          <label className="text-sm">地区政策
            <select className={fieldCls} value={editing.regionPolicyId}
              onChange={(e) => set({ regionPolicyId: e.target.value })}>
              {regionPolicies.map((p) => (
                <option key={p.id} value={p.id}>{p.region}（{p.year}，示例）</option>
              ))}
            </select>
          </label>
          <label className="text-sm">月基本工资（元）
            <input type="number" className={fieldCls} value={s.baseMonthly}
              onChange={(e) => set({ salary: { ...s, baseMonthly: Number(e.target.value) } })} />
          </label>
          <label className="text-sm">年终奖（元/年）
            <input type="number" className={fieldCls} value={s.annualBonus}
              onChange={(e) => set({ salary: { ...s, annualBonus: Number(e.target.value) } })} />
          </label>
          <label className="text-sm">年终奖计税
            <select className={fieldCls} value={s.bonusTaxMethod}
              onChange={(e) => set({ salary: { ...s, bonusTaxMethod: e.target.value as 'separate' | 'combined' } })}>
              <option value="separate">单独计税</option>
              <option value="combined">并入综合所得</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="mb-2 font-semibold">年度结果（基准情景）</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-slate-500">税前年现金</dt><dd>{fmt(result.grossAnnualCash)}</dd></div>
            <div><dt className="text-slate-500">税后年现金</dt><dd>{fmt(result.netAnnualCash)}</dd></div>
            <div><dt className="text-slate-500">税后月现金</dt><dd>{fmt(result.netMonthlyCash)}</dd></div>
            <div><dt className="text-slate-500">个税</dt><dd>{fmt(result.incomeTaxAnnual)}</dd></div>
            <div><dt className="text-slate-500">公积金年入账</dt><dd>{fmt(result.housingFundAnnual)}</dd></div>
            <div><dt className="text-slate-500">医保个账年入账</dt><dd>{fmt(result.medicalAccountAnnual)}</dd></div>
            <div><dt className="text-slate-500">企业年成本</dt><dd>{fmt(result.employerTotalCostAnnual)}</dd></div>
            <div><dt className="text-slate-500">年净储蓄</dt><dd>{fmt(result.annualSavings)}</dd></div>
          </dl>
          {result.warnings.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-xs text-amber-600 dark:text-amber-400">
              {result.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </div>

        <div className="flex gap-3">
          <button className={btnPrimary} onClick={() => void save(editing, false)}>保存</button>
          <button className={btnSecondary} onClick={() => void save(editing, true)}>存为草稿</button>
        </div>
        {saveError && <p className="text-sm text-red-600">保存失败：{saveError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">我的 Offer</h1>
        <button className={btnPrimary} onClick={() => setEditing(emptyOffer(regionPolicies[0]!.id))}>
          + 新建 Offer
        </button>
      </div>
      {offers.length === 0 ? (
        <p className="text-sm text-slate-500">还没有保存的 Offer，点击右上角新建。</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {offers.map((o) => {
            const r = calculateOffer(o);
            return (
              <li key={o.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{o.name}</p>
                    <p className="text-xs text-slate-500">{o.companyName}</p>
                  </div>
                  <button className="text-xs text-red-500 underline"
                    onClick={async () => { await offerStore.remove(o.id); await refresh(); }}>
                    删除
                  </button>
                </div>
                <p className="mt-2 text-sm">税后年现金 <strong>{fmt(r.netAnnualCash)}</strong> 元 · 年净储蓄 {fmt(r.annualSavings)} 元</p>
                <button className="mt-2 text-xs text-emerald-600 underline" onClick={() => setEditing(o)}>
                  编辑
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
