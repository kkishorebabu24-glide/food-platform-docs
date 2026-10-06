import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import StorefrontIcon from '@mui/icons-material/Storefront';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import StarIcon from '@mui/icons-material/Star';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const SLOT_SHORT_LABELS = {
  lunch_today: '☀️ Lunch Today',
  dinner_today: '🌙 Dinner Today',
  lunch_tomorrow: '☀️ Lunch Tomorrow',
  dinner_tomorrow: '🌙 Dinner Tomorrow',
  weekend_special: '🎉 Weekend Special',
};

const getApiOrigin = () => {
  const raw = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
};

// Fallback high-aesthetic dish photography based on category/keywords
export function getDishImageUrl(item) {
  if (item?.image_url) {
    const trimmed = item.image_url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return `${getApiOrigin()}${trimmed}`;
    }
  }
  const name = (item?.name || '').toLowerCase();
  const category = (item?.category || '').toLowerCase();

  if (name.includes('paneer') || name.includes('tikka') || name.includes('curry')) {
    return 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('biryani') || name.includes('rice') || name.includes('pulao')) {
    return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('dosa') || name.includes('idli') || name.includes('sambar')) {
    return 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('cake') || name.includes('jamun') || category === 'desserts' || name.includes('halwa') || name.includes('sweet')) {
    return 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?w=800&auto=format&fit=crop&q=80';
  }
  if (name.includes('tea') || name.includes('coffee') || category === 'beverages' || name.includes('chai') || name.includes('lassi')) {
    return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop&q=80';
  }
  if (category === 'snacks' || name.includes('samosa') || name.includes('pakora') || name.includes('chaat')) {
    return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80';
  }
  if (category === 'non_veg' || category === 'non-veg' || name.includes('chicken') || name.includes('mutton') || name.includes('fish')) {
    return 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80';
  }
  // Default fresh home-cooked meal
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80';
}

