import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  createReshipment,
  getReshipmentSource,
  quoteReshipment,
  type InventoryEffect,
  type ReshipmentDestination,
  type ReshipmentLineRequest,
  type ReshipmentOperation,
  type ReshipmentParcel,
  type ReshipmentReason,
  type ReshipmentSource,
} from "../api/reshipmentsApi";
import type { PackingQuoteResponse, PackingQuoteSelection } from "../api/shippitPackingApi";
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
  const [parcel, setParcel] = useState<ReshipmentParcel>(emptyParcel);
  const [productQuery, setProductQuery] = useState("");
  const [quote, setQuote] = useState<PackingQuoteResponse | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteOption | null>(null);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [operation, setOperation] = useState<ReshipmentOperation | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
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
    setOperation(null);
  };

  const loadSource = async () => {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      setMessage({ type: "error", text: "Enter a valid source WooCommerce order ID." });
      return;
    }
    setLoadingSource(true);
    setMessage(null);
    try {
      const result = await getReshipmentSource(id);
      setSource(result);
      setDestination(result.destination);
      setLines([]);
      setParcel(emptyParcel);
      resetCalculatedState();
      setMessage({ type: "success", text: `Source order #${result.order.number} loaded.` });
    } catch (error) {
      setSource(null);
      setDestination(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load the source order." });
    } finally {
      setLoadingSource(false);
    }
  };

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

  const useSourceItemDimensions = (item: ReshipmentSource["items"][number]) => {
    if (Math.min(item.weight_kg, item.length_cm, item.width_cm, item.height_cm) <= 0) {
      setMessage({ type: "error", text: "This product does not have complete positive parcel dimensions." });
      return;
    }
    setParcel({
      qty: 1,
      weight_kg: item.weight_kg,
      length_cm: item.length_cm,
      width_cm: item.width_cm,
      height_cm: item.height_cm,
    });
    resetCalculatedState();
  };

  const requestLines = (): ReshipmentLineRequest[] => lines.map(line => ({
    source_order_item_id: line.source_order_item_id,
    product_id: line.product_id,
    quantity: line.quantity,
    reason: line.reason,
    inventory_effect: line.inventory_effect,
  }));

  const parcelValid = Math.min(parcel.qty, parcel.weight_kg, parcel.length_cm, parcel.width_cm, parcel.height_cm) > 0;
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
        source_order_id: source.order.id,
        lines: requestLines(),
        parcels: [parcel],
        destination: destination!,
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

  const submitReshipment = async () => {
    if (!source || !destination || !selectedQuote || !parcelValid) return;
    setCreating(true);
    setMessage(null);
    try {
      const result = await createReshipment({
        operation_id: crypto.randomUUID(),
        source_order_id: source.order.id,
        lines: requestLines(),
        parcels: [parcel],
        destination,
        quote_selection: selectedQuote,
        notify_customer: notifyCustomer,
      });
      setOperation(result);
      setConfirming(false);
      setMessage({
        type: "success",
        text: `Replacement order #${result.replacement_order_id} created with Shippit tracking ${result.tracking_number}.`,
      });
      setSource(await getReshipmentSource(source.order.id));
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
          <Typography variant="h6">1. Source order</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Source WooCommerce Order ID"
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
                          <Button size="small" variant="text" onClick={() => useSourceItemDimensions(item)}>
                            Use Dimensions
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
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                {([
                  ["weight_kg", "Weight (kg)"],
                  ["length_cm", "Length (cm)"],
                  ["width_cm", "Width (cm)"],
                  ["height_cm", "Height (cm)"],
                ] as const).map(([key, label]) => (
                  <TextField
                    key={key}
                    label={label}
                    type="number"
                    value={parcel[key] || ""}
                    onChange={event => {
                      setParcel(previous => ({ ...previous, [key]: Number(event.target.value) }));
                      resetCalculatedState();
                    }}
                    inputProps={{ min: 0.01, step: 0.01 }}
                  />
                ))}
              </Stack>
              <Button variant="outlined" onClick={previewQuote} disabled={loadingQuote || lines.length === 0}>
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
              <Typography variant="h6">4. Create replacement order and shipment</Typography>
              <Alert severity="warning">
                A new zero-value WooCommerce order will be created. {stockDecrementCount} line(s) will reduce inventory and {alreadyAccountedCount} omitted-item line(s) will not reduce inventory again.
              </Alert>
              <FormControlLabel
                control={<Checkbox checked={notifyCustomer} onChange={event => setNotifyCustomer(event.target.checked)} />}
                label="Send the customer a WooCommerce fulfillment/tracking notification"
              />
              <Button variant="contained" color="secondary" onClick={() => setConfirming(true)} disabled={!selectedQuote || creating}>
                Create Replacement Order and Submit Shipment
              </Button>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          ) : null}
        </>
      ) : null}

      <Dialog open={confirming} onClose={() => !creating && setConfirming(false)}>
        <DialogTitle>Create live replacement shipment?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2">
              This creates a real zero-value WooCommerce order linked to source order #{source?.order.number}, applies the displayed inventory effects, and submits a live Shippit shipment using the selected quote.
            </Typography>
            <Typography variant="body2">
              Courier cost: {source?.order.currency} {Number(selectedQuote?.price || 0).toFixed(2)}.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)} disabled={creating}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={submitReshipment} disabled={creating}>
            {creating ? "Creating..." : "Create Order and Submit"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
