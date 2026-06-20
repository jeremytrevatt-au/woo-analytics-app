import { Stack, Typography, Grid, Box, Chip, Card, CardContent, CardActions, Button, Collapse, Divider } from "@mui/material";
import { useState } from "react";
import { CheckCircleOutline } from "@mui/icons-material";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatCurrency } from "../lib/format";
import { markOrderPacked } from "../api/analyticsApi";

function PackingPage() {
  const [page, setPage] = useState(1);
  const { rows, isLoading, error, refetch } = useDashboardData("packing", page, 100);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [packingState, setPackingState] = useState<Record<string, { status: string, user: string }>>({}); // optimistic UI updates

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

  // Group orders
  const getOrderStatus = (order: any) => {
    if (packingState[order.order_id]) return packingState[order.order_id].status;
    return order.status || 'unpacked';
  };

  const readyToPack = rows.filter(r => !r.has_backorders && getOrderStatus(r) === 'unpacked');
  const awaitingStock = rows.filter(r => r.has_backorders && getOrderStatus(r) === 'unpacked');
  const currentlyPacking = rows.filter(r => getOrderStatus(r) === 'packing');
  const recentlyPacked = rows.filter(r => getOrderStatus(r) === 'packed');

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
                </Typography>
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
            {order.lines && order.lines.map((line: any, idx: number) => (
              <Box key={idx} sx={{ mb: 1, pb: 1, borderBottom: idx < order.lines.length - 1 ? '1px dashed' : 'none', borderColor: 'divider' }}>
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={8} sm={9}>
                    <Typography variant="body2" fontWeight="bold">
                      {line.qty}x {line.sku}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {line.product_name || line.category}
                    </Typography>
                  </Grid>
                  <Grid item xs={4} sm={3} textAlign="right">
                    <Chip 
                      size="small" 
                      label={line.stock_status} 
                      color={
                        line.stock_status === 'instock' ? 'success' : 
                        line.stock_status === 'onbackorder' ? 'warning' : 
                        line.stock_status === 'outofstock' ? 'error' : 'default'
                      }
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
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