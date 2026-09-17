const configuredWordPressBaseUrl = String(
  import.meta.env.VITE_WORDPRESS_BASE_URL || "",
).trim().replace(/\/+$/, "");

export function wordpressAdminUrl(path: string): string | null {
  if (!configuredWordPressBaseUrl) return null;
  return `${configuredWordPressBaseUrl}/wp-admin/${path.replace(/^\/+/, "")}`;
}
