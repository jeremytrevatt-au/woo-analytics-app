import { FormEvent, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  AllocationStatus,
  preordersApi,
  PreorderAllocation,
  PreorderReservation,
  ReservationStatus
} from "../api/preordersApi";
import LoadStateBlock from "../components/LoadStateBlock";
import { usePreorders } from "../hooks/usePreorders";

const allocationStatuses: AllocationStatus[] = ["active", "paused", "closed", "cancelled"];
const reservationStatuses: ReservationStatus[] = ["reserved", "consumed", "released", "cancelled"];

function qty(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";
}

function dateLabel(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function statusColor(status: string): ChipProps["color"] {
  if (status === "active" || status === "reserved") return "success";
  if (status === "paused") return "warning";
  if (status === "closed" || status === "consumed") return "info";
  if (status === "cancelled" || status === "released") return "default";
  return "default";
}

type ReservationDialogProps = {
  allocation: PreorderAllocation | null;
  onClose: (saved: boolean) => void;
};

function HoldQuantityDialog({ allocation, onClose }: ReservationDialogProps) {
  const [qtyValue, setQtyValue] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsedQty = Number(qtyValue);
  const canSubmit = Boolean(allocation) && Number.isFinite(parsedQty) && parsedQty > 0;

  useEffect(() => {
    if (allocation) {
      setQtyValue("0");
      setNotes("");
      setError(null);
    }
  }, [allocation]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!allocation) return;
    setSaving(true);
    setError(null);
    try {
      await preordersApi.createReservation({
        allocation_id: allocation.id,
        qty: Number(qtyValue),
        reservation_key: `manual-hold-${allocation.id}-${Date.now()}`,
        notes: notes.trim() || "Manual preorder hold"
      });
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hold preorder quantity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(allocation)} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Hold Preorder Quantity</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              Hold quantity reduces available preorder stock without linking it to a WooCommerce order.
              {allocation?.sku ? ` ${allocation.sku}` : " Selected allocation"} has {qty(allocation?.available_qty)} available.
            </Alert>
            <TextField label="Qty to Hold" value={qtyValue} onChange={(event) => setQtyValue(event.target.value)} required fullWidth />
            <TextField label="Reason / Notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={3} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || !canSubmit}>Hold Qty</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

type AllocationEditDialogProps = {
  allocation: PreorderAllocation | null;
  onClose: (saved: boolean) => void;
};

function AllocationEditDialog({ allocation, onClose }: AllocationEditDialogProps) {
  const [allocatedQty, setAllocatedQty] = useState(allocation ? String(allocation.allocated_qty) : "");
  const [status, setStatus] = useState<AllocationStatus>(allocation?.status ?? "active");
  const [etaDate, setEtaDate] = useState(allocation?.eta_date ?? "");
  const [notes, setNotes] = useState(allocation?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (allocation) {
      setAllocatedQty(String(allocation.allocated_qty));
      setStatus(allocation.status);
      setEtaDate(allocation.eta_date ?? "");
      setNotes(allocation.notes ?? "");
      setError(null);
    }
  }, [allocation]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!allocation) return;
    setSaving(true);
    setError(null);
    try {
      await preordersApi.updateAllocation(allocation.id, {
        allocated_qty: Number(allocatedQty),
        status,
        eta_date: etaDate || null,
        notes: notes.trim() || null
      });
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preorder allocation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(allocation)} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Edit Preorder Allocation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              Edit allocation quantity and status. Reserved quantities are maintained through reservation/hold records.
            </Alert>
            <TextField label="SKU" value={allocation?.sku ?? ""} disabled fullWidth />
            <TextField label="Allocated Qty" value={allocatedQty} onChange={(event) => setAllocatedQty(event.target.value)} required fullWidth />
            <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value as AllocationStatus)} fullWidth>
              {allocationStatuses.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
            <TextField type="date" label="ETA Date" value={etaDate} onChange={(event) => setEtaDate(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={3} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || !allocation}>Save</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

type ReservationEditDialogProps = {
  reservation: PreorderReservation | null;
  onClose: (saved: boolean) => void;
};

function ReservationEditDialog({ reservation, onClose }: ReservationEditDialogProps) {
  const [status, setStatus] = useState<ReservationStatus>(reservation?.status ?? "reserved");
  const [notes, setNotes] = useState(reservation?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reservation) {
      setStatus(reservation.status);
      setNotes(reservation.notes ?? "");
      setError(null);
    }
  }, [reservation]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reservation) return;
    setSaving(true);
    setError(null);
    try {
      await preordersApi.updateReservation(reservation.id, {
        status,
        notes: notes.trim() || null
      });
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preorder reservation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(reservation)} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Edit Reservation / Hold</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              Quantity is read-only. To change a held quantity, release or cancel this record and create a replacement hold.
            </Alert>
            <TextField label="SKU" value={reservation?.sku ?? ""} disabled fullWidth />
            <TextField label="Qty" value={reservation ? qty(reservation.qty) : ""} disabled fullWidth />
            <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value as ReservationStatus)} fullWidth>
              {reservationStatuses.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
            <TextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={3} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || !reservation}>Save</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function PreordersPage() {
  const { diagnostics, allocations, reservations, loading, error, refetch } = usePreorders();
  const [reservationAllocation, setReservationAllocation] = useState<PreorderAllocation | null>(null);
  const [editAllocation, setEditAllocation] = useState<PreorderAllocation | null>(null);
  const [editReservation, setEditReservation] = useState<PreorderReservation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const updateAllocationStatus = async (allocation: PreorderAllocation, status: AllocationStatus) => {
    setActionError(null);
    try {
      await preordersApi.updateAllocation(allocation.id, { status });
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update allocation status");
    }
  };

  const deleteAllocation = async (allocation: PreorderAllocation) => {
    if (!window.confirm(`Delete preorder allocation for ${allocation.sku || allocation.product_name}?`)) return;
    setActionError(null);
    try {
      await preordersApi.deleteAllocation(allocation.id);
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete allocation");
    }
  };

  const updateReservationStatus = async (reservation: PreorderReservation, status: ReservationStatus) => {
    setActionError(null);
    try {
      await preordersApi.updateReservation(reservation.id, { status });
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update reservation status");
    }
  };

  const handleDialogClose = (saved: boolean) => {
    setReservationAllocation(null);
    setEditAllocation(null);
    setEditReservation(null);
    if (saved) refetch();
  };

  if (loading) return <LoadStateBlock isLoading={true} error={null} empty={false} />;
  if (error) return <LoadStateBlock isLoading={false} error={error} empty={false} />;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
        <Box>
          <Typography variant="h5">Preorders</Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor preorder allocations and reservations. Create allocations from Purchase Orders.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} onClick={refetch}>Refresh</Button>
        </Stack>
      </Box>

      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Allocations by Status</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {(diagnostics?.allocations_by_status ?? []).map((item) => (
                <Chip key={item.status} label={`${item.status}: ${item.count}`} color={statusColor(item.status)} />
              ))}
              {(diagnostics?.allocations_by_status ?? []).length === 0 && <Typography variant="body2">No allocations yet.</Typography>}
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Reservations by Status</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {(diagnostics?.reservations_by_status ?? []).map((item) => (
                <Chip key={item.status} label={`${item.status}: ${item.count}`} color={statusColor(item.status)} />
              ))}
              {(diagnostics?.reservations_by_status ?? []).length === 0 && <Typography variant="body2">No reservations yet.</Typography>}
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">Diagnostics</Typography>
            <Typography variant="h5">{diagnostics?.over_allocated.length ?? 0}</Typography>
            <Typography variant="body2" color="text.secondary">Over-allocated records</Typography>
          </CardContent>
        </Card>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>PO Line</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Allocated</TableCell>
              <TableCell align="right">Reserved</TableCell>
              <TableCell align="right">Consumed</TableCell>
              <TableCell align="right">Available</TableCell>
              <TableCell>ETA</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allocations.map((allocation) => (
              <TableRow key={allocation.id}>
                <TableCell>{allocation.sku || "-"}</TableCell>
                <TableCell>{allocation.product_name}</TableCell>
                <TableCell>{allocation.po_line_id ?? "-"}</TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={allocation.status}
                    onChange={(event) => updateAllocationStatus(allocation, event.target.value as AllocationStatus)}
                    sx={{ minWidth: 130 }}
                  >
                    {allocationStatuses.map((item) => (
                      <MenuItem key={item} value={item}>{item}</MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell align="right">{qty(allocation.allocated_qty)}</TableCell>
                <TableCell align="right">{qty(allocation.reserved_qty)}</TableCell>
                <TableCell align="right">{qty(allocation.consumed_qty)}</TableCell>
                <TableCell align="right">
                  <Chip
                    size="small"
                    label={qty(allocation.available_qty)}
                    color={allocation.available_qty > 0 ? "success" : "default"}
                  />
                </TableCell>
                <TableCell>{dateLabel(allocation.eta_date)}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => setReservationAllocation(allocation)}
                    disabled={allocation.status !== "active" || allocation.available_qty <= 0}
                  >
                    Hold Qty
                  </Button>
                  <IconButton size="small" onClick={() => setEditAllocation(allocation)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => deleteAllocation(allocation)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {allocations.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">No preorder allocations found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Reservation</TableCell>
              <TableCell>Allocation</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Order</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Reserved At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reservations.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell>{reservation.reservation_key || reservation.id}</TableCell>
                <TableCell>{reservation.allocation_id}</TableCell>
                <TableCell>{reservation.sku || "-"}</TableCell>
                <TableCell>
                  {reservation.order_id ? `${reservation.order_id}${reservation.order_item_id ? ` / ${reservation.order_item_id}` : ""}` : "-"}
                </TableCell>
                <TableCell align="right">{qty(reservation.qty)}</TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={reservation.status}
                    onChange={(event) => updateReservationStatus(reservation, event.target.value as ReservationStatus)}
                    sx={{ minWidth: 130 }}
                  >
                    {reservationStatuses.map((item) => (
                      <MenuItem key={item} value={item}>{item}</MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>{reservation.notes || "-"}</TableCell>
                <TableCell>{dateLabel(reservation.reserved_at)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setEditReservation(reservation)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {reservations.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">No preorder reservations found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <HoldQuantityDialog allocation={reservationAllocation} onClose={handleDialogClose} />
      <AllocationEditDialog allocation={editAllocation} onClose={handleDialogClose} />
      <ReservationEditDialog reservation={editReservation} onClose={handleDialogClose} />
    </Stack>
  );
}

export default PreordersPage;
