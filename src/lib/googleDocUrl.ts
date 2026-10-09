const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{25,}$/;

export function normalizeGoogleDocUrl(input: string): string {
  const trimmed = input.trim();
  const fromPath = trimmed.match(/\/document\/d\/([A-Za-z0-9_-]+)/);
  const fromQuery = trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
  const bare = DOCUMENT_ID_PATTERN.test(trimmed) ? trimmed : "";
  const documentId = fromPath?.[1] || fromQuery?.[1] || bare;
  if (!documentId) {
    throw new Error("Enter a Google Doc URL or Doc ID.");
  }
  const tab = trimmed.match(/[?&]tab=([^&#]+)/);
  const url = `https://docs.google.com/document/d/${documentId}/edit`;
  return tab ? `${url}?tab=${decodeURIComponent(tab[1])}` : url;
}
