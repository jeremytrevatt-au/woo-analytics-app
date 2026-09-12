import { Alert, Stack, Typography, Grid, Box, Chip, Card, CardContent, CardActions, Button, Collapse, Divider, TextField, IconButton, Popover, Dialog, DialogContent, DialogTitle } from "@mui/material";
import { useEffect, useState } from "react";
import { Check, CheckCircleOutline, Close } from "@mui/icons-material";
import CustomerCrmPanel from "../components/CustomerCrmPanel";
import LoadStateBlock from "../components/LoadStateBlock";
import { usePackingOrders } from "../hooks/usePackingOrders";
import { formatCurrency } from "../lib/format";
import { markOrderPacked, updatePackingLineStock } from "../api/analyticsApi";
import type { PackingStockQuantityResponse } from "../api/analyticsApi";
import { ApiRequestError } from "../api/httpClient";
import { listDocumentTemplates } from "../api/documentTemplatesApi";
import type { DocumentTemplate } from "../api/documentTemplatesApi";
import { listCrmCustomerProfileExtensions, listCrmNotes } from "../api/crmApi";
import type { CrmCustomerProfileExtension, CrmNote } from "../api/crmApi";
import { createPrintJob } from "../api/printJobsApi";
import PackingDimensionsDialog from "../components/PackingDimensionsDialog";
import PackingLineDetails from "../components/PackingLineDetails";
import { groupPackingOrdersByUser } from "../lib/packing";

type QueueContext = {
  duplicateFirstNameKeys: Set<string>;
  customerGroups: Map<string, any[]>;
};

type QueueGroup = {
  key: string;
  orders: any[];
  sameCustomer: boolean;
};

