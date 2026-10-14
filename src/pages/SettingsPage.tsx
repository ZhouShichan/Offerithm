import { useEffect, useState } from 'react';
import type { Offer } from '../core/types';
import { offerStore } from '../storage/db';
import { regionPolicies } from '../policies/regions';
import { taxPolicy2025 } from '../policies/tax';
import { toJson, fromJson, download } from '../storage/io';

export default function SettingsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void offerStore.list().then(setOffers);
  }, []);

  const exportJson = () => {
    const snapshot = { app: 'offerithm' as const, version: 1 as const, exportedAt: new Date().toISOString(), offers };
    download(`offerithm-${new Date().toISOString().slice(0, 10)}.json`, toJson(snapshot), 'application/json');
  };

  const importJson = async (file: File) => {
    try {
      const snapshot = fromJson(await file.text());
      for (const o of snapshot.offers) await offerStore.put(o);
      setOffers(await offerStore.list());
      setMessage(`已导入 ${snapshot.offers.length} 个 Offer。`);
    } catch (e) {
      setMessage(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">设置与数据</h1>

      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h2 className="mb-2 font-semibold">导入 / 导出</h2>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={exportJson}>
            导出 JSON
          </button>
          <label className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">
            导入 JSON
            <input type="file" accept="application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); }} />
          </label>
        </div>
        {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h2 className="mb-2 font-semibold">政策参数</h2>
        <p className="text-sm text-slate-500">
          个税政策年度：{taxPolicy2025.year}；基本减除费用 {taxPolicy2025.basicDeductionMonthly} 元/月。
          来源：{taxPolicy2025.source}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {regionPolicies.map((p) => (
            <li key={p.id}>
              {p.region}（{p.year}）：社保基数 {p.baseFloor}–{p.baseCeiling} 元/月，公积金基数 {p.hfBaseFloor}–{p.hfBaseCeiling} 元/月。
              <span className="block text-xs text-slate-400">{p.source}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          内置政策为示例配置；正式使用前请以当地人社部门当年公布口径为准，或自行在政策文件中修改。
        </p>
      </section>
    </div>
  );
}
