import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Outlet, useLocation, Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Chip,
  Alert,
  CircularProgress,
  Badge,
  Button,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import RefreshIcon from '@mui/icons-material/Refresh';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

import { adminAPI, getErrorMessage } from '../../services/api';

export default function AdminLayout({ currentUser }) {
  const location = useLocation();

  const [analytics, setAnalytics] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [analyticsRes, pendingRes] = await Promise.all([
        adminAPI.getAnalytics().catch(() => ({ data: null })),
        adminAPI.getPendingPartners().catch(() => ({ data: [] })),
      ]);

      if (analyticsRes?.data) {
        setAnalytics(analyticsRes.data);
      } else {
        setAnalytics({});
      }
      const pendingList = Array.isArray(pendingRes?.data)
        ? pendingRes.data
        : pendingRes?.data?.partners || pendingRes?.data?.pending_partners || [];
      setPendingCount(pendingList.length);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch admin overview data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Determine current active tab
  const currentPath = location.pathname;
  let activeTab = 0;
  if (currentPath.includes('/admin/approvals')) activeTab = 1;
  else if (currentPath.includes('/admin/residents')) activeTab = 2;
  else if (currentPath.includes('/admin/refunds') || currentPath.includes('/admin/disputes'))
    activeTab = 3;

  const contextValue = {
    analytics,
    setAnalytics,
    pendingCount,
    setPendingCount,
    loading,
    error,
    setError,
    actionSuccess,
    setActionSuccess,
    refreshAdminData: fetchAdminData,
    currentUser,
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4, minHeight: '85vh' }}>
      {/* Admin Header Bar */}
      <Box
        sx={{
          bgcolor: '#191928',
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          mb: 3,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              bgcolor: 'rgba(224,90,43,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(224,90,43,0.3)',
            }}
          >
            <AdminPanelSettingsIcon sx={{ color: '#E05A2B', fontSize: 32 }} />
          </Box>
          <Box>
            <Box display="flex" alignItems="center" gap={1.2}>
              <Typography variant="h5" fontWeight="bold">
                Society Platform Admin
              </Typography>
              <Chip
                size="small"
                label="SUPERVISOR"
                sx={{ bgcolor: 'rgba(46,196,182,0.15)', color: '#2EC4B6', fontWeight: 'bold' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Community Health • Chef Verifications • Member Directory • Payments & Refunds
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchAdminData}
          sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none' }}
        >
          Refresh Telemetry
        </Button>
      </Box>

      {/* Global Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {/* Admin Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)', mb: 3.5 }}>
        <Tabs
          value={activeTab}
          textColor="inherit"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              minHeight: 48,
              color: 'rgba(255,255,255,0.7)',
              '&.Mui-selected': { color: '#E05A2B' },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#E05A2B',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<AssessmentIcon fontSize="small" />}
            iconPosition="start"
            label="Overview & KPIs"
            component={Link}
            to="/admin"
          />
          <Tab
            icon={
              <Badge
                badgeContent={pendingCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
              >
                <HowToRegIcon fontSize="small" />
              </Badge>
            }
            iconPosition="start"
            label="Chef Approvals"
            component={Link}
            to="/admin/approvals"
          />
          <Tab
            icon={<PeopleAltIcon fontSize="small" />}
            iconPosition="start"
            label="Residents & Members"
            component={Link}
            to="/admin/residents"
          />
          <Tab
            icon={<CurrencyExchangeIcon fontSize="small" />}
            iconPosition="start"
            label="Disputes & Refunds"
            component={Link}
            to="/admin/refunds"
          />
        </Tabs>
      </Box>

      {/* Sub-Page Content */}
      {loading &&
      !analytics &&
      (location.pathname === '/admin' || location.pathname === '/admin/') ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : (
        <Outlet context={contextValue} />
      )}
    </Container>
  );
}

AdminLayout.propTypes = {
  currentUser: PropTypes.object,
};
