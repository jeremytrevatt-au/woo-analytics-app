import { Box } from "@mui/material";
import { Route, Routes } from "react-router-dom";
import ApiDebugPanel from "./components/ApiDebugPanel";
import DashboardLayout from "./components/DashboardLayout";
import FiltersProvider from "./components/FiltersProvider";
import CustomersPage from "./pages/CustomersPage";
import ForecastPage from "./pages/ForecastPage";
import OverviewPage from "./pages/OverviewPage";
import OrdersPage from "./pages/OrdersPage";
import StockPage from "./pages/StockPage";

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
            <Route path="/forecast" element={<ForecastPage />} />
          </Routes>
        </DashboardLayout>
        <ApiDebugPanel />
      </Box>
    </FiltersProvider>
  );
}

export default App;
