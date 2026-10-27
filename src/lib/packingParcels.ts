import type { PackingQuoteParcel, PackingShippitOrderParcel } from "../api/shippitPackingApi";

export type ParcelDraft = {
  id: string;
  qty: string;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

export function createBlankParcel(): ParcelDraft {
  return {
    id: crypto.randomUUID(),
    qty: "1",
    weightGrams: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
  };
}

export function numericString(value: unknown): string {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? String(numberValue) : "";
}

export function positiveNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

export function buildParcelsFromShippitOrder(parcels: PackingShippitOrderParcel[]): ParcelDraft[] {
  return parcels.map(parcel => ({
    id: crypto.randomUUID(),
    qty: numericString(parcel.qty) || "1",
    weightGrams: numericString(parcel.weight_g),
    lengthCm: numericString(parcel.length_cm),
    widthCm: numericString(parcel.width_cm),
    heightCm: numericString(parcel.height_cm),
  }));
}

export function buildParcelsFromRecommendations(parcels: PackingQuoteParcel[]): ParcelDraft[] {
  return parcels
    .filter(parcel => positiveNumber(parcel.weight_kg) > 0
      && positiveNumber(parcel.length_cm) > 0
      && positiveNumber(parcel.width_cm) > 0
      && positiveNumber(parcel.height_cm) > 0)
    .map(parcel => ({
      id: crypto.randomUUID(),
      qty: numericString(Math.max(1, Math.floor(Number(parcel.qty || 1)))) || "1",
      weightGrams: numericString(Number(parcel.weight_kg) * 1000),
      lengthCm: numericString(parcel.length_cm),
      widthCm: numericString(parcel.width_cm),
      heightCm: numericString(parcel.height_cm),
    }));
}

export function parseParcels(parcels: ParcelDraft[]): PackingQuoteParcel[] {
  return parcels.map(parcel => ({
    qty: Number(parcel.qty),
    weight_kg: Number(parcel.weightGrams) / 1000,
    length_cm: Number(parcel.lengthCm),
    width_cm: Number(parcel.widthCm),
    height_cm: Number(parcel.heightCm),
  }));
}

export function hasInvalidParcel(parcels: PackingQuoteParcel[]): boolean {
  return parcels.some(parcel =>
    !Number.isInteger(parcel.qty)
    || parcel.qty < 1
    || parcel.weight_kg <= 0
    || parcel.length_cm <= 0
    || parcel.width_cm <= 0
    || parcel.height_cm <= 0
  );
}

export function parcelsAreValid(parcels: ParcelDraft[]): boolean {
  if (parcels.length === 0) return false;
  return !hasInvalidParcel(parseParcels(parcels));
}
