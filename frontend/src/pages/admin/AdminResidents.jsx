import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

import { adminAPI, getErrorMessage } from '../../services/api';

export default function AdminResidents() {
  const context = useOutletContext() || {};
  const { setActionSuccess, setError, currentUser } = context;

  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Deactivation confirmation dialog
  const [statusConfirmUser, setStatusConfirmUser] = useState(null);
  const [targetNextStatus, setTargetNextStatus] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(false);

  const fetchResidents = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getResidents(0, 100);
      setResidents(res.data?.residents || []);
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to fetch resident members.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  const handleToggleStatus = (user, currentActive) => {
    if (user.id === currentUser?.id) {
      setError?.('Admins cannot deactivate their own account.');
      return;
    }
    setStatusConfirmUser(user);
    setTargetNextStatus(!currentActive);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusConfirmUser) return;
    try {
      setProcessingStatus(true);
      await adminAPI.setUserStatus(statusConfirmUser.id, targetNextStatus);
      setResidents((prev) =>
        prev.map((u) => (u.id === statusConfirmUser.id ? { ...u, is_active: targetNextStatus } : u))
      );
      setActionSuccess?.(
        `User #${statusConfirmUser.id} (${statusConfirmUser.name}) was ${
          targetNextStatus ? 'activated' : 'deactivated'
        }.`
      );
      setStatusConfirmUser(null);
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to update user active status.'));
    } finally {
      setProcessingStatus(false);
    }
  };

  const filteredResidents = residents.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.flat_number && r.flat_number.toLowerCase().includes(q));

    let matchesRole = true;
    if (roleFilter === 'resident') matchesRole = r.role === 'resident' || r.role === 'buyer';
    else if (roleFilter === 'partner') matchesRole = r.role === 'partner' || r.role === 'seller';
    else if (roleFilter === 'admin') matchesRole = r.role === 'admin';

    return matchesSearch && matchesRole;
  });

  return (
    <Box>
      <Box mb={2}>
        <Typography variant="h5" fontWeight="bold">
          Society Resident & Member Directory ({residents.length})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse verified apartment units, view member roles, and manage access status.
        </Typography>
      </Box>

      {/* Filter and Search Bar */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search by resident name, email, or flat #..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 260, '& .MuiInputBase-input': { color: '#fff' } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />

        <Box display="flex" gap={1} flexWrap="wrap">
          {[
            { id: 'all', label: 'All Members' },
            { id: 'resident', label: 'Residents' },
            { id: 'partner', label: 'Chefs / Partners' },
            { id: 'admin', label: 'Admins' },
          ].map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              onClick={() => setRoleFilter(item.id)}
              sx={{
                fontWeight: 'bold',
                bgcolor: roleFilter === item.id ? '#E05A2B' : '#1F1F35',
                color: '#fff',
                cursor: 'pointer',
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Member Table */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={8}>
              <CircularProgress sx={{ color: '#E05A2B' }} />
            </Box>
          ) : filteredResidents.length === 0 ? (
            <Box textAlign="center" py={8}>
              <PeopleAltIcon sx={{ fontSize: 44, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No resident members match your filter.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { color: 'text.secondary', borderColor: 'rgba(255,255,255,0.08)', fontWeight: 'bold' } }}>
                    <TableCell>Member Name</TableCell>
                    <TableCell>Flat Unit</TableCell>
                    <TableCell>Email Address</TableCell>
                    <TableCell>Primary Role</TableCell>
                    <TableCell align="center">Active Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredResidents.map((member) => {
                    const isSelf = member.id === currentUser?.id;
                    const isPartner = member.role === 'partner' || member.role === 'seller';
                    const isAdmin = member.role === 'admin';

                    return (
                      <TableRow key={member.id} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.06)', color: '#fff' } }}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: isPartner ? '#E05A2B' : isAdmin ? '#2EC4B6' : '#5C6BC0', fontSize: '0.9rem' }}>
                              {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {member.name || 'Resident'} {isSelf && '(You)'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID #{member.id}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="#F6BD60">
                            {member.flat_number ? `Flat #${member.flat_number}` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="rgba(255,255,255,0.8)">
                            {member.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={
                              isAdmin ? '🛡️ Admin' : isPartner ? '🍳 Home Chef' : '🛒 Resident'
                            }
                            sx={{
                              bgcolor:
                                isAdmin
                                  ? 'rgba(46,196,182,0.15)'
                                  : isPartner
                                  ? 'rgba(224,90,43,0.15)'
                                  : 'rgba(255,255,255,0.08)',
                              color:
                                isAdmin
                                  ? '#2EC4B6'
                                  : isPartner
                                  ? '#E05A2B'
                                  : '#fff',
                              fontWeight: 'bold',
                              fontSize: '0.75rem',
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Switch
                            size="small"
                            checked={Boolean(member.is_active)}
                            disabled={isSelf}
                            onChange={() => handleToggleStatus(member, member.is_active)}
                            color="success"
                          />
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

      {/* Confirmation Dialog for Status Change */}
      <Dialog
        open={Boolean(statusConfirmUser)}
        onClose={() => setStatusConfirmUser(null)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', borderRadius: 3 } }}
      >
        <DialogTitle fontWeight="bold">
          {targetNextStatus ? 'Activate User Account' : 'Deactivate User Account'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to <strong>{targetNextStatus ? 'activate' : 'deactivate'}</strong> account for{' '}
            <strong>{statusConfirmUser?.name || statusConfirmUser?.email}</strong>?
            {!targetNextStatus && ' Deactivated members cannot sign in or place food orders.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setStatusConfirmUser(null)} sx={{ color: '#aaa', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={targetNextStatus ? 'success' : 'error'}
            onClick={handleConfirmStatusChange}
            disabled={processingStatus}
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
          >
            {processingStatus ? 'Updating...' : targetNextStatus ? 'Activate' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
