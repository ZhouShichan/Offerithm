# 调研报告：三层测试基建与依赖选型

> 票据：[#2](https://github.com/ZhouShichan/Offerithm/issues/2)（wayfinder:research，隶属 #1 地图）
> 分支：`research/test-infra-stack`（仅留档，不合并、不开 PR）
> 检索日期：2026-10-19；所有版本号与安全事实均为当日快照，落地前需复核。

## 0. 结论总览（TL;DR）

| 决策点 | 推荐 | 关键理由 |
| --- | --- | --- |
| Vitest 分层 | **单配置不动，靠命名约定分层**：单元 `*.test.ts`、集成 `*.int.test.ts`，集成文件自引 fake-indexeddb；不引入 workspace/projects，不加 jsdom | fake-indexeddb 是纯 JS 内存实现，node 环境即可跑，无需切 environment；现有 `include: ['src/**/*.test.ts']` 已匹配 `*.int.test.ts`，`npm test` 脚本与 AGENTS.md「node-only」约定零改动 |
| fake-indexeddb | **6.2.6**（npm registry 当前 latest）；每个集成文件 `import { IDBFactory } from 'fake-indexeddb'` 并在 `beforeEach` 里 `globalThis.indexedDB = new IDBFactory()` | v5 起不再内置 structuredClone polyfill，依赖 Node 17+ 全局 `structuredClone`；CI 的 Node 20 满足。按用例新建工厂实现彻底隔离 |
| E2E | **@playwright/test 1.64.1**，`webServer` 用 `npm run build && npm run preview -- --port 4173 --strictPort`，`url`/`baseURL` 均含子路径 `http://localhost:4173/Offerithm/`；CI 单独 `e2e` job，不缓存浏览器二进制 | 测的就是生产 `base` 子路径下的真实部署形态；官方 CI 指南明确「缓存浏览器二进制不推荐」（恢复耗时≈下载、OS 依赖不可缓存）。**前置修复**：`<BrowserRouter>` 需加 `basename={import.meta.env.BASE_URL}` |
| XLSX 库 | **SheetJS 社区版 0.20.3，以固定版本 CDN tarball 安装**（`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`），并配合锁定完整性、ADR 留档与导入侧防御 | 本应用的致命场景是**解析不可信用户文件**（PRD-M07/TP-19）。exceljs npm 最新 4.4.0 存在**未修复的**高危原型污染 CVE-2026-78207（CVSS 9.4，解析路径可达），且上游近 3 年未发稳定版；SheetJS 0.20.3 已修复其全部已知 CVE，代价是分发渠道在官方 CDN 而非 npm registry |

---

## 1. 仓库现状事实（调研基线）

以下为本地读取仓库得到的客观事实（`dev` 分支 `1e3a26f`）：

- **依赖**（`package.json` + lockfile）：`vitest` 声明 `^2.1.2`、锁定 **2.1.9**；`vite ^5.4.8` 锁定 5.4.21；`typescript ^5.6.3`；无任何测试类新依赖（无 fake-indexeddb / playwright / xlsx 库）。
- **Vitest 配置内联在 `vite.config.ts`**：`test: { environment: 'node', include: ['src/**/*.test.ts'] }`；无独立 `vitest.config.ts`、无 `vitest.workspace.ts`。
- **脚本**：`npm test` = `vitest run`；`test:watch` = `vitest`。
- **CI**（`.github/workflows/ci.yml`）：ubuntu-latest、Node 20、`setup-node@v4` 带 `cache: npm`，四步门 `npm ci → typecheck → lint → test → build`；触发于 push（main/dev）与 PR。
- **构建子路径**：`vite.config.ts` 中 `base: process.env.VITE_BASE ?? (mode === 'production' ? '/Offerithm/' : '/')`。
- **路由**：`src/main.tsx` 的 `<BrowserRouter>` **未设置 `basename`**；`src/App.tsx` 的 `<Routes>` 定义 `/`、`/offers`、`/compare`、`/settings`。
- **存储层**：`src/storage/db.ts` 直接使用全局 `indexedDB`（`offerithm` 库，`offers`/`drafts` 两个 keyPath=id 的仓库，版本 1）；`src/storage/io.ts` 目前只有 JSON/CSV。
- **既有测试**：`src/core/engine/__tests__/engine.test.ts`（node 环境纯函数断言，断言带推导注释）。
- **文档基线**：ADR 0001 已决策「XLSX 多表工作簿 = 数据库」并点名 exceljs/sheetjs 为候选；`docs/test-plan.md` 定义四层（纯函数单元 / 仓储行为 / 数据交换契约 / 界面端到端）并明确「当前 Node 环境、无 DOM API、IndexedDB 测试需模拟环境」。

### 1.1 调研中发现的前置缺陷（实现票须先修）

**生产子路径下路由会脱离前缀**：`BrowserRouter` 无 `basename`，生产构建部署在 `/Offerithm/` 时，点击「我的 Offer」会导航到 `/offers`（不带前缀），在 GitHub Pages / `vite preview` 下 404。修复：

```tsx
// src/main.tsx
<BrowserRouter basename={import.meta.env.BASE_URL}>
```

`import.meta.env.BASE_URL` 在生产构建为 `'/Offerithm/'`、dev 为 `'/'`，与 `vite.config.ts` 的 `base` 逻辑天然对齐。**这正是 e2e 对着 `vite preview`（生产形态）跑的价值所在**——只对 dev server 跑测不出这类缺陷。

---

## 2. Vitest 分层方案

### 2.1 三种候选机制的事实

| 机制 | 在 vitest 2.1.9（本仓库版本）的表现 | 事实来源 |
| --- | --- | --- |
| **A. workspace 文件**（`vitest.workspace.ts`） | v2 支持：根目录放 `vitest.workspace.ts`，`vitest run` **自动**进入 workspace 模式跑全部项目，`npm test` 无需改脚本；inline 项目不继承根配置（需 `extends`），每项目可独立 `environment`/`setupFiles`。**注意**：官方现行文档（v5）标注 workspace 自 **3.2 起废弃**，由根配置 `test.projects` 取代——现在采用 workspace 意味着升级 Vitest 3+ 时必做一次迁移 | [v2 workspace 文档](https://v2.vitest.dev/guide/workspace)、[现行文档（v5，废弃说明）](https://vitest.dev/guide/workspace) |
| **B. 注释式 per-file environment** | 文件头 docblock/注释 `// @vitest-environment happy-dom` 可逐文件切换环境；v2 另有 `environmentMatchGlobs`（按 glob 匹配环境，v2 未标废弃，后续版本移除）。**但这套机制切换的是 environment（node/jsdom/…），而集成层根本不需要换环境**（见 2.2） | [v2 config 文档](https://v2.vitest.dev/config/) |
| **C. 独立配置 + 独立脚本**（`vitest.integration.config.ts` + `npm run test:integration`） | 可行但把一道门拆成两道，CI 与本地命令翻倍，且失去「一次 `vitest run` 全绿」的简单性 | 同上 |

### 2.2 关键事实：集成层不需要 jsdom

fake-indexeddb 是**纯 JS 的 IndexedDB 内存实现**，其主用途就是「在 Node.js 里测试依赖 IndexedDB 的代码」；它不依赖 DOM。因此：

- 集成测试可以继续跑在 `environment: 'node'`；
- 只需在测试文件里引入 fake-indexeddb 并把 `globalThis.indexedDB` 指向它；
- **AGENTS.md「测试跑在 node 环境、禁 DOM API」的约定继续成立**，`vite.config.ts` 的 test 块一行都不用改。

### 2.3 推荐方案（并给出升级路径）

**现在**：单配置 + 命名约定。

- 单元层：`src/**/*.test.ts`（现状不变）；
- 集成层：`src/**/*.int.test.ts`——现有 include glob `src/**/*.test.ts` **已经匹配** `*.int.test.ts`（`*` 匹配 segment 内任意字符，含 `db.int`），故 `npm test`、`npm run test:watch`、CI 四步门**零改动**即同时覆盖两层；
- 每个集成文件顶部自行引入 fake-indexeddb（显式优于隐式，读测试的人一眼看到 IndexedDB 是假的）。

**将来若需要**（例如引入 React 组件测试需要 happy-dom、或集成与单元要不同 timeout/覆盖率）：升级 Vitest 到 3+ 后在根配置用 `test.projects`（inline 数组即可，不必每项目一个文件）；**不要**在 2.1.9 上引入 `vitest.workspace.ts`，避免一步迁移债。若只有个别文件需要 DOM，优先用注释式 `// @vitest-environment happy-dom` 这类最小手段，而不是为少数文件上 projects。

**取舍说明**：projects/workspace 的真正收益是「不同项目不同环境/依赖/并发」，本仓库三层中的两层（单元、集成）同为 node 环境，唯一异质的是 e2e——而 e2e 属于 Playwright 而非 Vitest（见第 4 节），因此 Vitest 侧上 projects 目前只增加复杂度、没有收益。

---

## 3. fake-indexeddb

### 3.1 版本与兼容性事实

- **npm registry 当前 latest：6.2.6**（registry.npmjs.org `dist-tags`，2026-10-19 检索）。Apache-2.0，作者 Jeremy Scheff（dumbmatter），持续维护。
- **structuredClone**：官方 README 明确「**自 v5 起 fake-indexeddb 不再内置 structuredClone polyfill**」，需要环境自带（`structuredClone` 自 **Node 17+** 为全局）。本仓库 CI 为 **Node 20**，本地开发 Node ≥17 即可——**建议在实现票里向贡献者注明该下限**。旧环境（Node <17）需自行挂 polyfill（如 `@ungap/structured-clone`），或退回 4.x（不推荐）。
- **TypeScript 类型**：v4 起随包发布，直接复用 TS 内置的 IndexedDB 类型；本仓库 `tsconfig.app.json` 的 `lib` 已含 `"DOM"`，`src/storage/db.ts` 引用的全局类型在 node 环境测试中无需额外配置。
- **数据不持久**：纯内存实现，测试天然隔离于真实浏览器数据。

### 3.2 推荐接入方式（与 `src/storage/db.ts` 的接缝）

README 给出两条路：`import 'fake-indexeddb/auto'`（注入全局共享实例，最省事）或 `import { IDBFactory } from 'fake-indexeddb'` 后 `new IDBFactory()`（**每用例全新实例，彻底隔离**）。

推荐后者，因为 `db.ts` 每次操作都新开连接、schema 固定 version 1，配合每用例新工厂可保证用例间零残留：

```ts
import { IDBFactory } from 'fake-indexeddb';

beforeEach(() => {
  // 每个用例拿到全新的内存 IndexedDB（schema 回到未建库状态）
  globalThis.indexedDB = new IDBFactory();
});
```

注意点：

- `db.ts` 读取的是**全局** `indexedDB`，所以用 `globalThis.indexedDB =` 赋值即可生效，不需要改产品代码；
- 若用 `fake-indexeddb/auto`，实例在同一测试文件内共享，用例间要手动清库（`indexedDB.deleteDatabase('offerithm')`）或接受顺序耦合——不推荐；
- XLSX 往返（契约测试）同样在 node 环境可测：exceljs/sheetjs 的读写 API 均只依赖 Buffer/ArrayBuffer，不需要 DOM。

---

## 4. Playwright + GitHub Actions 接线

### 4.1 版本事实

- **@playwright/test npm latest：1.64.1**（2026-10-19 检索；官方 CI 文档示例容器镜像为 `mcr.microsoft.com/playwright:v1.64.0-noble`，与 1.64.x 同代）。

### 4.2 `webServer` 配置事实（官方文档）

- `command`：启动本地服务器的 shell 命令；`url`：轮询就绪的地址（接受 2xx/3xx/4xx-status）；`port` 已被 `url` 取代（deprecated）。
- `reuseExistingServer`：**官方推荐 `!process.env.CI`**——本地复用已在跑的服务器，CI 必新起。
- `timeout` 默认 60_000 ms（进程启动并可用），冷启动慢可调大。
- `stdout` 默认 `'ignore'`、`stderr` 默认 `'pipe'`；`env` 默认继承并附加 `PLAYWRIGHT_TEST=1`。
- `use.baseURL` 与 `page.goto('/')` 配合，`baseURL` 是导航解析的基底。

### 4.3 与 `vite preview` + `base: '/Offerithm/'` 的接线

生产构建的 `base` 是 `/Offerithm/`，`vite preview` 会把应用挂在 `http://<host>:<port>/Offerithm/` 下。因此 **`webServer.url` 与 `use.baseURL` 都必须带上子路径**：

```ts
// playwright.config.ts（仓库根目录）
import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/Offerithm/`; // 生产 base 子路径

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  globalTimeout: 10 * 60_000, // 挂死也能出报告
  workers: process.env.CI ? 1 : undefined, // 官方 CI 稳定性建议
  reporter: [['html', { open: 'never' }]],
  use: { baseURL: BASE, trace: 'on-first-retry' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: BASE, // 轮询带子路径的地址，就绪即真就绪
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // 包含 vite build，给足冷启动
    stdout: 'ignore',
  },
});
```

要点：

1. **`--strictPort`**：端口被占时直接失败而不是换端口，避免测到别的进程。
2. `command` 内含 `npm run build`，本地一条命令即可全流程；CI 里也可拆成显式 build 步骤（见 4.4），语义相同。
3. **路由前置修复**（1.1 节的 `basename`）是 e2e 对 preview 可跑的前提，否则任何站内导航断言都会 404。
4. 备选：对 dev server（`base: '/'`）跑可以绕开子路径问题，但会漏掉部署形态特有的缺陷（basename、资源绝对路径），**不推荐作为主通道**；如需「快速迭代冒烟」可作辅助 project。

### 4.4 CI 接线：独立 `e2e` job

推荐加一个与 `ci` job 并行的 `e2e` job（不塞进现有四步门，避免拖慢单测反馈；在分支保护里把它设为必需检查，即构成第五道**阻断**门）：

```yaml
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # 建议留量于 globalTimeout(10min)
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm # npm 包缓存照旧；浏览器二进制按官方口径不缓存
      - run: npm ci
      - run: npx playwright install --with-deps chromium # 只装 Chromium
      - run: npx playwright test # webServer 内部完成 build+preview
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }} # 失败也留 HTML 报告
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

