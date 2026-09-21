import { Chip, ChipProps } from "@mui/material";
import { SiteHealthStatus } from "../../api/siteHealthApi";

const labels: Record<SiteHealthStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  unavailable: "Unavailable",
  not_applicable: "Not applicable",
};

const colors: Record<SiteHealthStatus, ChipProps["color"]> = {
  healthy: "success",
  warning: "warning",
  critical: "error",
  unavailable: "default",
  not_applicable: "default",
};

interface Props {
  status: SiteHealthStatus;
  size?: ChipProps["size"];
}

export default function HealthStatusChip({ status, size = "small" }: Props) {
  return (
    <Chip
      color={colors[status]}
      label={labels[status]}
      size={size}
      variant={status === "unavailable" || status === "not_applicable" ? "outlined" : "filled"}
    />
  );
}
