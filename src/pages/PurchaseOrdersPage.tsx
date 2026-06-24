import { useState } from "react";
import { Stack, Typography, Button, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { usePurchaseOrders } from "../hooks/usePurchaseOrders";
import { purchaseOrdersApi, PurchaseOrder } from "../api/purchaseOrdersApi";
import LoadStateBlock from "../components/LoadStateBlock";
import PurchaseOrderModal from "../components/PurchaseOrderModal";

function PurchaseOrdersPage() {
  const { data, loading, error, refetch } = usePurchaseOrders();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  const handleCreate = () => {
    setSelectedPo(null);
    setModalOpen(true);
  };

  const handleEdit = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this purchase order?")) {
      try {
        await purchaseOrdersApi.delete(id);
        refetch();
      } catch (err) {
        console.error(err);
        alert("Failed to delete purchase order");
      }
    }
  };

  const handleModalClose = (saved: boolean) => {
    setModalOpen(false);
    if (saved) {
      refetch();
    }
  };

  if (loading) return <LoadStateBlock isLoading={true} />;
  if (error) return <LoadStateBlock isLoading={false} error={error} />;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Purchase Orders</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Create PO
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>PO Number</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created Date</TableCell>
              <TableCell>ETA Date</TableCell>
              <TableCell>Shipping Type</TableCell>
              <TableCell>Total Cost (AUD)</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((po) => (
              <TableRow key={po.id}>
                <TableCell>{po.po_number}</TableCell>
                <TableCell>
                  <Chip size="small" label={po.status} color={po.status === 'ordered' ? 'primary' : po.status === 'shipped' ? 'info' : 'default'} />
                </TableCell>
                <TableCell>{new Date(po.created_date).toLocaleDateString()}</TableCell>
                <TableCell>{po.eta_date ? new Date(po.eta_date).toLocaleDateString() : '-'}</TableCell>
                <TableCell>{po.shipping_type || '-'}</TableCell>
                <TableCell>${Number(po.total_cost_aud || 0).toFixed(2)}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleEdit(po)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(po.id!)} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">No purchase orders found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {modalOpen && (
        <PurchaseOrderModal
          open={modalOpen}
          onClose={handleModalClose}
          po={selectedPo}
        />
      )}
    </Stack>
  );
}

export default PurchaseOrdersPage;