**缓存口径（官方明确）**：Playwright CI 文档写道「**缓存浏览器二进制不被推荐**」——恢复缓存耗时与直接下载相当，且 Linux OS 依赖（`--with-deps` 装的系统库）不可缓存；若仍要缓存，需以 Playwright 版本哈希为 key。npm 侧的缓存继续由 `setup-node` 的 `cache: npm` 覆盖。**超时控制**：三层防线——用例 `timeout`（30s）、套件 `globalTimeout`（10min，保证挂死也有报告）、job `timeout-minutes`（15min，留量高于 globalTimeout）。`workers: process.env.CI ? 1 : undefined` 为官方对 CI 稳定性的建议，套件变大后可评估分片（官方 `--shard` + 报告合并）。

**typecheck/lint 覆盖**：`playwright.config.ts` 与 `tests/e2e/*.spec.ts` 应加入检查面——`tsconfig.node.json` 的 `include` 目前只有 `vite.config.ts`，实现票需把 `playwright.config.ts` 加进去（spec 文件若含 JSX 无关、纯 TS，可并入 `tsconfig.app.json` 或单独 project）；ESLint flat config 默认扫全仓，通常无需额外动作。

### 4.5 本地命令清单

```bash
npm i -D @playwright/test
npx playwright install chromium          # 一次性装浏览器
npx playwright test                      # 跑全部 e2e（自动 build+preview）
npx playwright test --headed             # 有头模式观察
npx playwright test --ui                 # UI 模式调试（官方推荐的迭代方式）
npx playwright show-report               # 查看 HTML 报告
npx playwright test --update-snapshots   # 快照类断言更新（如采用）
```