function PackingPage() {
  const { rows, currentUser, isLoading, error, refetch, updateOrderStatus } = usePackingOrders(1, 100);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [packingSaving, setPackingSaving] = useState<Record<number, boolean>>({});
  const [packingActionError, setPackingActionError] = useState<string | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({});
  const [stockMessages, setStockMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [stockOverrides, setStockOverrides] = useState<Record<string, PackingStockQuantityResponse>>({});
  const [stockPopover, setStockPopover] = useState<{ key: string; anchorEl: HTMLElement } | null>(null);
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [documentTemplateError, setDocumentTemplateError] = useState<string | null>(null);
  const [documentPrintSaving, setDocumentPrintSaving] = useState<Record<string, boolean>>({});
  const [documentPrintMessage, setDocumentPrintMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [crmNotes, setCrmNotes] = useState<CrmNote[]>([]);
  const [crmNotesError, setCrmNotesError] = useState<string | null>(null);
  const [crmProfiles, setCrmProfiles] = useState<CrmCustomerProfileExtension[]>([]);
  const [crmProfilesError, setCrmProfilesError] = useState<string | null>(null);
  const [crmOrder, setCrmOrder] = useState<any | null>(null);
  const [dimensionsOrder, setDimensionsOrder] = useState<any | null>(null);

  useEffect(() => {
    listDocumentTemplates({ enabled: "true" })
      .then(setDocumentTemplates)
      .catch((error: any) => setDocumentTemplateError(error.message || "Failed to load document templates."));
  }, []);

  const loadCrmNotes = async () => {
    try {
      const notes = await listCrmNotes({ status: "open" });
      setCrmNotes(notes);
      setCrmNotesError(null);
    } catch (error: any) {
      setCrmNotesError(error.message || "Failed to load CRM notes.");
    }
  };

  useEffect(() => {
    loadCrmNotes();
  }, []);

  const loadCrmProfiles = async () => {
    try {
      const profiles = await listCrmCustomerProfileExtensions();
      setCrmProfiles(Array.isArray(profiles) ? profiles : [profiles]);
      setCrmProfilesError(null);
    } catch (error: any) {
      setCrmProfilesError(error.message || "Failed to load CRM customer profiles.");
    }
  };

  useEffect(() => {
    loadCrmProfiles();
  }, []);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handlePack = async (orderId: number, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const previousOrder = rows.find(order => Number(order.order_id) === Number(orderId));
    const previousStatus = previousOrder?.status || "unpacked";
    const previousPackedBy = previousOrder?.packed_by || "";
    setPackingActionError(null);
    setPackingSaving(previous => ({ ...previous, [orderId]: true }));
    updateOrderStatus(orderId, status, currentUser || "You");

    try {
      const res = await markOrderPacked(orderId, status);
      updateOrderStatus(orderId, res.status || status, res.packed_by || currentUser || "You");
      void refetch();
    } catch (err: any) {
      updateOrderStatus(orderId, previousStatus, previousPackedBy);
      const responseDetail = err instanceof ApiRequestError
        && err.responseBody
        && typeof err.responseBody === "object"
        && "detail" in err.responseBody
        ? (err.responseBody as { detail?: { message?: string } }).detail
        : null;
      setPackingActionError(
        responseDetail?.message
        || (err instanceof Error ? err.message : `Failed to mark order as ${status}.`)
      );
      void refetch();
    } finally {
      setPackingSaving(previous => ({ ...previous, [orderId]: false }));
    }
  };

  const lineKey = (orderId: number, orderItemId: number) => `${orderId}:${orderItemId}`;

  const getStockTargetLabel = (targetType: string | undefined) => {
    if (targetType === "wsvi") return "Shared WSVI";
    if (targetType === "variation") return "Variation";
    if (targetType === "simple") return "Product";
    return "Stock";
  };

  const getStockFieldColor = (stockStatus: string | undefined, stockQty: any) => {
    if (Number(stockQty) === 0) return { bgcolor: "error.light", color: "error.contrastText" };
    if (stockStatus === "instock") return { bgcolor: "success.light", color: "success.contrastText" };
    if (stockStatus === "outofstock") return { bgcolor: "error.light", color: "error.contrastText" };
    if (stockStatus === "onbackorder") return { bgcolor: "warning.light", color: "warning.contrastText" };
    return { bgcolor: "action.hover", color: "text.primary" };
  };

  const getOrderDocumentTemplates = (order: any) => {
    const lines = Array.isArray(order.lines) ? order.lines : [];
    return documentTemplates.filter(template => {
      if (!Boolean(Number(template.enabled))) return false;
      const matchValue = String(template.match_value || "").trim().toLowerCase();
      if (template.trigger_type === "manual") return true;
      if (template.trigger_type === "new_customer") return Boolean(order.is_first_order);
      if (template.trigger_type === "product_sku") {
        return !!matchValue && lines.some((line: any) => String(line.sku || "").trim().toLowerCase() === matchValue);
      }
      if (template.trigger_type === "product_category") {
        return !!matchValue && lines.some((line: any) => String(line.category || "").toLowerCase().includes(matchValue));
      }
      return false;
    });
  };

  const handleQueueDocumentPrint = async (order: any, template: DocumentTemplate, event: React.MouseEvent) => {
    event.stopPropagation();
    const key = `${order.order_id}:${template.id}`;
    setDocumentPrintSaving(previous => ({ ...previous, [key]: true }));
    setDocumentPrintMessage(null);

    try {
      const queued = await createPrintJob({
        document_url: template.google_drive_url,
        document_name: `${template.name}-order-${order.order_id}.pdf`,
        source_type: "google_drive_url",
        payload: {
          queued_from: "packing_page",
          order_id: order.order_id,
          template_id: template.id,
          customer_name: order.customer_name,
        },
      });
      setDocumentPrintMessage({ type: "success", text: `Queued ${template.name} as print job #${queued.id}.` });
    } catch (error: unknown) {
      setDocumentPrintMessage({
        type: "error",
        text: error instanceof Error ? error.message : `Failed to queue ${template.name}.`,
      });
    } finally {
      setDocumentPrintSaving(previous => ({ ...previous, [key]: false }));
    }
  };

  const getPackingFirstName = (order: any) => {
    const explicitFirstName = String(order.packing_first_name || order.billing_first_name || "").trim();
    if (explicitFirstName) return explicitFirstName;

    const displayName = String(order.customer_name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    return displayName.split(/\s+/)[0] || "";
  };

  const normaliseFirstNameKey = (firstName: string) => firstName.trim().toLowerCase();

  const getCustomerMatchKey = (order: any) => {
    const apiKey = String(order.customer_match_key || "").trim();
    if (apiKey && !apiKey.startsWith("order:")) return apiKey;

    const customerId = Number(order.customer_id || 0);
    if (customerId > 0) return `customer:${customerId}`;

    const phone = String(order.billing_phone || "").replace(/\D/g, "");
    if (phone) return `phone:${phone}`;

    const email = String(order.billing_email || "").trim().toLowerCase();
    if (email) return `email:${email}`;

    return "";
  };

  const getOrderCrmIdentity = (order: any) => ({
    customer_id: Number(order.customer_id || 0) > 0 ? Number(order.customer_id) : undefined,
    customer_key: getCustomerMatchKey(order) || undefined,
    customer_email: String(order.billing_email || "").trim() || undefined,
    customer_phone: String(order.billing_phone || "").trim() || undefined,
  });

  const normalizePhone = (value: any) => String(value || "").replace(/\D/g, "");

  const getOrderCrmNotes = (order: any) => {
    const orderId = Number(order.order_id);

    return crmNotes.filter(note => {
      if (Number(note.order_id || 0) > 0 && Number(note.order_id) === orderId) return true;
      return false;
    });
  };

  const getOrderCrmProfile = (order: any) => {
    const customerKey = getCustomerMatchKey(order);
    const customerId = Number(order.customer_id || 0);
    const phone = normalizePhone(order.billing_phone);
    const email = String(order.billing_email || "").trim().toLowerCase();

    return crmProfiles.find(profile => {
      if (profile.customer_key && customerKey && profile.customer_key === customerKey) return true;
      if (Number(profile.customer_id || 0) > 0 && customerId > 0 && Number(profile.customer_id) === customerId) return true;
      if (profile.customer_phone && phone && normalizePhone(profile.customer_phone) === phone) return true;
      if (profile.customer_email && email && profile.customer_email.toLowerCase() === email) return true;
      return false;
    });
  };

  const getLineWooProductAdminId = (line: any, stockOverride?: PackingStockQuantityResponse) => {
    const parentId = Number(line.stock_target_parent_id || 0);
    if (parentId > 0) return parentId;
    return stockOverride?.stock_target_product_id ?? line.stock_target_product_id ?? line.product_id;
  };

  const buildQueueContext = (orders: any[]): QueueContext => {
    const firstNameGroups = new Map<string, any[]>();
    const customerGroups = new Map<string, any[]>();

    orders.forEach(order => {
      const firstName = getPackingFirstName(order);
      const firstNameKey = normaliseFirstNameKey(firstName);
      if (firstNameKey) {
        firstNameGroups.set(firstNameKey, [...(firstNameGroups.get(firstNameKey) || []), order]);
      }

      const customerKey = getCustomerMatchKey(order);
      if (customerKey) {
        customerGroups.set(customerKey, [...(customerGroups.get(customerKey) || []), order]);
      }
    });

    return {
      duplicateFirstNameKeys: new Set(
        Array.from(firstNameGroups.entries())
          .filter(([, groupedOrders]) => groupedOrders.length > 1)
          .map(([firstNameKey]) => firstNameKey)
      ),
      customerGroups,
    };
  };

  const buildQueueGroups = (orders: any[], queueContext: QueueContext): QueueGroup[] => {
    const groupedKeys = new Set<string>();
    const groups: QueueGroup[] = [];

    orders.forEach(order => {
      const customerKey = getCustomerMatchKey(order);
      const sameCustomerOrders = customerKey ? queueContext.customerGroups.get(customerKey) || [] : [];

      if (customerKey && sameCustomerOrders.length > 1) {
        if (groupedKeys.has(customerKey)) return;
        groupedKeys.add(customerKey);
        groups.push({ key: customerKey, orders: sameCustomerOrders, sameCustomer: true });
        return;
      }

      groups.push({ key: `order:${order.order_id}`, orders: [order], sameCustomer: false });
    });

    return groups;
  };

  const handleStockOpen = (
    key: string,
    anchorEl: HTMLElement,
    stockQty: any,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setStockInputs(prev => ({ ...prev, [key]: String(stockQty ?? "") }));
    setStockPopover({ key, anchorEl });
  };

  const handleStockClose = (key: string, stockQty: any) => {
    setStockInputs(prev => ({ ...prev, [key]: String(stockQty ?? "") }));
    setStockPopover(null);
  };

  const handleStockSave = async (order: any, line: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = lineKey(order.order_id, line.order_item_id);
    const currentValue = stockInputs[key] ?? String(stockOverrides[key]?.stock_qty ?? line.reported_stock_qty ?? line.stock_qty ?? "");
    const nextStockQty = Number(currentValue);

    if (!Number.isFinite(nextStockQty) || nextStockQty < 0) {
      setStockMessages(prev => ({ ...prev, [key]: { type: "error", text: "Enter a stock quantity of 0 or higher." } }));
      return;
    }

    setStockSaving(prev => ({ ...prev, [key]: true }));
    setStockMessages(prev => ({ ...prev, [key]: { type: "success", text: "Saving..." } }));

    try {
      const response = await updatePackingLineStock(
        order.order_id,
        line.order_item_id,
        line.stock_target_product_id ?? line.product_id ?? null,
        line.sku ?? null,
        nextStockQty
      );
      setStockOverrides(prev => ({ ...prev, [key]: response }));
      setStockInputs(prev => ({ ...prev, [key]: String(response.stock_qty) }));
      setStockMessages(prev => ({ ...prev, [key]: { type: "success", text: `Saved ${response.stock_qty}` } }));
      setStockPopover(null);
    } catch (err: any) {
      setStockMessages(prev => ({ ...prev, [key]: { type: "error", text: err.message || "Failed to update stock." } }));
    } finally {
      setStockSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // Group orders
  const getOrderStatus = (order: any) => {
    return order.status || 'unpacked';
  };

  const preOrders = rows.filter(r => r.order_status === 'wc-pre-ordered' && getOrderStatus(r) !== 'packing');
  const readyToPack = rows.filter(r => r.order_status !== 'wc-pre-ordered' && !r.has_backorders && getOrderStatus(r) === 'unpacked');
  const awaitingStock = rows.filter(r => r.order_status !== 'wc-pre-ordered' && r.has_backorders && getOrderStatus(r) === 'unpacked');
  const currentlyPacking = rows.filter(r => getOrderStatus(r) === 'packing');
  const recentlyPacked = rows.filter(r => r.order_status !== 'wc-pre-ordered' && getOrderStatus(r) === 'packed');
  const packingUserGroups = groupPackingOrdersByUser(currentlyPacking, currentUser);
  const readyToPackContext = buildQueueContext(readyToPack);
  const readyToPackGroups = buildQueueGroups(readyToPack, readyToPackContext);

  const renderOrderCard = (order: any, queueContext?: QueueContext) => {
    const isExpanded = expandedOrders[order.order_id];
    const currentStatus = getOrderStatus(order);
    const packedBy = order.packed_by;
    const orderDocuments = getOrderDocumentTemplates(order);
    const packingFirstName = getPackingFirstName(order);
    const firstNameKey = normaliseFirstNameKey(packingFirstName);
    const hasDuplicateFirstName = !!firstNameKey && !!queueContext?.duplicateFirstNameKeys?.has(firstNameKey);
    const customerKey = getCustomerMatchKey(order);
    const sameCustomerOrders = customerKey && queueContext ? queueContext.customerGroups.get(customerKey) || [] : [];
    const orderCrmNotes = getOrderCrmNotes(order);
    const orderCrmProfile = getOrderCrmProfile(order);
    const canChangePackingStatus = currentStatus !== "packing"
      || String(packedBy || "").toLowerCase() === currentUser.toLowerCase();

    let borderColor = 'divider';
    if (currentStatus === 'packed') borderColor = 'success.main';
    if (currentStatus === 'packing') borderColor = 'warning.main';
    return (
      <Card key={order.order_id} variant="outlined" sx={{ mb: 2, borderColor }}>
        <Box onClick={() => toggleOrder(order.order_id)} sx={{ cursor: 'pointer' }}>
          <CardContent sx={{ pb: 1 }}>
            <Grid container spacing={1} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Order #{order.order_id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(order.order_date).toLocaleDateString("en-AU")} • {order.customer_name}
                    {order.is_first_order && (
                      <Chip 
                        size="small" 
                        label="1st Order" 
                        color="secondary" 
                        sx={{ ml: 1, height: '20px', fontSize: '0.7rem' }} 
                      />
                    )}
                  </Typography>
                  {hasDuplicateFirstName && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                      Warning! There is more than one {packingFirstName} in this queue!
                    </Alert>
                  )}
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label="Woo"
                      component="a"
                      href={`https://naturalyield.com.au/wp-admin/admin.php?page=wc-orders&action=edit&id=${order.order_id}`}
                      target="_blank"
                      clickable
                      onClick={(e) => e.stopPropagation()}
                      sx={{ cursor: 'pointer' }}
                    />
                    {orderDocuments.length > 0 && (
                      <Typography variant="caption" fontWeight={700}>
                        Documents:
                      </Typography>
                    )}
                    {orderDocuments.map(template => (
                      <Stack key={template.id} direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          variant="outlined"
                          href={template.google_drive_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {template.name}
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={(event) => handleQueueDocumentPrint(order, template, event)}
                          disabled={!!documentPrintSaving[`${order.order_id}:${template.id}`]}
                        >
                          Print
                        </Button>
                      </Stack>
                    ))}
                    {orderCrmNotes.length > 0 && (
                      <Chip
                        size="small"
                        label={`CRM notes: ${orderCrmNotes.length}`}
                        color="warning"
                      />
                    )}
                  </Stack>
                  {documentTemplateError && (
                    <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                      {documentTemplateError}
                    </Typography>
                  )}
                  {documentPrintMessage && (
                    <Alert severity={documentPrintMessage.type} sx={{ mt: 1, py: 0 }}>
                      {documentPrintMessage.text}
                    </Alert>
                  )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <Chip size="small" label={`Sub: ${formatCurrency(order.order_total - (order.shipping_total || 0))}`} variant="outlined" />
                  <Chip size="small" label={`Ship: ${formatCurrency(order.shipping_total || 0)}`} variant="outlined" />
                  <Chip size="small" label={`Tot: ${formatCurrency(order.order_total)}`} variant="outlined" color="primary" />
                  {order.courier_allocation && (
                    <Chip size="small" label={order.courier_allocation} color="primary" variant="outlined" />
                  )}
                  {currentStatus === 'packed' && (
                    <Chip size="small" icon={<CheckCircleOutline />} label={`Packed by ${packedBy || 'You'}`} color="success" />
                  )}
                  {currentStatus === 'unpacked' && packedBy && (
                    <Chip size="small" label={`Unpacked by ${packedBy}`} variant="outlined" />
                  )}
                  {sameCustomerOrders.length > 1 && (
                    <Chip
                      size="small"
                      label={`Same customer: ${sameCustomerOrders.length} orders`}
                      color="info"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Box>

        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Divider />
          <CardContent sx={{ bgcolor: 'background.default', pt: 1, pb: 1 }}>
            {crmNotesError && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', mb: 1 }}>
                {crmNotesError}
              </Typography>
            )}
            {crmProfilesError && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', mb: 1 }}>
                {crmProfilesError}
              </Typography>
            )}
            {orderCrmNotes.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'block', mb: 0.75 }}>
                  CRM
                </Typography>
                <Stack spacing={1} sx={{ p: 1.25, border: 1, borderColor: "warning.main", borderRadius: 1, bgcolor: "background.paper" }}>
                  {((orderCrmProfile?.flags ?? []).length > 0 || (orderCrmProfile?.tags ?? []).length > 0) && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {(orderCrmProfile?.flags ?? []).map(flag => (
                        <Chip key={`crm-section-flag:${order.order_id}:${flag}`} size="small" label={flag} color="warning" variant="outlined" />
                      ))}
                      {(orderCrmProfile?.tags ?? []).map(tag => (
                        <Chip key={`crm-section-tag:${order.order_id}:${tag}`} size="small" label={tag} color="info" variant="outlined" />
                      ))}
                    </Stack>
                  )}
                  {orderCrmProfile?.preferred_handling_notes && (
                    <Alert severity="info" sx={{ py: 0 }}>
                      <Typography variant="caption" fontWeight="bold" sx={{ display: "block" }}>
                        Preferred Handling:
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {orderCrmProfile.preferred_handling_notes}
                      </Typography>
                    </Alert>
                  )}
                  {orderCrmNotes.map(note => (
                    <Alert key={note.id} severity="warning" sx={{ py: 0 }}>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {note.note_content}
                      </Typography>
                      {note.reminder_date ? (
                        <Typography variant="caption" color="text.secondary">
                          Reminder {new Date(note.reminder_date).toLocaleDateString("en-AU")}
                        </Typography>
                      ) : null}
                    </Alert>
                  ))}
                </Stack>
              </Box>
            )}
            {order.lines && order.lines.map((line: any, idx: number) => {
              const isParentBundle = !!line.is_bundle_parent || (!!line.bundle_cart_key && !line.bundled_by);
              const isChildItem = !!line.bundled_by;
              const key = lineKey(order.order_id, line.order_item_id);
              const stockOverride = stockOverrides[key];
              const reportedStockQty = stockOverride?.stock_qty ?? line.reported_stock_qty ?? line.stock_qty;
              const reservedUnpackedQty = Number(line.reserved_unpacked_qty ?? 0);
              const adjustedStockQty = stockOverride
                ? Number(stockOverride.stock_qty ?? 0) + reservedUnpackedQty
                : line.adjusted_stock_qty ?? (Number(reportedStockQty ?? 0) + reservedUnpackedQty);
              const stockStatus = stockOverride?.stock_status ?? line.stock_status;
              const stockTargetType = stockOverride?.stock_target_type ?? line.stock_target_type;
              const stockInputValue = stockInputs[key] ?? (reportedStockQty ?? "");
              const stockMessage = stockMessages[key];
              const managesStock = stockTargetType === "wsvi" || line.stock_manage_stock !== false;
              const canUpdateStock = !isParentBundle && !!line.order_item_id && managesStock;
              const stockFieldColor = getStockFieldColor(stockStatus, reportedStockQty);
              return (
                <Box key={idx} sx={{ 
                  mb: 1, 
                  pb: 1, 
                  borderBottom: idx < order.lines.length - 1 ? '1px dashed' : 'none', 
                  borderColor: 'divider',
                  ml: isChildItem ? 4 : 0,
                  pl: isChildItem ? 1 : 0,
                  borderLeft: isChildItem ? '2px solid' : 'none',
                  borderLeftColor: 'primary.light',
                  bgcolor: isParentBundle ? 'action.hover' : 'transparent',
                  borderRadius: isParentBundle ? 1 : 0,
                  p: isParentBundle ? 1 : 0
                }}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={12}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "minmax(0, 1fr)",
                            sm: "minmax(0, 1fr) 120px",
                          },
                          columnGap: 1,
                          rowGap: 1,
                          alignItems: "start",
                        }}
                      >
                        <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                          <PackingLineDetails
                            description={line.product_name || line.category || ""}
                            quantity={line.qty}
                            sku={line.sku || ""}
                            skuActions={(
                              <>
                                {isParentBundle && (
                                  <Chip size="small" label="Bundle" color="primary" variant="outlined" sx={{ height: '20px', fontSize: '0.7rem' }} />
                                )}
                                <Chip
                                  size="small"
                                  label="Woo"
                                  component="a"
                                  href={`https://naturalyield.com.au/wp-admin/post.php?post=${getLineWooProductAdminId(line, stockOverride)}&action=edit`}
                                  target="_blank"
                                  clickable
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{ cursor: 'pointer', height: '20px', fontSize: '0.7rem' }}
                                />
                              </>
                            )}
                          />
                        </Box>
                        {canUpdateStock && (
                          <TextField
                            size="small"
                            label="Stock / Adj"
                            value={`${reportedStockQty ?? "-"} / ${adjustedStockQty ?? "-"}`}
                            inputProps={{ readOnly: true }}
                            onClick={(event) => handleStockOpen(key, event.currentTarget, reportedStockQty, event)}
                            sx={{
                              width: 120,
                              cursor: "pointer",
                              "& .MuiInputBase-root": {
                                height: 34,
                                bgcolor: stockFieldColor.bgcolor,
                                color: stockFieldColor.color,
                                cursor: "pointer"
                              },
                              "& input, & .MuiOutlinedInput-input": {
                                cursor: "pointer",
                                textAlign: "center",
                                p: "6px 8px"
                              },
                              "& .MuiInputLabel-root": {
                                bgcolor: "background.paper",
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 0.75,
                                color: "text.primary",
                                fontWeight: 700,
                                maxWidth: "none",
                                minWidth: "max-content",
                                overflow: "visible",
                                px: 0.5
                              }
                            }}
                          />
                        )}
                        {!isParentBundle && !managesStock && (
                          <Chip
                            size="small"
                            label="Stock not managed"
                            variant="outlined"
                            color="default"
                            sx={{
                              gridColumn: { xs: "1 / -1", sm: "2" },
                              justifySelf: "start",
                              height: 24,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                            }}
                          />
                        )}
                      </Box>
                      {isParentBundle ? (
                        <Chip size="small" label="Bundle parent - stock on child SKUs" variant="outlined" sx={{ mt: 0.75, height: 20, fontSize: '0.7rem' }} />
                      ) : !managesStock ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                          Woo stock management is not enabled for this product.
                        </Typography>
                      ) : (
                        <Popover
                          open={stockPopover?.key === key}
                          anchorEl={stockPopover?.key === key ? stockPopover.anchorEl : null}
                          onClose={() => handleStockClose(key, reportedStockQty)}
                          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                          transformOrigin={{ vertical: "top", horizontal: "right" }}
                        >
                          <Box sx={{ p: 2, width: 280 }} onClick={(e) => e.stopPropagation()}>
                            <Stack spacing={1.5}>
                              <Typography variant="subtitle2">Update Stock</Typography>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Chip 
                                  size="small" 
                                  label={stockStatus || "unknown"} 
                                  color={
                                    stockStatus === 'instock' ? 'success' : 
                                    stockStatus === 'onbackorder' ? 'warning' : 
                                    stockStatus === 'outofstock' ? 'error' : 'default'
                                  }
                                />
                                <Chip size="small" label={getStockTargetLabel(stockTargetType)} variant="outlined" />
                              </Stack>
                              <Stack direction="row" spacing={1}>
                                <TextField
                                  size="small"
                                  label="Stock"
                                  type="number"
                                  value={reportedStockQty ?? ""}
                                  inputProps={{ readOnly: true }}
                                  sx={{ flex: 1 }}
                                />
                                <TextField
                                  size="small"
                                  label="Adjusted"
                                  type="number"
                                  value={adjustedStockQty ?? ""}
                                  inputProps={{ readOnly: true }}
                                  sx={{ flex: 1 }}
                                />
                              </Stack>
                              <TextField
                                size="small"
                                label="Update Stock"
                                type="number"
                                value={stockInputValue}
                                inputProps={{ min: 0, step: "any" }}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setStockInputs(prev => ({ ...prev, [key]: nextValue }));
                                }}
                                fullWidth
                              />
                              {stockMessage && (
                                <Typography variant="caption" color={stockMessage.type === "error" ? "error.main" : "success.main"}>
                                  {stockMessage.text}
                                </Typography>
                              )}
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <IconButton
                                  size="small"
                                  aria-label="Close stock editor"
                                  onClick={() => handleStockClose(key, reportedStockQty)}
                                  disabled={!!stockSaving[key]}
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  aria-label="Save stock"
                                  onClick={(event) => handleStockSave(order, line, event)}
                                  disabled={!!stockSaving[key]}
                                  sx={{
                                    border: 1,
                                    borderColor: 'primary.main',
                                    height: 34,
                                    width: 34
                                  }}
                                >
                                  <Check fontSize="small" />
                                </IconButton>
                              </Stack>
                            </Stack>
                          </Box>
                        </Popover>
                      )}
                    </Grid>
                  </Grid>
                </Box>
              );
            })}
          </CardContent>
        </Collapse>

        <Divider />
        <CardActions sx={{ justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              setDimensionsOrder(order);
            }}
          >
            L W H
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              setCrmOrder(order);
            }}
          >
            CRM
          </Button>
          {currentStatus === 'unpacked' && (
            <>
              <Button size="small" variant="outlined" color="warning" onClick={(e) => handlePack(order.order_id, 'packing', e)} disabled={!!packingSaving[order.order_id]}>
                Pack
              </Button>
              <Button size="small" variant="contained" color="success" onClick={(e) => handlePack(order.order_id, 'packed', e)} disabled={!!packingSaving[order.order_id]}>
                Packed
              </Button>
            </>
          )}
          {currentStatus === 'packing' && (
            <>
              <Button size="small" variant="outlined" color="inherit" onClick={(e) => handlePack(order.order_id, 'unpacked', e)} disabled={!!packingSaving[order.order_id] || !canChangePackingStatus}>
                Unpack
              </Button>
              <Button size="small" variant="contained" color="success" onClick={(e) => handlePack(order.order_id, 'packed', e)} disabled={!!packingSaving[order.order_id] || !canChangePackingStatus}>
                Packed
              </Button>
            </>
          )}
          {currentStatus === 'packed' && (
            <>
              <Button size="small" variant="outlined" color="inherit" onClick={(e) => handlePack(order.order_id, 'unpacked', e)} disabled={!!packingSaving[order.order_id]}>
                Unpack
              </Button>
              <Button size="small" variant="outlined" color="warning" onClick={(e) => handlePack(order.order_id, 'packing', e)} disabled={!!packingSaving[order.order_id]}>
                Pack
              </Button>
            </>
          )}
        </CardActions>
      </Card>
    );
  };

  const renderReadyToPackOrders = () => {
    return readyToPackGroups.map(group => {
      if (!group.sameCustomer) {
        return renderOrderCard(group.orders[0], readyToPackContext);
      }

      const firstOrder = group.orders[0];
      const orderIds = group.orders.map(order => `#${order.order_id}`).join(", ");
      return (
        <Box
          key={group.key}
          sx={{
            mb: 2,
            p: 1,
            border: 2,
            borderColor: "info.main",
            borderRadius: 2,
            bgcolor: "background.default",
          }}
        >
          <Alert severity="info" sx={{ mb: 1 }}>
            Same customer group: {firstOrder.customer_name} has {group.orders.length} orders in Ready to Pack ({orderIds})
          </Alert>
          {group.orders.map(order => renderOrderCard(order, readyToPackContext))}
        </Box>
      );
    });
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Packing Team
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage orders ready for fulfillment.
        </Typography>
      </Box>

      <LoadStateBlock
        isLoading={isLoading}
        error={rows.length === 0 ? error : null}
        empty={!isLoading && !error && rows.length === 0}
      />
      {packingActionError && (
        <Alert severity="error" onClose={() => setPackingActionError(null)}>
          {packingActionError}
        </Alert>
      )}
      {error && rows.length > 0 && (
        <Alert severity="warning">
          Live packing refresh failed. Existing orders remain visible while synchronization retries.
        </Alert>
      )}

      {!isLoading && rows.length > 0 && (
        <>
          {packingUserGroups.map(group => (
            <Box
              key={group.username}
              sx={{
                p: 1.25,
                border: 2,
                borderColor: group.isCurrentUser ? "primary.main" : "warning.main",
                borderRadius: 2,
                bgcolor: group.isCurrentUser ? "action.selected" : "background.default",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" color="warning.dark">
                  Being packed by
                </Typography>
                <Chip
                  label={group.username}
                  color={group.isCurrentUser ? "primary" : "warning"}
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
              {group.orders.map(order => renderOrderCard(order))}
            </Box>
          ))}

          <Box>
            <Typography variant="h6" color="success.main" gutterBottom>
              Ready to Pack ({readyToPack.length})
            </Typography>
            {readyToPack.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No orders currently ready to pack.</Typography>
            ) : (
              renderReadyToPackOrders()
            )}
          </Box>

          <Box>
            <Typography variant="h6" color="warning.main" gutterBottom>
              Awaiting Stock ({awaitingStock.length})
            </Typography>
            {awaitingStock.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No orders waiting on backordered items.</Typography>
            ) : (
              awaitingStock.map(order => renderOrderCard(order))
            )}
          </Box>

          {preOrders.length > 0 && (
            <Box>
              <Typography variant="h6" color="secondary.main" gutterBottom>
                Pre Orders ({preOrders.length})
              </Typography>
              {preOrders.map(order => renderOrderCard(order))}
            </Box>
          )}

          {recentlyPacked.length > 0 && (
            <Box>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Recently Packed ({recentlyPacked.length})
              </Typography>
              {recentlyPacked.map(order => renderOrderCard(order))}
            </Box>
          )}
        </>
      )}
      <Dialog open={!!crmOrder} onClose={() => setCrmOrder(null)} fullWidth maxWidth="lg">
        <DialogTitle>
          Customer CRM{crmOrder ? ` - ${crmOrder.customer_name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {crmOrder ? (
            <CustomerCrmPanel
              {...getOrderCrmIdentity(crmOrder)}
              customerName={String(crmOrder.customer_name || "")}
              orderId={Number(crmOrder.order_id)}
              defaultTriggerEvent="packing_order"
              onChanged={() => {
                loadCrmNotes();
                loadCrmProfiles();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <PackingDimensionsDialog
        open={!!dimensionsOrder}
        order={dimensionsOrder}
        onClose={() => setDimensionsOrder(null)}
      />
    </Stack>
  );
}

export default PackingPage;