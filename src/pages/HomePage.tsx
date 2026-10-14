import { Link } from 'react-router-dom';

const features = [
  ['复杂薪资结构', '基本工资、绩效、阶梯奖金、年终奖、补贴与叠加规则'],
  ['七险二金 + 企业年金', '缴费比例、基数上下限与地区政策可配置'],
  ['税后与用人成本', '税后到手现金、公积金、医保个账、企业总成本'],
  ['生活成本与储蓄', '住房、餐饮、交通等支出推算年度净储蓄'],
  ['工作强度与预测', '工时、通勤、出差分析与 3 年 / 10 年收入预测'],
  ['多 Offer 决策', '自定义权重、三档情景、不确定性分析与仪表盘'],
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white">
        <h1 className="text-3xl font-bold">算清薪酬，筹划前程</h1>
        <p className="mt-2 max-w-xl text-emerald-50">
          面向中国大陆应届生与求职者的综合薪酬分析与多 Offer 决策工具。
          无需登录、无需后端，数据全部保存在你的浏览器本地。
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            to="/offers"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            开始录入 Offer
          </Link>
          <Link
            to="/compare"
            className="rounded-lg border border-white/60 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            多 Offer 比较
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([title, desc]) => (
          <div
            key={title}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <strong>诚实原则：</strong>
        本工具不将未知数据伪装为确定值。所有估计值均标注置信度与假设来源；
        政策参数（缴费比例、基数、税率）独立管理，使用前请核对官方当年口径。
      </section>
    </div>
  );
}