package.json 脚本建议：`"test:e2e": "playwright test"`、`"test:e2e:ui": "playwright test --ui"`。

---

## 5. XLSX 读写库选型：exceljs vs SheetJS 社区版

### 5.1 事实对比（2026-10-19 快照）

| 维度 | exceljs | SheetJS 社区版（CE） |
| --- | --- | --- |
| npm registry 最新版 | **4.4.0**（2023-10 发布，此后无稳定版；4.4.1 仅有 prerelease tag，社区催发版 issue #2974/#2975 长期未应答） | **0.18.5**（2022 年后停更；官方明言「registry is out of date」） |
| 实际维护渠道 | 上游近乎停滞；出现第三方续命分叉（exceljs-hardened 5.0.0、exceljs-community 5.2） | 官方 CDN（cdn.sheetjs.com）持续发版，**当前 0.20.3**；npm/GitHub 公开镜像不再更新 |
| 安装方式 | `npm i exceljs`（registry） | `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`（**固定版本 tarball URL**；官方禁用浮动 `xlsx-latest`） |
| 安全（关键） | **CVE-2026-78207**：原型污染，CVSS **9.4**，影响**至 4.4.0 全部版本**，`deepMerge` 合并 note 对象时不拒绝 `__proto__`/`constructor`/`prototype` 键——**解析恶意工作簿即触发**，上游未发修复（修复只在第三方分叉）；另有 `tmp`/`uuid` 传递依赖审计告警 | npm 上的 0.18.5 带 CVE-2023-30533（原型污染，0.19.3 修复）与 CVE-2024-22363（ReDoS，0.20.2 修复）；**0.20.3 已修复全部已知 CVE，暂无针对 0.20.3 的新披露**。注意：因修复版不在 npm，Snyk/OSV 等扫描器对 CDN 版本常误报（osv.dev #4313） |
| TypeScript 类型 | 随包自带（`types: ./index.d.ts`） | 随包自带 |
| 浏览器 bundle | `browser: ./dist/exceljs.min.js`（browserify 产物），可被 Vite 解析，但体积大、依赖树偏 Node 化（jszip/unzipper/archiver/tmp 等） | 以浏览器为一等公民设计，体积小、无 Node 依赖包袱，与 Vite 适配简单 |
| 多工作表读写 | `addWorksheet`/`getWorksheet`/`eachSheet`；`workbook.xlsx.load(buffer)` 读、`writeBuffer()` 写，流式支持 | `book_append_sheet`/`book_new` 写、`XLSX.read`/`sheet_to_json` 读，全格式覆盖广 |

