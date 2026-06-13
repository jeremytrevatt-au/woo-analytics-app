import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import { NavLink } from "react-router-dom";
import FilterBar from "./FilterBar";

type Props = {
  children: React.ReactNode;
};

const navItems = [
  { label: "Overview", to: "/" },
  { label: "Orders", to: "/orders" },
  { label: "Customers", to: "/customers" },
  { label: "Stock", to: "/stock" },
  { label: "Forecast", to: "/forecast" }
];

function DashboardLayout({ children }: Props) {
  return (
    <Box>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <TimelineIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Natural Yield Analytics
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            {navItems.map((item) => (
              <Button
                key={item.to}
                component={NavLink}
                to={item.to}
                color="inherit"
                sx={{
                  "&.active": {
                    color: "primary.main",
                    fontWeight: 700
                  }
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <FilterBar />
        <Box sx={{ mt: 3 }}>{children}</Box>
      </Container>
    </Box>
  );
}

export default DashboardLayout;
