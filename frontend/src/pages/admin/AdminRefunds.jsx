import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { adminAPI, ordersAPI, getErrorMessage } from '../../services/api';

export default function AdminRefunds() {
  const context = useOutletContext() || {};
  const { setActionSuccess, setError, refreshAdminData } = context;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetOrderId, setTargetOrderId] = useState('');

  // Refund Confirmation Modal
  const [confirmOrder, setConfirmOrder] = useState(null);
  const [processingRefund, setProcessingRefund] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersAPI.list(0, 50);
      setOrders(res.data?.orders || []);
    } catch (_) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleTriggerRefund = async () => {
    if (!confirmOrder) return;
    try {
      setProcessingRefund(true);
      const res = await adminAPI.refundOrder(confirmOrder.id);
      setActionSuccess?.(
        `Full refund of ₹${res.data?.amount_refunded || confirmOrder.total_price} issued for Order #${confirmOrder.id}! 💸`
      );
      setConfirmOrder(null);
      fetchOrders();
      refreshAdminData?.();
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to issue refund. Payment may already be refunded or not yet captured.'));
    } finally {
      setProcessingRefund(false);
    }
  };

  const handleDirectLookupRefund = (e) => {
    e.preventDefault();
    const parsed = parseInt(targetOrderId, 10);
    if (!parsed) {
      setError?.('Please enter a valid numeric Order ID.');
      return;
    }
    const match = orders.find((o) => o.id === parsed);
    setConfirmOrder(match || { id: parsed, total_price: '—' });
  };

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Order Issues, Audits & Payments Refunds
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Initiate payment refunds for undelivered food, cold deliveries, or resident disputes.
        </Typography>
      </Box>

      {/* Direct Order Lookup Card */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <CurrencyExchangeIcon sx={{ color: '#ff5252', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Direct Order ID Refund Action
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Enter an order ticket ID to trigger an immediate payment reversal.
              </Typography>
            </Box>
          </Box>

          <form onSubmit={handleDirectLookupRefund}>
            <Box display="flex" gap={2} flexWrap="wrap">
              <TextField
                size="small"
                placeholder="Enter Order ID (e.g. 104)"
                value={targetOrderId}
                onChange={(e) => setTargetOrderId(e.target.value)}
                sx={{ flexGrow: 1, maxWidth: 320, '& .MuiInputBase-input': { color: '#fff' } }}
              />
              <Button
                type="submit"
                variant="contained"
                color="error"
                sx={{ fontWeight: 'bold', textTransform: 'none' }}
              >
                Initiate Refund...
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>

      {/* Orders Audit Table */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent sx={{ p: 0 }}>
          <Box p={2.5} pb={1.5}>
            <Typography variant="h6" fontWeight="bold">
              Recent Society Orders Audit Trail ({orders.length})
            </Typography>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress sx={{ color: '#E05A2B' }} />
            </Box>
          ) : orders.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Typography variant="body2" color="text.secondary">
                No orders recorded yet.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { color: 'text.secondary', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 'bold' } }}>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Created Time</TableCell>
                    <TableCell>Items Summary</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((order) => {
                    const isRefunded = order.status === 'refunded' || order.status === 'cancelled';
                    return (
                      <TableRow key={order.id} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.06)', color: '#fff' } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            #{order.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {order.created_at ? new Date(order.created_at).toLocaleString() : 'Recent'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>
                            {(order.items || []).map((it) => `${it.quantity}x ${it.name}`).join(', ') || 'Food items'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={order.status?.toUpperCase() || 'PLACED'}
                            sx={{
                              bgcolor:
                                order.status === 'completed' || order.status === 'delivered'
                                  ? 'rgba(46,196,182,0.15)'
                                  : isRefunded
                                  ? 'rgba(255,82,82,0.15)'
                                  : 'rgba(246,189,96,0.15)',
                              color:
                                order.status === 'completed' || order.status === 'delivered'
                                  ? '#2EC4B6'
                                  : isRefunded
                                  ? '#ff5252'
                                  : '#F6BD60',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color="#E05A2B">
                            ₹{order.total_price}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={isRefunded}
                            onClick={() => setConfirmOrder(order)}
                            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.2 }}
                          >
                            {isRefunded ? 'Refunded' : 'Refund'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmOrder)}
        onClose={() => setConfirmOrder(null)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', borderRadius: 3 } }}
      >
        <DialogTitle fontWeight="bold" display="flex" alignItems="center" gap={1}>
          <WarningAmberIcon sx={{ color: '#ff5252' }} />
          Confirm Order Refund
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={1.5}>
            Are you sure you want to issue a full payment refund for <strong>Order #{confirmOrder?.id}</strong>?
          </Typography>
          <Box bgcolor="#1F1F35" p={1.5} borderRadius={2}>
            <Typography variant="caption" color="text.secondary" display="block">
              Refund Amount: <strong>₹{confirmOrder?.total_price}</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              This action will mark the payment as refunded and create a debit ledger entry for the partner.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOrder(null)} sx={{ color: '#aaa', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleTriggerRefund}
            disabled={processingRefund}
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            {processingRefund ? 'Processing...' : 'Authorize Full Refund'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