### 5.2 推荐与理由

**推荐：SheetJS CE 0.20.3，以固定版本 CDN tarball 引入。**

一句话理由：**这个库在本应用的职责就是解析不可信的用户工作簿（PRD-M07、TP-19/TP-21 把「导入任意文件、错误定位、失败不写坏」列为核心验收），exceljs 4.4.0 恰好在该代码路径上有一个未修复的 CVSS 9.4 原型污染，而 SheetJS 0.20.3 已修复其全部已知漏洞——「登记在册且已修」优于「登记在册且无修」。**

次要理由：浏览器 bundle 更小更干净（本地优先应用对包体敏感）；多工作表读写能力两者都满足 ADR 0001 的「工作簿=数据库」双向映射需求。

**必须配套的缓解措施**（针对 CDN 分发的供应链与审计风险）：

1. **固定版本 URL**，绝不使用 `xlsx-latest` 之类浮动地址；lockfile 会记录 resolved URL 与 integrity，装完核对 `package-lock.json` 中 `xlsx` 的 `integrity` 字段存在。
2. **ADR 0001 增补**（或新 ADR）：记录分发渠道决策、来源链接、以及「若 exceljs 上游发布含 CVE-2026-78207 修复的稳定版，可重新评估切回 registry 依赖」的回退条件。
3. **PR 描述附官方来源链接**（cdn.sheetjs.com 版本页），符合 AGENTS.md「policy/依赖变更须有官方来源」的口径。
4. **导入侧纵深防御**：解析产物一律当作不可信数据——先做 schema 校验（TP-19）再进入领域对象；导入事务失败不落库（TP-21）。扫描器（npm audit/OSV）对 CDN 版 xlsx 的误报需在 CI 说明或豁免清单中留档。
5. 关注第三方分叉（exceljs-hardened / exceljs-community）动态，仅作观察项，**不建议**引入无治理背书的分叉作为主依赖。

