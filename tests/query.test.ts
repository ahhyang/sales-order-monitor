import { describe, expect, it } from "vitest";
import { buildUpstreamQuery, isValidSalesId } from "../lib/query";

const build = (qs: string) => Object.fromEntries(buildUpstreamQuery(new URLSearchParams(qs)));

describe("buildUpstreamQuery", () => {
  it("applies defaults when nothing is passed", () => {
    expect(build("")).toEqual({ page: "1", pageSize: "25" });
  });

  it("clamps page and pageSize to the API's limits", () => {
    expect(build("page=0&pageSize=500")).toMatchObject({ page: "1", pageSize: "100" });
    expect(build("page=abc&pageSize=-3")).toMatchObject({ page: "1", pageSize: "1" });
  });

  it("passes through trimmed filters and drops empty ones", () => {
    expect(build("status=Open%20order&site=B20&q=%20%20Siti%20%20Mart%20")).toEqual({
      page: "1",
      pageSize: "25",
      status: "Open order",
      site: "B20",
      q: "Siti Mart",
    });
    expect(build("status=&site=%20&q=")).toEqual({ page: "1", pageSize: "25" });
  });

  it("caps search text length", () => {
    expect(build(`q=${"x".repeat(500)}`).q).toHaveLength(100);
  });

  it("only forwards allow-listed sort fields", () => {
    expect(build("sort=HAR_TotalSOAmount&order=desc")).toMatchObject({
      sort: "HAR_TotalSOAmount",
      order: "desc",
    });
    expect(build("sort=HAR_TotalSOAmount&order=sideways").order).toBe("asc");
    expect(build("sort=DROP_TABLE&order=desc")).not.toHaveProperty("sort");
  });

  it("ignores unknown params", () => {
    expect(build("evil=1&page=2")).toEqual({ page: "2", pageSize: "25" });
  });
});

describe("isValidSalesId", () => {
  it("accepts normal ids and rejects path tricks", () => {
    expect(isValidSalesId("SO-MOCK-00001")).toBe(true);
    expect(isValidSalesId("../meta")).toBe(false);
    expect(isValidSalesId("SO 1")).toBe(false);
    expect(isValidSalesId("")).toBe(false);
  });
});
