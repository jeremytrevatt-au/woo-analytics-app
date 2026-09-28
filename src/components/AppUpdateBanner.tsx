import { Alert, Button } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

const CURRENT_BUILD_REF = import.meta.env.VITE_BUILD_GIT_REF || "unknown";
const VERSION_CHECK_INTERVAL_MS = 60_000;

export default function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkVersion = useCallback(async () => {
    if (CURRENT_BUILD_REF === "unknown") return;
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const version = await response.json() as { git_ref?: string };
      if (version.git_ref && version.git_ref !== CURRENT_BUILD_REF) {
        setUpdateAvailable(true);
      }
    } catch {
      // A transient version check must not interrupt packing work.
    }
  }, []);

  useEffect(() => {
    void checkVersion();
    const intervalId = window.setInterval(() => void checkVersion(), VERSION_CHECK_INTERVAL_MS);
    const handleFocus = () => void checkVersion();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkVersion]);

  if (!updateAvailable) return null;
  return (
    <Alert
      severity="info"
      action={
        <Button color="inherit" size="small" onClick={() => window.location.reload()}>
          Reload
        </Button>
      }
      sx={{ borderRadius: 0 }}
    >
      A newer Analytics version is available.
    </Alert>
  );
}
