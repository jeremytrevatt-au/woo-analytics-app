import { Box } from "@mui/material";
import { Route, Routes } from "react-router-dom";
import ApiDebugPanel from "./components/ApiDebugPanel";
import DashboardLayout from "./components/DashboardLayout";
import FiltersProvider from "./components/FiltersProvider";
import CustomersPage from "./pages/CustomersPage";
import RevenuePage from "./pages/RevenuePage";
import OverviewPage from "./pages/OverviewPage";
import OrdersPage from "./pages/OrdersPage";
import StockPage from "./pages/StockPage";
import BackordersPage from "./pages/BackordersPage";
import PackingPage from "./pages/PackingPage";
import AdminPage from "./pages/AdminPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";

import SuppliersPage from "./pages/SuppliersPage";

function App() {
  return (
    <FiltersProvider>
      <Box sx={{ minHeight: "100vh" }}>
        <DashboardLayout>
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="/backorders" element={<BackordersPage />} />
              <Route path="/packing" element={<PackingPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
        </DashboardLayout>
        <ApiDebugPanel />
      </Box>
    </FiltersProvider>
  );
}

export default App;
