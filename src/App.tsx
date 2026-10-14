import { Link, NavLink, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import OffersPage from './pages/OffersPage';
import ComparePage from './pages/ComparePage';
import SettingsPage from './pages/SettingsPage';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-emerald-600 text-white'
      : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
  }`;

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-600">Offerithm</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">薪筹 · 算清薪酬，筹划前程</span>
          </Link>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navCls}>首页</NavLink>
            <NavLink to="/offers" className={navCls}>我的 Offer</NavLink>
            <NavLink to="/compare" className={navCls}>比较</NavLink>
            <NavLink to="/settings" className={navCls}>设置</NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
        Offerithm 是开源项目，所有数据仅保存在你的浏览器本地（IndexedDB），不联网上传。
        计算结果仅供参考，请以实际发放为准。
      </footer>
    </div>
  );
}
