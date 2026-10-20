import { describe, expect, it } from "vitest";
import { calculateOffer } from "../index";

// 契约 v2 引导期的占位冒烟：各引擎模块（IMP-04~07）落地后由金标准测试取代。
describe("引擎占位（契约 v2 引导期）", () => {
  it("calculateOffer 在 IMP-07 落地前抛出 TODO", () => {
    expect(() => calculateOffer({} as never, {} as never)).toThrow(
      "TODO(IMP-07)"
    );
  });
});