**何时不选 SheetJS**：若团队把「依赖必须来自 npm registry」定为硬性红线，则该结论翻转——此时应在 exceljs 上游发布修复版之前**不引入任何 XLSX 解析依赖**，或接受分叉风险，二者都需要产品侧显式确认。

---

## 6. 每层一个最小可运行示例（文档代码块，不入 dev）

以下示例均已对照本仓库真实类型（`src/core/types.ts`、`src/storage/db.ts`、`src/pages/HomePage.tsx`）与政策表（`src/policies/tax.ts`）编写，可作为实现票的起点。

### 6.1 单元层（node 环境，现状零改动）

```ts
// src/core/engine/__tests__/tax.bracket.test.ts —— 单元层示例
import { describe, expect, it } from 'vitest';
import { comprehensiveTax } from '../tax';
import { taxPolicy2025 } from '../../../policies/tax';

describe('comprehensiveTax 边界档位（单元层示例）', () => {
  it('20% 档速算扣除：应纳税所得 300000 → 300000*0.2 - 16920 = 43080', () => {
    // 推导：300000 落在「超过 144000 至 300000」区间（上限含端点），
    // 税率 0.20、速算扣除数 16920（见 src/policies/tax.ts 税率表）
    expect(comprehensiveTax(300000, taxPolicy2025)).toBe(43080);
  });
});
```

