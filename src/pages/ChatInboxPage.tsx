import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  chatAttachmentUrl,
  chatMessageEventsUrl,
  listChatConversations,
  listChatMessages,
  markChatConversationRead,
  sendChatReply,
  uploadChatAttachment,
  updateChatConversation,
} from "../api/chatApi";
import {
  ChatConversation,
  ChatConversationStatus,
  ChatMessage,
} from "../types/chat";
import CustomerCrmPanel from "../components/CustomerCrmPanel";
import { chatCustomerLabel } from "../lib/chatIdentity";

const statuses: ChatConversationStatus[] = ["open", "assigned", "waiting", "closed"];

function ChatInboxPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ChatConversationStatus>("open");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>(
    searchParams.get("conversation") ?? "",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = conversations.find((conversation) => conversation.id === selectedId);

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    setError(null);
    try {
      const response = await listChatConversations(status);
      setConversations(response.conversations);
      setSelectedId((current) => {
        if (response.conversations.some((conversation) => conversation.id === current)) {
          return current;
        }
        return response.conversations[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoadingInbox(false);
    }
  }, [status]);

  const loadMessages = useCallback(async () => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await listChatMessages(selectedId);
      setMessages(response.messages);
      await markChatConversationRead(selectedId);
      setConversations((current) => current.map((conversation) => (
        conversation.id === selectedId
          ? { ...conversation, unread_count: 0 }
          : conversation
      )));
      window.dispatchEvent(new Event("ny-chat-unread-changed"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadInbox(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const source = new EventSource(chatMessageEventsUrl(selectedId), {
      withCredentials: true,
    });
    source.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChatMessage;
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) {
          return current;
        }
        return [...current, message].sort(
          (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at),
        );
      });
      if (message.sender_type === "customer") {
        void markChatConversationRead(selectedId).then(() => {
          setConversations((current) => current.map((conversation) => (
            conversation.id === selectedId
              ? { ...conversation, unread_count: 0, updated_at: message.created_at }
              : conversation
          )));
          window.dispatchEvent(new Event("ny-chat-unread-changed"));
        });
      }
    });
    return () => source.close();
  }, [selectedId]);

  const handleReply = async () => {
    const body = reply.trim();
    if (!selectedId || (!body && !attachment)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const uploaded = attachment
        ? await uploadChatAttachment(selectedId, attachment)
        : null;
      await sendChatReply(selectedId, body, uploaded ? [uploaded.id] : []);
      setReply("");
      setAttachment(null);
      await Promise.all([loadMessages(), loadInbox()]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleWorkflow = async (nextStatus: ChatConversationStatus) => {
    if (!selectedId) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateChatConversation(selectedId, nextStatus);
      await loadInbox();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>NY Chat Inbox</Typography>
          <Typography color="text.secondary">
            Customer website conversations linked to verified WooCommerce identities.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => void loadInbox()} disabled={loadingInbox}>
          Refresh
        </Button>
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={status}
        onChange={(_, value: ChatConversationStatus | null) => value && setStatus(value)}
      >
        {statuses.map((item) => (
          <ToggleButton key={item} value={item}>{item}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ minHeight: 480 }}>
          <Typography variant="subtitle2" sx={{ px: 2, py: 1.5 }}>
            {status.toUpperCase()} ({conversations.length})
          </Typography>
          <Divider />
          {loadingInbox ? (
            <Stack alignItems="center" py={5}><CircularProgress size={28} /></Stack>
          ) : conversations.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>No conversations in this queue.</Typography>
          ) : (
            <List disablePadding>
              {conversations.map((conversation) => (
                <ListItemButton
                  key={conversation.id}
                  selected={conversation.id === selectedId}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <ListItemText
                    primary={chatCustomerLabel(conversation)}
                    secondary={`${conversation.channel} · ${new Date(conversation.updated_at ?? conversation.created_at).toLocaleString()}`}
                  />
                  {(conversation.unread_count ?? 0) > 0 ? (
                    <Chip label="New" size="small" color="error" sx={{ mr: 1 }} />
                  ) : null}
                  <Chip label={conversation.status} size="small" />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ minHeight: 480, display: "flex", flexDirection: "column" }}>
          {!selected ? (
            <Typography color="text.secondary" sx={{ p: 3 }}>Select a conversation.</Typography>
          ) : (
            <>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1} sx={{ p: 2 }}>
                <Box>
                  <Typography fontWeight={700}>{chatCustomerLabel(selected)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Woo customer: {selected.woo_customer_id ?? "Not linked"} · Assigned: {selected.assigned_operator_email ?? "Unassigned"}
                  </Typography>
                  {selected.customer_identity_type === "guest" ? (
                    <Typography variant="body2" color="text.secondary">
                      Guest email: {selected.guest_email ?? "Not provided"} · Claimed order: {selected.guest_order_number ?? "Not provided"} · {selected.guest_identity_status === "new_sales" ? "New sales enquiry" : "Unverified"}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    Current page: {selected.customer_page_title || selected.customer_page_path || "Not reported"}
                    {selected.customer_last_seen_at
                      ? ` · seen ${new Date(selected.customer_last_seen_at).toLocaleString()}`
                      : ""}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Button size="small" onClick={() => void handleWorkflow("assigned")} disabled={saving}>Assign to me</Button>
                  <Button size="small" onClick={() => void handleWorkflow("waiting")} disabled={saving}>Waiting</Button>
                  <Button size="small" color="success" onClick={() => void handleWorkflow("closed")} disabled={saving}>Close</Button>
                  <Button size="small" onClick={() => void handleWorkflow("open")} disabled={saving}>Reopen</Button>
                </Stack>
              </Stack>
              <Divider />
              <Stack spacing={1.5} sx={{ p: 2, flex: 1, minHeight: 260, maxHeight: 520, overflowY: "auto" }}>
                {loadingMessages ? <CircularProgress size={28} /> : messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      alignSelf: message.sender_type === "operator" ? "flex-end" : "flex-start",
                      bgcolor: message.sender_type === "operator" ? "primary.light" : "grey.100",
                      borderRadius: 2,
                      px: 1.5,
                      py: 1,
                      maxWidth: "78%",
                    }}
                  >
                    {message.body ? (
                      <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</Typography>
                    ) : null}
                    {(message.attachments ?? []).map((item) => (
                      <Box
                        key={item.id}
                        component="img"
                        src={chatAttachmentUrl(message.conversation_id, item.id)}
                        alt="Chat attachment"
                        sx={{ display: "block", maxWidth: "100%", maxHeight: 320, mt: message.body ? 1 : 0, borderRadius: 1 }}
                      />
                    ))}
                    <Typography variant="caption" color="text.secondary">
                      {message.sender_type} · {new Date(message.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ p: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  disabled={saving}
                />
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<AttachFileIcon />}
                  disabled={saving}
                >
                  {attachment ? attachment.name : "Image"}
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                  />
                </Button>
                <Button variant="contained" onClick={() => void handleReply()} disabled={saving || (!reply.trim() && !attachment)}>
                  Send
                </Button>
              </Stack>
            </>
          )}
        </Paper>
      </Box>

      {selected?.woo_customer_id ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>
              Linked CRM customer #{selected.woo_customer_id}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <CustomerCrmPanel
              customer_id={selected.woo_customer_id}
              customer_email={selected.guest_email ?? undefined}
              customerName={chatCustomerLabel(selected)}
              defaultTriggerEvent="manual"
            />
          </AccordionDetails>
        </Accordion>
      ) : null}
    </Stack>
  );
}

export default ChatInboxPage;
