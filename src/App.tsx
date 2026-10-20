import { Link, NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OffersPage from "./pages/OffersPage";
import ComparePage from "./pages/ComparePage";
import SettingsPage from "./pages/SettingsPage";

/** 导航 pill：cafe 风格，active 用 accent 底色，focus-visible 用焦点环 token。 */
const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 focus-visible:shadow-focus-ring focus-visible:outline-none ${
    isActive
      ? "border-accent bg-accent text-accent-on"
      : "border-border bg-surface text-fg-2 hover:bg-surface-warm"
  }`;

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-6 md:px-6">
          <Link
            to="/"
            className="rounded-md font-display text-2xl tracking-tight text-fg focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            薪筹 Offerithm
          </Link>
          <nav className="flex flex-wrap gap-2" aria-label="主导航">
            <NavLink to="/" end className={navCls}>
              快速估算
            </NavLink>
            <NavLink to="/offers" className={navCls}>
              Offers
            </NavLink>
            <NavLink to="/compare" className={navCls}>
              比较
            </NavLink>
            <NavLink to="/settings" className={navCls}>
              设置
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-4 pb-14 md:px-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <footer className="border-t border-border-soft py-4 text-center text-sm text-muted">
        Offerithm 是开源项目，所有数据仅保存在你的浏览器本地（IndexedDB），不联网上传。
        计算结果仅供参考，请以实际发放为准。
      </footer>
    </div>
  );
}