运行：`npm test`（与现有 engine.test.ts 同层同命令）。

### 6.2 集成层（node 环境 + fake-indexeddb，`*.int.test.ts` 命名）

```ts
// src/storage/__tests__/db.int.test.ts —— 集成层示例
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { draftStore, offerStore } from '../db';
import type { Offer } from '../../core/types';

beforeEach(() => {
  // 每个用例拿到全新内存 IndexedDB（db.ts 读全局 indexedDB）
  globalThis.indexedDB = new IDBFactory();
});

function fixture(id: string): Offer {
  return {
    id,
    name: `示例 Offer ${id}`,
    companyName: '示例公司',
    regionPolicyId: 'bj-2025',
    salary: {
      baseMonthly: 20000,
      annualBonus: 60000,
      bonusTaxMethod: 'separate',
      components: [],
      tieredBonusRules: [],
    },
    scenarios: {
      pessimistic: { raiseRate: 0, bonusMultiplier: 0.5 },
      base: { raiseRate: 0.05, bonusMultiplier: 1 },
      optimistic: { raiseRate: 0.1, bonusMultiplier: 1.5 },
    },
    livingCost: { housing: 3000, food: 1500, transport: 300, utilities: 200, other: 500, annualExtra: 0 },
    work: { weeklyHours: 40, commuteMinutesOneWay: 40, travelDaysPerMonth: 0, annualLeaveDays: 10 },
    oneTimePayments: [],
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  };
}

describe('offerStore 仓储往返（集成层示例）', () => {
  it('put 后 get/list 能读回同一记录', async () => {
    const offer = fixture('o-1');
    await offerStore.put(offer);
    await expect(offerStore.get('o-1')).resolves.toEqual(offer);
    await expect(offerStore.list()).resolves.toHaveLength(1);
  });

  it('用例间零残留：上个用例的 o-1 不存在', async () => {
    await expect(offerStore.get('o-1')).resolves.toBeUndefined();
  });

  it('offers 与 drafts 两个对象仓库互不串数据', async () => {
    await offerStore.put(fixture('o-1'));
    await draftStore.put(fixture('d-1'));
    await expect(offerStore.list()).resolves.toHaveLength(1);
    await expect(draftStore.list()).resolves.toHaveLength(1);
  });
});
```

