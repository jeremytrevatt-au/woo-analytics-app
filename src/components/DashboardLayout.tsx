import { AppBar, Box, Container, Stack, Toolbar, Typography, IconButton, Drawer, List, ListItem, ListItemButton, ListItemText, Divider } from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import MenuIcon from "@mui/icons-material/Menu";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import FilterBar from "./FilterBar";

type Props = {
  children: React.ReactNode;
};

const navItems = [
  { label: "Overview", to: "/" },
  { label: "Orders", to: "/orders" },
  { label: "Customers", to: "/customers" },
  { label: "Stock", to: "/stock" },
  { label: "Revenue", to: "/revenue" },
  { label: "Backorders", to: "/backorders" },
  { label: "Packing Team", to: "/packing" },
  { label: "Purchase Orders", to: "/purchase-orders" },
  { label: "Suppliers", to: "/suppliers" },
  { label: "Admin", to: "/admin" }
];

function DashboardLayout({ children }: Props) {
  const location = useLocation();
  const isPackingPage = location.pathname === "/packing";
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ my: 2 }}>
        <TimelineIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          NYA
        </Typography>
      </Stack>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={NavLink}
              to={item.to}
              sx={{
                textAlign: 'left',
                "&.active": {
                  color: "primary.main",
                  fontWeight: 700,
                  bgcolor: "action.selected"
                }
              }}
            >
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 'inherit' }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <TimelineIcon color="primary" sx={{ display: { xs: 'none', sm: 'block' } }} />
            <Typography variant="h6" fontWeight={700}>
              Natural Yield Analytics
            </Typography>
          </Stack>
        </Toolbar>
      </AppBar>

      <nav>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: 'block',
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
          }}
        >
          {drawer}
        </Drawer>
      </nav>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <FilterBar />
        <Box sx={{ mt: 3 }}>{children}</Box>
      </Container>
    </Box>
  );
}

export default DashboardLayout;
