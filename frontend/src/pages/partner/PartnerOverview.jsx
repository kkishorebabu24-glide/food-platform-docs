import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Box, Grid, Card, CardContent, Typography, Button, Chip } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import StarIcon from '@mui/icons-material/Star';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import { ordersAPI, getErrorMessage } from '../../services/api';

const SLOT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

export default function PartnerOverview() {
  const context = useOutletContext() || {};
  const {
    sellerProfile,
    orders = [],
    menuItems = [],
    balance = { current_balance: 0, total_earned: 0 },
    maintenanceStatus,
    setOrders,
    setActionSuccess,
    setError,
    handleOpenCreateMenu,
    setOpenTopupDialog,
  } = context;

  // Active / Urgent Orders (placed, accepted, preparing, ready)
  const activeOrders = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');

  // Compute batch counts per slot
  const preorders = orders.filter((o) => o.is_preorder && o.status !== 'cancelled');
  const slotBatchCounts = preorders.reduce((acc, o) => {
    const slot = o.delivery_slot || 'unassigned';
    const totalItems = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
    acc[slot] = (acc[slot] || 0) + totalItems;
    return acc;
  }, {});

  const handleAdvanceOrderStatus = async (orderId, currentStatus) => {
    let nextStatus = 'accepted';
    if (currentStatus === 'pending') nextStatus = 'accepted';
    else if (currentStatus === 'accepted') nextStatus = 'ready';
    else if (currentStatus === 'ready') nextStatus = 'completed';

    try {
      await ordersAPI.updateStatus(orderId, nextStatus);
      setOrders?.((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      setActionSuccess?.(`Order #${orderId} marked as ${nextStatus.toUpperCase()}! 🚀`);
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to update order status.'));
    }
  };

  return (
    <Box>
      {/* Top Quick KPI Strip */}
      <Grid container spacing={2.5} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Revenue Earned
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="#2EC4B6" mt={0.5}>
                ₹{balance?.total_earned?.toLocaleString() || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Direct UPI + In-app payouts
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Active Orders Now
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="#E05A2B" mt={0.5}>
                {activeOrders.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {orders.length} total orders lifetime
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Customer Rating
              </Typography>
              <Box display="flex" alignItems="center" gap={0.8} mt={0.5}>
                <Typography variant="h4" fontWeight="bold" color="#F6BD60">
                  {sellerProfile?.punctuality_rating?.toFixed(1) || '4.9'}
                </Typography>
                <StarIcon sx={{ color: '#F6BD60', fontSize: 28 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {sellerProfile?.total_orders_completed ||
                  orders.filter((o) => o.status === 'completed').length}{' '}
                completed orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                On-Time Fulfillment
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="#4caf50" mt={0.5}>
                {sellerProfile?.on_time_delivery_rate
                  ? `${sellerProfile.on_time_delivery_rate.toFixed(0)}%`
                  : '98%'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Avg. prep {sellerProfile?.avg_delivery_minutes || 25} mins
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Middle Row: Prep Sheet & SaaS Pass Card */}
      <Grid container spacing={3} mb={4}>
        {/* Pre-Order Batch Prep Sheet */}
        <Grid item xs={12} md={7}>
          <Card
            sx={{
              bgcolor: '#191928',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.08)',
              height: '100%',
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <AccessTimeIcon sx={{ color: '#F6BD60' }} />
                  <Typography variant="h6" fontWeight="bold">
                    Today's Batch Prep Sheet
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  to="/partner/orders"
                  size="small"
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  sx={{ color: '#F6BD60', textTransform: 'none' }}
                >
                  View All Orders
                </Button>
              </Box>

              {Object.keys(slotBatchCounts).length === 0 ? (
                <Typography variant="body2" color="text.secondary" py={3} textAlign="center">
                  No pre-orders scheduled yet for upcoming meal slots.
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(slotBatchCounts).map(([slot, count]) => (
                    <Grid item xs={6} sm={4} key={slot}>
                      <Box bgcolor="#1F1F35" p={2} borderRadius={2} textAlign="center">
                        <Typography variant="caption" color="text.secondary" display="block">
                          {SLOT_LABELS[slot] || slot}
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" color="#F6BD60" mt={0.5}>
                          {count}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Portions Booked
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* SaaS Pass & Direct UPI Quota Card */}
        <Grid item xs={12} md={5}>
          <Card
            sx={{
              bgcolor: '#191928',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.08)',
              height: '100%',
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Box display="flex" alignItems="center" gap={1}>
                  <AccountBalanceWalletIcon sx={{ color: '#4caf50' }} />
                  <Typography variant="h6" fontWeight="bold">
                    SaaS Pass & Quota
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={sellerProfile?.upi_id ? '🟢 Direct UPI' : '⚠️ Missing UPI'}
                  sx={{
                    bgcolor: sellerProfile?.upi_id
                      ? 'rgba(76, 175, 80, 0.15)'
                      : 'rgba(255, 152, 0, 0.15)',
                    color: sellerProfile?.upi_id ? '#4caf50' : '#ff9800',
                    fontWeight: 'bold',
                  }}
                />
              </Box>

              <Box display="flex" justifyContent="space-between" mb={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Remaining Free Orders:
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#2EC4B6">
                    {maintenanceStatus?.free_orders_remaining ?? 50} /{' '}
                    {maintenanceStatus?.free_orders_total ?? 50}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary">
                    Maintenance Balance:
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="#F6BD60">
                    ₹{maintenanceStatus?.maintenance_balance?.toFixed(2) ?? '0.00'}
                  </Typography>
                </Box>
              </Box>

              <Box bgcolor="#1F1F35" p={1.5} borderRadius={2} mb={2}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Receiving UPI: <strong>{sellerProfile?.upi_id || 'Not configured'}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Account Name: <strong>{sellerProfile?.upi_account_name || 'Chef'}</strong>
                </Typography>
              </Box>

              <Box display="flex" gap={1.5}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => setOpenTopupDialog?.(true)}
                  sx={{
                    borderColor: '#4caf50',
                    color: '#4caf50',
                    textTransform: 'none',
                    fontWeight: 'bold',
                  }}
                >
                  ⚡ Top Up Wallet
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  component={Link}
                  to="/partner/finances"
                  sx={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    textTransform: 'none',
                  }}
                >
                  Manage UPI
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Urgent Active Orders Stream */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <DeliveryDiningIcon sx={{ color: '#E05A2B' }} />
            <Typography variant="h6" fontWeight="bold">
              Urgent Kitchen Orders ({activeOrders.length})
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/partner/orders"
            endIcon={<ArrowForwardIcon fontSize="small" />}
            sx={{ color: '#E05A2B', textTransform: 'none', fontWeight: 'bold' }}
          >
            Fulfillment Kanban
          </Button>
        </Box>

        {activeOrders.length === 0 ? (
          <Box
            textAlign="center"
            py={5}
            color="text.secondary"
            bgcolor="#191928"
            borderRadius={3}
            border="1px dashed rgba(255,255,255,0.1)"
          >
            <Typography variant="body1">No orders currently awaiting kitchen prep.</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              Keep your kitchen open to receive fresh dinner and lunch orders from residents.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {activeOrders.slice(0, 4).map((order) => (
              <Grid item xs={12} sm={6} md={3} key={order.id}>
                <Card
                  sx={{
                    bgcolor: '#191928',
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.08)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        Order #{order.id}
                      </Typography>
                      <Chip
                        size="small"
                        label={order.status.toUpperCase()}
                        sx={{
                          bgcolor:
                            order.status === 'ready'
                              ? 'rgba(246, 189, 96, 0.2)'
                              : order.status === 'accepted'
                                ? 'rgba(46, 196, 182, 0.2)'
                                : 'rgba(224, 90, 43, 0.2)',
                          color:
                            order.status === 'ready'
                              ? '#F6BD60'
                              : order.status === 'accepted'
                                ? '#2EC4B6'
                                : '#E05A2B',
                          fontWeight: 'bold',
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />
                    </Box>

                    <Box mb={1.5}>
                      {(order.items || []).map((it, idx) => (
                        <Typography key={idx} variant="body2" noWrap sx={{ fontSize: '0.85rem' }}>
                          {it.quantity}x {it.name}
                        </Typography>
                      ))}
                    </Box>

                    <Typography variant="subtitle2" fontWeight="bold" color="#E05A2B" mb={1.5}>
                      ₹{order.total_price}
                    </Typography>

                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      onClick={() => handleAdvanceOrderStatus(order.id, order.status)}
                      sx={{
                        bgcolor:
                          order.status === 'pending'
                            ? '#E05A2B'
                            : order.status === 'accepted'
                              ? '#F6BD60'
                              : '#2EC4B6',
                        color: order.status === 'pending' ? '#fff' : '#000',
                        fontWeight: 'bold',
                        textTransform: 'none',
                        fontSize: '0.75rem',
                      }}
                    >
                      {order.status === 'pending'
                        ? 'Accept Order'
                        : order.status === 'accepted'
                          ? 'Mark Ready'
                          : 'Mark Completed'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Quick Launch Shortcuts */}
      <Box bgcolor="#191928" p={3} borderRadius={3} border="1px solid rgba(255,255,255,0.08)">
        <Typography variant="subtitle1" fontWeight="bold" mb={2}>
          ⚡ Chef Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleOpenCreateMenu}
              sx={{
                p: 1.5,
                borderColor: '#E05A2B',
                color: '#E05A2B',
                textTransform: 'none',
                fontWeight: 'bold',
              }}
            >
              + Cook New Dish
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RestaurantIcon />}
              component={Link}
              to="/partner/menu"
              sx={{
                p: 1.5,
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                textTransform: 'none',
              }}
            >
              Manage {menuItems.length} Dishes
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DeliveryDiningIcon />}
              component={Link}
              to="/partner/orders"
              sx={{
                p: 1.5,
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                textTransform: 'none',
              }}
            >
              View Orders Pipeline
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