运行：`npm test`（include glob 已覆盖 `*.int.test.ts`，无需改配置/脚本）。

### 6.3 E2E 层（Playwright，对生产形态 preview）

```ts
// tests/e2e/home.spec.ts —— E2E 层示例
import { expect, test } from '@playwright/test';

test('首页渲染并可导航到录入页', async ({ page }) => {
  await page.goto('/'); // baseURL = http://localhost:4173/Offerithm/（含子路径）
  await expect(page.getByRole('heading', { level: 1, name: '算清薪酬，筹划前程' })).toBeVisible();

  await page.getByRole('link', { name: '开始录入 Offer' }).click();
  // 验证 basename 修复后子路径路由正确（URL 含 /Offerithm 前缀）
  await expect(page).toHaveURL(/\/Offerithm\/offers$/);
  await expect(page.getByRole('navigation').getByText('我的 Offer', { exact: true })).toHaveClass(/bg-emerald-600/);
});
```

运行：`npx playwright test`（自动 build + preview，见 4.3 配置）。

---

## 7. 实现票「搭建测试基建」验收标准草案

### 7.1 CI 阻断门槛

1. 现有 `ci` job 四步门（typecheck → lint → test → build）保持不变；`npm test` 须同时跑过单元与集成（`*.test.ts` + `*.int.test.ts`）。
2. 新增 `e2e` job（并行）：`npm ci` → `npx playwright install --with-deps chromium` → `npx playwright test` → 失败也上传 `playwright-report/` artifact；`timeout-minutes: 15`；分支保护中将 `e2e` 设为必需检查。
3. 不缓存 Playwright 浏览器二进制（官方口径）；npm 缓存沿用 `setup-node: cache: npm`。
4. `playwright.config.ts` 纳入 `npm run typecheck` 覆盖（加入 `tsconfig.node.json` 的 include）。

### 7.2 依赖与配置改动清单

- devDependencies：`fake-indexeddb@^6.2.6`、`@playwright/test@^1.64.1`；dependencies：`xlsx` 固定版本 CDN tarball（`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`）。
- `vite.config.ts` test 块**不改**；`src/main.tsx` 加 `basename={import.meta.env.BASE_URL}`（e2e 前置修复）。
- 新增 `playwright.config.ts`（根目录，含 webServer/baseURL 子路径/`reuseExistingServer: !CI`/CI workers=1/globalTimeout）。
- 文档同步：AGENTS.md（测试小节补充 `*.int.test.ts` 约定、e2e 命令、Node ≥17 下限缘由）、ADR 0001 增补（xlsx 分发渠道与回退条件）、CONTRIBUTING.md 如涉及。

### 7.3 本地命令清单（实现票完成后的开发者体验）

```bash
npm test                     # 单元 + 集成（vitest run，node 环境）
npm run test:watch           # 同上，watch 模式
npm run test:e2e             # e2e：自动 build + vite preview + playwright
npm run test:e2e:ui          # playwright UI 模式调试
npx playwright show-report   # 查看 e2e HTML 报告
npx playwright install chromium  # 首次使用 e2e 前的一次性准备
```

