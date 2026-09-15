import OpenInNew from "@mui/icons-material/OpenInNew";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import type { DocumentTemplate } from "../api/documentTemplatesApi";

type PrintMessage = {
  type: "success" | "error";
  text: string;
} | null;

type Props = {
  order: any | null;
  templates: DocumentTemplate[];
  printSaving: Record<string, boolean>;
  printMessage: PrintMessage;
  onClose: () => void;
  onPrint: (order: any, template: DocumentTemplate, event: React.MouseEvent) => void;
};

export default function PackingDocumentsDialog({
  order,
  templates,
  printSaving,
  printMessage,
  onClose,
  onPrint,
}: Props) {
  return (
    <Dialog open={!!order} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Print documents{order ? ` — Order #${order.order_id}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {printMessage && (
            <Alert severity={printMessage.type}>
              {printMessage.text}
            </Alert>
          )}
          {templates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No documents are available for this order.
            </Typography>
          ) : templates.map((template, index) => {
            const printKey = `${order?.order_id}:${template.id}`;
            return (
              <Stack key={template.id} spacing={1}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {template.name}
                    </Typography>
                    {template.notes && (
                      <Typography variant="caption" color="text.secondary">
                        {template.notes}
                      </Typography>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNew />}
                      href={template.google_drive_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<PrintOutlined />}
                      onClick={(event) => order && onPrint(order, template, event)}
                      disabled={!order || !!printSaving[printKey]}
                    >
                      Print
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
