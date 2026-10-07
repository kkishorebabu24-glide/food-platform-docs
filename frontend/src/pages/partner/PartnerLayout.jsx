import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Outlet,
  useLocation,
  Link,
} from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Chip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Avatar,
  Badge,
  IconButton,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloseIcon from '@mui/icons-material/Close';

import {
  ordersAPI,
  sellersAPI,
  menusAPI,
  paymentsAPI,
  getErrorMessage,
} from '../../services/api';

export default function PartnerLayout({ currentUser }) {
  const location = useLocation();

  const [sellerProfile, setSellerProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [balance, setBalance] = useState({ current_balance: 0, total_earned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // SaaS Pass & Platform Maintenance Quota
  const [maintenanceStatus, setMaintenanceStatus] = useState(null);
  const [openTopupDialog, setOpenTopupDialog] = useState(false);
  const [topupAmount, setTopupAmount] = useState(100);
  const [topupUtr, setTopupUtr] = useState('');
  const [submittingTopup, setSubmittingTopup] = useState(false);

  // Global Menu Dialog (Create & Edit)
  const [openNewMenu, setOpenNewMenu] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState(120);
  const [menuCat, setMenuCat] = useState('veg');
  const [menuDesc, setMenuDesc] = useState('');
  const [menuPortions, setMenuPortions] = useState(15);
  const [menuSpiceLevel, setMenuSpiceLevel] = useState('medium');
  const [menuImageUrl, setMenuImageUrl] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [isPreorder, setIsPreorder] = useState(true);
  const [cutoffTime, setCutoffTime] = useState('11:00');
  const [maxBatch, setMaxBatch] = useState(15);
  const [submittingMenu, setSubmittingMenu] = useState(false);
  const fileInputRef = React.useRef(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const sellerId =
        currentUser?.id ||
        (() => {
          try {
            return JSON.parse(localStorage.getItem('user') || 'null')?.id;
          } catch {
            return null;
          }
        })();

      const [profRes, ordersRes, balRes, menusRes, maintRes] = await Promise.all([
        sellersAPI.getMe().catch(() => ({ data: null })),
        ordersAPI.list(0, 50).catch(() => ({ data: { orders: [] } })),
        paymentsAPI.getBalance().catch(() => ({ data: { current_balance: 0, total_earned: 0 } })),
        sellerId
          ? menusAPI.bySeller(sellerId, null, null, false).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        paymentsAPI.getMaintenanceStatus
          ? paymentsAPI.getMaintenanceStatus().catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);

      if (profRes.data) setSellerProfile(profRes.data);
      if (maintRes.data) setMaintenanceStatus(maintRes.data);
      setOrders(ordersRes.data?.orders || []);
      setBalance(balRes.data || { current_balance: 0, total_earned: 0 });

      const rawMenuData = menusRes.data;
      const fetchedItems = Array.isArray(rawMenuData)
        ? rawMenuData
        : (rawMenuData?.items || []);
      setMenuItems(fetchedItems);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch partner workspace data.'));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleToggleStoreOpen = async (e) => {
    const nextStatus = e.target.checked;
    try {
      await sellersAPI.setOpenStatus(nextStatus);
      setSellerProfile((prev) => (prev ? { ...prev, is_open: nextStatus } : null));
      setActionSuccess(nextStatus ? 'Kitchen is now OPEN for orders! 🍳' : 'Kitchen is now CLOSED. 🔒');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change kitchen status.'));
    }
  };

  const handleSaveMenuSubmit = async () => {
    if (!menuName.trim()) return;
    try {
      setSubmittingMenu(true);
      setError(null);
      const portionsVal = parseInt(menuPortions, 10) || 0;
      const menuPayload = {
        name: menuName.trim(),
        price: parseFloat(menuPrice),
        category: menuCat,
        description: menuDesc ? menuDesc.trim() : undefined,
        quantity: portionsVal,
        is_available: portionsVal > 0,
        spice_level: menuSpiceLevel || 'medium',
        image_url: menuImageUrl ? menuImageUrl.trim() : undefined,
        is_preorder_only: isPreorder,
        preorder_cutoff_time: isPreorder ? cutoffTime : undefined,
        available_slots: isPreorder ? ['lunch_today', 'dinner_today'] : undefined,
        max_batch_quantity: isPreorder ? (parseInt(maxBatch, 10) || portionsVal) : portionsVal,
      };

      let targetMenuId = editingMenuId;

      if (editingMenuId) {
        await menusAPI.update(editingMenuId, menuPayload);
        setActionSuccess(`Dish '${menuName}' updated successfully!`);
      } else {
        const createRes = await menusAPI.create(menuPayload);
        targetMenuId = createRes?.data?.id;
        setActionSuccess('Menu item / Pre-order batch created successfully!');
      }

      if (selectedImageFile && targetMenuId) {
        try {
          await menusAPI.uploadImage(targetMenuId, selectedImageFile);
          setActionSuccess(`Dish '${menuName}' saved & photo uploaded!`);
        } catch (uploadErr) {
          setError(getErrorMessage(uploadErr, 'Dish saved, but failed to upload photo.'));
        }
      }

      setOpenNewMenu(false);
      setEditingMenuId(null);
      setSelectedImageFile(null);
      setImagePreviewUrl('');
      fetchDashboardData();
    } catch (err) {
      setError(getErrorMessage(err, editingMenuId ? 'Failed to update menu item.' : 'Failed to create menu item.'));
    } finally {
      setSubmittingMenu(false);
    }
  };

  const handleOpenCreateMenu = () => {
    setEditingMenuId(null);
    setMenuName('');
    setMenuPrice(120);
    setMenuCat('veg');
    setMenuDesc('');
    setMenuPortions(15);
    setMenuSpiceLevel('medium');
    setMenuImageUrl('');
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setIsPreorder(true);
    setCutoffTime('11:00');
    setMaxBatch(15);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpenNewMenu(true);
  };

  const handleOpenEditMenu = (dish) => {
    setEditingMenuId(dish.id);
    setMenuName(dish.name || '');
    setMenuPrice(dish.price || 120);
    setMenuCat(dish.category || 'veg');
    setMenuDesc(dish.description || '');
    setMenuPortions(dish.quantity !== undefined ? dish.quantity : 15);
    setMenuSpiceLevel(dish.spice_level || 'medium');
    setMenuImageUrl(dish.image_url || '');
    setSelectedImageFile(null);
    const resolvedUrl = dish.image_url
      ? (dish.image_url.startsWith('http') || dish.image_url.startsWith('data:')
          ? dish.image_url
          : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${dish.image_url}`)
      : '';
    setImagePreviewUrl(resolvedUrl);
    setIsPreorder(Boolean(dish.is_preorder_only));
    setCutoffTime(dish.preorder_cutoff_time || '11:00');
    setMaxBatch(dish.max_batch_quantity || dish.quantity || 15);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpenNewMenu(true);
  };

  const handleTopupSubmit = async () => {
    if (!topupUtr.trim()) {
      setError('Please enter the 12-digit UPI Transaction Reference (UTR) number.');
      return;
    }
    try {
      setSubmittingTopup(true);
      setError(null);
      await paymentsAPI.topupMaintenanceWallet({
        amount: parseFloat(topupAmount),
        utr_reference: topupUtr.trim(),
      });
      setActionSuccess(`Top-up of ₹${topupAmount} submitted! Pending admin ledger verification.`);
      setOpenTopupDialog(false);
      setTopupUtr('');
      fetchDashboardData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit wallet recharge.'));
    } finally {
      setSubmittingTopup(false);
    }
  };

  // Determine current active tab based on URL path
  const currentPath = location.pathname;
  let activeTab = 0;
  if (currentPath.includes('/partner/orders')) activeTab = 1;
  else if (currentPath.includes('/partner/menu')) activeTab = 2;
  else if (currentPath.includes('/partner/gallery')) activeTab = 3;
  else if (currentPath.includes('/partner/finances')) activeTab = 4;

  const activeOrdersCount = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;

  const contextValue = {
    sellerProfile,
    setSellerProfile,
    orders,
    setOrders,
    menuItems,
    setMenuItems,
    balance,
    setBalance,
    maintenanceStatus,
    setMaintenanceStatus,
    loading,
    error,
    setError,
    actionSuccess,
    setActionSuccess,
    refreshData: fetchDashboardData,
    handleToggleStoreOpen,
    handleOpenCreateMenu,
    handleOpenEditMenu,
    setOpenTopupDialog,
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4, minHeight: '85vh' }}>
      {/* Partner Kitchen Header Bar */}
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
          <Avatar
            src={sellerProfile?.photo_url || undefined}
            sx={{
              width: 56,
              height: 56,
              bgcolor: '#E05A2B',
              border: '2px solid #2EC4B6',
              fontWeight: 'bold',
              fontSize: '1.4rem',
            }}
          >
            {sellerProfile?.name?.[0]?.toUpperCase() || 'C'}
          </Avatar>
          <Box>
            <Box display="flex" alignItems="center" gap={1.2} flexWrap="wrap">
              <Typography variant="h5" fontWeight="bold">
                {sellerProfile?.name || 'Home Chef Workspace'}
              </Typography>
              <Chip
                size="small"
                label={sellerProfile?.flat_number ? `Flat #${sellerProfile.flat_number}` : 'Home Chef'}
                sx={{ bgcolor: 'rgba(246,189,96,0.15)', color: '#F6BD60', fontWeight: 'bold' }}
              />
              {maintenanceStatus && (
                <Chip
                  size="small"
                  label={
                    maintenanceStatus.free_orders_remaining > 0
                      ? `🟢 ${maintenanceStatus.free_orders_remaining}/${maintenanceStatus.free_orders_total} Free Orders`
                      : `⚡ Wallet ₹${maintenanceStatus.maintenance_balance?.toFixed(0) || 0}`
                  }
                  sx={{
                    bgcolor: maintenanceStatus.free_orders_remaining > 0 ? 'rgba(46,196,182,0.15)' : 'rgba(224,90,43,0.15)',
                    color: maintenanceStatus.free_orders_remaining > 0 ? '#2EC4B6' : '#E05A2B',
                    fontWeight: 'bold',
                  }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Direct P2PM Community Kitchen Management • Real-time Order Fulfillment
            </Typography>
          </Box>
        </Box>

        {/* Action Controls: Kitchen Switch & Quick Add Dish */}
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <FormControlLabel
            control={
              <Switch
                checked={sellerProfile?.is_open ?? true}
                onChange={handleToggleStoreOpen}
                color="success"
              />
            }
            label={
              <Typography fontWeight="bold" color={sellerProfile?.is_open ? '#2EC4B6' : '#aaa'} sx={{ fontSize: '0.9rem' }}>
                {sellerProfile?.is_open ? 'KITCHEN OPEN' : 'KITCHEN CLOSED'}
              </Typography>
            }
          />

          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenCreateMenu}
            sx={{
              bgcolor: '#E05A2B',
              fontWeight: 'bold',
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': { bgcolor: '#c9481c' },
            }}
          >
            + Add Dish
          </Button>
        </Box>
      </Box>

      {/* Global Alerts */}
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {actionSuccess && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setActionSuccess(null)}>{actionSuccess}</Alert>}

      {/* Partner Sub-Navigation Tabs */}
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
              '&.Mui-selected': {
                color: '#E05A2B',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#E05A2B',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab
            icon={<DashboardIcon fontSize="small" />}
            iconPosition="start"
            label="Overview"
            component={Link}
            to="/partner"
          />
          <Tab
            icon={
              <Badge badgeContent={activeOrdersCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}>
                <DeliveryDiningIcon fontSize="small" />
              </Badge>
            }
            iconPosition="start"
            label="Live Orders"
            component={Link}
            to="/partner/orders"
          />
          <Tab
            icon={
              <Badge badgeContent={menuItems.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}>
                <RestaurantMenuIcon fontSize="small" />
              </Badge>
            }
            iconPosition="start"
            label="Menu & Batches"
            component={Link}
            to="/partner/menu"
          />
          <Tab
            icon={<PhotoCameraIcon fontSize="small" />}
            iconPosition="start"
            label="Gallery & Branding"
            component={Link}
            to="/partner/gallery"
          />
          <Tab
            icon={<AccountBalanceWalletIcon fontSize="small" />}
            iconPosition="start"
            label="Finances & SaaS Pass"
            component={Link}
            to="/partner/finances"
          />
        </Tabs>
      </Box>

      {/* Sub-Page Content Container */}
      {loading && !sellerProfile ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: '#E05A2B' }} />
        </Box>
      ) : (
        <Outlet context={contextValue} />
      )}

      {/* Shared Create / Edit Dish Modal */}
      <Dialog
        open={openNewMenu}
        onClose={() => setOpenNewMenu(false)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 500, borderRadius: 3 } }}
      >
        <DialogTitle fontWeight="bold" display="flex" justifyContent="space-between" alignItems="center">
          {editingMenuId ? '✏️ Edit Menu Item' : '✨ Create Dish or Pre-Order Batch'}
          <IconButton size="small" onClick={() => setOpenNewMenu(false)} sx={{ color: '#aaa' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Dish Name"
            value={menuName}
            onChange={(e) => setMenuName(e.target.value)}
            margin="dense"
            sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' } }}
          />

          <Box display="flex" gap={2} mb={2}>
            <TextField
              fullWidth
              type="number"
              label="Portion Price (₹)"
              value={menuPrice}
              onChange={(e) => setMenuPrice(e.target.value)}
              sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
            />
            <TextField
              fullWidth
              type="number"
              label="Portions Available"
              value={menuPortions}
              onChange={(e) => setMenuPortions(e.target.value)}
              sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
            />
          </Box>

          <Box display="flex" gap={2} mb={2}>
            <TextField
              select
              fullWidth
              label="Category"
              value={menuCat}
              onChange={(e) => setMenuCat(e.target.value)}
              sx={{ '& .MuiSelect-select': { color: '#fff' } }}
            >
              <MenuItem value="veg">🟢 Pure Veg</MenuItem>
              <MenuItem value="non-veg">🔴 Non-Veg</MenuItem>
              <MenuItem value="snacks">🥟 Evening Snacks</MenuItem>
              <MenuItem value="desserts">🍰 Desserts & Sweets</MenuItem>
              <MenuItem value="beverages">☕ Beverages & Chai</MenuItem>
            </TextField>

            <TextField
              select
              fullWidth
              label="Spice Level"
              value={menuSpiceLevel}
              onChange={(e) => setMenuSpiceLevel(e.target.value)}
              sx={{ '& .MuiSelect-select': { color: '#fff' } }}
            >
              <MenuItem value="mild">🌱 Mild (Kid-friendly)</MenuItem>
              <MenuItem value="medium">🌶️ Medium (Balanced)</MenuItem>
              <MenuItem value="hot">🔥 Spicy (Authentic Desi)</MenuItem>
              <MenuItem value="extra_hot">💥 Extra Hot (Fiery)</MenuItem>
            </TextField>
          </Box>

          {/* Pre-Order Batch Option */}
          <Box p={2} mb={2} bgcolor="#1F1F35" borderRadius={2} border="1px solid rgba(255,255,255,0.06)">
            <FormControlLabel
              control={
                <Switch
                  checked={isPreorder}
                  onChange={(e) => setIsPreorder(e.target.checked)}
                  color="warning"
                />
              }
              label={
                <Typography fontWeight="bold" color="#F6BD60">
                  Scheduled Pre-Order Batch (Recommended)
                </Typography>
              }
            />
            {isPreorder && (
              <Box display="flex" gap={2} mt={1.5}>
                <TextField
                  fullWidth
                  type="time"
                  label="Order Cutoff Time"
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Batch Limit (Max Portions)"
                  value={maxBatch}
                  onChange={(e) => setMaxBatch(e.target.value)}
                  sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
                />
              </Box>
            )}
          </Box>

          {/* Dish Image Upload */}
          <Box mb={2}>
            <Typography variant="body2" fontWeight="bold" mb={1}>
              Dish Photo (Upload file or paste URL):
            </Typography>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedImageFile(file);
                  setImagePreviewUrl(URL.createObjectURL(file));
                }
              }}
            />
            <Box display="flex" gap={1.5} alignItems="center" mb={1.5}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PhotoCameraIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ color: '#E05A2B', borderColor: '#E05A2B', textTransform: 'none' }}
              >
                {selectedImageFile ? 'Change Photo' : 'Upload Image File'}
              </Button>
              {selectedImageFile && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                  {selectedImageFile.name}
                </Typography>
              )}
            </Box>

            <TextField
              fullWidth
              label="Or Image URL"
              placeholder="https://..."
              value={menuImageUrl}
              onChange={(e) => {
                setMenuImageUrl(e.target.value);
                if (!selectedImageFile) setImagePreviewUrl(e.target.value);
              }}
              sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
            />

            {imagePreviewUrl && (
              <Box mt={1.5} borderRadius={2} overflow="hidden" height={140} position="relative">
                <Box
                  component="img"
                  src={imagePreviewUrl}
                  alt="Preview"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
            )}
          </Box>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Description & Ingredients"
            placeholder="E.g., Slow-cooked with homemade ghee and freshly ground spices."
            value={menuDesc}
            onChange={(e) => setMenuDesc(e.target.value)}
            sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenNewMenu(false)} sx={{ color: '#aaa', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveMenuSubmit}
            disabled={submittingMenu || !menuName.trim()}
            sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', textTransform: 'none', '&:hover': { bgcolor: '#c9481c' } }}
          >
            {submittingMenu ? 'Saving...' : editingMenuId ? 'Save Changes' : 'Create Dish'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shared SaaS Pass Topup Dialog */}
      <Dialog
        open={openTopupDialog}
        onClose={() => setOpenTopupDialog(false)}
        PaperProps={{ sx: { bgcolor: '#161622', color: '#fff', width: 440, borderRadius: 3 } }}
      >
        <DialogTitle fontWeight="bold">
          ⚡ Top Up Maintenance Wallet
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Pay via UPI to society admin handle to top up maintenance credits (₹5 deducted per successfully completed order).
          </Typography>
          <Box bgcolor="#1F1F35" p={2} borderRadius={2} mb={2.5} textAlign="center">
            <Typography variant="caption" color="text.secondary">Admin Society UPI ID</Typography>
            <Typography variant="h6" fontWeight="bold" color="#2EC4B6" mt={0.5}>
              societyadmin@upi
            </Typography>
          </Box>
          <TextField
            select
            fullWidth
            label="Recharge Amount (₹)"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            sx={{ mb: 2, '& .MuiSelect-select': { color: '#fff' } }}
          >
            <MenuItem value={100}>₹100 (20 orders)</MenuItem>
            <MenuItem value={250}>₹250 (50 orders)</MenuItem>
            <MenuItem value={500}>₹500 (100 orders)</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label="12-digit UPI UTR / Ref Number"
            placeholder="e.g. 423984712093"
            value={topupUtr}
            onChange={(e) => setTopupUtr(e.target.value)}
            sx={{ '& .MuiInputBase-input': { color: '#fff' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenTopupDialog(false)} sx={{ color: '#aaa', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleTopupSubmit}
            disabled={submittingTopup || !topupUtr.trim()}
            sx={{ bgcolor: '#4caf50', fontWeight: 'bold', textTransform: 'none', '&:hover': { bgcolor: '#388e3c' } }}
          >
            {submittingTopup ? 'Submitting...' : 'Confirm Recharge'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

PartnerLayout.propTypes = {
  currentUser: PropTypes.object,
};
