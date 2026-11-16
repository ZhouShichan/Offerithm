import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Offer } from '../core/types';
import { calculateOffer } from '../core/engine';
import { validateOffer, type ValidationIssue } from '../core/validation';
import { draftStore, offerStore, type DraftOffer } from '../storage/db';
import { regionPolicies } from '../policies/regions';

function emptyOffer(regionPolicyId: string): Offer {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), name: '新 Offer', companyName: '', regionPolicyId,
    salary: { baseMonthly: 0, annualBonus: 0, bonusTaxMethod: 'separate', components: [], tieredBonusRules: [] },
    scenarios: {
      pessimistic: { raiseRate: 0.02, bonusMultiplier: 0.5 },
      base: { raiseRate: 0.05, bonusMultiplier: 1 },
      optimistic: { raiseRate: 0.1, bonusMultiplier: 1.5 },
    },
    livingCost: { housing: 0, food: 0, transport: 0, utilities: 0, other: 0, annualExtra: 0 },
    work: { weeklyHours: 40, commuteMinutesOneWay: 30, travelDaysPerMonth: 0, annualLeaveDays: 5 },
    oneTimePayments: [], createdAt: now, updatedAt: now,
  };
}

/** Fill absent structural containers only after the user explicitly chooses recovery. */
function completeDraftStructure(draft: DraftOffer): DraftOffer {
  const base = emptyOffer(regionPolicies[0]?.id ?? '');
  return {
    ...base, ...draft, name: draft.name ?? '', companyName: draft.companyName ?? '', regionPolicyId: draft.regionPolicyId ?? '',
    salary: {
      ...base.salary, ...draft.salary, baseMonthly: draft.salary?.baseMonthly, annualBonus: draft.salary?.annualBonus,
      bonusTaxMethod: draft.salary?.bonusTaxMethod,
      components: draft.salary?.components ?? [], tieredBonusRules: draft.salary?.tieredBonusRules ?? [],
    },
    scenarios: {
      pessimistic: { ...base.scenarios.pessimistic, ...draft.scenarios?.pessimistic },
      base: { ...base.scenarios.base, ...draft.scenarios?.base },
      optimistic: { ...base.scenarios.optimistic, ...draft.scenarios?.optimistic },
    },
    livingCost: {
      housing: draft.livingCost?.housing, food: draft.livingCost?.food, transport: draft.livingCost?.transport,
      utilities: draft.livingCost?.utilities, other: draft.livingCost?.other, annualExtra: draft.livingCost?.annualExtra,
    },
    work: {
      weeklyHours: draft.work?.weeklyHours, commuteMinutesOneWay: draft.work?.commuteMinutesOneWay,
      travelDaysPerMonth: draft.work?.travelDaysPerMonth, annualLeaveDays: draft.work?.annualLeaveDays,
    },
    oneTimePayments: draft.oneTimePayments ?? [],
    createdAt: draft.createdAt ?? base.createdAt,
    updatedAt: draft.updatedAt ?? base.updatedAt,
  };
}

const fmt = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const fieldCls = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800';
const btnPrimary = 'rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60';
const btnSecondary = 'rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-700';

function NumberField({ label, value, disabled, onChange }: {
  label: string; value: number | undefined; disabled: boolean; onChange: (value: number | undefined) => void;
}) {
  return <label className="text-sm">{label}
    <input type="number" inputMode="decimal" className={fieldCls} value={value ?? ''} disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))} />
  </label>;
}

