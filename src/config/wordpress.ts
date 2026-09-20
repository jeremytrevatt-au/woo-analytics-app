const configuredWordPressBaseUrl = String(
  import.meta.env.VITE_WORDPRESS_BASE_URL || "",
).trim().replace(/\/+$/, "");

export function wordpressAdminUrl(path: string): string | null {
  if (!configuredWordPressBaseUrl) return null;
  return `${configuredWordPressBaseUrl}/wp-admin/${path.replace(/^\/+/, "")}`;
}

export function wordpressStorefrontUrl(path: string): string | null {
  if (!configuredWordPressBaseUrl || !path.startsWith("/") || path.startsWith("//")) {
    return null;
  }
  const safePath = path.split("?", 1)[0].split("#", 1)[0];
  return `${configuredWordPressBaseUrl}${safePath}`;
}
