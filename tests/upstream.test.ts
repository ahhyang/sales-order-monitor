import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorResponse, fetchUpstream, UpstreamError } from "../lib/upstream";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SALES_API_KEY", "test-key");
  vi.stubEnv("SALES_API_BASE_URL", "https://upstream.test/orders");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function failure(promise: Promise<unknown>) {
  const err = await promise.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(UpstreamError);
  return err as UpstreamError;
}

describe("fetchUpstream", () => {
  it("sends the key server-side and builds the URL", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await expect(fetchUpstream("", new URLSearchParams({ page: "2" }))).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://upstream.test/orders?page=2");
    expect(init.headers["x-assessment-key"]).toBe("test-key");
  });

  it("refuses to call upstream without a configured key", async () => {
    vi.stubEnv("SALES_API_KEY", "");
    expect((await failure(fetchUpstream("/meta"))).status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [404, 404, "Order not found."],
    [401, 502, "rejected our credentials"],
    [500, 502, "returned 500"],
  ])("maps upstream %i to %i", async (upstream, expected, message) => {
    fetchMock.mockResolvedValue(json(upstream, { error: "x" }));
    const err = await failure(fetchUpstream("/SO-1"));
    expect(err.status).toBe(expected);
    expect(err.message).toContain(message);
  });

  it("maps network failures to 502 and timeouts to 504", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await failure(fetchUpstream(""))).status).toBe(502);

    fetchMock.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    expect((await failure(fetchUpstream(""))).status).toBe(504);
  });

  it("treats a non-JSON body as a bad gateway", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    expect((await failure(fetchUpstream(""))).status).toBe(502);
  });
});

describe("errorResponse", () => {
  it("returns the UpstreamError message and status, uncached", async () => {
    const res = errorResponse(new UpstreamError("Order not found.", 404), "test");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Order not found." });
  });

  it("hides details of unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("db password is hunter2"), "test");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Unexpected server error." });
  });
});
