import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Box, Grid, Card, CardContent, Typography, Button, Chip, Alert } from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function AdminOverview() {
  const context = useOutletContext() || {};
  const { analytics, pendingCount = 0 } = context;

  const grossRevenue = analytics?.revenue?.total_gross_inr || 0;
  const refundedAmount = analytics?.revenue?.total_refunded_inr || 0;
  const netRevenue = analytics?.revenue?.net_inr || grossRevenue - refundedAmount;

  return (
    <Box>
      {/* Alert Banner for Pending Approvals */}
      {pendingCount > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          action={
            <Button
              component={Link}
              to="/admin/approvals"
              color="inherit"
              size="small"
              sx={{ fontWeight: 'bold' }}
            >
              Review Now ({pendingCount})
            </Button>
          }
          sx={{ mb: 4, borderRadius: 2 }}
        >
          There are <strong>{pendingCount} new home chef application(s)</strong> awaiting society
          verification.
        </Alert>
      )}

      {/* Financial Health KPIs */}
      <Typography variant="h6" fontWeight="bold" mb={2}>
        💰 Platform Financial Performance
      </Typography>
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={4}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Gross Platform GMV
                </Typography>
                <Chip
                  size="small"
                  label="GROSS"
                  sx={{ bgcolor: 'rgba(46,196,182,0.15)', color: '#2EC4B6', fontWeight: 'bold' }}
                />
              </Box>
              <Typography variant="h3" fontWeight="bold" color="#2EC4B6" mt={1}>
                ₹{grossRevenue.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Cumulative food orders placed in society
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Total Refunded
                </Typography>
                <Chip
                  size="small"
                  label="REFUNDS"
                  sx={{ bgcolor: 'rgba(255,82,82,0.15)', color: '#ff5252', fontWeight: 'bold' }}
                />
              </Box>
              <Typography variant="h3" fontWeight="bold" color="#ff5252" mt={1}>
                ₹{refundedAmount.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Processed refund vouchers & dispute returns
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Net Platform Volume
                </Typography>
                <Chip
                  size="small"
                  label="NET GMV"
                  sx={{ bgcolor: 'rgba(246,189,96,0.15)', color: '#F6BD60', fontWeight: 'bold' }}
                />
              </Box>
              <Typography variant="h3" fontWeight="bold" color="#F6BD60" mt={1}>
                ₹{netRevenue.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Net retained transactional volume
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Society Platform Engagement Metrics */}
      <Typography variant="h6" fontWeight="bold" mb={2}>
        📊 Society Activity & Network Density
      </Typography>
      <Grid container spacing={3} mb={4}>
        <Grid item xs={6} sm={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <StoreIcon sx={{ color: '#E05A2B' }} />
                <Typography variant="caption" color="text.secondary">
                  Active Kitchens
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {analytics?.total_partners ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Approved home chefs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <PeopleIcon sx={{ color: '#2EC4B6' }} />
                <Typography variant="caption" color="text.secondary">
                  Residents
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {analytics?.total_residents ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Verified building members
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <ShoppingBagIcon sx={{ color: '#F6BD60' }} />
                <Typography variant="caption" color="text.secondary">
                  Total Orders
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {analytics?.total_orders ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Lifetime platform tickets
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircleIcon sx={{ color: '#4caf50' }} />
                <Typography variant="caption" color="text.secondary">
                  Delivered
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color="#4caf50">
                {analytics?.completed_orders ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completed handovers
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Admin Quick Action Cards */}
      <Typography variant="h6" fontWeight="bold" mb={2}>
        ⚡ Quick Management Operations
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                👩‍🍳 Partner Approvals
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Verify kitchen hygiene, flat numbers, and activate new home chef profiles.
              </Typography>
              <Button
                component={Link}
                to="/admin/approvals"
                variant="outlined"
                fullWidth
                endIcon={<ArrowForwardIcon />}
                sx={{
                  borderColor: '#E05A2B',
                  color: '#E05A2B',
                  textTransform: 'none',
                  fontWeight: 'bold',
                }}
              >
                Open Review Queue ({pendingCount})
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                👥 Resident Directory
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Inspect registered building members, filter by flat unit, or deactivate rogue
                accounts.
              </Typography>
              <Button
                component={Link}
                to="/admin/residents"
                variant="outlined"
                fullWidth
                endIcon={<ArrowForwardIcon />}
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', textTransform: 'none' }}
              >
                Browse Members Directory
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                💸 Disputes & Refunds
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Issue immediate full refunds for disputed orders or undelivered meals.
              </Typography>
              <Button
                component={Link}
                to="/admin/refunds"
                variant="outlined"
                fullWidth
                endIcon={<ArrowForwardIcon />}
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', textTransform: 'none' }}
              >
                Process Order Refund
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
