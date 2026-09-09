import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  createCrmNote,
  CrmCustomerIdentity,
  CrmCustomerProfile,
  CrmNote,
  deleteCrmNote,
  getCrmCustomerProfile,
  updateCrmCustomerProfileExtension,
  updateCrmNote,
} from "../api/crmApi";
import { formatCurrency } from "../lib/format";

type Props = CrmCustomerIdentity & {
  customerName?: string;
  orderId?: number;
  defaultTriggerEvent?: string;
  onChanged?: () => void;
};

const triggerOptions = [
  { value: "manual", label: "Manual reference" },
  { value: "packing_order", label: "Show when packing an order" },
  { value: "next_order_created", label: "Show on the next order" },
  { value: "follow_up", label: "Follow up" },
];

function CustomerCrmPanel({ customer_id, customer_key, customer_email, customer_phone, customerName, orderId, defaultTriggerEvent, onChanged }: Props) {
  const [profile, setProfile] = useState<CrmCustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [triggerEvent, setTriggerEvent] = useState(defaultTriggerEvent ?? "packing_order");
  const [reminderDate, setReminderDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [attachToOrder, setAttachToOrder] = useState(Boolean(orderId));
  const [tagsInput, setTagsInput] = useState("");
  const [flagsInput, setFlagsInput] = useState("");
  const [handlingNotes, setHandlingNotes] = useState("");
  const [lastReviewedDate, setLastReviewedDate] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [editTriggerEvent, setEditTriggerEvent] = useState("manual");
  const [editReminderDate, setEditReminderDate] = useState("");

  const identity = useMemo<CrmCustomerIdentity>(
    () => ({
      customer_id: customer_id && customer_id > 0 ? customer_id : undefined,
      customer_key,
      customer_email,
      customer_phone,
    }),
    [customer_id, customer_email, customer_key, customer_phone],
  );

  const hasIdentity = Boolean(identity.customer_id || identity.customer_key || identity.customer_email || identity.customer_phone);

  const loadProfile = async () => {
    if (!hasIdentity) return;
    setIsLoading(true);
    setError(null);
    try {
      const nextProfile = await getCrmCustomerProfile(identity);
      setProfile(nextProfile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasIdentity, identity.customer_id, identity.customer_key, identity.customer_email, identity.customer_phone]);

  useEffect(() => {
    const extension = profile?.profile_extension;
    if (!extension) return;
    setTagsInput((extension.tags ?? []).join(", "));
    setFlagsInput((extension.flags ?? []).join(", "));
    setHandlingNotes(extension.preferred_handling_notes ?? "");
    setLastReviewedDate(extension.last_reviewed_date ?? "");
    setNextFollowUpDate(extension.next_follow_up_date ?? "");
  }, [profile?.profile_extension]);

  useEffect(() => {
    setAttachToOrder(Boolean(orderId));
  }, [orderId]);

  const handleCreateNote = async () => {
    if (!noteContent.trim() || !hasIdentity) return;
    setIsSaving(true);
    setError(null);
    try {
      await createCrmNote({
        ...identity,
        order_id: attachToOrder ? orderId : undefined,
        trigger_event: triggerEvent,
        reminder_date: reminderDate || undefined,
        note_content: noteContent.trim(),
      });
      setNoteContent("");
      setReminderDate("");
      await loadProfile();
      onChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (note: CrmNote, status: CrmNote["status"]) => {
    setError(null);
    try {
      await updateCrmNote(note.id, { status });
      await loadProfile();
      onChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const handleStartEditNote = (note: CrmNote) => {
    setEditingNoteId(Number(note.id));
    setEditNoteContent(note.note_content ?? "");
    setEditTriggerEvent(note.trigger_event ?? "manual");
    setEditReminderDate(note.reminder_date ?? "");
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteContent("");
    setEditTriggerEvent("manual");
    setEditReminderDate("");
  };

  const handleSaveEditNote = async (note: CrmNote) => {
    if (!editNoteContent.trim()) return;
    setError(null);
    try {
      await updateCrmNote(note.id, {
        note_content: editNoteContent.trim(),
        trigger_event: editTriggerEvent,
        reminder_date: editReminderDate,
      });
      handleCancelEditNote();
      await loadProfile();
      onChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const handleDeleteNote = async (note: CrmNote) => {
    if (!window.confirm("Delete this CRM note?")) return;
    setError(null);
    try {
      await deleteCrmNote(note.id);
      await loadProfile();
      onChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const parseListInput = (value: string) =>
    value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter((item, index, items) => item && items.indexOf(item) === index);

  const handleSaveProfileExtension = async () => {
    if (!hasIdentity) return;
    setIsSavingProfile(true);
    setError(null);
    try {
      await updateCrmCustomerProfileExtension({
        ...identity,
        tags: parseListInput(tagsInput),
        flags: parseListInput(flagsInput),
        preferred_handling_notes: handlingNotes,
        last_reviewed_date: lastReviewedDate || undefined,
        next_follow_up_date: nextFollowUpDate || undefined,
      });
      await loadProfile();
      onChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!hasIdentity) {
    return (
      <Alert severity="info">
        This customer record does not currently include a stable customer identity for CRM notes.
      </Alert>
    );
  }

  const profileData = profile?.profile;
  const profileExtension = profile?.profile_extension;
  const displayName = profileData?.customer_name || customerName || "Customer";

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {isLoading && !profile ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading customer profile...
          </Typography>
        </Stack>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {displayName}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {profileData?.customer_key ? <Chip size="small" label={profileData.customer_key} /> : null}
            {profileData?.billing_email ? <Chip size="small" label={profileData.billing_email} /> : null}
            {profileData?.billing_phone ? <Chip size="small" label={profileData.billing_phone} /> : null}
            <Chip size="small" label={`${profileData?.order_count ?? 0} orders`} />
            <Chip size="small" label={`${formatCurrency(profileData?.lifetime_value ?? 0)} lifetime value`} />
          </Stack>
          {(profileExtension?.tags?.length || profileExtension?.flags?.length) ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {(profileExtension.tags ?? []).map((tag) => (
                <Chip key={`tag:${tag}`} size="small" color="info" variant="outlined" label={tag} />
              ))}
              {(profileExtension.flags ?? []).map((flag) => (
                <Chip key={`flag:${flag}`} size="small" color="warning" label={flag} />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" fontWeight={700}>
            Customer Profile Extension
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Tags"
              helperText="Comma separated, e.g. school, wholesale, VIP"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Important flags"
              helperText="Comma separated, e.g. needs follow-up, packing care"
              value={flagsInput}
              onChange={(event) => setFlagsInput(event.target.value)}
              fullWidth
            />
          </Stack>
          <TextField
            multiline
            minRows={2}
            label="Preferred handling notes"
            value={handlingNotes}
            onChange={(event) => setHandlingNotes(event.target.value)}
            fullWidth
          />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Last reviewed"
              type="date"
              value={lastReviewedDate}
              onChange={(event) => setLastReviewedDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              label="Next follow-up"
              type="date"
              value={nextFollowUpDate}
              onChange={(event) => setNextFollowUpDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <Box>
            <Button variant="outlined" onClick={handleSaveProfileExtension} disabled={isSavingProfile}>
              Save Profile
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" fontWeight={700}>
            Add CRM Note
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="Trigger"
              value={triggerEvent}
              onChange={(event) => {
                const nextTriggerEvent = event.target.value;
                setTriggerEvent(nextTriggerEvent);
                if (nextTriggerEvent === "next_order_created") {
                  setAttachToOrder(false);
                }
              }}
              sx={{ minWidth: 240 }}
            >
              {triggerOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Reminder date"
              type="date"
              value={reminderDate}
              onChange={(event) => setReminderDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          {orderId ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={attachToOrder}
                  onChange={(event) => setAttachToOrder(event.target.checked)}
                />
              }
              label={`Attach note to order #${orderId}`}
            />
          ) : null}
          <TextField
            multiline
            minRows={2}
            label="Note"
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            fullWidth
          />
          <Box>
            <Button variant="contained" onClick={handleCreateNote} disabled={isSaving || !noteContent.trim()}>
              Save Note
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" fontWeight={700}>
            Notes
          </Typography>
          {(profile?.notes ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No CRM notes have been recorded for this customer.
            </Typography>
          ) : (
            (profile?.notes ?? []).map((note) => (
              <Paper key={note.id} variant="outlined" sx={{ p: 1.5, bgcolor: note.status === "open" ? "warning.light" : "background.paper" }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip size="small" color={note.status === "open" ? "warning" : "default"} label={note.status} />
                    <Chip size="small" label={note.trigger_event.replace(/_/g, " ")} />
                    {note.reminder_date ? <Chip size="small" label={`Reminder ${new Date(note.reminder_date).toLocaleDateString("en-AU")}`} /> : null}
                    {note.order_id ? <Chip size="small" label={`Order ${note.order_id}`} /> : null}
                  </Stack>
                  {editingNoteId === Number(note.id) ? (
                    <Stack spacing={1}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                        <TextField
                          select
                          size="small"
                          label="Trigger"
                          value={editTriggerEvent}
                          onChange={(event) => setEditTriggerEvent(event.target.value)}
                          sx={{ minWidth: 240 }}
                        >
                          {triggerOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          size="small"
                          label="Reminder date"
                          type="date"
                          value={editReminderDate}
                          onChange={(event) => setEditReminderDate(event.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Stack>
                      <TextField
                        multiline
                        minRows={2}
                        label="Note"
                        value={editNoteContent}
                        onChange={(event) => setEditNoteContent(event.target.value)}
                        fullWidth
                      />
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" onClick={() => handleSaveEditNote(note)} disabled={!editNoteContent.trim()}>
                          Save
                        </Button>
                        <Button size="small" onClick={handleCancelEditNote}>
                          Cancel
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {note.note_content}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Created {new Date(note.created_at).toLocaleString("en-AU")} by {note.created_by_name || "NYA API"}
                  </Typography>
                  {editingNoteId !== Number(note.id) ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button size="small" onClick={() => handleStartEditNote(note)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => handleDeleteNote(note)}>
                        Delete
                      </Button>
                      {note.status === "open" ? (
                        <>
                      <Button size="small" onClick={() => handleUpdateStatus(note, "acknowledged")}>
                        Acknowledge
                      </Button>
                      <Button size="small" onClick={() => handleUpdateStatus(note, "completed")}>
                        Complete
                      </Button>
                        </>
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Recent Orders
        </Typography>
        <Divider sx={{ mb: 1 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Lines</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(profile?.orders ?? []).slice(0, 10).map((order) => (
              <TableRow key={order.order_id}>
                <TableCell>{order.order_id}</TableCell>
                <TableCell>{order.order_date ? new Date(order.order_date).toLocaleDateString("en-AU") : "-"}</TableCell>
                <TableCell>{order.order_status}</TableCell>
                <TableCell align="right">{formatCurrency(Number(order.order_total ?? 0))}</TableCell>
                <TableCell align="right">{order.lines?.length ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}

export default CustomerCrmPanel;
