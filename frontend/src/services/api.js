/**
 * api.js — Centralised Axios API client
 *
 * All API calls go through this instance.
 * - Base URL read from REACT_APP_API_URL env var (set in docker-compose)
 * - Authorization header automatically added from localStorage token
 * - 401 responses automatically clear token and redirect to /login
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getErrorMessage = (error, fallback = 'Something went wrong.') => {
  if (!error) return fallback;

  // Handle Axios / Fetch response details
  const detail = error.response?.data?.detail ?? error.response?.data?.message;

  // 1. If detail is an array of Pydantic validation error objects (FastAPI 422)
  if (Array.isArray(detail)) {
    const formatted = detail
      .map((err) => {
        if (typeof err === 'string') return err;
        if (typeof err === 'object' && err !== null) {
          const loc = Array.isArray(err.loc)
            ? err.loc.filter((part) => part !== 'body').join('.')
            : '';
          const msg = err.msg || err.message || JSON.stringify(err);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(err);
      })
      .filter(Boolean)
      .join('; ');
    if (formatted) return formatted;
  }

  // 2. If detail is a single object
  if (typeof detail === 'object' && detail !== null) {
    if (detail.msg) return String(detail.msg);
    if (detail.message) return String(detail.message);
    return JSON.stringify(detail);
  }

  // 3. If detail is a non-empty string
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  // 4. Check error.message (e.g., Network Error, timeout)
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

// ── Request interceptor — attach JWT token ─────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle auth errors ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined' && window.location && process.env.NODE_ENV !== 'test') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth API ───────────────────────────────────────────────────────────────
export const authAPI = {
  /** Request passwordless OTP via Email or WhatsApp */
  requestOtp: (email, role = 'resident', channel = 'email', phone = null) =>
    api.post('/auth/otp/request', { email, role, channel, phone }),

  /** Verify OTP and authenticate */
  verifyOtp: (email, otp, name = null, role = 'resident') =>
    api.post('/auth/otp/verify', { email, otp, name, role }),

  /** Register a new user */
  register: (email, password, name, role = 'resident') =>
    api.post('/auth/register', { email, password, name, role }),

  /** Login with email and password */
  login: (email, password, role = null) =>
    api.post('/auth/login', { email, password, ...(role ? { role } : {}) }),

  /** Switch active workspace between resident and partner (partner requires approval) */
  switchRole: (targetRole = null) => api.post('/auth/switch-role', { target_role: targetRole }),

  /** Refresh JWT */
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),

  /** Get current authenticated user */
  me: () => api.get('/auth/me'),

  /** Logout */
  logout: () => api.post('/auth/logout'),
};

