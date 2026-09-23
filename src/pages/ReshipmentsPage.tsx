import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Link,
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
import type { ProductSearchResult } from "../api/productsApi";
import {
  cancelReshipment,
  createReshipment,
  getReshipmentSource,
  getReshipmentOperation,
  listRecentReshipments,
  modifyReshipment,
  previewReshipmentCancellation,
  previewReshipmentParcels,
  quoteReshipment,
  type InventoryEffect,
  type ReshipmentDestination,
  type ReshipmentCancellationPreview,
  type ReshipmentLineRequest,
  type ReshipmentOperation,
  type ReshipmentParcel,
  type ReshipmentReason,
  type RecentReshipment,
  type ReshipmentSource,
} from "../api/reshipmentsApi";
import type { PackingQuoteResponse, PackingQuoteSelection } from "../api/shippitPackingApi";
import CrmNoteComposer from "../components/CrmNoteComposer";
import { useProductIndex } from "../components/ProductIndexProvider";
import { wordpressAdminUrl } from "../config/wordpress";
import { searchProductIndex } from "../lib/purchaseOrderProductSearch";

type SelectedLine = ReshipmentLineRequest & {
  key: string;
  sku: string;
  name: string;
  maxQuantity: number | null;
};

type QuoteOption = PackingQuoteSelection & {
  id: string;
  label: string;
};

type QuoteFailure = {
  courier: string;
  service: string;
  error: string;
};

const reasonLabels: Record<ReshipmentReason, string> = {
  damaged_transit: "Damaged in transit",
  missing_from_package: "Missing from package",
  other: "Additional / other",
};

function quoteOptions(response: PackingQuoteResponse | null): QuoteOption[] {
  const body = response?.body as { response?: unknown; quotes?: unknown } | unknown[] | undefined;
  const carriers = Array.isArray(body)
    ? body
    : body && Array.isArray((body as { response?: unknown }).response)
      ? (body as { response: unknown[] }).response
      : body && Array.isArray((body as { quotes?: unknown }).quotes)
        ? (body as { quotes: unknown[] }).quotes
        : [];
  const options: QuoteOption[] = [];
  carriers.forEach((carrier, carrierIndex) => {
    if (!carrier || typeof carrier !== "object") return;
    const carrierData = carrier as Record<string, unknown>;
    const rows = Array.isArray(carrierData.quotes) ? carrierData.quotes : [carrierData];
    rows.forEach((row, rowIndex) => {
      if (!row || typeof row !== "object") return;
      const quote = row as Record<string, unknown>;
      const courierType = String(carrierData.courier_type || quote.courier_type || "");
      const serviceLevel = String(carrierData.service_level || quote.service_level || "");
      const price = Number(quote.price);
      if ((!courierType && !serviceLevel) || !Number.isFinite(price) || price < 0) return;
      options.push({
        id: `${carrierIndex}-${rowIndex}-${courierType}-${serviceLevel}-${price}`,
        label: String(carrierData.courier_name || quote.courier_name || courierType || serviceLevel),
        courier_type: courierType || null,
        service_level: serviceLevel || null,
        price,
        estimated_transit_time: typeof quote.estimated_transit_time === "string" ? quote.estimated_transit_time : null,
      });
    });
  });
  return options.sort((left, right) => Number(left.price) - Number(right.price));
}

function quoteFailures(response: PackingQuoteResponse | null): QuoteFailure[] {
  const body = response?.body as { response?: unknown } | undefined;
  const carriers = body && Array.isArray(body.response) ? body.response : [];
  const failures: QuoteFailure[] = [];
  carriers.forEach(carrier => {
    if (!carrier || typeof carrier !== "object") return;
    const data = carrier as Record<string, unknown>;
    const courier = String(data.courier_type || "Unknown courier");
    const service = String(data.service_level || "");
    if (data.success === false && typeof data.error === "string" && data.error) {
      failures.push({ courier, service, error: data.error });
    }
    if (Array.isArray(data.failures)) {
      data.failures.forEach(nested => {
        if (!nested || typeof nested !== "object") return;
        const failure = nested as Record<string, unknown>;
        failures.push({
          courier: String(failure.courier_type || courier),
          service: String(failure.service_level || service),
          error: String(failure.error || data.error || "Quote unavailable."),
        });
      });
    }
  });
  return failures;
}

function inventoryEffect(reason: ReshipmentReason): InventoryEffect {
  return reason === "missing_from_package" ? "already_accounted" : "decrement";
}

function productLabel(product: ProductSearchResult): string {
  return `${product.sku ? `[${product.sku}] ` : ""}${product.name}`;
}

const emptyParcel: ReshipmentParcel = {
  qty: 1,
  weight_kg: 0,
  length_cm: 0,
  width_cm: 0,
  height_cm: 0,
};

