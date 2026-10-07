import React, { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  IconButton,
  Chip,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { sellersAPI, getErrorMessage } from '../../services/api';

const BACKGROUND_PRESETS = [
  { id: 'bakery', name: '🥖 Bakery & Sweets', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&auto=format&fit=crop&q=80' },
  { id: 'south_indian', name: '🥘 South Indian Kitchen', url: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=1200&auto=format&fit=crop&q=80' },
  { id: 'north_spices', name: '🍛 North Indian Spices', url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=1200&auto=format&fit=crop&q=80' },
  { id: 'healthy', name: '🥗 Fresh & Healthy Bowls', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&auto=format&fit=crop&q=80' },
  { id: 'street_tiffins', name: '🥟 Street Food & Tiffins', url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=1200&auto=format&fit=crop&q=80' },
  { id: 'pure_veg', name: '🌿 Pure Veg Sattvic', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop&q=80' },
  { id: 'cafe', name: '☕ Cafe & Beverages', url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&auto=format&fit=crop&q=80' },
];

export default function PartnerGallery() {
  const context = useOutletContext() || {};
  const {
    sellerProfile,
    setSellerProfile,
    setActionSuccess,
    setError,
  } = context;

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await sellersAPI.uploadPhoto(file);
      setSellerProfile?.((prev) => (prev ? { ...prev, photo_url: res.data.photo_url } : null));
      setActionSuccess?.('Chef avatar photo updated successfully! 📸');
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to upload avatar photo.'));
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await sellersAPI.uploadBanner(file);
      setSellerProfile?.((prev) => (prev ? { ...prev, banner_url: res.data.banner_url } : null));
      setActionSuccess?.('Kitchen banner updated successfully! 🖼️');
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to upload kitchen banner.'));
    }
  };

  const handleSelectPresetBanner = async (presetUrl) => {
    try {
      await sellersAPI.updateProfile({ banner_url: presetUrl });
      setSellerProfile?.((prev) => (prev ? { ...prev, banner_url: presetUrl } : null));
      setActionSuccess?.('Kitchen background preset applied! ✨');
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to update kitchen background.'));
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setUploadingGallery(true);
      const res = await sellersAPI.uploadPhotos(files);
      setSellerProfile?.((prev) => (prev ? { ...prev, photos: res.data.photos } : null));
      setActionSuccess?.(`${files.length} photo(s) added to kitchen gallery! 📸`);
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to upload gallery photos.'));
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleDeleteGalleryPhoto = async (photoUrl) => {
    try {
      const res = await sellersAPI.deletePhoto(photoUrl);
      setSellerProfile?.((prev) => (prev ? { ...prev, photos: res.data.photos } : null));
      setActionSuccess?.('Photo removed from kitchen gallery.');
    } catch (err) {
      setError?.(getErrorMessage(err, 'Failed to delete photo.'));
    }
  };

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Kitchen Branding & Multi-Photo Showcase
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Customize your profile photo, cover banner, and upload high-resolution kitchen prep photos.
        </Typography>
      </Box>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={avatarInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleAvatarUpload}
      />
      <input
        type="file"
        ref={bannerInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleBannerUpload}
      />
      <input
        type="file"
        ref={galleryInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
        onChange={handleGalleryUpload}
      />

      {/* Section 1: Storefront Header Live Preview */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', mb: 4, overflow: 'hidden' }}>
        <Box
          sx={{
            height: 180,
            position: 'relative',
            backgroundImage: `url(${sellerProfile?.banner_url || BACKGROUND_PRESETS[1].url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.45)' }} />

          <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<PhotoCameraIcon />}
              onClick={() => bannerInputRef.current?.click()}
              sx={{ bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', textTransform: 'none', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
            >
              Upload Custom Banner
            </Button>
          </Box>

          <Box sx={{ position: 'absolute', bottom: -30, left: 24, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            <Box position="relative">
              <Avatar
                src={sellerProfile?.photo_url || undefined}
                sx={{
                  width: 90,
                  height: 90,
                  bgcolor: '#E05A2B',
                  border: '3px solid #191928',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                }}
              >
                {sellerProfile?.name?.[0]?.toUpperCase() || 'C'}
              </Avatar>
              <IconButton
                size="small"
                onClick={() => avatarInputRef.current?.click()}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: '#E05A2B',
                  color: '#fff',
                  '&:hover': { bgcolor: '#c9481c' },
                }}
              >
                <PhotoCameraIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        <CardContent sx={{ pt: 5, px: 3, pb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {sellerProfile?.name || 'Chef Storefront Preview'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {sellerProfile?.bio || 'Delicious homemade food prepared fresh with love.'}
              </Typography>
            </Box>
            <Chip
              label={sellerProfile?.flat_number ? `Unit #${sellerProfile.flat_number}` : 'Home Chef'}
              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 'bold' }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Section 2: Curated Background Presets */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={0.5}>
            ✨ Curated Kitchen Background Presets
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2.5}>
            One-click apply professional culinary backgrounds to your store card:
          </Typography>

          <Grid container spacing={2}>
            {BACKGROUND_PRESETS.map((preset) => {
              const isSelected = sellerProfile?.banner_url === preset.url;
              return (
                <Grid item xs={6} sm={4} md={3} key={preset.id}>
                  <Box
                    onClick={() => handleSelectPresetBanner(preset.url)}
                    sx={{
                      height: 110,
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: isSelected ? '#2EC4B6' : 'rgba(255,255,255,0.1)',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: '#E05A2B', transform: 'scale(1.02)' },
                    }}
                  >
                    <Box
                      component="img"
                      src={preset.url}
                      alt={preset.name}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      {isSelected ? (
                        <CheckCircleIcon sx={{ color: '#2EC4B6', fontSize: 20 }} />
                      ) : <Box />}
                      <Typography variant="caption" fontWeight="bold" color="#fff" noWrap>
                        {preset.name}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Section 3: Multi-Photo Kitchen Gallery */}
      <Card sx={{ bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1.5}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                📸 Multi-Photo Kitchen Gallery ({(sellerProfile?.photos || []).length})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload photos of your kitchen setup, hygienic prep areas, and signature dish plating.
              </Typography>
            </Box>

            <Button
              variant="contained"
              size="small"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingGallery}
              sx={{ bgcolor: '#E05A2B', textTransform: 'none', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
            >
              {uploadingGallery ? 'Uploading...' : '+ Add Photos'}
            </Button>
          </Box>

          {(!sellerProfile?.photos || sellerProfile.photos.length === 0) ? (
            <Box textAlign="center" py={6} bgcolor="#1F1F35" borderRadius={2} border="1px dashed rgba(255,255,255,0.1)">
              <PhotoCameraIcon sx={{ fontSize: 44, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No kitchen photos uploaded yet.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => galleryInputRef.current?.click()}
                sx={{ mt: 1.5, color: '#E05A2B', borderColor: '#E05A2B', textTransform: 'none' }}
              >
                Upload First Photo
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {sellerProfile.photos.map((photoUrl, idx) => (
                <Grid item xs={6} sm={4} md={3} key={idx}>
                  <Box
                    sx={{
                      height: 140,
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid rgba(255,255,255,0.1)',
                      '&:hover .delete-overlay': { opacity: 1 },
                    }}
                  >
                    <Box
                      component="img"
                      src={photoUrl.startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${photoUrl}` : photoUrl}
                      alt={`Kitchen Photo ${idx + 1}`}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <Box
                      className="delete-overlay"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteGalleryPhoto(photoUrl)}
                        sx={{ bgcolor: 'rgba(224, 90, 43, 0.9)', color: '#fff', '&:hover': { bgcolor: '#c9481c' } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
