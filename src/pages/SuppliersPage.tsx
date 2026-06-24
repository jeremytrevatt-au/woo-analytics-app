import { useState, useEffect } from "react";
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, CircularProgress } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Supplier, suppliersApi } from "../api/suppliersApi";
import SupplierModal from "../components/SupplierModal";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await suppliersApi.getAll();
      setSuppliers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleAdd = () => {
    setSelectedSupplier(null);
    setModalOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await suppliersApi.delete(id);
      await loadSuppliers();
    } catch (err: any) {
      alert("Failed to delete supplier: " + err.message);
    }
  };

  const handleModalClose = (saved: boolean) => {
    setModalOpen(false);
    if (saved) {
      loadSuppliers();
    }
  };

  if (loading && suppliers.length === 0) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Suppliers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          New Supplier
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Contact Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Default Currency</TableCell>
              <TableCell>Lead Time (Days)</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">No suppliers found.</TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id} hover>
                  <TableCell>{supplier.name}</TableCell>
                  <TableCell>{supplier.contact_name}</TableCell>
                  <TableCell>{supplier.email}</TableCell>
                  <TableCell>{supplier.default_currency}</TableCell>
                  <TableCell>{supplier.default_lead_time_days}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEdit(supplier)} color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(supplier.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <SupplierModal 
        open={modalOpen} 
        onClose={handleModalClose} 
        supplier={selectedSupplier} 
      />
    </Box>
  );
}
