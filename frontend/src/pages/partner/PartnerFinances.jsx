import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HistoryIcon from '@mui/icons-material/History';
import QrCode2Icon from '@mui/icons-material/QrCode2';

import { sellersAPI, paymentsAPI, getErrorMessage } from '../../services/api';

export default function PartnerFinances() {
  const context = useOutletContext() || {};
  const {
    sellerProfile,
    setSellerProfile,
    balance = { current_balance: 0, total_earned: 0 },
    maintenanceStatus,
    setActionSuccess,
    setError,
    setOpenTopupDialog,
    refreshData,
  } = context;

  const [upiId, setUpiId] = useState(sellerProfile?.upi_id || '');
  const [upiName, setUpiName] = useState(sellerProfile?.upi_account_name || '');
  const [savingUpi, setSavingUpi] = useState(false);

  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    if (sellerProfile) {
      setUpiId(sellerProfile.upi_id || '');
      setUpiName(sellerProfile.upi_account_name || '');
    }
  }, [sellerProfile]);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        setLoadingLedger(true);
        const res = await paymentsAPI.getLedger(0, 20);
        setLedgerEntries(res.data?.entries || res.data || []);
      } catch (_) {
        // Ledger may be empty or not yet seeded
      } finally {
        setLoadingLedger(false);
      }
    };
    fetchLedger();
  }, []);

  const handleSaveUpi = async (e) => {
    e.preventDefault();
    if (!upiId.trim()) {
      setError?.('Please enter a valid UPI ID (e.g., name@okhdfcbank)');
      return;
    }
    try {
      setSavingUpi(true);
      await sellersAPI.updateProfile({
        upi_id: upiId.trim(),
        upi_account_name: upiName.trim(),
      });
      setSellerProfile?.((prev) => (prev ? { ...prev, upi_id: upiId.trim(), upi_account_name: upiName.trim() } : null));
      setActionSuccess?.('Direct UPI payment configuration updated successfully! 💳');
      refreshData?.();
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to update UPI settings.'));
    } finally {
      setSavingUpi(false);
    }
  };

  const freeRemaining = maintenanceStatus?.free_orders_remaining ?? 50;
  const freeTotal = maintenanceStatus?.free_orders_total ?? 50;
  const quotaPercent = Math.max(0, Math.min(100, (freeRemaining / freeTotal) * 100));

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Finances, SaaS Pass & Direct P2PM UPI
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure direct-to-bank resident payments, monitor free order credits, and review transaction history.
        </Typography>
      </Box>

      {/* Top Cards: Financial Summary */}
      <Grid container spacing={3} mb={4}>
        {/* Earnings Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AccountBalanceWalletIcon sx={{ color: '#2EC4B6' }} />
                <Typography variant="subtitle1" fontWeight="bold">Total Platform Earnings</Typography>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="#2EC4B6" mt={1}>
                ₹{balance?.total_earned?.toLocaleString() || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Direct UPI receipts are received immediately in your bank account with 0% platform commission!
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Free SaaS Pass Meter */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight="bold">SaaS Pass Free Orders</Typography>
                <Chip
                  size="small"
                  label={freeRemaining > 0 ? '🟢 Active Pass' : '⚠️ Depleted'}
                  sx={{
                    bgcolor: freeRemaining > 0 ? 'rgba(46,196,182,0.15)' : 'rgba(224,90,43,0.15)',
                    color: freeRemaining > 0 ? '#2EC4B6' : '#E05A2B',
                    fontWeight: 'bold',
                  }}
                />
              </Box>
              <Typography variant="h4" fontWeight="bold" color="#F6BD60" mt={1}>
                {freeRemaining} / {freeTotal}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Remaining orders before ₹5/order maintenance fee.
              </Typography>
              <LinearProgress
                variant="determinate"
                value={quotaPercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: freeRemaining > 10 ? '#2EC4B6' : '#E05A2B' },
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Maintenance Wallet Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight="bold">Maintenance Wallet</Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => setOpenTopupDialog?.(true)}
                  sx={{ bgcolor: '#4caf50', textTransform: 'none', fontWeight: 'bold', '&:hover': { bgcolor: '#388e3c' } }}
                >
                  ⚡ Top Up
                </Button>
              </Box>
              <Typography variant="h3" fontWeight="bold" color="#4caf50" mt={1}>
                ₹{maintenanceStatus?.maintenance_balance?.toFixed(2) ?? '0.00'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Deducted automatically after your free pass expires at ₹5 per completed order.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* UPI Configuration Form */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <QrCode2Icon sx={{ color: '#E05A2B', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Direct P2PM UPI Settlement Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Residents scan your personalized UPI QR during checkout. Funds deposit straight to your bank account.
              </Typography>
            </Box>
          </Box>

          <form onSubmit={handleSaveUpi}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Chef Receiving UPI ID"
                  placeholder="e.g. yourname@okhdfcbank or phone@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
                  helperText="Supports GPay, PhonePe, Paytm, BHIM, and bank UPIs"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Account Holder / Merchant Name"
                  placeholder="e.g. Chef Meera Sharma"
                  value={upiName}
                  onChange={(e) => setUpiName(e.target.value)}
                  sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
                  helperText="Displayed to residents on the UPI checkout screen"
                />
              </Grid>
            </Grid>

            <Box mt={3} display="flex" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={savingUpi}
                sx={{
                  bgcolor: '#E05A2B',
                  fontWeight: 'bold',
                  px: 4,
                  py: 1.2,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#c9481c' },
                }}
              >
                {savingUpi ? 'Saving UPI Details...' : 'Save UPI Settings'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>

      {/* Transaction & Maintenance Fee Ledger Table */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <HistoryIcon sx={{ color: '#F6BD60' }} />
            <Typography variant="h6" fontWeight="bold">
              Maintenance Credits & Fee Deduction Ledger
            </Typography>
          </Box>

          {loadingLedger ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={30} sx={{ color: '#E05A2B' }} />
            </Box>
          ) : ledgerEntries.length === 0 ? (
            <Box textAlign="center" py={5} bgcolor="#1F1F35" borderRadius={2}>
              <Typography variant="body2" color="text.secondary">
                No ledger transactions recorded yet. Maintenance deductions start after 50 free orders.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { color: 'text.secondary', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 'bold' } }}>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Description / Event</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Amount (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledgerEntries.map((row, idx) => (
                    <TableRow key={idx} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.06)', color: '#fff' } }}>
                      <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : 'Recent'}</TableCell>
                      <TableCell>{row.description || `Order #${row.order_id || idx + 1}`}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.type || 'FEE'}
                          sx={{
                            bgcolor: row.type === 'CREDIT' ? 'rgba(76,175,80,0.15)' : 'rgba(255,82,82,0.15)',
                            color: row.type === 'CREDIT' ? '#4caf50' : '#ff5252',
                            fontSize: '0.7rem',
                            height: 20,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: row.type === 'CREDIT' ? '#4caf50' : '#ff5252' }}>
                        {row.type === 'CREDIT' ? `+₹${row.amount}` : `-₹${row.amount}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
