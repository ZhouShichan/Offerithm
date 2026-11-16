import { useEffect, useRef, useState } from 'react';
import type { Offer } from '../core/types';
import { offerStore, prepareImport, commitImport, type ImportPreview } from '../storage/db';
import { regionPolicies } from '../policies/regions';
import { taxPolicy2025 } from '../policies/tax';
import { MAX_IMPORT_BYTES, fromJson, toJson, download } from '../storage/io';

const buttonClass = 'rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50';
const secondaryClass = 'rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-600';

export default function SettingsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewConflict, setPreviewConflict] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const refresh = async () => setOffers(await offerStore.list());
  useEffect(() => { void refresh().catch((error: unknown) => setMessage(`读取本地数据失败：${String(error)}`)); }, []);

  const runLocked = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await action(); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const exportJson = () => {
    void runLocked(async () => {
      try {
        const committedOffers = await offerStore.list();
        const snapshot = { app: 'offerithm' as const, version: 1 as const, exportedAt: new Date().toISOString(), offers: committedOffers };
        download(`offerithm-${new Date().toISOString().slice(0, 10)}.json`, toJson(snapshot), 'application/json');
        setMessage(`已导出 ${committedOffers.length} 个已保存 Offer。JSON 不包含草稿、比较权重或情景选择。`);
      } catch (error) { setMessage(`导出失败：${String(error)}`); }
    });
  };

  const readImport = async (file: File) => {
    if (busyRef.current) return;
    setPreview(null);
    setPreviewConflict(false);
    setMessage(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage('导入失败：文件大小超过 5 MiB 限制。');
      return;
    }
    await runLocked(async () => {
      try {
        const snapshot = fromJson(await file.text());
        const nextPreview = await prepareImport(snapshot.offers);
        setPreview(nextPreview);
        setMessage(null);
      } catch (error) {
        setMessage(`导入失败：${error instanceof Error ? error.message : String(error)}。未写入任何数据；可修正文件后重试。`);
      }
    });
  };

  const confirmImport = () => {
    if (!preview) return;
    void runLocked(async () => {
      const currentPreview = preview;
      try {
        await commitImport(currentPreview);
      } catch (error) {
        const detail = String(error);
        setPreviewConflict(detail.includes('重新预览'));
        setMessage(`导入提交失败，本次导入未写入；${detail}`);
        return;
      }
      setPreview(null);
      setPreviewConflict(false);
      setMessage(`已导入 ${currentPreview.added.length} 个，覆盖 ${currentPreview.overwritten.length} 个`);
      try { await refresh(); }
      catch (error) { setRefreshFailed(true); setMessage(`数据已提交，但列表刷新失败：${String(error)}。可以重试刷新列表。`); }
    });
  };

  const refreshAfterImport = () => {
    void runLocked(async () => {
      try { await refresh(); setRefreshFailed(false); setMessage('列表已刷新。'); }
      catch (error) { setMessage(`列表刷新失败：${String(error)}`); }
    });
  };

  const refreshPreview = () => {
    if (!preview || busyRef.current) return;
    void runLocked(async () => {
      try {
        const updated = await prepareImport(preview.offers);
        setPreview(updated);
        setPreviewConflict(false);
        setMessage('预览已更新，请检查新增和覆盖数量后再次确认。');
      } catch (error) { setMessage(`重新预览失败：${String(error)}。当前预览仍保留。`); }
    });
  };

  const displayName = (offer: Offer | undefined) => typeof offer?.name === 'string' && offer.name ? offer.name : '(未命名)';
  const baselineFor = (id: string) => preview?.baseline[preview.offers.findIndex((offer) => offer.id === id)];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">设置与数据</h1>

      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h2 className="mb-2 font-semibold">导入 / 导出</h2>
        <p className="mb-3 text-xs text-slate-500">当前已保存 {offers.length} 个 Offer。</p>
        <p className="mb-3 text-sm text-slate-500">JSON 备份包含已保存 Offer；草稿、比较权重和情景选择不包含在文件中。</p>
        <div className="flex flex-wrap gap-3">
          <button className={buttonClass} disabled={busy} onClick={exportJson}>导出 JSON</button>
          <label className={`${secondaryClass} cursor-pointer`}>
            导入 JSON
            <input type="file" accept="application/json,.json" className="sr-only" disabled={busy}
              onChange={(event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                input.value = '';
                if (file) void readImport(file);
              }} />
          </label>
        </div>
        {message && <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-300">{message}</p>}
        {preview && <div role="dialog" aria-label="导入预览" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:bg-emerald-950">
          <h3 className="font-semibold">导入预览</h3>
          <p className="mt-1 text-sm">新增 {preview.added.length} 个 · 覆盖 {preview.overwritten.length} 个。确认后将一次性写入。</p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
            {preview.offers.map((offer) => {
              const previous = baselineFor(offer.id);
              return <li key={offer.id} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <span className="font-medium">{preview.overwritten.includes(offer.id) ? '覆盖' : '新增'} · {offer.id}</span>
                {previous && <p>原记录：{displayName(previous)}</p>}
                <p>导入后：{displayName(offer)}</p>
              </li>;
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={buttonClass} disabled={busy} onClick={confirmImport}>确认导入</button>
            {previewConflict && <button className={secondaryClass} disabled={busy} onClick={refreshPreview}>重新预览</button>}
            <button className={secondaryClass} disabled={busy} onClick={() => { setPreview(null); setMessage('已取消导入预览。'); }}>取消</button>
          </div>
        </div>}
        {refreshFailed && !preview && <button className={`${secondaryClass} mt-3`} disabled={busy} onClick={refreshAfterImport}>重试刷新列表</button>}
      </section>

      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h2 className="mb-2 font-semibold">政策参数</h2>
        <p className="text-sm text-slate-500">
          个税政策年度：{taxPolicy2025.year}；基本减除费用 {taxPolicy2025.basicDeductionMonthly} 元/月。
          来源：{taxPolicy2025.source}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {regionPolicies.map((p) => <li key={p.id}>{p.region}（{p.year}）：社保基数 {p.baseFloor}–{p.baseCeiling} 元/月，公积金基数 {p.hfBaseFloor}–{p.hfBaseCeiling} 元/月。
            <span className="block text-xs text-slate-400">{p.source}</span></li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-400">内置政策为示例配置；正式使用前请以当地人社部门当年公布口径为准，或自行在政策文件中修改。</p>
      </section>
    </div>
  );
}
