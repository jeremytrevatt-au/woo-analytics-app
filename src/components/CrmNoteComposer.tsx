import { useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";

import { createCrmNote } from "../api/crmApi";

type Props = {
  orderId: number;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  triggerEvent: "return" | "reshipment";
};

export default function CrmNoteComposer({
  orderId,
  customerEmail,
  customerPhone,
  customerName,
  triggerEvent,
}: Props) {
  const [note, setNote] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await createCrmNote({
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        order_id: orderId,
        trigger_event: triggerEvent,
        reminder_date: reminderDate || undefined,
        note_content: note.trim(),
      });
      setNote("");
      setReminderDate("");
      setMessage({ type: "success", text: "CRM Note added." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to add CRM Note." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">
        CRM Note{customerName ? ` — ${customerName}` : ""}
      </Typography>
      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}
      <TextField
        label="CRM Note"
        value={note}
        onChange={event => setNote(event.target.value)}
        multiline
        minRows={3}
        helperText={`Linked to source order #${orderId}.`}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          label="Reminder date (optional)"
          type="date"
          value={reminderDate}
          onChange={event => setReminderDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="outlined" onClick={saveNote} disabled={saving || !note.trim()}>
          {saving ? "Saving..." : "Add CRM Note"}
        </Button>
      </Stack>
    </Stack>
  );
}
