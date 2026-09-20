import { afterEach, describe, expect, it, vi } from "vitest";

describe("wordpressStorefrontUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("builds only privacy-safe relative storefront links", async () => {
    vi.stubEnv(
      "VITE_WORDPRESS_BASE_URL",
      "https://staging.naturalyield.com.au",
    );
    const { wordpressStorefrontUrl } = await import("./wordpress");

    expect(wordpressStorefrontUrl("/shop/product?private=value#details")).toBe(
      "https://staging.naturalyield.com.au/shop/product",
    );
    expect(wordpressStorefrontUrl("https://example.com")).toBeNull();
    expect(wordpressStorefrontUrl("//example.com/path")).toBeNull();
  });
});