export default function DishImageModal({
  open,
  onClose,
  item,
  items = [],
  currentIndex = 0,
  onIndexChange,
  sellerName,
  sellerFlat,
  onAddToCart,
  isSelfKitchen = false,
}) {
  const activeList = items && items.length > 0 ? items : (item ? [item] : []);
  const [internalIndex, setInternalIndex] = useState(currentIndex || 0);
  const [isFavorite, setIsFavorite] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    setInternalIndex(currentIndex || 0);
  }, [currentIndex]);

  const activeIndex = onIndexChange ? (currentIndex ?? 0) : internalIndex;
  const currentDish = activeList[activeIndex] || item;

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    if (activeList.length <= 1) return;
    const nextIdx = activeIndex === 0 ? activeList.length - 1 : activeIndex - 1;
    if (onIndexChange) {
      onIndexChange(nextIdx);
    } else {
      setInternalIndex(nextIdx);
    }
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (activeList.length <= 1) return;
    const nextIdx = activeIndex === activeList.length - 1 ? 0 : activeIndex + 1;
    if (onIndexChange) {
      onIndexChange(nextIdx);
    } else {
      setInternalIndex(nextIdx);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeIndex, activeList.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 40) {
      handleNext();
    } else if (diff < -40) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  if (!currentDish) return null;

  const imageUrl = getDishImageUrl(currentDish);
  const isVeg = currentDish.category === 'veg' || (!currentDish.category?.includes('non') && !currentDish.name?.toLowerCase().includes('chicken') && !currentDish.name?.toLowerCase().includes('mutton'));
  const currentSellerName = currentDish.seller_name || sellerName;
  const currentSellerFlat = currentDish.seller_flat || sellerFlat;

  const spiceBadge = currentDish.spice_level === 'hot'
    ? '🌶️🌶️🌶️ Hot'
    : currentDish.spice_level === 'mild'
    ? '🌶️ Mild'
    : '🌶️🌶️ Medium';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#191928',
          color: '#fff',
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
        },
      }}
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(10, 10, 18, 0.75)',
          backdropFilter: 'blur(8px)',
        },
      }}
    >
      {/* Top Image Banner with Sliding Carousel Controls */}
      <Box
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        sx={{
          position: 'relative',
          width: '100%',
          height: { xs: 250, sm: 320 },
          bgcolor: '#12121e',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <Box
          key={currentDish.id || activeIndex}
          component="img"
          src={imageUrl}
          alt={currentDish.name}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            animation: 'fadeInSlide 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            '@keyframes fadeInSlide': {
              from: { opacity: 0.5, transform: 'scale(0.97)' },
              to: { opacity: 1, transform: 'scale(1)' },
            },
          }}
        />

        {/* Floating Prev & Next Navigation Buttons */}
        {activeList.length > 1 && (
          <>
            <IconButton
              aria-label="Previous dish"
              onClick={handlePrev}
              sx={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: 12,
                bgcolor: 'rgba(18, 18, 30, 0.75)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                zIndex: 4,
                '&:hover': { bgcolor: '#E05A2B', transform: 'translateY(-50%) scale(1.1)' },
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronLeftIcon />
            </IconButton>

            <IconButton
              aria-label="Next dish"
              onClick={handleNext}
              sx={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                right: 12,
                bgcolor: 'rgba(18, 18, 30, 0.75)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                zIndex: 4,
                '&:hover': { bgcolor: '#E05A2B', transform: 'translateY(-50%) scale(1.1)' },
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        )}

        {/* Top-Left Badges: Counter, Category & Rating */}
        <Box sx={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 1, flexWrap: 'wrap', zIndex: 3 }}>
          {activeList.length > 1 && (
            <Chip
              label={`Dish ${activeIndex + 1} of ${activeList.length}`}
              size="small"
              sx={{
                bgcolor: 'rgba(224, 90, 43, 0.9)',
                color: '#fff',
                fontWeight: 'bold',
                backdropFilter: 'blur(6px)',
              }}
            />
          )}
          <Chip
            label={isVeg ? '🟢 Pure Veg' : '🔴 Non-Veg'}
            size="small"
            sx={{
              bgcolor: 'rgba(22, 22, 34, 0.85)',
              color: '#fff',
              backdropFilter: 'blur(6px)',
              fontWeight: 'bold',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          />
          <Chip
            icon={<StarIcon sx={{ color: '#F6BD60 !important', fontSize: '15px !important' }} />}
            label="4.8"
            size="small"
            sx={{
              bgcolor: 'rgba(22, 22, 34, 0.85)',
              color: '#fff',
              backdropFilter: 'blur(6px)',
              fontWeight: 'bold',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          />
        </Box>

        {/* Top-Right Action Controls: Favorite Heart & Close */}
        <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 1, zIndex: 3 }}>
          <IconButton
            onClick={() => setIsFavorite(!isFavorite)}
            aria-label="favorite"
            sx={{
              bgcolor: 'rgba(0,0,0,0.6)',
              color: isFavorite ? '#E05A2B' : '#fff',
              backdropFilter: 'blur(6px)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
            }}
          >
            {isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          </IconButton>

          <IconButton
            onClick={onClose}
            aria-label="close"
            sx={{
              bgcolor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              backdropFilter: 'blur(6px)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Content Section */}
      <DialogContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Typography variant="h5" fontWeight="bold" color="#fff">
              {currentDish.name}
            </Typography>
            {(currentSellerName || currentSellerFlat) && (
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                by <strong>{currentSellerName || 'Home Chef'}</strong> {currentSellerFlat ? `(Flat #${currentSellerFlat})` : ''}
              </Typography>
            )}
          </Box>
          <Typography variant="h5" fontWeight="bold" color="#E05A2B">
            ₹{currentDish.price}
          </Typography>
        </Box>

        {/* Culinary & Dietary Attribute Pills */}
        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
          <Chip
            size="small"
            label={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
            sx={{ bgcolor: 'rgba(46, 196, 182, 0.15)', color: '#2EC4B6', fontWeight: 600, fontSize: 12 }}
          />
          <Chip
            size="small"
            label="🌾 Fresh Kitchen Made"
            sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 600, fontSize: 12 }}
          />
          <Chip
            size="small"
            label={spiceBadge}
            sx={{ bgcolor: 'rgba(224, 90, 43, 0.15)', color: '#E05A2B', fontWeight: 600, fontSize: 12 }}
          />
          <Chip
            size="small"
            label="⏱️ Ready in ~25m"
            sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#ccc', fontWeight: 600, fontSize: 12 }}
          />
        </Box>

        {currentDish.description && (
          <Typography variant="body2" color="rgba(255,255,255,0.8)" sx={{ mb: 2.5, lineHeight: 1.6 }}>
            {currentDish.description}
          </Typography>
        )}

        {/* Pre-Order Specifics */}
        {currentDish.is_preorder_only && (
          <Box sx={{ bgcolor: 'rgba(246, 189, 96, 0.1)', border: '1px solid rgba(246, 189, 96, 0.25)', p: 2, borderRadius: 2, mb: 2.5 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <AccessTimeIcon sx={{ color: '#F6BD60', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight="bold" color="#F6BD60">
                Advance Pre-Order Required
              </Typography>
            </Box>
            {currentDish.preorder_cutoff_time && (
              <Typography variant="body2" color="rgba(255,255,255,0.85)" mb={1}>
                Booking Cutoff: <strong>{currentDish.preorder_cutoff_time}</strong>
              </Typography>
            )}
            {currentDish.available_slots && currentDish.available_slots.length > 0 && (
              <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                {currentDish.available_slots.map((s) => (
                  <Chip
                    key={s}
                    size="small"
                    label={SLOT_SHORT_LABELS[s] || s}
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#F6BD60', fontWeight: 'bold' }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2.5 }} />

        {/* Action Button */}
        {isSelfKitchen ? (
          <Button
            variant="outlined"
            fullWidth
            disabled
            size="large"
            sx={{
              borderColor: 'rgba(255,255,255,0.2)',
              color: '#aaa',
              py: 1.5,
              fontSize: '1rem',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 'bold',
            }}
          >
            🍳 Your Kitchen — Self-ordering disabled
          </Button>
        ) : (
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<AddShoppingCartIcon />}
            onClick={() => {
              if (onAddToCart) {
                onAddToCart(currentDish);
              }
              onClose();
            }}
            sx={{
              bgcolor: '#E05A2B',
              fontWeight: 'bold',
              py: 1.5,
              fontSize: '1.05rem',
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': { bgcolor: '#c9481c' },
            }}
          >
            {currentDish.is_preorder_only ? `Pre-Order for ₹${currentDish.price}` : `Add to Basket • ₹${currentDish.price}`}
          </Button>
        )}

        {/* Quick Thumbnail Strip Carousel for Multiple Dishes */}
        {activeList.length > 1 && (
          <Box sx={{ mt: 2.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Slide to Browse Other Dishes ({activeList.length})
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 1.2,
                overflowX: 'auto',
                py: 0.5,
                '&::-webkit-scrollbar': { height: 6 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
              }}
            >
              {activeList.map((dish, idx) => (
                <Box
                  key={dish.id || idx}
                  onClick={() => {
                    if (onIndexChange) onIndexChange(idx);
                    else setInternalIndex(idx);
                  }}
                  sx={{
                    flexShrink: 0,
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: idx === activeIndex ? '#E05A2B' : 'rgba(255,255,255,0.15)',
                    opacity: idx === activeIndex ? 1 : 0.6,
                    transform: idx === activeIndex ? 'scale(1.05)' : 'none',
                    transition: 'all 0.2s',
                    '&:hover': { opacity: 1, borderColor: '#E05A2B' },
                  }}
                >
                  <Box
                    component="img"
                    src={getDishImageUrl(dish)}
                    alt={dish.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

DishImageModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  item: PropTypes.object,
  items: PropTypes.array,
  currentIndex: PropTypes.number,
  onIndexChange: PropTypes.func,
  sellerName: PropTypes.string,
  sellerFlat: PropTypes.string,
  onAddToCart: PropTypes.func,
  isSelfKitchen: PropTypes.bool,
};
