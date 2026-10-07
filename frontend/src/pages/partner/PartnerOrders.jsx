import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import RefreshIcon from '@mui/icons-material/Refresh';

import { ordersAPI, deliveryAPI, getErrorMessage } from '../../services/api';

const SLOT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

export default function PartnerOrders() {
  const context = useOutletContext() || {};
  const {
    orders = [],
    setOrders,
    setActionSuccess,
    setError,
    refreshData,
  } = context;

  const [statusFilter, setStatusFilter] = useState('all');

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return order.status !== 'completed' && order.status !== 'cancelled';
    return order.status === statusFilter;
  });

  const handleAdvanceOrderStatus = async (orderId, currentStatus) => {
    let nextStatus = 'accepted';
    if (currentStatus === 'pending') nextStatus = 'accepted';
    else if (currentStatus === 'accepted') nextStatus = 'ready';
    else if (currentStatus === 'ready') nextStatus = 'completed';

    try {
      await ordersAPI.updateStatus(orderId, nextStatus);
      setOrders?.((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      setActionSuccess?.(`Order #${orderId} marked as ${nextStatus.toUpperCase()}! 🚀`);
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to update order status.'));
    }
  };

  const handleDispatchDoorstep = async (orderId) => {
    try {
      await deliveryAPI.create(orderId, 15, 'Chef out for delivery');
      setActionSuccess?.(`Doorstep delivery initiated for Order #${orderId}! 🛵`);
      refreshData?.();
    } catch (err) {
      setError?.(getErrorMessage(err, 'Could not dispatch delivery.'));
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const acceptedCount = orders.filter((o) => o.status === 'accepted').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Live Kitchen Order Pipeline ({filteredOrders.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage incoming resident tickets, cook times, and doorstep handovers.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => refreshData?.()}
          sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none' }}
        >
          Refresh Feed
        </Button>
      </Box>

      {/* Pipeline Stage Filter Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)', mb: 3 }}>
        <Tabs
          value={statusFilter}
          onChange={(_, val) => setStatusFilter(val)}
          textColor="inherit"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.7)',
              '&.Mui-selected': { color: '#E05A2B' },
            },
            '& .MuiTabs-indicator': { backgroundColor: '#E05A2B' },
          }}
        >
          <Tab value="all" label={`All (${orders.length})`} />
          <Tab value="active" label={`In Progress (${pendingCount + acceptedCount + readyCount})`} />
          <Tab value="pending" label={`Awaiting Acceptance (${pendingCount})`} />
          <Tab value="accepted" label={`Cooking (${acceptedCount})`} />
          <Tab value="ready" label={`Ready for Pickup (${readyCount})`} />
          <Tab value="completed" label={`Completed (${completedCount})`} />
        </Tabs>
      </Box>

      {filteredOrders.length === 0 ? (
        <Box textAlign="center" py={8} bgcolor="#191928" borderRadius={3} border="1px dashed rgba(255,255,255,0.1)">
          <DeliveryDiningIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            No orders found under "{statusFilter.toUpperCase()}"
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Check other tabs or wait for new meal orders from society neighbors.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredOrders.map((order) => {
            const isCompleted = order.status === 'completed';
            const isCancelled = order.status === 'cancelled';

            return (
              <Grid item xs={12} md={6} key={order.id}>
                <Card
                  sx={{
                    bgcolor: '#191928',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor:
                      order.status === 'pending'
                        ? '#E05A2B'
                        : order.status === 'ready'
                        ? '#F6BD60'
                        : 'rgba(255,255,255,0.08)',
                    boxShadow: order.status === 'pending' ? '0 0 12px rgba(224,90,43,0.2)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Box>
                        <Typography variant="h6" fontWeight="bold">
                          Order #{order.id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                        </Typography>
                      </Box>

                      <Chip
                        size="small"
                        label={order.status.toUpperCase()}
                        sx={{
                          bgcolor:
                            order.status === 'completed'
                              ? 'rgba(46, 196, 182, 0.2)'
                              : order.status === 'ready'
                              ? 'rgba(246, 189, 96, 0.2)'
                              : order.status === 'accepted'
                              ? 'rgba(76, 175, 80, 0.2)'
                              : 'rgba(224, 90, 43, 0.2)',
                          color:
                            order.status === 'completed'
                              ? '#2EC4B6'
                              : order.status === 'ready'
                              ? '#F6BD60'
                              : order.status === 'accepted'
                              ? '#4caf50'
                              : '#E05A2B',
                          fontWeight: 'bold',
                        }}
                      />
                    </Box>

                    {/* Pre-order & Delivery Badges */}
                    <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                      {order.is_preorder && (
                        <Chip
                          size="small"
                          icon={<AccessTimeIcon fontSize="small" />}
                          label={SLOT_LABELS[order.delivery_slot] || order.delivery_slot || 'Pre-Order'}
                          sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 'bold' }}
                        />
                      )}
                      <Chip
                        size="small"
                        icon={<DeliveryDiningIcon fontSize="small" />}
                        label={order.delivery_type === 'doorstep' ? 'Doorstep Delivery' : 'Self-Pickup'}
                        sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }}
                      />
                    </Box>

                    {/* Item List */}
                    <Box mb={2} bgcolor="#1F1F35" p={1.5} borderRadius={2}>
                      {(order.items || []).map((it, idx) => (
                        <Box key={idx} display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2" fontWeight="bold">
                            {it.quantity}x {it.name}
                          </Typography>
                          <Typography variant="body2" color="#aaa">
                            ₹{(it.price || 0) * (it.quantity || 1)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {order.notes && (
                      <Box bgcolor="rgba(246,189,96,0.1)" p={1.2} borderRadius={2} mb={2} border="1px dashed #F6BD60">
                        <Typography variant="caption" color="#F6BD60" display="block">
                          <strong>Resident Special Note:</strong> {order.notes}
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="caption" color="text.secondary">Total Amount:</Typography>
                        <Typography variant="h6" fontWeight="bold" color="#E05A2B">
                          ₹{order.total_price}
                        </Typography>
                      </Box>

                      {!isCompleted && !isCancelled && (
                        <Box display="flex" gap={1}>
                          {order.delivery_type === 'doorstep' && order.status === 'ready' && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<DeliveryDiningIcon />}
                              onClick={() => handleDispatchDoorstep(order.id)}
                              sx={{ color: '#2EC4B6', borderColor: '#2EC4B6', textTransform: 'none', fontWeight: 'bold' }}
                            >
                              Dispatch 🛵
                            </Button>
                          )}
                          <Button
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
                              '&:hover': { opacity: 0.9 },
                            }}
                          >
                            {order.status === 'pending'
                              ? 'Accept Order'
                              : order.status === 'accepted'
                              ? 'Mark as Ready'
                              : 'Mark Completed / Delivered'}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
