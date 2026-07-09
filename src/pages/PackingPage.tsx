import { Stack, Typography, Grid, Box, Chip, Card, CardContent, CardActions, Button, Collapse, Divider, TextField, IconButton, Popover } from "@mui/material";
import { useState } from "react";
import { Check, CheckCircleOutline, Close } from "@mui/icons-material";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatCurrency } from "../lib/format";
import { markOrderPacked, updatePackingLineStock } from "../api/analyticsApi";
import type { PackingStockQuantityResponse } from "../api/analyticsApi";

function PackingPage() {
  const [page, setPage] = useState(1);
  const { rows, isLoading, error, refetch } = useDashboardData("packing", page, 100);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [packingState, setPackingState] = useState<Record<string, { status: string, user: string }>>({}); // optimistic UI updates
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({});
  const [stockMessages, setStockMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [stockOverrides, setStockOverrides] = useState<Record<string, PackingStockQuantityResponse>>({});
  const [stockPopover, setStockPopover] = useState<{ key: string; anchorEl: HTMLElement } | null>(null);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handlePack = async (orderId: number, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic update
    setPackingState(prev => ({ ...prev, [orderId]: { status, user: "You" } }));
    try {
      const res = await markOrderPacked(orderId, status);
      if (res.success) {
        // Update with actual user if available
        setPackingState(prev => ({ ...prev, [orderId]: { status, user: res.packed_by || "You" } }));
        // Refetch to get updated list
        refetch();
      } else {
        // Revert on failure
        setPackingState(prev => {
          const newState = { ...prev };
          delete newState[orderId];
          return newState;
        });
        alert(`Failed to mark as ${status}: ` + res.message);
      }
    } catch (err: any) {
      setPackingState(prev => {
        const newState = { ...prev };
        delete newState[orderId];
        return newState;
      });
      alert(`Failed to mark as ${status}: ` + err.message);
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

  const getCompactFieldWidth = (label: string, value: any) => {
    const valueLength = String(value ?? "").length;
    return `${Math.max(valueLength + 5, label.length + 4)}ch`;
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
    if (packingState[order.order_id]) return packingState[order.order_id].status;
    return order.status || 'unpacked';
  };

  const preOrders = rows.filter(r => r.order_status === 'wc-pre-ordered');
  const readyToPack = rows.filter(r => r.order_status !== 'wc-pre-ordered' && !r.has_backorders && getOrderStatus(r) === 'unpacked');
  const awaitingStock = rows.filter(r => r.order_status !== 'wc-pre-ordered' && r.has_backorders && getOrderStatus(r) === 'unpacked');
  const currentlyPacking = rows.filter(r => r.order_status !== 'wc-pre-ordered' && getOrderStatus(r) === 'packing');
  const recentlyPacked = rows.filter(r => r.order_status !== 'wc-pre-ordered' && getOrderStatus(r) === 'packed');

  const renderOrderCard = (order: any) => {
    const isExpanded = expandedOrders[order.order_id];
    const currentStatus = getOrderStatus(order);
    const packedBy = packingState[order.order_id] ? packingState[order.order_id].user : order.packed_by;

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
                  <Box sx={{ mt: 0.5 }}>
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
                </Box>
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
                  {currentStatus === 'packing' && (
                    <Chip size="small" label={`Being Packed by ${packedBy || 'You'}`} color="warning" />
                  )}
                  {currentStatus === 'unpacked' && packedBy && (
                    <Chip size="small" label={`Unpacked by ${packedBy}`} variant="outlined" />
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Box>

        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Divider />
          <CardContent sx={{ bgcolor: 'background.default', pt: 1, pb: 1 }}>
            <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>Items to Pack:</Typography>
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
              const canUpdateStock = !isParentBundle && !!line.order_item_id;
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
                      <Typography variant="body2" fontWeight="bold">
                        {line.qty}x {line.sku}
                        {isParentBundle && (
                          <Chip size="small" label="Bundle" color="primary" variant="outlined" sx={{ ml: 1, height: '20px', fontSize: '0.7rem' }} />
                        )}
                        <Chip 
                          size="small" 
                          label="Woo" 
                          component="a" 
                          href={`https://naturalyield.com.au/wp-admin/post.php?post=${stockOverride?.stock_target_product_id ?? line.stock_target_product_id ?? line.product_id}&action=edit`} 
                          target="_blank" 
                          clickable 
                          onClick={(e) => e.stopPropagation()} 
                          sx={{ cursor: 'pointer', ml: 1, height: '20px', fontSize: '0.7rem' }}
                        />
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, flex: 1 }}>
                          {line.product_name || line.category}
                        </Typography>
                        {canUpdateStock && (
                          <TextField
                            size="small"
                            label="Stock"
                            type="number"
                            value={reportedStockQty ?? ""}
                            inputProps={{ readOnly: true }}
                            onClick={(event) => handleStockOpen(key, event.currentTarget, reportedStockQty, event)}
                            sx={{
                              width: getCompactFieldWidth("Stock", reportedStockQty),
                              flexShrink: 0,
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
                        {canUpdateStock && (
                          <TextField
                            size="small"
                            label="Adjusted"
                            type="number"
                            value={adjustedStockQty ?? ""}
                            inputProps={{ readOnly: true }}
                            sx={{
                              width: getCompactFieldWidth("Adjusted", adjustedStockQty),
                              flexShrink: 0,
                              "& .MuiInputBase-root": {
                                height: 34,
                                bgcolor: "background.paper"
                              },
                              "& input, & .MuiOutlinedInput-input": {
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
                      </Stack>
                      {isParentBundle ? (
                        <Chip size="small" label="Bundle parent - stock on child SKUs" variant="outlined" sx={{ mt: 0.75, height: 20, fontSize: '0.7rem' }} />
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
          {currentStatus === 'unpacked' && (
            <>
              <Button size="small" variant="outlined" color="warning" onClick={(e) => handlePack(order.order_id, 'packing', e)}>
                Mark as Packing
              </Button>
              <Button size="small" variant="contained" color="success" onClick={(e) => handlePack(order.order_id, 'packed', e)}>
                Mark as Packed
              </Button>
            </>
          )}
          {currentStatus === 'packing' && (
            <>
              <Button size="small" variant="outlined" color="inherit" onClick={(e) => handlePack(order.order_id, 'unpacked', e)}>
                Mark as Unpacked
              </Button>
              <Button size="small" variant="contained" color="success" onClick={(e) => handlePack(order.order_id, 'packed', e)}>
                Mark as Packed
              </Button>
            </>
          )}
          {currentStatus === 'packed' && (
            <>
              <Button size="small" variant="outlined" color="inherit" onClick={(e) => handlePack(order.order_id, 'unpacked', e)}>
                Mark as Unpacked
              </Button>
              <Button size="small" variant="outlined" color="warning" onClick={(e) => handlePack(order.order_id, 'packing', e)}>
                Mark as Packing
              </Button>
            </>
          )}
        </CardActions>
      </Card>
    );
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

      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />

      {!isLoading && !error && (
        <>
          <Box>
            <Typography variant="h6" color="success.main" gutterBottom>
              Ready to Pack ({readyToPack.length})
            </Typography>
            {readyToPack.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No orders currently ready to pack.</Typography>
            ) : (
              readyToPack.map(renderOrderCard)
            )}
          </Box>

          <Box>
            <Typography variant="h6" color="warning.main" gutterBottom>
              Awaiting Stock ({awaitingStock.length})
            </Typography>
            {awaitingStock.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No orders waiting on backordered items.</Typography>
            ) : (
              awaitingStock.map(renderOrderCard)
            )}
          </Box>

          {preOrders.length > 0 && (
            <Box>
              <Typography variant="h6" color="secondary.main" gutterBottom>
                Pre Orders ({preOrders.length})
              </Typography>
              {preOrders.map(renderOrderCard)}
            </Box>
          )}

          {currentlyPacking.length > 0 && (
            <Box>
              <Typography variant="h6" color="warning.dark" gutterBottom>
                Currently Packing ({currentlyPacking.length})
              </Typography>
              {currentlyPacking.map(renderOrderCard)}
            </Box>
          )}

          {recentlyPacked.length > 0 && (
            <Box>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Recently Packed ({recentlyPacked.length})
              </Typography>
              {recentlyPacked.map(renderOrderCard)}
            </Box>
          )}
        </>
      )}
    </Stack>
  );
}

export default PackingPage;