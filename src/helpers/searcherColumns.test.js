import { describe, expect, it } from "vitest";

import { trailingActionColumns, mergeContributedColumns, mergeContributedExport } from "./searcherColumns";

const base = () => ({
  headers: ["code", "name", "emptyLabel", "emptyLabel"],
  formatters: ["fCode", "fName", "fEdit", "fDelete"],
  headerActions: [["sortCode"], ["sortName"], [null], [null]],
  aligns: false,
});
const sortAction = (s) => ["sorted", s];

describe("searcherColumns", () => {
  it("counts the trailing action columns only", () => {
    expect(trailingActionColumns(["a", "emptyLabel", "b", "emptyLabel", "emptyLabel"])).toBe(2);
    expect(trailingActionColumns(["a", "b"])).toBe(0);
    expect(trailingActionColumns([])).toBe(0);
  });

  it("returns the columns unchanged without contributions", () => {
    const columns = base();
    expect(mergeContributedColumns(columns, [], sortAction)).toEqual(columns);
  });

  it("places contributed columns before the trailing action columns", () => {
    const merged = mergeContributedColumns(base(), [{ header: "photo", formatter: "fPhoto" }], sortAction);
    expect(merged.headers).toEqual(["code", "name", "photo", "emptyLabel", "emptyLabel"]);
    expect(merged.formatters).toEqual(["fCode", "fName", "fPhoto", "fEdit", "fDelete"]);
    expect(merged.headerActions[2][0]).toBe(null);
    expect(merged.headerActions[2][1]()).toBe(null);
    expect(merged.aligns).toBe(false);
  });

  it("builds the header action of a contributed sort with sortAction", () => {
    const merged = mergeContributedColumns(base(), [{ header: "h", formatter: "f", sort: ["photo", true] }], sortAction);
    expect(merged.headerActions[2]).toEqual(["sorted", ["photo", true]]);
  });

  it("keeps alignments in step with the inserted columns", () => {
    const columns = { ...base(), aligns: [undefined, "right"] };
    const merged = mergeContributedColumns(columns, [{ header: "h", formatter: "f", align: "center" }], sortAction);
    expect(merged.aligns).toEqual([undefined, "right", "center", undefined, undefined]);
  });

  it("builds the aligns array from a contributed alignment when the searcher has none", () => {
    const merged = mergeContributedColumns(base(), [{ header: "h", formatter: "f", align: "center" }], sortAction);
    expect(merged.aligns).toEqual([undefined, undefined, "center", undefined, undefined]);
  });

  it("gives one header action per contributed column when the searcher has none", () => {
    const columns = { ...base(), headerActions: [] };
    const merged = mergeContributedColumns(columns, [{ header: "h", formatter: "f" }], sortAction);
    expect(merged.headerActions).toHaveLength(1);
  });

  it("appends contributed export fields with their labels", () => {
    const merged = mergeContributedExport(["id", "code"], { code: "Code" }, [
      { header: "h", formatter: "f" },
      { header: "p", formatter: "f", exportField: "photo_url", exportLabel: "Photo" },
    ]);
    expect(merged.exportFields).toEqual(["id", "code", "photo_url"]);
    expect(merged.exportFieldsColumns).toEqual({ code: "Code", photo_url: "Photo" });
  });

  it("leaves the export props untouched when no contribution is exported", () => {
    const columns = { code: "Code" };
    const merged = mergeContributedExport(undefined, columns, [{ header: "h", formatter: "f" }]);
    expect(merged.exportFields).toBe(undefined);
    expect(merged.exportFieldsColumns).toBe(columns);
  });
});
