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
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import { menusAPI, getErrorMessage } from '../../services/api';

const CATEGORY_COLORS = {
  veg: '#2EC4B6',
  'non-veg': '#E05A2B',
  snacks: '#F6BD60',
  desserts: '#FF6B6B',
  beverages: '#4D96FF',
  other: '#A0AEC0',
};

export default function PartnerMenu() {
  const context = useOutletContext() || {};
  const {
    menuItems = [],
    setMenuItems,
    handleOpenCreateMenu,
    handleOpenEditMenu,
    refreshData,
    setError,
    setActionSuccess,
  } = context;

  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredItems = menuItems.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  // Adjust portion quantity (+/-)
  const handleAdjustPortions = async (dishId, currentQty, delta) => {
    const newQty = Math.max(0, (currentQty || 0) + delta);
    try {
      if (menusAPI.updatePortions) {
        await menusAPI.updatePortions(dishId, newQty);
      } else {
        await menusAPI.update(dishId, { quantity: newQty, is_available: newQty > 0 });
      }
      setMenuItems?.((prev) =>
        prev.map((item) =>
          item.id === dishId ? { ...item, quantity: newQty, is_available: newQty > 0 } : item
        )
      );
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to update portions.'));
    }
  };

  // Toggle in-stock / out-of-stock
  const handleToggleAvailability = async (dishId, currentAvailable, quantity) => {
    const newAvailable = !currentAvailable;
    try {
      if (menusAPI.toggleAvailability) {
        await menusAPI.toggleAvailability(dishId, newAvailable);
      } else {
        await menusAPI.update(dishId, { is_available: newAvailable });
      }
      setMenuItems?.((prev) =>
        prev.map((item) => (item.id === dishId ? { ...item, is_available: newAvailable } : item))
      );
      setActionSuccess?.(newAvailable ? 'Dish marked IN STOCK! 🍲' : 'Dish marked SOLD OUT. ⏳');
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to update dish availability.'));
    }
  };

  // Duplicate dish
  const handleDuplicateDish = async (dish) => {
    try {
      const clonedPayload = {
        name: `${dish.name} (Copy)`,
        price: dish.price,
        category: dish.category,
        description: dish.description || '',
        quantity: dish.quantity || 15,
        is_available: true,
        spice_level: dish.spice_level || 'medium',
        image_url: dish.image_url || undefined,
        is_preorder_only: Boolean(dish.is_preorder_only),
        preorder_cutoff_time: dish.preorder_cutoff_time || '11:00',
        available_slots: dish.available_slots || ['lunch_today'],
        max_batch_quantity: dish.max_batch_quantity || dish.quantity || 15,
      };
      await menusAPI.create(clonedPayload);
      setActionSuccess?.(`Cloned '${dish.name}' successfully!`);
      refreshData?.();
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to duplicate dish.'));
    }
  };

  // Delete dish
  const handleDeleteDish = async (dishId, dishName) => {
    if (!window.confirm(`Are you sure you want to remove '${dishName}' from your menu?`)) {
      return;
    }
    try {
      await menusAPI.delete(dishId);
      setMenuItems?.((prev) => prev.filter((item) => item.id !== dishId));
      setActionSuccess?.(`Dish '${dishName}' deleted successfully.`);
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to delete dish.'));
    }
  };

  return (
    <Box>
      {/* Header controls & category filter */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={2}
        mb={3}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <RestaurantMenuIcon sx={{ color: '#E05A2B', fontSize: 28 }} />
          <Typography variant="h5" fontWeight="bold" color="#fff">
            Menu & Batch Inventory
          </Typography>
          <Chip
            label={`${menuItems.length} Dishes`}
            size="small"
            sx={{ bgcolor: 'rgba(224,90,43,0.15)', color: '#E05A2B', fontWeight: 'bold' }}
          />
        </Box>

        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          {/* Category Filter Pills */}
          {['all', 'veg', 'non-veg', 'snacks', 'desserts'].map((cat) => (
            <Chip
              key={cat}
              label={cat === 'all' ? 'All Items' : cat.toUpperCase()}
              clickable
              onClick={() => setCategoryFilter(cat)}
              sx={{
                bgcolor: categoryFilter === cat ? '#E05A2B' : 'rgba(255,255,255,0.06)',
                color: categoryFilter === cat ? '#fff' : 'text.secondary',
                fontWeight: categoryFilter === cat ? 'bold' : 'normal',
                '&:hover': { bgcolor: categoryFilter === cat ? '#c9481c' : 'rgba(255,255,255,0.12)' },
              }}
            />
          ))}

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
            + Add New Dish
          </Button>
        </Box>
      </Box>

      {/* Dishes Catalog Grid */}
      {filteredItems.length === 0 ? (
        <Card sx={{ bgcolor: '#191928', p: 6, textAlign: 'center', borderRadius: 3 }}>
          <RestaurantMenuIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" fontWeight="bold" color="#fff" mb={1}>
            No dishes found in this category
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Add fresh home-cooked dishes or scheduled pre-order batches for your society neighbors.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenCreateMenu}
            sx={{ bgcolor: '#E05A2B', fontWeight: 'bold' }}
          >
            Create Your First Dish
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {filteredItems.map((dish) => {
            const isSoldOut = !dish.is_available || (dish.quantity !== undefined && dish.quantity <= 0);
            const catColor = CATEGORY_COLORS[dish.category] || '#E05A2B';

            return (
              <Grid item xs={12} sm={6} md={4} key={dish.id}>
                <Card
                  sx={{
                    bgcolor: '#191928',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: isSoldOut ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
                    opacity: isSoldOut ? 0.8 : 1,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5} gap={1}>
                      <Box display="flex" alignItems="center" gap={0.8} flexWrap="wrap">
                        <Chip
                          label={dish.category?.toUpperCase() || 'DISH'}
                          size="small"
                          sx={{
                            bgcolor: `${catColor}22`,
                            color: catColor,
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                            height: 22,
                          }}
                        />

                        {/* Spice Level Indicator */}
                        {dish.spice_level && (
                          <Chip
                            icon={<LocalFireDepartmentIcon sx={{ fontSize: '13px !important' }} />}
                            label={
                              dish.spice_level === 'hot'
                                ? 'Hot'
                                : dish.spice_level === 'mild'
                                ? 'Mild'
                                : 'Medium'
                            }
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.06)',
                              color: dish.spice_level === 'hot' ? '#ff5252' : '#F6BD60',
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              height: 22,
                            }}
                          />
                        )}

                        {/* Low Stock Warning Badge */}
                        {dish.is_available && dish.quantity !== undefined && dish.quantity >= 1 && dish.quantity <= 3 && (
                          <Chip
                            label={`⚠️ Only ${dish.quantity} left`}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255, 152, 0, 0.15)',
                              color: '#ff9800',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              height: 22,
                              border: '1px solid rgba(255, 152, 0, 0.3)',
                            }}
                          />
                        )}
                      </Box>

                      {/* Action Icon Buttons */}
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="h6" fontWeight="bold" color="#E05A2B" sx={{ mr: 0.5 }}>
                          ₹{dish.price}
                        </Typography>
                        <Tooltip title="Edit dish details">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditMenu?.(dish)}
                            sx={{ color: '#aaa', '&:hover': { color: '#2EC4B6' } }}
                            aria-label={`Edit ${dish.name}`}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate / clone this dish">
                          <IconButton
                            size="small"
                            onClick={() => handleDuplicateDish(dish)}
                            sx={{ color: '#aaa', '&:hover': { color: '#F6BD60' } }}
                            aria-label={`Duplicate ${dish.name}`}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete dish">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDish(dish.id, dish.name)}
                            sx={{ color: '#aaa', '&:hover': { color: '#ff5252' } }}
                            aria-label={`Delete ${dish.name}`}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Dish Photo if available */}
                    {dish.image_url && (
                      <Box
                        component="img"
                        src={
                          dish.image_url.startsWith('http') || dish.image_url.startsWith('data:')
                            ? dish.image_url
                            : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${dish.image_url}`
                        }
                        alt={dish.name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                        sx={{
                          width: '100%',
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 2,
                          mb: 1.5,
                        }}
                      />
                    )}

                    <Typography variant="subtitle1" fontWeight="bold" color="#fff" mb={0.5}>
                      {dish.name}
                    </Typography>

                    {dish.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 1.5,
                          fontSize: '0.82rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {dish.description}
                      </Typography>
                    )}

                    {dish.is_preorder_only && (
                      <Box display="flex" alignItems="center" gap={0.8} mb={1.5}>
                        <AccessTimeIcon sx={{ color: '#F6BD60', fontSize: 16 }} />
                        <Typography variant="caption" color="#F6BD60">
                          Pre-Order Cutoff: {dish.preorder_cutoff_time || '11:00 AM'}
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1.5 }} />

                    {/* Portions Available & Stepper Controls */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Portions Available:
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.8} mt={0.5}>
                          <IconButton
                            size="small"
                            disabled={!dish.quantity || dish.quantity <= 0}
                            onClick={() => handleAdjustPortions(dish.id, dish.quantity, -1)}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              p: 0.5,
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                            }}
                            aria-label={`Decrease portions for ${dish.name}`}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>

                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={isSoldOut ? '#ff5252' : '#2EC4B6'}
                            sx={{ minWidth: 24, textAlign: 'center' }}
                          >
                            {dish.quantity ?? 0}
                          </Typography>

                          <IconButton
                            size="small"
                            onClick={() => handleAdjustPortions(dish.id, dish.quantity, 1)}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.08)',
                              color: '#fff',
                              p: 0.5,
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                            }}
                            aria-label={`Increase portions for ${dish.name}`}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>

                      {/* In-Stock Switch */}
                      <Box textAlign="right">
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={Boolean(dish.is_available && (dish.quantity === undefined || dish.quantity > 0))}
                              onChange={() => handleToggleAvailability(dish.id, dish.is_available, dish.quantity)}
                              color="success"
                            />
                          }
                          label={
                            <Typography
                              variant="caption"
                              fontWeight="bold"
                              color={dish.is_available && (dish.quantity === undefined || dish.quantity > 0) ? '#2EC4B6' : '#aaa'}
                            >
                              {dish.is_available && (dish.quantity === undefined || dish.quantity > 0) ? 'IN STOCK' : 'SOLD OUT'}
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                      </Box>
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