export default function ReshipmentsPage() {
  const { products, loading: productsLoading, error: productsError } = useProductIndex();
  const [orderId, setOrderId] = useState("");
  const [source, setSource] = useState<ReshipmentSource | null>(null);
  const [destination, setDestination] = useState<ReshipmentDestination | null>(null);
  const [lines, setLines] = useState<SelectedLine[]>([]);
  const [parcels, setParcels] = useState<ReshipmentParcel[]>([]);
  const [recommendedParcels, setRecommendedParcels] = useState<ReshipmentParcel[]>([]);
  const [parcelDrafts, setParcelDrafts] = useState<Record<string, string>>({});
  const [loadingParcels, setLoadingParcels] = useState(false);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [quote, setQuote] = useState<PackingQuoteResponse | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteOption | null>(null);
  const [pendingOperationId, setPendingOperationId] = useState<string | null>(null);
  const [pendingChangeId, setPendingChangeId] = useState<string | null>(null);
  const [editingOperation, setEditingOperation] = useState<ReshipmentOperation | null>(null);
  const [cancelPreview, setCancelPreview] = useState<ReshipmentCancellationPreview | null>(null);
  const [actionOperation, setActionOperation] = useState<ReshipmentOperation | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [operation, setOperation] = useState<ReshipmentOperation | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [recentReshipments, setRecentReshipments] = useState<RecentReshipment[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentFilter, setRecentFilter] = useState<"all" | "unprocessed">("all");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const productOptions = useMemo(
    () => searchProductIndex(products, productQuery).filter(product => product.type !== "wsvi_group"),
    [productQuery, products],
  );

  const resetCalculatedState = () => {
    setQuote(null);
    setSelectedQuote(null);
    setPendingOperationId(null);
    setPendingChangeId(null);
    setOperation(null);
  };

  const applyLoadedSource = (result: ReshipmentSource) => {
    setOrderId(String(result.order.id));
    setSource(result);
    setDestination(result.destination);
    setLines([]);
    setParcels([]);
    setRecommendedParcels([]);
    setParcelDrafts({});
    setParcelError(null);
    setEditingOperation(null);
    setCancelPreview(null);
    setActionOperation(null);
    resetCalculatedState();
  };

  const loadSourceById = async (id: number): Promise<ReshipmentSource | null> => {
    setLoadingSource(true);
    setMessage(null);
    try {
      const result = await getReshipmentSource(id);
      applyLoadedSource(result);
      setMessage({ type: "success", text: `Source order #${result.order.number} loaded.` });
      return result;
    } catch (error) {
      setSource(null);
      setDestination(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load the source order." });
      return null;
    } finally {
      setLoadingSource(false);
    }
  };

  const loadSource = async () => {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      setMessage({ type: "error", text: "Enter a valid source or replacement WooCommerce order ID." });
      return;
    }
    await loadSourceById(id);
  };

  const loadRecent = async () => {
    setLoadingRecent(true);
    setRecentError(null);
    try {
      const result = await listRecentReshipments(25);
      setRecentReshipments(result.reshipments);
    } catch (error) {
      setRecentError(error instanceof Error ? error.message : "Failed to load recent reshipments.");
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    void loadRecent();
    // The recent list is refreshed explicitly after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRecentReshipments = useMemo(
    () => recentFilter === "unprocessed"
      ? recentReshipments.filter(row => row.is_unprocessed)
      : recentReshipments,
    [recentFilter, recentReshipments],
  );

  const addSourceLine = (
    item: ReshipmentSource["items"][number],
    reason: "damaged_transit" | "missing_from_package",
  ) => {
    const maxQuantity = Math.max(0, item.quantity - item.already_reshipped_qty);
    const alreadySelected = lines
      .filter(line => line.source_order_item_id === item.order_item_id)
      .reduce((total, line) => total + line.quantity, 0);
    if (maxQuantity <= alreadySelected) {
      setMessage({ type: "error", text: `${item.name} is already fully represented by prior or currently selected reshipments.` });
      return;
    }
    const key = `source-${item.order_item_id}-${reason}`;
    setLines(previous => {
      const existing = previous.find(line => line.key === key);
      if (existing) {
        return previous.map(line => line.key === key
          ? { ...line, quantity: line.quantity + 1 }
          : line);
      }
      return [
        ...previous,
        {
          key,
          source_order_item_id: item.order_item_id,
          product_id: item.variation_id || item.product_id,
          quantity: 1,
          reason,
          inventory_effect: inventoryEffect(reason),
          sku: item.sku,
          name: item.name,
          maxQuantity,
        },
      ];
    });
    resetCalculatedState();
  };

  const addAdditionalProduct = (product: ProductSearchResult | null) => {
    if (!product) return;
    const key = `additional-${product.id}`;
    setLines(previous => {
      const existing = previous.find(line => line.key === key);
      return existing
        ? previous.map(line => line.key === key ? { ...line, quantity: line.quantity + 1 } : line)
        : [
            ...previous,
            {
              key,
              source_order_item_id: null,
              product_id: product.id,
              quantity: 1,
              reason: "other",
              inventory_effect: "decrement",
              sku: product.sku,
              name: product.name,
              maxQuantity: null,
            },
          ];
    });
    setProductQuery("");
    resetCalculatedState();
  };

  const updateLine = (key: string, values: Partial<SelectedLine>) => {
    setLines(previous => previous.map(line => {
      if (line.key !== key) return line;
      const next = { ...line, ...values };
      if (values.quantity && line.source_order_item_id && line.maxQuantity) {
        const otherSelected = previous
          .filter(candidate => candidate.key !== key && candidate.source_order_item_id === line.source_order_item_id)
          .reduce((total, candidate) => total + candidate.quantity, 0);
        next.quantity = Math.min(values.quantity, Math.max(1, line.maxQuantity - otherSelected));
      }
      if (values.reason) next.inventory_effect = inventoryEffect(values.reason);
      return next;
    }));
    resetCalculatedState();
  };

  const requestLines = useMemo<ReshipmentLineRequest[]>(() => lines.map(line => ({
    source_order_item_id: line.source_order_item_id,
    product_id: line.product_id,
    quantity: line.quantity,
    reason: line.reason,
    inventory_effect: line.inventory_effect,
  })), [lines]);

  useEffect(() => {
    if (!source || !destination || requestLines.length === 0) {
      setParcels([]);
      setRecommendedParcels([]);
      setParcelDrafts({});
      setParcelError(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoadingParcels(true);
      setParcelError(null);
      try {
        const result = await previewReshipmentParcels({
          operation_id: editingOperation?.operation_id,
          source_order_id: source.order.id,
          lines: requestLines,
          destination,
        });
        if (cancelled) return;
        setRecommendedParcels(result.parcels);
        setParcels(result.parcels);
        setParcelDrafts({});
        setQuote(null);
        setSelectedQuote(null);
      } catch (error) {
        if (cancelled) return;
        setRecommendedParcels([]);
        setParcels([]);
        setParcelDrafts({});
        setParcelError(error instanceof Error ? error.message : "Failed to calculate NY Shipping parcels.");
      } finally {
        if (!cancelled) setLoadingParcels(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [destination, editingOperation?.operation_id, requestLines, source]);

  const parcelSource: "recommended" | "manual" =
    JSON.stringify(parcels) === JSON.stringify(recommendedParcels) ? "recommended" : "manual";

  const updateParcel = (index: number, values: Partial<ReshipmentParcel>) => {
    setParcels(previous => previous.map((parcel, parcelIndex) => (
      parcelIndex === index ? { ...parcel, ...values } : parcel
    )));
    resetCalculatedState();
  };

  const resetToRecommendedParcels = () => {
    setParcels(recommendedParcels);
    setParcelDrafts({});
    resetCalculatedState();
  };

  const parcelValid = parcels.length > 0 && parcels.every(
    parcel => Math.min(parcel.qty, parcel.weight_kg, parcel.length_cm, parcel.width_cm, parcel.height_cm) > 0,
  );
  const destinationValid = Boolean(
    destination
    && destination.first_name
    && destination.last_name
    && destination.address_1
    && destination.city
    && destination.state
    && destination.postcode
    && destination.country.length === 2
    && destination.email
    && destination.phone,
  );
  const destinationSanitised = Boolean(
    destination
    && (
      Object.values(destination).some(value => value.toLowerCase().includes("redacted-"))
      || destination.email.toLowerCase().endsWith("@example.test")
      || destination.phone.replace(/\D/g, "").startsWith("000")
    ),
  );

  const previewQuote = async () => {
    if (!source || !destinationValid || destinationSanitised || lines.length === 0 || !parcelValid) {
      setMessage({ type: "error", text: "Enter a valid unsanitised destination, select an item, and complete the parcel dimensions." });
      return;
    }
    setLoadingQuote(true);
    setMessage(null);
    try {
      const result = await quoteReshipment({
        operation_id: editingOperation?.operation_id,
        source_order_id: source.order.id,
        lines: requestLines,
        parcels,
        destination: destination!,
        parcel_source: parcelSource,
      });
      setQuote(result);
      setSelectedQuote(quoteOptions(result)[0] ?? null);
      setMessage({ type: "success", text: "Current Shippit quotes loaded." });
    } catch (error) {
      setQuote(null);
      setSelectedQuote(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load Shippit quotes." });
    } finally {
      setLoadingQuote(false);
    }
  };

  const beginModification = async (row: ReshipmentOperation, selectedSource: ReshipmentSource | null = source) => {
    if (!selectedSource) return;
    setLoadingAction(true);
    setMessage(null);
    try {
      const detail = await getReshipmentOperation(row.operation_id);
      if (!detail.can_modify) {
        setMessage({ type: "error", text: detail.action_note || "This reshipment cannot be modified." });
        return;
      }
      const selectedLines: SelectedLine[] = (detail.lines || []).map((line, index) => {
        const sourceItem = selectedSource.items.find(item => item.order_item_id === line.source_order_item_id);
        const currentQuantity = line.quantity;
        return {
          key: `edit-${index}-${line.source_order_item_id || line.variation_id || line.product_id}`,
          source_order_item_id: line.source_order_item_id,
          product_id: line.variation_id || line.product_id,
          quantity: currentQuantity,
          reason: line.reason,
          inventory_effect: line.inventory_effect,
          sku: line.sku,
          name: line.product_name,
          maxQuantity: sourceItem
            ? Math.max(currentQuantity, sourceItem.quantity - sourceItem.already_reshipped_qty + currentQuantity)
            : null,
        };
      });
      setEditingOperation(detail);
      setLines(selectedLines);
      setDestination(detail.request_json?.destination || selectedSource.destination);
      setParcels(detail.request_json?.parcels || []);
      setRecommendedParcels([]);
      setParcelDrafts({});
      setQuote(null);
      setSelectedQuote(null);
      setPendingChangeId(null);
      setOperation(null);
      setMessage({ type: "info", text: `Editing replacement order #${detail.replacement_order_id}. Recalculate parcels and select a fresh quote before saving.` });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load the reshipment." });
    } finally {
      setLoadingAction(false);
    }
  };

  const beginCancellation = async (row: ReshipmentOperation) => {
    setLoadingAction(true);
    setMessage(null);
    try {
      const preview = await previewReshipmentCancellation(row.operation_id);
      if (!preview.can_cancel) {
        setMessage({ type: "error", text: preview.blocked_reason || "This reshipment cannot be cancelled." });
        return;
      }
      setActionOperation(row);
      setCancelPreview(preview);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to preview cancellation." });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRecentAction = async (
    row: RecentReshipment,
    action: "select" | "modify" | "cancel",
  ) => {
    const selectedSource = await loadSourceById(row.source_order_id);
    if (!selectedSource) return;
    if (action === "modify") {
      await beginModification(row, selectedSource);
    } else if (action === "cancel") {
      await beginCancellation(row);
    }
  };

  const confirmCancellation = async () => {
    if (!actionOperation || !source) return;
    setLoadingAction(true);
    setMessage(null);
    try {
      const result = await cancelReshipment(actionOperation.operation_id);
      setCancelPreview(null);
      setActionOperation(null);
      if (editingOperation?.operation_id === result.operation_id) setEditingOperation(null);
      setSource(await getReshipmentSource(source.order.id));
      await loadRecent();
      setMessage({ type: "success", text: `Replacement order #${result.replacement_order_id} and its Shippit shipment were cancelled.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to cancel the reshipment." });
    } finally {
      setLoadingAction(false);
    }
  };

  const submitReshipment = async () => {
    if (!source || !destination || !selectedQuote || !parcelValid) return;
    setCreating(true);
    setMessage(null);
    const operationId = pendingOperationId ?? crypto.randomUUID();
    const changeId = pendingChangeId ?? crypto.randomUUID();
    if (!editingOperation) setPendingOperationId(operationId);
    if (editingOperation) setPendingChangeId(changeId);
    try {
      const result = editingOperation
        ? await modifyReshipment(editingOperation.operation_id, {
            change_id: changeId,
            lines: requestLines,
            parcels,
            destination,
            parcel_source: parcelSource,
            quote_selection: selectedQuote,
          })
        : await createReshipment({
            operation_id: operationId,
            source_order_id: source.order.id,
            lines: requestLines,
            parcels,
            destination,
            parcel_source: parcelSource,
            quote_selection: selectedQuote,
            notify_customer: notifyCustomer,
          });
      setOperation(result);
      setPendingChangeId(null);
      setEditingOperation(null);
      setConfirming(false);
      setMessage({
        type: "success",
        text: editingOperation
          ? `Replacement order #${result.replacement_order_id} and Shippit shipment ${result.tracking_number} were updated.`
          : `Replacement order #${result.replacement_order_id} created with Shippit tracking ${result.tracking_number}.`,
      });
      setSource(await getReshipmentSource(source.order.id));
      await loadRecent();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to create the reshipment." });
    } finally {
      setCreating(false);
    }
  };

  const stockDecrementCount = lines.filter(line => line.inventory_effect === "decrement").length;
  const alreadyAccountedCount = lines.filter(line => line.inventory_effect === "already_accounted").length;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Reshipments</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create an auditable zero-value replacement order for goods damaged in transit, omitted from a package, or supplied as an additional replacement.
      </Typography>

      {message ? <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert> : null}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
            <Box>
              <Typography variant="h6">Recent and unprocessed reshipments</Typography>
              <Typography variant="body2" color="text.secondary">
                Select a source order, or modify or cancel a shipment that has not been picked up.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField
                select
                size="small"
                label="Show"
                value={recentFilter}
                onChange={event => setRecentFilter(event.target.value as "all" | "unprocessed")}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">Recent</MenuItem>
                <MenuItem value="unprocessed">Unprocessed only</MenuItem>
              </TextField>
              <Button variant="outlined" onClick={loadRecent} disabled={loadingRecent}>
                {loadingRecent ? "Refreshing..." : "Refresh"}
              </Button>
            </Stack>
          </Stack>
          {recentError ? <Alert severity="error">{recentError}</Alert> : null}
          {!loadingRecent && visibleRecentReshipments.length === 0 ? (
            <Alert severity="info">
              {recentFilter === "unprocessed" ? "There are no unprocessed reshipments." : "There are no recent reshipments."}
            </Alert>
          ) : null}
          {visibleRecentReshipments.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Source order</TableCell>
                  <TableCell>Replacement order</TableCell>
                  <TableCell>Billing name</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Shipment</TableCell>
                  <TableCell>CRM notes</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRecentReshipments.map(row => (
                  <TableRow key={row.operation_id} hover>
                    <TableCell>#{row.source_order_number || row.source_order_id}</TableCell>
                    <TableCell>#{row.replacement_order_number || row.replacement_order_id || "-"}</TableCell>
                    <TableCell>{row.billing_name || "-"}</TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        {row.item_summary.map((item, index) => (
                          <Typography variant="caption" key={`${row.operation_id}-item-${index}`}>
                            {item.quantity}× {item.sku ? `[${item.sku}] ` : ""}{item.name}
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} alignItems="flex-start">
                        <Chip
                          size="small"
                          color={row.is_unprocessed ? "warning" : row.status === "cancelled" ? "default" : "success"}
                          label={row.shipment_state || row.status}
                        />
                        {row.tracking_url ? (
                          <Link href={row.tracking_url} target="_blank" rel="noopener noreferrer">
                            {row.tracking_number}
                          </Link>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 240, maxWidth: 360 }}>
                      {row.crm_notes.length > 0 ? (
                        <Box component="details">
                          <Box component="summary" sx={{ cursor: "pointer" }}>
                            {row.crm_notes.length} note{row.crm_notes.length === 1 ? "" : "s"} — {row.crm_notes[0].note_content}
                          </Box>
                          <Stack spacing={1} sx={{ mt: 1 }}>
                            {row.crm_notes.map(note => (
                              <Box key={note.id}>
                                <Typography variant="caption" color="text.secondary">
                                  {note.status} · {note.trigger_event}{note.reminder_date ? ` · reminder ${note.reminder_date}` : ""}
                                </Typography>
                                <Typography variant="body2">{note.note_content}</Typography>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">No CRM notes</Typography>
                      )}
                    </TableCell>
                    <TableCell>{row.created_at ? new Date(`${row.created_at}Z`).toLocaleString() : "-"}</TableCell>
                    <TableCell>
                      <Stack spacing={1} alignItems="flex-start">
                        <Button size="small" variant="outlined" disabled={loadingAction || loadingSource} onClick={() => handleRecentAction(row, "select")}>
                          Select
                        </Button>
                        {row.can_modify ? (
                          <Button size="small" variant="outlined" disabled={loadingAction || loadingSource} onClick={() => handleRecentAction(row, "modify")}>
                            Modify
                          </Button>
                        ) : null}
                        {row.can_cancel ? (
                          <Button size="small" variant="outlined" color="error" disabled={loadingAction || loadingSource} onClick={() => handleRecentAction(row, "cancel")}>
                            Cancel
                          </Button>
                        ) : null}
                        {!row.can_modify && !row.can_cancel ? (
                          <Typography variant="caption" color="text.secondary">{row.action_note}</Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">1. Source order</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Source or Replacement WooCommerce Order ID"
              type="number"
              value={orderId}
              onChange={event => {
                setOrderId(event.target.value);
                setSource(null);
                setDestination(null);
                setLines([]);
                resetCalculatedState();
              }}
              sx={{ minWidth: 280 }}
            />
            <Button variant="contained" onClick={loadSource} disabled={loadingSource}>
              {loadingSource ? "Loading..." : "Load Source Order"}
            </Button>
          </Stack>
          {source ? (
            <Stack spacing={2}>
              <Alert severity="info">
                <Typography variant="subtitle2">
                  Order #{source.order.number} — {source.order.customer} — {source.order.status_label}
                </Typography>
                <Typography variant="body2">{source.order.shipping_address}</Typography>
                <Typography variant="body2">{source.order.email} · {source.order.phone}</Typography>
              </Alert>
              {destinationSanitised ? (
                <Alert severity="warning">
                  This staging order contains sanitised customer data. Replace the destination and contact fields below before requesting quotes.
                </Alert>
              ) : null}
              <Typography variant="subtitle2">Replacement shipment destination</Typography>
              {destination ? (
                <>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    {([
                      ["first_name", "First name"],
                      ["last_name", "Last name"],
                      ["company", "Company"],
                      ["email", "Email"],
                      ["phone", "Phone"],
                    ] as const).map(([key, label]) => (
                      <TextField
                        key={key}
                        label={label}
                        value={destination[key]}
                        required={key !== "company"}
                        onChange={event => {
                          setDestination(previous => previous ? { ...previous, [key]: event.target.value } : previous);
                          resetCalculatedState();
                        }}
                      />
                    ))}
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    {([
                      ["address_1", "Address line 1"],
                      ["address_2", "Address line 2"],
                      ["city", "Suburb / city"],
                      ["state", "State"],
                      ["postcode", "Postcode"],
                      ["country", "Country code"],
                    ] as const).map(([key, label]) => (
                      <TextField
                        key={key}
                        label={label}
                        value={destination[key]}
                        required={key !== "address_2"}
                        onChange={event => {
                          setDestination(previous => previous ? { ...previous, [key]: event.target.value } : previous);
                          resetCalculatedState();
                        }}
                      />
                    ))}
                  </Stack>
                </>
              ) : null}
              <Divider />
              <CrmNoteComposer
                orderId={source.order.id}
                customerEmail={source.order.email}
                customerPhone={source.order.phone}
                customerName={source.order.customer}
                triggerEvent="reshipment"
              />
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {source ? (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">2. Select replacement items</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Source item</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="right">Ordered</TableCell>
                    <TableCell align="right">Already reshipped</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {source.items.map(item => (
                    <TableRow key={item.order_item_id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.sku || "-"}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{item.already_reshipped_qty}</TableCell>
                      <TableCell>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => addSourceLine(item, "missing_from_package")}>
                            Add Missing Item
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => addSourceLine(item, "damaged_transit")}>
                            Add Damaged Replacement
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Autocomplete
                options={productOptions}
                filterOptions={available => available}
                loading={productsLoading}
                inputValue={productQuery}
                onInputChange={(_event, value) => setProductQuery(value)}
                onChange={(_event, product) => addAdditionalProduct(product)}
                getOptionLabel={productLabel}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Add a different product or variation"
                    error={Boolean(productsError)}
                    helperText={productsError || "Search the global product index by SKU or product name."}
                  />
                )}
              />

              {lines.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Selected item</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Inventory effect</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map(line => (
                      <TableRow key={line.key}>
                        <TableCell>{line.sku ? `[${line.sku}] ` : ""}{line.name}</TableCell>
                        <TableCell>
                          <TextField
                            select
                            size="small"
                            value={line.reason}
                            onChange={event => updateLine(line.key, { reason: event.target.value as ReshipmentReason })}
                            sx={{ minWidth: 210 }}
                          >
                            {line.source_order_item_id ? (
                              <MenuItem value="missing_from_package">{reasonLabels.missing_from_package}</MenuItem>
                            ) : null}
                            <MenuItem value="damaged_transit">{reasonLabels.damaged_transit}</MenuItem>
                            <MenuItem value="other">{reasonLabels.other}</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          {line.inventory_effect === "already_accounted"
                            ? "No additional reduction"
                            : "Reduce stock"}
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={line.quantity}
                            onChange={event => updateLine(line.key, {
                              quantity: Math.max(1, Math.min(line.maxQuantity ?? 9999, Number(event.target.value) || 1)),
                            })}
                            inputProps={{ min: 1, max: line.maxQuantity ?? undefined }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button color="error" size="small" onClick={() => {
                            setLines(previous => previous.filter(item => item.key !== line.key));
                            resetCalculatedState();
                          }}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">3. Parcel and Shippit quote</Typography>
              {loadingParcels ? <Alert severity="info">Calculating parcels with NY Shipping rules...</Alert> : null}
              {parcelError ? <Alert severity="error">{parcelError}</Alert> : null}
              {!loadingParcels && parcels.length > 0 ? (
                <Alert severity={parcelSource === "recommended" ? "success" : "warning"}>
                  {parcelSource === "recommended"
                    ? `${parcels.length} parcel(s) calculated using NY Shipping rules.`
                    : "Parcel configuration has been manually adjusted. Request a new quote before booking."}
                </Alert>
              ) : null}
              {parcels.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parcel</TableCell>
                      <TableCell>Weight (kg)</TableCell>
                      <TableCell>Length (cm)</TableCell>
                      <TableCell>Width (cm)</TableCell>
                      <TableCell>Height (cm)</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parcels.map((parcelRow, parcelIndex) => (
                      <TableRow key={`parcel-${parcelIndex}`}>
                        <TableCell>{parcelIndex + 1}</TableCell>
                        {(["weight_kg", "length_cm", "width_cm", "height_cm"] as const).map(key => {
                          const draftKey = `${parcelIndex}:${key}`;
                          return (
                            <TableCell key={key}>
                              <TextField
                                size="small"
                                type="number"
                                value={parcelDrafts[draftKey] ?? String(parcelRow[key])}
                                onChange={event => {
                                  const rawValue = event.target.value;
                                  setParcelDrafts(previous => ({ ...previous, [draftKey]: rawValue }));
                                  const numericValue = rawValue === "" ? 0 : Number(rawValue);
                                  if (Number.isFinite(numericValue)) {
                                    updateParcel(parcelIndex, { [key]: numericValue });
                                  }
                                }}
                                onBlur={() => {
                                  setParcelDrafts(previous => {
                                    const next = { ...previous };
                                    delete next[draftKey];
                                    return next;
                                  });
                                }}
                                inputProps={{ min: 0.01, step: 0.01 }}
                                sx={{ width: 120 }}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <Button
                            color="error"
                            size="small"
                            onClick={() => {
                              setParcels(previous => previous.filter((_parcel, index) => index !== parcelIndex));
                              setParcelDrafts({});
                              resetCalculatedState();
                            }}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setParcels(previous => [...previous, { ...emptyParcel }]);
                    setParcelDrafts({});
                    resetCalculatedState();
                  }}
                  disabled={lines.length === 0}
                >
                  Add Parcel
                </Button>
                <Button
                  variant="text"
                  onClick={resetToRecommendedParcels}
                  disabled={recommendedParcels.length === 0 || parcelSource === "recommended"}
                >
                  Reset to NY Recommendation
                </Button>
              </Stack>
              <Button
                variant="outlined"
                onClick={previewQuote}
                disabled={loadingQuote || loadingParcels || lines.length === 0 || !parcelValid}
              >
                {loadingQuote ? "Loading Quotes..." : "Get Shippit Quotes"}
              </Button>
              {quote ? (
                <Stack spacing={2}>
                  <Alert severity={quoteFailures(quote).length > 0 ? "warning" : "success"}>
                    {quoteOptions(quote).length} usable quote(s) returned; {quoteFailures(quote).length} carrier quote failure(s).
                  </Alert>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Courier</TableCell>
                        <TableCell>Service</TableCell>
                        <TableCell align="right">Cost</TableCell>
                        <TableCell>Transit</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {quoteOptions(quote).map(option => (
                        <TableRow key={option.id}>
                          <TableCell>{option.label}</TableCell>
                          <TableCell>{option.service_level || option.courier_type || "-"}</TableCell>
                          <TableCell align="right">{source.order.currency} {Number(option.price).toFixed(2)}</TableCell>
                          <TableCell>{option.estimated_transit_time || "-"}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant={selectedQuote?.id === option.id ? "contained" : "outlined"}
                              onClick={() => setSelectedQuote(option)}
                            >
                              {selectedQuote?.id === option.id ? "Selected" : "Select"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {quoteFailures(quote).length > 0 ? (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Carrier quote failures</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Courier</TableCell>
                            <TableCell>Service</TableCell>
                            <TableCell>Reason</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {quoteFailures(quote).map((failure, index) => (
                            <TableRow key={`${failure.courier}-${failure.service}-${index}`}>
                              <TableCell>{failure.courier}</TableCell>
                              <TableCell>{failure.service || "-"}</TableCell>
                              <TableCell>{failure.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">
                {editingOperation ? "4. Save replacement shipment changes" : "4. Create replacement order and shipment"}
              </Typography>
              <Alert severity="warning">
                {editingOperation
                  ? `The existing Shippit shipment and replacement order #${editingOperation.replacement_order_id} will be updated. Inventory will be adjusted only by the difference from the current items.`
                  : `A new zero-value WooCommerce order will be created. ${stockDecrementCount} line(s) will reduce inventory and ${alreadyAccountedCount} omitted-item line(s) will not reduce inventory again.`}
              </Alert>
              {!editingOperation ? (
                <FormControlLabel
                  control={<Checkbox checked={notifyCustomer} onChange={event => setNotifyCustomer(event.target.checked)} />}
                  label="Send the customer a WooCommerce fulfillment/tracking notification"
                />
              ) : null}
              <Button variant="contained" color="secondary" onClick={() => setConfirming(true)} disabled={!selectedQuote || creating}>
                {editingOperation ? "Review and Save Changes" : "Create Replacement Order and Submit Shipment"}
              </Button>
              {editingOperation ? (
                <Button variant="text" onClick={() => {
                  setEditingOperation(null);
                  setLines([]);
                  setParcels([]);
                  setRecommendedParcels([]);
                  resetCalculatedState();
                  setMessage({ type: "info", text: "Modification cancelled. No shipment changes were made." });
                }}>
                  Stop Editing
                </Button>
              ) : null}
              {operation ? (
                <Alert severity="success">
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Operation {operation.operation_id}</Typography>
                    <Typography variant="body2">
                      Replacement order #{operation.replacement_order_id}; status {operation.status}; tracking {operation.tracking_number}
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      {operation.replacement_order_id && wordpressAdminUrl(`post.php?post=${operation.replacement_order_id}&action=edit`) ? (
                        <Link href={wordpressAdminUrl(`post.php?post=${operation.replacement_order_id}&action=edit`)!} target="_blank" rel="noopener noreferrer">
                          Open replacement order
                        </Link>
                      ) : null}
                      {operation.tracking_url ? (
                        <Link href={operation.tracking_url} target="_blank" rel="noopener noreferrer">Track shipment</Link>
                      ) : null}
                    </Stack>
                  </Stack>
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          {source.previous_reshipments.length > 0 ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Previous reshipments for this order</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Replacement order</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Courier</TableCell>
                    <TableCell>Tracking</TableCell>
                    <TableCell align="right">Cost</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {source.previous_reshipments.map(row => (
                    <TableRow key={row.operation_id}>
                      <TableCell>#{row.replacement_order_id || "-"}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.courier_name || "-"}</TableCell>
                      <TableCell>
                        {row.tracking_url
                          ? <Link href={row.tracking_url} target="_blank" rel="noopener noreferrer">{row.tracking_number}</Link>
                          : row.tracking_number || "-"}
                      </TableCell>
                      <TableCell align="right">{row.currency} {row.quoted_cost?.toFixed(2) ?? "-"}</TableCell>
                      <TableCell>
                        {row.can_modify && row.can_cancel ? (
                          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                            <Button size="small" variant="outlined" disabled={loadingAction} onClick={() => beginModification(row)}>
                              Modify
                            </Button>
                            <Button size="small" variant="outlined" color="error" disabled={loadingAction} onClick={() => beginCancellation(row)}>
                              Cancel
                            </Button>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {row.action_note || (row.status === "cancelled" ? "Cancelled" : "Unavailable")}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          ) : null}
        </>
      ) : null}

      <Dialog open={confirming} onClose={() => !creating && setConfirming(false)}>
        <DialogTitle>{editingOperation ? "Modify live replacement shipment?" : "Create live replacement shipment?"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2">
              {editingOperation
                ? `This updates live Shippit tracking ${editingOperation.tracking_number}, replacement order #${editingOperation.replacement_order_id}, its fulfillment, and the displayed inventory differences.`
                : `This creates a real zero-value WooCommerce order linked to source order #${source?.order.number}, applies the displayed inventory effects, and submits a live Shippit shipment using the selected quote.`}
            </Typography>
            <Typography variant="body2">
              Courier cost: {source?.order.currency} {Number(selectedQuote?.price || 0).toFixed(2)}.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)} disabled={creating}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={submitReshipment} disabled={creating}>
            {creating ? (editingOperation ? "Saving..." : "Creating...") : (editingOperation ? "Save Shipment Changes" : "Create Order and Submit")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(cancelPreview)} onClose={() => !loadingAction && setCancelPreview(null)}>
        <DialogTitle>Cancel live replacement shipment?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2">
              This will cancel Shippit tracking {cancelPreview?.tracking_number}, cancel replacement order #{cancelPreview?.replacement_order_id}, and cancel its WooCommerce fulfillment.
            </Typography>
            <Typography variant="body2">
              {cancelPreview?.stock_restore_quantity || 0} unit(s) previously deducted for this reshipment will be restored. {cancelPreview?.already_accounted_quantity || 0} omitted-item unit(s) will not be restored because their stock was already accounted for.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCancelPreview(null);
            setActionOperation(null);
          }} disabled={loadingAction}>Keep Reshipment</Button>
          <Button variant="contained" color="error" onClick={confirmCancellation} disabled={loadingAction}>
            {loadingAction ? "Cancelling..." : "Cancel Reshipment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