// ── Sellers API ────────────────────────────────────────────────────────────
export const sellersAPI = {
  /** List all approved sellers */
  list: (skip = 0, limit = 20) => api.get('/partners/', { params: { skip, limit } }),

  /** Get a specific seller profile */
  get: (sellerId) => api.get(`/partners/${sellerId}`),

  /** Get current authenticated seller profile */
  getMe: () => api.get('/partners/me'),

  /** Toggle store open/closed status */
  setOpenStatus: (isOpen) => api.patch('/partners/me/open', { is_open: isOpen }),

  /** Update own seller profile (bio, photo, upi_id, upi_account_name) */
  updateProfile: (data) => api.put('/partners/me', data),

  /** Register as a seller */
  register: (data) => api.post('/partners/register', data),

  /** Partner application state for the current user (any role) */
  getApplication: () => api.get('/partners/me/application'),

  /** Upload seller avatar photo */
  uploadPhoto: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/partners/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Upload kitchen banner image */
  uploadBanner: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/partners/me/banner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Upload one or multiple photos to kitchen gallery */
  uploadPhotos: (files) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    return api.post('/partners/me/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Delete a photo from kitchen gallery */
  deletePhoto: (photoUrl) => api.delete('/partners/me/photos', { params: { photo_url: photoUrl } }),
};

// ── Partners API (Alias to Sellers API for modern terminology) ───────────
export const partnersAPI = sellersAPI;

// ── Menus API ──────────────────────────────────────────────────────────────
export const menusAPI = {
  /** Search dishes across all approved sellers */
  search: (query = '', params = {}) =>
    api.get('/menus/search', { params: { q: query, ...params } }),

  /** Get menus for a seller */
  bySeller: (sellerId, category = null, search = null, availableOnly = false) =>
    api.get(`/menus/partners/${sellerId}`, {
      params: { category, search, available_only: availableOnly },
    }),

  /** Create a new menu item (supports pre-order attributes) */
  create: (data) => api.post('/menus/', data),

  /** Update a menu item */
  update: (menuId, data) => api.put(`/menus/${menuId}`, data),

  /** Toggle item availability and optional portion count */
  toggleAvailability: (menuId, isAvailable, quantity = null) =>
    api.patch(`/menus/${menuId}/availability`, {
      is_available: isAvailable,
      ...(quantity !== null ? { quantity } : {}),
    }),

  /** Update portion count directly */
  updatePortions: (menuId, quantity) =>
    api.patch(`/menus/${menuId}/availability`, {
      is_available: quantity > 0,
      quantity,
    }),

  /** Upload image for a menu item */
  uploadImage: (menuId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/menus/${menuId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Delete a menu item */
  delete: (menuId) => api.delete(`/menus/${menuId}`),
};

// ── Orders API ─────────────────────────────────────────────────────────────
export const ordersAPI = {
  /** Place a new order / pre-order */
  create: (data) => api.post('/orders/', data),

  /** Get current user's orders (buyer or seller) */
  list: (skip = 0, limit = 20, status = null) =>
    api.get('/orders/', { params: { skip, limit, status } }),

  /** Get order detail */
  get: (orderId) => api.get(`/orders/${orderId}`),

  /** Update order status (seller) */
  updateStatus: (orderId, status) => api.put(`/orders/${orderId}/status`, { status }),

  /** Cancel order (buyer) */
  cancel: (orderId) => api.delete(`/orders/${orderId}`),
};

// ── Suggestions & Wishlist API ───────────────────────────────────────────────
export const suggestionsAPI = {
  /** List community dish suggestions */
  list: (status = null, category = null, skip = 0, limit = 30) =>
    api.get('/suggestions/', { params: { status, category, skip, limit } }),

  /** List open cravings matched for the authenticated seller's kitchen */
  listMatched: (minScore = 35, limit = 30) =>
    api.get('/suggestions/matched', { params: { min_score: minScore, limit } }),

  /** Propose a new dish suggestion */
  create: (data) => api.post('/suggestions/', data),

  /** Toggle upvote on a suggestion */
  upvote: (suggestionId) => api.post(`/suggestions/${suggestionId}/upvote`),

  /** Chef claims suggestion and launches pre-order batch or links existing item */
  claim: (suggestionId, data) => api.post(`/suggestions/${suggestionId}/claim`, data),
};

// ── Payments & Financial Ledger API ─────────────────────────────────────────
export const paymentsAPI = {
  /** Initiate direct P2PM UPI payment intent */
  initiateDirectUPI: (orderId) => api.post(`/payments/orders/${orderId}/direct-upi`),

  /** Buyer submits 12-digit UPI UTR reference */
  submitUTR: (orderId, utrNumber) =>
    api.post(`/payments/orders/${orderId}/submit-utr`, { utr_number: utrNumber }),

  /** Seller confirms receipt of direct UPI payment in bank account */
  confirmReceived: (orderId) => api.post(`/payments/orders/${orderId}/confirm-received`),

  /** Get chef's SaaS pass quota, free orders remaining, and balance */
  getMaintenanceStatus: () => api.get('/payments/maintenance/status'),

  /** Chef recharges maintenance credit balance */
  topupMaintenance: (amount, utrNumber) =>
    api.post('/payments/maintenance/topup', { amount, utr_number: utrNumber }),

  /** Initiate payment for an order (Razorpay fallback) */
  initiate: (orderId) => api.post(`/payments/orders/${orderId}/initiate`),

  /** Capture payment with Razorpay signature */
  capture: (orderId, providerPaymentId, providerSignature) =>
    api.post(`/payments/orders/${orderId}/capture`, {
      provider_payment_id: providerPaymentId,
      provider_signature: providerSignature,
    }),

  /** Get current seller's ledger balance */
  getBalance: () => api.get('/payments/balance/me'),

  /** Get seller's ledger transaction history */
  getLedger: (skip = 0, limit = 20) => api.get('/payments/ledger/me', { params: { skip, limit } }),
};

// ── In-Building Delivery API ────────────────────────────────────────────────
export const deliveryAPI = {
  /** Get delivery status for an order */
  get: (orderId) => api.get(`/deliveries/orders/${orderId}`),

  /** Initiate delivery (seller) */
  create: (orderId, estimatedMinutes = 15, notes = null) =>
    api.post(`/deliveries/orders/${orderId}`, {
      estimated_minutes: estimatedMinutes,
      notes: notes,
    }),

  /** Update delivery status (seller) */
  updateStatus: (deliveryId, newStatus, notes = null) =>
    api.patch(`/deliveries/${deliveryId}/status`, {
      new_status: newStatus,
      notes: notes,
    }),

  /** Dispatch delivery (en route to flat) */
  dispatch: (deliveryId, notes = null) =>
    api.patch(`/deliveries/${deliveryId}/status`, {
      new_status: 'dispatched',
      notes: notes,
    }),

  /** Mark delivery completed at flat door */
  deliver: (deliveryId, notes = null) =>
    api.patch(`/deliveries/${deliveryId}/status`, {
      new_status: 'delivered',
      notes: notes,
    }),
};

// ── Ratings API ────────────────────────────────────────────────────────────
export const ratingsAPI = {
  /** Rate a completed order */
  create: (orderId, score, reviewText = null) =>
    api.post(`/ratings/orders/${orderId}`, {
      score: parseInt(score, 10),
      review_text: reviewText || null,
    }),

  /** Get seller ratings */
  bySeller: (sellerId, skip = 0, limit = 20) =>
    api.get(`/ratings/partners/${sellerId}`, { params: { skip, limit } }),
};

// ── AI / Multimodal ──────────────────────────────────────────────────────────
export const aiAPI = {
  /** Multimodal dish analysis (dietary tags, allergens, calories, price guidance) */
  analyzeDish: (data) => api.post('/ai/analyze-dish', data),

  /** AI meal advisory */
  mealAdvisor: (data) => api.post('/ai/meal-advisor', data),

  /** Multimodal search */
  multimodalSearch: (data) =>
    api.post('/ai/search', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ── Admin API ──────────────────────────────────────────────────────────────
export const adminAPI = {
  /** Platform-wide summary statistics and revenue metrics */
  getAnalytics: () => api.get('/admin/analytics'),

  /** List partners awaiting approval */
  getPendingPartners: (skip = 0, limit = 20) =>
    api.get('/admin/partners/pending', { params: { skip, limit } }),

  /** Approve a pending partner registration */
  approvePartner: (partnerId) => api.post(`/admin/partners/${partnerId}/approve`),

  /** Reject a pending partner registration */
  rejectPartner: (partnerId) => api.post(`/admin/partners/${partnerId}/reject`),

  /** List registered residents */
  getResidents: (skip = 0, limit = 50) => api.get('/admin/residents', { params: { skip, limit } }),

  /** Activate or deactivate user account */
  setUserStatus: (userId, isActive) =>
    api.patch(`/admin/users/${userId}/status`, { is_active: isActive }),

  /** Issue full refund for an order */
  refundOrder: (orderId) => api.post(`/admin/orders/${orderId}/refund`),
};

export default api;
