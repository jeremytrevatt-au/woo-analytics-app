import MailOutlineIcon from "@mui/icons-material/MailOutline";
import {
  Badge,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getChatUnreadSummary } from "../api/chatApi";
import { ChatUnreadSummary } from "../types/chat";
import { chatCustomerLabel } from "../lib/chatIdentity";

const EMPTY_SUMMARY: ChatUnreadSummary = {
  unread_conversation_count: 0,
  conversations: [],
};

function ChatNotificationBell() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSummary(await getChatUnreadSummary());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const handleRefresh = () => void refresh();
    window.addEventListener("ny-chat-unread-changed", handleRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ny-chat-unread-changed", handleRefresh);
    };
  }, [refresh]);

  return (
    <>
      <Tooltip title={error ? "Chat notifications unavailable" : "NY Chat notifications"}>
        <IconButton
          color="inherit"
          aria-label={`${summary.unread_conversation_count} unread chat conversations`}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <Badge badgeContent={summary.unread_conversation_count} color="error">
            <MailOutlineIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1.5 }}>
          Unread customer chats
        </Typography>
        {summary.conversations.length ? (
          <List dense sx={{ width: 320, maxHeight: 360, overflowY: "auto" }}>
            {summary.conversations.map((conversation) => (
              <ListItemButton
                key={conversation.id}
                onClick={() => {
                  setAnchor(null);
                  navigate(`/chat?conversation=${encodeURIComponent(conversation.id)}`);
                }}
              >
                <ListItemText
                  primary={chatCustomerLabel(conversation)}
                  secondary={conversation.customer_page_title || conversation.customer_page_path || "Website chat"}
                />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>
            No unread chats.
          </Typography>
        )}
      </Popover>
    </>
  );
}

export default ChatNotificationBell;