### 7.4 明确不做（本期）

- 不引入 jsdom/happy-dom、不上 Vitest projects/workspace（2.3 节理由）；
- 不做浏览器二进制缓存、不分片（套件变大后再评估）；
- 不引入组件测试层（test-plan.md 的「界面/端到端」由 Playwright 冒烟承担）。

---

## 8. 来源

检索日期均为 2026-10-19。

**Vitest**

- Vitest 2 Workspace（本仓库版本适用的机制）：https://v2.vitest.dev/guide/workspace
- Vitest 2 Config（environment / environmentMatchGlobs / per-file docblock / setupFiles）：https://v2.vitest.dev/config/
- Vitest 现行文档（v5.0.5；workspace 自 3.2 废弃、由 projects 取代）：https://vitest.dev/guide/workspace

**fake-indexeddb**

- 仓库与 README（用法、structuredClone、v5 变更、类型说明）：https://github.com/dumbmatter/fakeIndexedDB
- npm registry 元数据（latest 6.2.6）：https://registry.npmjs.org/fake-indexeddb
- CHANGELOG（历史破坏性变更与 Node 版本要求）：https://github.com/dumbmatter/fakeIndexedDB/blob/master/CHANGELOG.md

**Playwright**

- webServer 配置（command/url/timeout/reuseExistingServer/stdout/env）：https://playwright.dev/docs/test-webserver
- CI 指南（GitHub Actions 步骤、浏览器缓存官方口径、workers、globalTimeout、shard、报告 artifact）：https://playwright.dev/docs/ci
- npm registry 元数据（@playwright/test latest 1.64.1）：https://registry.npmjs.org/@playwright/test

**XLSX 选型**

- SheetJS 官方安装文档（npm registry 过时声明、CDN 为主要分发渠道）：https://docs.sheetjs.com/docs/getting-started/installation/ 与 https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- SheetJS CDN（当前版本 0.20.3）：https://cdn.sheetjs.com
- CVE-2024-22363 官方通告（0.20.2 修复）：https://cdn.sheetjs.com/advisories/CVE-2024-22363
- CVE-2023-30533（NVD，0.19.3 修复）：https://nvd.nist.gov/vuln/detail/CVE-2023-30533
- exceljs 仓库（接口、浏览器构建）：https://github.com/exceljs/exceljs
- exceljs package.json（version 4.4.0 / browser / types 字段）：https://raw.githubusercontent.com/exceljs/exceljs/master/package.json
- exceljs npm registry 元数据（latest 4.4.0）：https://registry.npmjs.org/exceljs
- CVE-2026-78207（exceljs ≤4.4.0 原型污染，CVSS 9.4）：https://nvd.nist.gov/vuln/detail/CVE-2026-78207 、https://www.strix.ai/cve/CVE-2026-78207 、https://app.snyk.io/vuln/SNYK-JS-EXCELJS-19234023
- exceljs 催发版 issue：https://github.com/exceljs/exceljs/issues/2975 （及 #2974）
- OSV 对 CDN 版 xlsx 的误报讨论：https://github.com/google/osv.dev/issues/4313
- 第三方分叉（仅观察）：https://github.com/mateocallec/exceljs-hardened 、https://www.npmjs.com/package/exceljs-community

**仓库内部事实**

- `package.json`、`package-lock.json`（vitest 2.1.9 / vite 5.4.21）、`vite.config.ts`、`.github/workflows/ci.yml`、`tsconfig*.json`、`src/main.tsx`、`src/App.tsx`、`src/storage/db.ts`、`src/storage/io.ts`、`src/core/types.ts`、`src/policies/tax.ts`、`docs/adr/0001-excel-multisheet-data-interchange.md`、`docs/test-plan.md`
