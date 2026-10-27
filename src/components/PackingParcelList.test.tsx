import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import PackingParcelList from "./PackingParcelList";
import { createBlankParcel, type ParcelDraft } from "../lib/packingParcels";

function measuredParcel(): ParcelDraft {
  return {
    ...createBlankParcel(),
    weightGrams: "700",
    lengthCm: "25",
    widthCm: "15",
    heightCm: "10",
  };
}

function ParcelListHarness({ initial }: { initial: ParcelDraft[] }) {
  const [parcels, setParcels] = useState(initial);
  return <PackingParcelList parcels={parcels} onChange={setParcels} />;
}

describe("PackingParcelList", () => {
  afterEach(() => {
    cleanup();
  });

  it("adds and removes parcels without leaving the list empty", () => {
    const view = render(<ParcelListHarness initial={[measuredParcel()]} />);

    expect(view.getByText("Parcel 1")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Remove parcel" })).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "Add Parcel" }));
    expect(view.getByText("Parcel 2")).toBeInTheDocument();
    expect(view.getAllByRole("button", { name: "Remove parcel" })).toHaveLength(2);

    fireEvent.click(view.getAllByRole("button", { name: "Remove parcel" })[1]);
    expect(view.queryByText("Parcel 2")).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: "Remove parcel" })).toBeDisabled();
  });
});
