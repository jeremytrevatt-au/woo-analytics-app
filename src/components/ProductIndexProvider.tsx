import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { productsApi } from "../api/productsApi";
import type { ProductSearchResult } from "../api/productsApi";

type ProductIndexContextValue = {
  products: readonly ProductSearchResult[];
  loading: boolean;
  error: string | null;
};

const ProductIndexContext = createContext<ProductIndexContextValue | null>(null);

export function ProductIndexProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    productsApi.getIndex()
      .then((productIndex) => {
        if (!active) return;
        setProducts(productIndex);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load the product index.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ products, loading, error }),
    [error, loading, products],
  );

  return <ProductIndexContext.Provider value={value}>{children}</ProductIndexContext.Provider>;
}

export function useProductIndex(): ProductIndexContextValue {
  const context = useContext(ProductIndexContext);
  if (!context) {
    throw new Error("useProductIndex must be used within ProductIndexProvider.");
  }
  return context;
}