function issueText(issues: ValidationIssue[]) {
  return issues.map(({ path, message }) => `${path || 'Offer'}：${message}`).join('；');
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [drafts, setDrafts] = useState<DraftOffer[]>([]);
  const [editing, setEditing] = useState<DraftOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextOffers, nextDrafts] = await Promise.all([offerStore.list(), draftStore.list()]);
    setOffers(nextOffers);
    setDrafts(nextDrafts);
    setLoadError(null);
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => setLoadError(String(error))).finally(() => setLoading(false));
  }, [refresh]);

  const runBusy = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSaveError(null);
    setNotice(null);
    setActionError(null);
    try { await action(); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const issues = useMemo(() => editing ? validateOffer(editing) : [], [editing]);
  const draftIssues = useMemo(() => editing ? validateOffer(editing, 'draft') : [], [editing]);
  const result = editing && issues.length === 0 ? calculateOffer(editing as Offer) : null;
  const invalidRows = offers.map((offer) => ({ offer, issues: validateOffer(offer) })).filter((row) => row.issues.length > 0);

  const updateEditing = (update: (current: DraftOffer) => DraftOffer) => {
    setNotice(null);
    setSaveError(null);
    setEditing((current) => current ? update(current) : current);
  };
  const setTop = (patch: Partial<Offer>) => updateEditing((current) => ({ ...current, ...patch }));
  const setSalary = (patch: Partial<NonNullable<DraftOffer['salary']>>) => updateEditing((current) => ({ ...current, salary: { ...current.salary, ...patch } }));
  const setCost = (field: keyof NonNullable<DraftOffer['livingCost']>, value: number | undefined) => updateEditing((current) => ({ ...current, livingCost: { ...current.livingCost, [field]: value } }));
  const setWork = (field: 'weeklyHours' | 'commuteMinutesOneWay' | 'travelDaysPerMonth' | 'annualLeaveDays', value: number | undefined) => updateEditing((current) => ({ ...current, work: { ...current.work, [field]: value } }));

  const beginEditing = (offer: DraftOffer) => {
    setNotice(null);
    setSaveError(null);
    setActionError(null);
    setRefreshError(false);
    setEditing(offer);
  };

  const submit = async (asDraft: boolean) => {
    if (!editing || busyRef.current) return;
    const current = structuredClone(editing);
    const next = { ...current, updatedAt: new Date().toISOString() };
    const validationIssues = asDraft ? validateOffer(next, 'draft') : issues;
    if (validationIssues.length > 0) {
      setSaveError(`请先修正：${issueText(validationIssues)}`);
      return;
    }
    await runBusy(async () => {
      try {
        if (asDraft) await draftStore.put(next);
        else await offerStore.save(next as Offer);
      } catch (error) {
        setSaveError(`写入失败，编辑内容仍保留，可修正后重试：${String(error)}`);
        return;
      }
      setEditing(next);
      setNotice(asDraft ? '草稿已保存。' : '已保存');
      try {
        await refresh();
        setRefreshError(false);
        if (asDraft) setEditing(null);
      } catch (error) {
        setRefreshError(true);
        setSaveError(`${asDraft ? '草稿已保存' : '已保存'}，但列表刷新失败：${String(error)}。可重试刷新列表。`);
      }
    });
  };

  const retryRefresh = () => {
    void runBusy(async () => {
      try { await refresh(); setRefreshError(false); setSaveError(null); setNotice('列表已刷新。'); }
      catch (error) { setSaveError(`列表刷新失败：${String(error)}`); }
    });
  };

  const removeOffer = (id: string) => {
    void runBusy(async () => {
      try { await offerStore.remove(id); }
      catch (error) { setActionError(`删除失败，记录仍保留：${String(error)}`); return; }
      try { await refresh(); }
      catch (error) { setRefreshError(true); setActionError(`已删除，但列表刷新失败：${String(error)}`); }
    });
  };

  const removeDraft = (id: string) => {
    void runBusy(async () => {
      try { await draftStore.remove(id); }
      catch (error) { setActionError(`删除草稿失败：${String(error)}`); return; }
      try { await refresh(); }
      catch (error) { setRefreshError(true); setActionError(`草稿已删除，但列表刷新失败：${String(error)}`); }
    });
  };

  if (editing) {
    const s = editing.salary;
    const cost = editing.livingCost;
    const work = editing.work;
    const name = typeof editing.name === 'string' ? editing.name : '';
    const regionId = typeof editing.regionPolicyId === 'string' ? editing.regionPolicyId : '';
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">编辑 Offer</h1>
          <button className="text-sm text-slate-500 underline disabled:opacity-50" disabled={busy} onClick={() => setEditing(null)}>返回列表</button>
        </div>
        {(issues.length > 0 || draftIssues.length > 0) && <section aria-label="输入诊断" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <h2 className="font-semibold">尚不能计算或正式保存</h2>
          <ul className="mt-1 list-disc pl-5">{issues.map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.path || 'Offer'}：{issue.message}</li>)}</ul>
          {draftIssues.length > 0 && <p className="mt-2">草稿也有无效字段：{issueText(draftIssues)}</p>}
        </section>}
        <fieldset disabled={busy} className="space-y-5">
          <section className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">名称<input className={fieldCls} value={name} onChange={(e) => setTop({ name: e.target.value })} /></label>
            <label className="text-sm">公司<input className={fieldCls} value={typeof editing.companyName === 'string' ? editing.companyName : ''} onChange={(e) => setTop({ companyName: e.target.value })} /></label>
            <label className="text-sm">地区政策
              <select className={fieldCls} value={regionId} onChange={(e) => setTop({ regionPolicyId: e.target.value })}>
                {!regionId && <option value="">请选择地区政策</option>}
                {regionId && !regionPolicies.some((p) => p.id === regionId) && <option value={regionId}>未知地区：{regionId}</option>}
                {regionPolicies.map((p) => <option key={p.id} value={p.id}>{p.region}（{p.year}，示例）</option>)}
              </select>
            </label>
            <NumberField label="月基本工资（元）" value={s?.baseMonthly} disabled={busy} onChange={(v) => setSalary({ baseMonthly: v })} />
            <NumberField label="年终奖（元/年）" value={s?.annualBonus} disabled={busy} onChange={(v) => setSalary({ annualBonus: v })} />
            <label className="text-sm">年终奖计税
              <select className={fieldCls} value={s?.bonusTaxMethod ?? ''} onChange={(e) => setSalary({ bonusTaxMethod: e.target.value as 'separate' | 'combined' })}>
                {!s?.bonusTaxMethod && <option value="">请选择计税方式</option>}
                <option value="separate">单独计税</option><option value="combined">并入综合所得</option>
              </select>
            </label>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 font-semibold">生活成本</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="住房（元/月）" value={cost?.housing} disabled={busy} onChange={(v) => setCost('housing', v)} />
              <NumberField label="餐饮（元/月）" value={cost?.food} disabled={busy} onChange={(v) => setCost('food', v)} />
              <NumberField label="交通（元/月）" value={cost?.transport} disabled={busy} onChange={(v) => setCost('transport', v)} />
              <NumberField label="水电等（元/月）" value={cost?.utilities} disabled={busy} onChange={(v) => setCost('utilities', v)} />
              <NumberField label="其他（元/月）" value={cost?.other} disabled={busy} onChange={(v) => setCost('other', v)} />
              <NumberField label="年度额外支出（元/年）" value={cost?.annualExtra} disabled={busy} onChange={(v) => setCost('annualExtra', v)} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="mb-3 font-semibold">工作强度</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="每周工时（小时）" value={work?.weeklyHours} disabled={busy} onChange={(v) => setWork('weeklyHours', v)} />
              <NumberField label="单程通勤（分钟）" value={work?.commuteMinutesOneWay} disabled={busy} onChange={(v) => setWork('commuteMinutesOneWay', v)} />
              <NumberField label="每月出差天数" value={work?.travelDaysPerMonth} disabled={busy} onChange={(v) => setWork('travelDaysPerMonth', v)} />
              <NumberField label="年假天数" value={work?.annualLeaveDays} disabled={busy} onChange={(v) => setWork('annualLeaveDays', v)} />
            </div>
            <p className="mt-2 text-xs text-slate-500">时薪估算使用每周工时与单程通勤；出差和年假暂不参与当前公式。恢复旧草稿会将缺失数字留空，需补齐后才能正式保存。</p>
          </section>
        </fieldset>

        {result ? <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="mb-2 font-semibold">年度结果（基准情景）</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-slate-500">税前年现金</dt><dd>{fmt(result.grossAnnualCash)}</dd></div>
            <div><dt className="text-slate-500">税后年现金</dt><dd>{fmt(result.netAnnualCash)}</dd></div>
            <div><dt className="text-slate-500">税后月现金</dt><dd>{fmt(result.netMonthlyCash)}</dd></div>
            <div><dt className="text-slate-500">个税</dt><dd>{fmt(result.incomeTaxAnnual)}</dd></div>
            <div><dt className="text-slate-500">公积金年入账</dt><dd>{fmt(result.housingFundAnnual)}</dd></div>
            <div><dt className="text-slate-500">医保个账年入账</dt><dd>{fmt(result.medicalAccountAnnual)}</dd></div>
            <div><dt className="text-slate-500">企业年成本</dt><dd>{fmt(result.employerTotalCostAnnual)}</dd></div>
            <div><dt className="text-slate-500">年度生活成本</dt><dd>{fmt(result.livingCostAnnual)}</dd></div>
            <div><dt className="text-slate-500">年净储蓄</dt><dd>{fmt(result.annualSavings)}</dd></div>
            <div><dt className="text-slate-500">含通勤有效时薪（元/小时）</dt><dd>{fmt(result.effectiveHourlyRate)}</dd></div>
          </dl>
          {result.warnings.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-amber-600 dark:text-amber-400">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </section> : <p className="text-sm text-amber-700 dark:text-amber-300">输入不完整或政策未知，暂不计算结果。草稿仍可保存。</p>}

        <div className="flex flex-wrap gap-3">
          <button className={btnPrimary} disabled={busy || issues.length > 0} onClick={() => void submit(false)}>保存</button>
          <button className={btnSecondary} disabled={busy || draftIssues.length > 0} onClick={() => void submit(true)}>存为草稿</button>
        </div>
        {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
        {refreshError && <button className={btnSecondary} disabled={busy} onClick={retryRefresh}>重试刷新列表</button>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">我的 Offer</h1>
        <button className={btnPrimary} disabled={busy} onClick={() => beginEditing(emptyOffer(regionPolicies[0]?.id ?? ''))}>+ 新建 Offer</button>
      </div>
      {loadError && <div role="alert" className="text-sm text-red-600"><p>读取列表失败：{loadError}</p><button className="underline" disabled={busy} onClick={retryRefresh}>重试刷新列表</button></div>}
      {loading ? <p className="text-sm text-slate-500">正在读取本地数据…</p> : offers.length === 0
        ? <p className="text-sm text-slate-500">还没有保存的 Offer，点击右上角新建。</p>
        : <ul className="grid gap-3 sm:grid-cols-2">{offers.map((offer) => {
          const rowIssues = validateOffer(offer);
          const result = rowIssues.length === 0 ? calculateOffer(offer) : null;
          return <li key={offer.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold">{typeof offer.name === 'string' && offer.name ? offer.name : '未命名 Offer'}</p><p className="text-xs text-slate-500">{typeof offer.companyName === 'string' ? offer.companyName : '公司名称无效'}</p><p className="text-xs text-slate-400">ID：{offer.id}</p></div>
              <button className="text-xs text-red-500 underline" disabled={busy} onClick={() => removeOffer(offer.id)}>删除</button>
            </div>
            {result ? <p className="mt-2 text-sm">税后年现金 <strong>{fmt(result.netAnnualCash)}</strong> 元 · 年净储蓄 {fmt(result.annualSavings)} 元</p>
              : <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">记录不完整，未计算：{issueText(rowIssues)}</p>}
            <button className="mt-2 text-xs text-emerald-600 underline" disabled={busy} onClick={() => beginEditing(completeDraftStructure(offer))}>编辑</button>
          </li>;
        })}</ul>}
      {invalidRows.length > 0 && <p className="text-xs text-amber-700">有 {invalidRows.length} 条已保存记录需要修复；记录仍保留，可编辑后重新保存。</p>}
      {drafts.length > 0 && <section className="rounded-xl border border-amber-200 p-4 dark:border-amber-900">
        <h2 className="mb-2 font-semibold">草稿</h2>
        <p className="mb-3 text-xs text-slate-500">草稿不会参与正式 Offer 比较。恢复时会为缺失的情景采用新建默认值，保留已有情景，并补齐空组件/款项列表和技术日期；缺失金额、生活成本、工时、通勤、地区和计税方式仍留空，需要你填写。</p>
        <ul className="space-y-2">{drafts.map((draft) => <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <span>{typeof draft.name === 'string' && draft.name ? draft.name : '未命名草稿'}</span>
          <span className="text-xs text-slate-400">ID：{draft.id}</span>
          <div className="flex gap-3">
            <button className="text-sm text-emerald-700 underline" disabled={busy || validateOffer(draft, 'draft').length > 0} onClick={() => beginEditing(completeDraftStructure(draft))}>恢复</button>
            <button className="text-sm text-red-600 underline" disabled={busy} onClick={() => removeDraft(draft.id)}>删除草稿</button>
          </div>
          {validateOffer(draft, 'draft').length > 0 && <p className="w-full text-xs text-red-600">草稿含无效字段：{issueText(validateOffer(draft, 'draft'))}。请删除后重新录入。</p>}
        </li>)}</ul>
      </section>}
      {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {refreshError && <button className={btnSecondary} disabled={busy} onClick={retryRefresh}>重试刷新列表</button>}
    </div>
  );
}
