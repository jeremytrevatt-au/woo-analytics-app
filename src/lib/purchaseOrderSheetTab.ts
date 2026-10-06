const SHEET_URLS = "__nyaPurchaseOrderSheetUrls";

export type CreatingSheetTab = {
  token: string;
  reveal: (url: string) => void;
  fail: (message: string) => void;
  close: () => void;
};

type SheetWindow = Window & {
  [SHEET_URLS]?: Record<string, string>;
};

export function creatingSheetTabMarkup(
  token: string,
  statusText = "Creating the purchase order Google Sheet…",
): string {
  const safeToken = JSON.stringify(token);
  const safeStatus = JSON.stringify(statusText);
  return `<!doctype html><html><head><title>Creating purchase order export</title></head><body><p id="status"></p><script>
document.getElementById("status").textContent = ${safeStatus};
const token = ${safeToken};
const timer = setInterval(() => {
  let url = "";
  try {
    const urls = window.opener && window.opener.${SHEET_URLS};
    url = urls && urls[token] ? urls[token] : "";
  } catch (error) {
    clearInterval(timer);
    return;
  }
  if (url) {
    clearInterval(timer);
    location.replace(url);
  }
}, 250);
</script></body></html>`;
}

export function sheetTabErrorMarkup(message: string): string {
  const safeMessage = JSON.stringify(message);
  return `<!doctype html><html><head><title>Purchase order sheet</title></head><body><p id="message"></p><script>document.getElementById("message").textContent = ${safeMessage};</script></body></html>`;
}

export function openCreatingSheetTab(
  statusText = "Creating the purchase order Google Sheet…",
  openWindow: typeof window.open = window.open.bind(window),
): CreatingSheetTab | null {
  const token = crypto.randomUUID();
  const tab = openWindow("", "_blank");
  if (!tab) {
    return null;
  }
  const host = window as SheetWindow;
  const urls = host[SHEET_URLS] || {};
  host[SHEET_URLS] = urls;
  tab.document.open();
  tab.document.write(creatingSheetTabMarkup(token, statusText));
  tab.document.close();
  return {
    token,
    reveal: (url: string) => {
      urls[token] = url;
    },
    fail: (message: string) => {
      delete urls[token];
      try {
        tab.document.open();
        tab.document.write(sheetTabErrorMarkup(message));
        tab.document.close();
      } catch {
        tab.close();
      }
    },
    close: () => {
      delete urls[token];
      tab.close();
    },
  };
}

export function openSavedSheet(url: string, openWindow: typeof window.open = window.open.bind(window)): boolean {
  return openWindow(url, "_blank", "noopener,noreferrer") !== null;
}
