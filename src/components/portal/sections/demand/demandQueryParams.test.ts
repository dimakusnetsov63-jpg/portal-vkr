import { describe, expect, it } from "vitest";
import { parseDemandParams, serializeDemandParams, type DemandUrlState } from "./demandQueryParams";

const FULL_STATE: DemandUrlState = {
  section: "demand",
  project: "Самокат",
  city: "Москва",
  q: "казань",
  filled: true,
  from: "2026-07-20",
  to: "2026-08-30",
  rowStatus: "paused",
};

describe("serializeDemandParams", () => {
  it("writes every provided field", () => {
    const params = serializeDemandParams(FULL_STATE);
    expect(params.get("section")).toBe("demand");
    expect(params.get("project")).toBe("Самокат");
    expect(params.get("city")).toBe("Москва");
    expect(params.get("q")).toBe("казань");
    expect(params.get("filled")).toBe("1");
    expect(params.get("from")).toBe("2026-07-20");
    expect(params.get("to")).toBe("2026-08-30");
    expect(params.get("rowStatus")).toBe("paused");
  });

  it("omits falsy/empty fields instead of writing them empty", () => {
    const params = serializeDemandParams({ section: "demand", project: "", filled: false, rowStatus: "" });
    expect(params.get("project")).toBeNull();
    expect(params.get("filled")).toBeNull();
    expect(params.get("rowStatus")).toBeNull();
    expect(params.get("section")).toBe("demand");
  });

  it('does not write a "rowStatus" param for "all statuses" (empty string)', () => {
    const params = serializeDemandParams({ ...FULL_STATE, rowStatus: "" });
    expect(params.has("rowStatus")).toBe(false);
  });

  it("produces params that round-trip through parseDemandParams", () => {
    const params = serializeDemandParams(FULL_STATE);
    expect(parseDemandParams(params)).toEqual(FULL_STATE);
  });
});

describe("parseDemandParams", () => {
  it("omits fields that are absent from the URL (does not default them)", () => {
    const params = new URLSearchParams("project=Купер");
    const parsed = parseDemandParams(params);
    expect(parsed).toEqual({ project: "Купер" });
    expect(parsed.filled).toBeUndefined();
    expect(parsed.from).toBeUndefined();
  });

  it("parses filled=1 and filled=true as true", () => {
    expect(parseDemandParams(new URLSearchParams("filled=1")).filled).toBe(true);
    expect(parseDemandParams(new URLSearchParams("filled=true")).filled).toBe(true);
  });

  it("parses any other filled value as false, when the key is present", () => {
    expect(parseDemandParams(new URLSearchParams("filled=0")).filled).toBe(false);
  });

  it("ignores unknown query keys", () => {
    const parsed = parseDemandParams(new URLSearchParams("foo=bar&project=Купер"));
    expect(parsed).toEqual({ project: "Купер" });
  });

  it("returns an empty object for an empty query string", () => {
    expect(parseDemandParams(new URLSearchParams(""))).toEqual({});
  });

  it("reads a valid rowStatus", () => {
    expect(parseDemandParams(new URLSearchParams("rowStatus=paused")).rowStatus).toBe("paused");
  });

  it("ignores an unknown rowStatus value", () => {
    const parsed = parseDemandParams(new URLSearchParams("rowStatus=archived"));
    expect(parsed.rowStatus).toBeUndefined();
  });
});
