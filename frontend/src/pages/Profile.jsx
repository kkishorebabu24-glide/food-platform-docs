import React, { useState, useEffect } from 'react';
import {} from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import LocalDiningIcon from '@mui/icons-material/LocalDining';

import { sellersAPI, getErrorMessage } from '../services/api';

export default function ProfilePage() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch {
    user = null;
  }

  const role = user?.role || 'resident';
  const isPartner = role === 'partner' || role === 'seller';
  const isAdmin = role === 'admin' || role === 'super_admin';

  // Partner profile & state
  const [loading, setLoading] = useState(isPartner);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [upiId, setUpiId] = useState('');
  const [upiAccountName, setUpiAccountName] = useState('');
  const [bio, setBio] = useState('');
  const [freeOrders, setFreeOrders] = useState(50);
  const [maintenanceBalance, setMaintenanceBalance] = useState(0.0);
  const [isUpiVerified, setIsUpiVerified] = useState(false);

  // Resident Chef Onboarding Dialog
  const [openApplyDialog, setOpenApplyDialog] = useState(false);
  const [applyBio, setApplyBio] = useState('');
  const [applyUpi, setApplyUpi] = useState('');
  const [applyName, setApplyName] = useState(user?.name || '');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!isPartner) return;

    let isMounted = true;
    const fetchPartnerData = async () => {
      try {
        setLoading(true);
        const res = await sellersAPI.getMe();
        if (isMounted && res.data) {
          setUpiId(res.data.upi_id || '');
          setUpiAccountName(res.data.upi_account_name || res.data.name || '');
          setBio(res.data.bio || '');
          setFreeOrders(res.data.free_orders_remaining ?? 50);
          setMaintenanceBalance(res.data.maintenance_balance ?? 0.0);
          setIsUpiVerified(Boolean(res.data.upi_id));
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, 'Failed to load kitchen profile details.'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPartnerData();
    return () => {
      isMounted = false;
    };
  }, [isPartner]);

  const isValidUpi =
    upiId.trim().length > 0 && /^[a-zA-Z0-9.\-_]+@[a-zA-Z]{3,}$/.test(upiId.trim());

  const handleSaveUpi = async (e) => {
    e.preventDefault();
    if (upiId.trim() && !isValidUpi) {
      setError('Please enter a valid UPI ID (e.g. yourname@oksbi or mobile@paytm)');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await sellersAPI.updateProfile({
        upi_id: upiId.trim() || null,
        upi_account_name: upiAccountName.trim() || null,
        bio: bio.trim() || null,
      });

      setIsUpiVerified(Boolean(upiId.trim()));
      setSuccess('Kitchen payment details updated successfully!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save payment details.'));
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPartner = async (e) => {
    e.preventDefault();
    try {
      setApplying(true);
      setError(null);
      await sellersAPI.updateProfile({
        bio: applyBio.trim(),
        upi_id: applyUpi.trim() || null,
        upi_account_name: applyName.trim() || null,
      });
      setSuccess(
        'Home Chef application submitted successfully! Your kitchen is now being enrolled.'
      );
      setOpenApplyDialog(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit chef application.'));
    } finally {
      setApplying(false);
    }
  };

  const testUpiUri = upiId.trim()
    ? `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(
        upiAccountName.trim() || user?.name || 'Chef'
      )}&am=1.00&cu=INR&tn=UPI_Test_Verification`
    : '';

  const getRoleBadge = () => {
    if (role === 'super_admin') {
      return { label: 'SUPER ADMIN', color: 'secondary' };
    }
    if (role === 'admin') {
      return { label: 'SOCIETY ADMIN', color: 'primary' };
    }
    if (isPartner) {
      return { label: 'HOME CHEF (PARTNER)', color: 'warning' };
    }
    return { label: 'RESIDENT MEMBER', color: 'success' };
  };

  const roleBadge = getRoleBadge();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* User Profile Card */}
        <Paper
          sx={{
            p: 3,
            bgcolor: '#141420',
            color: '#fff',
            borderRadius: 2,
            border: '1px solid #232336',
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            flexWrap="wrap"
            gap={2}
          >
            <Box>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Profile & Identity
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage your credentials, apartment location, and active workspace permissions.
              </Typography>
            </Box>
            <Chip
              label={roleBadge.label}
              color={roleBadge.color}
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>

          {user ? (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <Typography>
                <strong>Full Name:</strong> {user.name || '—'}
              </Typography>
              <Typography>
                <strong>Email Address:</strong> {user.email || '—'}
              </Typography>
              <Typography>
                <strong>Apartment / Flat:</strong> {user.flat_number || 'Tower A - Resident'}
              </Typography>
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Not logged in.
            </Typography>
          )}
        </Paper>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Profile List of Actions Sub-Menu */}
        <Paper
          sx={{
            p: 3,
            bgcolor: '#141420',
            color: '#fff',
            borderRadius: 2,
            border: '1px solid #232336',
          }}
        >
          <Typography variant="h6" fontWeight="bold" mb={1}>
            Account Services & Action Menu
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Select an action to navigate across platform spaces or manage your enrollments.
          </Typography>

          <Grid container spacing={2}>
            {/* Common Action: Resident Marketplace */}
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  bgcolor: '#1b1b2a',
                  border: '1px solid #2d2d42',
                  color: '#fff',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  '&:hover': { borderColor: '#2EC4B6' },
                }}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <DeliveryDiningIcon sx={{ color: '#2EC4B6' }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Resident Space & Orders
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Browse fresh homemade dishes from verified neighbors, view active cart, and
                    order history.
                  </Typography>
                </CardContent>
                <Box p={2} pt={0}>
                  <Button
                    href="/"
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowForwardIcon />}
                    sx={{
                      color: '#2EC4B6',
                      borderColor: '#2EC4B6',
                      textTransform: 'none',
                      fontWeight: 'bold',
                    }}
                  >
                    Open Resident Marketplace
                  </Button>
                </Box>
              </Card>
            </Grid>

            {/* Resident Chef Onboarding / Kitchen Hub Action */}
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  bgcolor: '#1b1b2a',
                  border: '1px solid #2d2d42',
                  color: '#fff',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  '&:hover': { borderColor: '#E05A2B' },
                }}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <RestaurantIcon sx={{ color: '#E05A2B' }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      {isPartner ? 'Kitchen Hub & Menus' : 'Become a Home Chef (Partner)'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {isPartner
                      ? 'Manage daily portion quotas, accept pre-orders, and review kitchen live pipeline.'
                      : 'Share your home culinary specialties with residents. Enjoy 0% commission with 50 free orders.'}
                  </Typography>
                </CardContent>
                <Box p={2} pt={0}>
                  {isPartner ? (
                    <Button
                      href="/partner"
                      size="small"
                      variant="contained"
                      endIcon={<ArrowForwardIcon />}
                      sx={{
                        bgcolor: '#E05A2B',
                        '&:hover': { bgcolor: '#c84e24' },
                        textTransform: 'none',
                        fontWeight: 'bold',
                      }}
                    >
                      Enter Kitchen Hub
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setOpenApplyDialog(true)}
                      endIcon={<LocalDiningIcon />}
                      sx={{
                        bgcolor: '#E05A2B',
                        '&:hover': { bgcolor: '#c84e24' },
                        textTransform: 'none',
                        fontWeight: 'bold',
                      }}
                    >
                      Apply as Home Chef
                    </Button>
                  )}
                </Box>
              </Card>
            </Grid>

            {/* Admin Console Action */}
            {isAdmin && (
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    bgcolor: '#1b1b2a',
                    border: '1px solid #2d2d42',
                    color: '#fff',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': { borderColor: '#F6BD60' },
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AdminPanelSettingsIcon sx={{ color: '#F6BD60' }} />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Society Admin Console
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Review chef applicant licenses, monitor society GMV, audit member directory
                      and handle refunds.
                    </Typography>
                  </CardContent>
                  <Box p={2} pt={0}>
                    <Button
                      href="/admin"
                      size="small"
                      variant="outlined"
                      endIcon={<ArrowForwardIcon />}
                      sx={{
                        color: '#F6BD60',
                        borderColor: '#F6BD60',
                        textTransform: 'none',
                        fontWeight: 'bold',
                      }}
                    >
                      Open Admin Console
                    </Button>
                  </Box>
                </Card>
              </Grid>
            )}

            {/* Direct P2PM UPI Action (if Partner) */}
            {isPartner && (
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    bgcolor: '#1b1b2a',
                    border: '1px solid #2d2d42',
                    color: '#fff',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': { borderColor: '#4caf50' },
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AccountBalanceWalletIcon sx={{ color: '#4caf50' }} />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Finances & SaaS Pass
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Configure your direct bank UPI QR handle, top up maintenance wallet, and
                      inspect ledger.
                    </Typography>
                  </CardContent>
                  <Box p={2} pt={0}>
                    <Button
                      href="/partner/finances"
                      size="small"
                      variant="outlined"
                      endIcon={<ArrowForwardIcon />}
                      sx={{
                        color: '#4caf50',
                        borderColor: '#4caf50',
                        textTransform: 'none',
                        fontWeight: 'bold',
                      }}
                    >
                      View Financial Sub-Page
                    </Button>
                  </Box>
                </Card>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* Partner Specific: Direct P2PM UPI Configuration */}
        {isPartner && (
          <Paper
            sx={{
              p: 3,
              bgcolor: '#141420',
              color: '#fff',
              borderRadius: 2,
              border: '1px solid #232336',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AccountBalanceWalletIcon sx={{ color: '#E05A2B', fontSize: 28 }} />
                <Typography variant="h6" fontWeight="bold">
                  Direct P2PM UPI Payment Configuration
                </Typography>
              </Box>
              {isUpiVerified ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Direct UPI Active"
                  color="success"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              ) : (
                <Chip
                  icon={<WarningAmberIcon />}
                  label="UPI Setup Required"
                  color="warning"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
            </Box>

            <Typography variant="body2" sx={{ color: '#aaa', mb: 3 }}>
              Residents pay directly into your personal or business UPI account.{' '}
              <strong>0% aggregator commission</strong>. Funds settle immediately into your bank
              account via UPI rails.
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSaveUpi}>
                <Stack spacing={2.5}>
                  <TextField
                    label="Your UPI ID / VPA"
                    placeholder="e.g. chef.name@oksbi or 9876543210@paytm"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    required
                    fullWidth
                    helperText={
                      upiId && !isValidUpi
                        ? 'Invalid UPI ID format (expected: handle@bank)'
                        : 'Exact UPI ID where residents will transfer meal payments.'
                    }
                    error={Boolean(upiId && !isValidUpi)}
                    InputLabelProps={{ sx: { color: '#bbb' } }}
                    InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
                  />

                  <TextField
                    label="Account Holder / Display Name"
                    placeholder="e.g. Lakshmi Devi"
                    value={upiAccountName}
                    onChange={(e) => setUpiAccountName(e.target.value)}
                    fullWidth
                    helperText="Display name as shown on your bank account / UPI app."
                    InputLabelProps={{ sx: { color: '#bbb' } }}
                    InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
                  />

                  <TextField
                    label="Kitchen Bio / Specialties"
                    multiline
                    rows={2}
                    placeholder="e.g. Authentic homemade Andhra meals and evening snacks."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    fullWidth
                    InputLabelProps={{ sx: { color: '#bbb' } }}
                    InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
                  />

                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pt: 1 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={saving || (upiId.trim() && !isValidUpi)}
                      sx={{
                        bgcolor: '#E05A2B',
                        '&:hover': { bgcolor: '#c84e24' },
                        px: 3,
                        fontWeight: 'bold',
                      }}
                    >
                      {saving ? 'Saving...' : 'Save Payment Details'}
                    </Button>

                    {upiId.trim() && isValidUpi && (
                      <Button
                        variant="outlined"
                        href={testUpiUri}
                        target="_blank"
                        rel="noreferrer"
                        startIcon={<OpenInNewIcon />}
                        sx={{
                          color: '#4caf50',
                          borderColor: '#4caf50',
                          '&:hover': { borderColor: '#81c784', bgcolor: 'rgba(76, 175, 80, 0.08)' },
                        }}
                      >
                        Test UPI Intent Link
                      </Button>
                    )}
                  </Box>
                </Stack>
              </Box>
            )}

            <Divider sx={{ my: 3, borderColor: '#232336' }} />

            {/* SaaS Pass & Maintenance Status */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <CardGiftcardIcon sx={{ color: '#4caf50', fontSize: 24 }} />
                <Typography variant="subtitle1" fontWeight="bold">
                  SaaS Pass & Platform Quota
                </Typography>
              </Box>

              <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
              >
                <Card sx={{ bgcolor: '#1b1b2a', border: '1px solid #2d2d42', color: '#fff' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="caption" sx={{ color: '#aaa' }}>
                      Free Orders Remaining
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#4caf50', mt: 0.5 }}>
                      {freeOrders} / 50
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.5 }}>
                      First 50 orders are 100% free of maintenance fees!
                    </Typography>
                  </CardContent>
                </Card>

                <Card sx={{ bgcolor: '#1b1b2a', border: '1px solid #2d2d42', color: '#fff' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="caption" sx={{ color: '#aaa' }}>
                      Platform Maintenance Balance
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: '#E05A2B', mt: 0.5 }}>
                      ₹{Number(maintenanceBalance).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.5 }}>
                      ₹5.00/order charged only after 50 free orders.
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Paper>
        )}
      </Stack>

      {/* Resident Application Modal */}
      <Dialog
        open={openApplyDialog}
        onClose={() => setOpenApplyDialog(false)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 480, borderRadius: 3 } }}
      >
        <DialogTitle
          fontWeight="bold"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          🍳 Apply as Home Chef (Partner)
          <IconButton size="small" onClick={() => setOpenApplyDialog(false)} sx={{ color: '#aaa' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleApplyPartner}>
          <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Join the Society Food kitchen partner network. You will retain 100% of dish proceeds
              via direct resident UPI settlements.
            </Typography>
            <TextField
              label="Chef / Kitchen Display Name"
              value={applyName}
              onChange={(e) => setApplyName(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              InputLabelProps={{ sx: { color: '#bbb' } }}
              InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
            />
            <TextField
              label="Cuisine Specialties & Kitchen Bio"
              value={applyBio}
              onChange={(e) => setApplyBio(e.target.value)}
              multiline
              rows={3}
              placeholder="e.g. North Indian curries, weekend biryanis, fresh sourdough breads"
              fullWidth
              required
              sx={{ mb: 2 }}
              InputLabelProps={{ sx: { color: '#bbb' } }}
              InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
            />
            <TextField
              label="UPI ID for Direct Settlements"
              value={applyUpi}
              onChange={(e) => setApplyUpi(e.target.value)}
              placeholder="e.g. chef@okhdfcbank"
              fullWidth
              required
              helperText="Residents scan your UPI QR at checkout. Zero platform commission."
              sx={{ mb: 1 }}
              InputLabelProps={{ sx: { color: '#bbb' } }}
              InputProps={{ sx: { color: '#fff', bgcolor: '#1b1b2a' } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#141420' }}>
            <Button onClick={() => setOpenApplyDialog(false)} sx={{ color: '#aaa' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={applying}
              sx={{ bgcolor: '#E05A2B', '&:hover': { bgcolor: '#c84e24' }, fontWeight: 'bold' }}
            >
              {applying ? 'Submitting Application...' : 'Submit Application'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
}
