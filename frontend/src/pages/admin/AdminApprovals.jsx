import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Avatar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HowToRegIcon from '@mui/icons-material/HowToReg';

import { adminAPI, sellersAPI, getErrorMessage } from '../../services/api';

export default function AdminApprovals() {
  const context = useOutletContext() || {};
  const { setActionSuccess, setError, refreshAdminData } = context;

  const [activeTab, setActiveTab] = useState(0); // 0: Pending, 1: Approved
  const [pendingPartners, setPendingPartners] = useState([]);
  const [approvedPartners, setApprovedPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Rejection confirmation dialog
  const [rejectPartnerData, setRejectPartnerData] = useState(null);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const [pendingRes, approvedRes] = await Promise.all([
        adminAPI.getPendingPartners().catch(() => ({ data: [] })),
        sellersAPI.list(0, 50).catch(() => ({ data: [] })),
      ]);

      setPendingPartners(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      const approvedList = Array.isArray(approvedRes.data)
        ? approvedRes.data
        : (approvedRes.data?.sellers || []);
      setApprovedPartners(approvedList);
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to fetch partner applicants.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleApprove = async (partnerId, partnerName) => {
    try {
      setProcessingId(partnerId);
      await adminAPI.approvePartner(partnerId);
      setActionSuccess?.(`Chef '${partnerName || partnerId}' has been approved and activated! 🎉`);
      fetchPartners();
      refreshAdminData?.();
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to approve partner.'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectPartnerData) return;
    try {
      setProcessingId(rejectPartnerData.id);
      await adminAPI.rejectPartner(rejectPartnerData.id);
      setActionSuccess?.(`Partner application for '${rejectPartnerData.name || rejectPartnerData.id}' was rejected.`);
      setRejectPartnerData(null);
      fetchPartners();
      refreshAdminData?.();
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to reject partner.'));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Home Chef Onboarding & Approvals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review kitchen applicants, ensure flat residency and hygiene standards, and grant selling privileges.
          </Typography>
        </Box>
      </Box>

      {/* View Switcher Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          textColor="inherit"
          indicatorColor="primary"
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
          <Tab label={`Pending Applications (${pendingPartners.length})`} />
          <Tab label={`Active Approved Kitchens (${approvedPartners.length})`} />
        </Tabs>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : activeTab === 0 ? (
        /* Pending Applications */
        pendingPartners.length === 0 ? (
          <Box textAlign="center" py={8} bgcolor="#191928" borderRadius={3} border="1px dashed rgba(255,255,255,0.1)">
            <HowToRegIcon sx={{ fontSize: 48, color: '#2EC4B6', mb: 1 }} />
            <Typography variant="h6" color="#2EC4B6" fontWeight="bold">
              Review Queue is Clear! ✨
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No pending home chef applications awaiting approval at this time.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {pendingPartners.map((partner) => (
              <Grid item xs={12} md={6} key={partner.id}>
                <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', height: '100%' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar
                          src={partner.photo_url || undefined}
                          sx={{ width: 50, height: 50, bgcolor: '#E05A2B', fontWeight: 'bold' }}
                        >
                          {partner.name?.[0]?.toUpperCase() || 'C'}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {partner.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Applicant ID #{partner.id} • Flat #{partner.flat_number || 'Unspecified'}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        size="small"
                        label="PENDING"
                        sx={{ bgcolor: 'rgba(246,189,96,0.15)', color: '#F6BD60', fontWeight: 'bold' }}
                      />
                    </Box>

                    <Box bgcolor="#1F1F35" p={1.5} borderRadius={2} mb={2}>
                      <Typography variant="body2" color="rgba(255,255,255,0.8)" mb={0.5}>
                        {partner.bio || 'Home chef applicant has not provided a description.'}
                      </Typography>
                      {partner.upi_id && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Receiving UPI: <strong>{partner.upi_id}</strong>
                        </Typography>
                      )}
                    </Box>

                    <Box display="flex" gap={1.5} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<CancelOutlinedIcon />}
                        disabled={processingId === partner.id}
                        onClick={() => setRejectPartnerData(partner)}
                        sx={{ textTransform: 'none', fontWeight: 'bold' }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<CheckCircleOutlineIcon />}
                        disabled={processingId === partner.id}
                        onClick={() => handleApprove(partner.id, partner.name)}
                        sx={{ bgcolor: '#2EC4B6', color: '#000', fontWeight: 'bold', textTransform: 'none', '&:hover': { bgcolor: '#25a094' } }}
                      >
                        {processingId === partner.id ? 'Approving...' : 'Approve & Activate'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )
      ) : (
        /* Approved Kitchens */
        approvedPartners.length === 0 ? (
          <Box textAlign="center" py={8} bgcolor="#191928" borderRadius={3}>
            <Typography variant="body1" color="text.secondary">No approved kitchens found.</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {approvedPartners.map((partner) => (
              <Grid item xs={12} sm={6} md={4} key={partner.id}>
                <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                      <Avatar
                        src={partner.photo_url || undefined}
                        sx={{ width: 44, height: 44, bgcolor: '#E05A2B', fontWeight: 'bold' }}
                      >
                        {partner.name?.[0]?.toUpperCase() || 'C'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {partner.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Flat #{partner.flat_number || 'N/A'} • {partner.is_open ? '🟢 Open' : '🔒 Closed'}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap mb={1.5}>
                      {partner.bio || 'Home Kitchen'}
                    </Typography>
                    <Chip
                      size="small"
                      label="✅ APPROVED CHEF"
                      sx={{ bgcolor: 'rgba(46,196,182,0.15)', color: '#2EC4B6', fontSize: '0.7rem', height: 20 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )
      )}

      {/* Reject Confirmation Dialog */}
      <Dialog
        open={Boolean(rejectPartnerData)}
        onClose={() => setRejectPartnerData(null)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', borderRadius: 3 } }}
      >
        <DialogTitle fontWeight="bold">Confirm Application Rejection</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to reject the chef application from <strong>{rejectPartnerData?.name}</strong> (Flat #{rejectPartnerData?.flat_number})?
            This will deactivate their partner profile.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejectPartnerData(null)} sx={{ color: '#aaa', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={processingId !== null}
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            {processingId !== null ? 'Rejecting...' : 'Reject Application'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
