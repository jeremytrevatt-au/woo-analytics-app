import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPackingOrders } from "../api/analyticsApi";
import type { PackingOrdersResponse } from "../api/analyticsApi";
import LoadStateBlock from "../components/LoadStateBlock";
import { usePackingOrders } from "./usePackingOrders";

vi.mock("../api/analyticsApi", () => ({
  getPackingOrders: vi.fn(),
}));

const PACKING_POLL_MS = 5000;

const packingOrdersResponse: PackingOrdersResponse = {
  records: [{ order_id: 501, order_number: "501" }],
  columns: [],
  page: 1,
  pageSize: 100,
  totalCount: 1,
  currentUser: "packer",
  syncState: null,
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function PackingOrdersProbe() {
  const { rows, isLoading, error } = usePackingOrders(1, 100);
  return (
    <>
      <LoadStateBlock
        isLoading={isLoading}
        error={rows.length === 0 ? error : null}
        empty={!isLoading && !error && rows.length === 0}
      />
      {!isLoading && rows.map(row => (
        <div key={String(row.order_id)}>Order {String(row.order_id)}</div>
      ))}
    </>
  );
}

describe("usePackingOrders", () => {
  let packingPoll: (() => void) | null = null;
  const pending: Deferred<PackingOrdersResponse>[] = [];

  beforeEach(() => {
    packingPoll = null;
    pending.length = 0;
    const realSetInterval = window.setInterval.bind(window);
    const realClearInterval = window.clearInterval.bind(window);
    vi.spyOn(window, "setInterval").mockImplementation((handler, timeout) => {
      if (timeout === PACKING_POLL_MS && typeof handler === "function") {
        packingPoll = () => {
          handler();
        };
        return 4242;
      }
      return realSetInterval(handler, timeout);
    });
    vi.spyOn(window, "clearInterval").mockImplementation((intervalId) => {
      if (intervalId === 4242) {
        return;
      }
      realClearInterval(intervalId);
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    vi.mocked(getPackingOrders).mockReset();
    vi.mocked(getPackingOrders).mockImplementation(() => {
      const next = deferred<PackingOrdersResponse>();
      pending.push(next);
      return next.promise;
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
    vi.restoreAllMocks();
    cleanup();
  });

  function runPackingPoll() {
    expect(packingPoll).toEqual(expect.any(Function));
    act(() => {
      packingPoll?.();
    });
  }

  it("renders orders when the list response arrives after the poll interval", async () => {
    render(<PackingOrdersProbe />);

    expect(screen.getByText("Loading analytics data...")).toBeInTheDocument();
    await waitFor(() => expect(getPackingOrders).toHaveBeenCalledTimes(1));

    runPackingPoll();
    expect(getPackingOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading analytics data...")).toBeInTheDocument();

    await act(async () => {
      pending[0].resolve(packingOrdersResponse);
    });

    expect(screen.queryByText("Loading analytics data...")).not.toBeInTheDocument();
    expect(screen.getByText("Order 501")).toBeInTheDocument();
    expect(getPackingOrders).toHaveBeenCalledTimes(1);

    runPackingPoll();
    expect(getPackingOrders).toHaveBeenCalledTimes(2);
  });

  it("surfaces a failed list request and lets the next poll retry", async () => {
    render(<PackingOrdersProbe />);
    await waitFor(() => expect(getPackingOrders).toHaveBeenCalledTimes(1));

    runPackingPoll();
    expect(getPackingOrders).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0].reject(new Error("Packing orders request failed."));
    });

    expect(screen.queryByText("Loading analytics data...")).not.toBeInTheDocument();
    expect(screen.getByText("Packing orders request failed.")).toBeInTheDocument();

    runPackingPoll();
    expect(getPackingOrders).toHaveBeenCalledTimes(2);
  });
});
