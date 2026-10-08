import React, { useState, useEffect, createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Link,
} from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  Divider,
  Paper,
  Badge,
  IconButton,
  Tabs,
  Tab,
  InputAdornment,
  Popover,
} from '@mui/material';

import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import HomeIcon from '@mui/icons-material/Home';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import { authAPI, sellersAPI, menusAPI, getErrorMessage } from './services/api';

import DishImageModal, { getDishImageUrl } from './components/DishImageModal';
import MenuPage from './pages/Menu';
import OrdersPage from './pages/Orders';
import ProfilePage from './pages/Profile';
import SellerDashboardPage from './pages/SellerDashboard';
import BuyerDashboardPage from './pages/BuyerDashboard';
import SuggestionsBoard from './pages/SuggestionsBoard';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import './App.css';
import LandingPage from './pages/Landing';

// ── Partner Workspace Sub-Pages ──────────────────────────────────────────────
import PartnerLayout from './pages/partner/PartnerLayout';
import PartnerOverview from './pages/partner/PartnerOverview';
import PartnerOrders from './pages/partner/PartnerOrders';
import PartnerMenu from './pages/partner/PartnerMenu';
import PartnerGallery from './pages/partner/PartnerGallery';
import PartnerFinances from './pages/partner/PartnerFinances';

// ── Admin Console Sub-Pages ──────────────────────────────────────────────────
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminApprovals from './pages/admin/AdminApprovals';
import AdminResidents from './pages/admin/AdminResidents';
import AdminRefunds from './pages/admin/AdminRefunds';

// ── Warm Culinary Theme (Modern Coffee/Food Ordering Inspired) ───────────────
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#E05A2B', dark: '#C9481C', light: '#FF7D4D' },       // Warm Terracotta
    forest: { main: '#1B4332', light: '#2D6A4F', contrastText: '#FFFFFF' }, // Dark Forest Green
    secondary: { main: '#F6BD60' },     // Honey Saffron
    success: { main: '#2D6A4F' },       // Deep Forest Mint
    background: { default: '#0F0F1A', paper: '#181828' },
  },
  typography: {
    fontFamily: '"Poppins", "Plus Jakarta Sans", "Inter", -apple-system, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, textTransform: 'none', fontWeight: 600 },
      },
    },
  },
});

// ── Auth Context ─────────────────────────────────────────────────────────────
// ── Auth Context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });

  const login = (userData, token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const switchRole = async (targetRole) => {
    const res = await authAPI.switchRole(targetRole);
    const { access_token, user: updatedUser } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node,
};

const useAuth = () => useContext(AuthContext);

// ── Navigation Bar ───────────────────────────────────────────────────────────
function Navbar({ cartCount, onOpenCart }) {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch (_) { /* ignore */ }
    logout();
    navigate('/login');
  };

  const handleSwitchRole = async (targetRole) => {
    try {
      const updated = await switchRole(targetRole);
      if (updated.role === 'seller' || updated.role === 'partner') {
        navigate('/partner');
      } else {
        navigate('/buyer');
      }
    } catch (err) {
      console.error('Failed to switch role', err);
    }
  };

  return (
    <AppBar position="sticky" sx={{ background: 'rgba(22,22,34,0.95)', backdropFilter: 'blur(10px)' }}>
      <Toolbar>
        <RestaurantIcon sx={{ color: 'primary.main', mr: 1 }} />
        <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit', fontWeight: 700 }}>
          Society Food
        </Typography>

        {user ? (
          <>
            {/* Admin Navigation */}
            {user.role === 'admin' ? (
              <>
                <Button component={Link} to="/admin" color="inherit" size="small" sx={{ mr: 1, color: '#2EC4B6', fontWeight: 'bold' }}>
                  Admin Console
                </Button>
                <Button component={Link} to="/partner" color="inherit" size="small" sx={{ mr: 1 }}>
                  Kitchen Hub
                </Button>
                <Button component={Link} to="/orders" color="inherit" size="small" sx={{ mr: 1 }}>
                  Orders
                </Button>
                <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
                  Cravings
                </Button>
              </>
            ) : (user.role === 'seller' || user.role === 'partner') ? (
              /* Seller / Partner Navigation */
              <>
                <Button component={Link} to="/partner" color="inherit" size="small" sx={{ mr: 1 }}>
                  Kitchen Hub
                </Button>
                <Button component={Link} to="/orders" color="inherit" size="small" sx={{ mr: 1 }}>
                  Orders
                </Button>
                <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
                  Cravings
                </Button>
              </>
            ) : (
              /* Buyer / Resident Mode Navigation */
              <>
                <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
                  Cravings
                </Button>
                <Button component={Link} to="/orders" color="inherit" size="small" sx={{ mr: 1 }}>
                  Orders
                </Button>
              </>
            )}

            {/* Cart Icon */}
            <IconButton onClick={onOpenCart} sx={{ color: '#fff', mr: 1.5 }}>
              <Badge badgeContent={cartCount} color="primary">
                <ShoppingBagOutlinedIcon />
              </Badge>
            </IconButton>


            {/* User Info Chip with Interactive Popover */}
            <Chip
              avatar={
                <Avatar sx={{ bgcolor: user.role === 'seller' ? '#2EC4B6' : '#E05A2B', color: '#fff', fontWeight: 'bold' }}>
                  {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </Avatar>
              }
              label={`${user.name || user.email?.split('@')[0]} (${user.role || 'buyer'})`}
              size="small"
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              sx={{
                mr: 1.5,
                cursor: 'pointer',
                bgcolor: 'rgba(224,90,43,0.15)',
                color: 'primary.main',
                fontWeight: 'bold',
                '&:hover': { bgcolor: 'rgba(224,90,43,0.25)' },
              }}
            />

            {/* User Info Popover */}
            <Popover
              open={Boolean(userMenuAnchor)}
              anchorEl={userMenuAnchor}
              onClose={() => setUserMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: {
                  p: 2.5,
                  width: 290,
                  bgcolor: '#191928',
                  color: '#fff',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Avatar sx={{ bgcolor: user.role === 'seller' ? '#2EC4B6' : '#E05A2B', width: 44, height: 44, fontWeight: 'bold' }}>
                  {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>
                    {user.name || 'Society Resident'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {user.email}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1.5 }} />

              <Box display="flex" flexDirection="column" gap={1} mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Active Mode:</Typography>
                  <Chip
                    size="small"
                    label={
                      user.role === 'admin'
                        ? '🛡️ Society Admin'
                        : (user.role === 'seller' || user.role === 'partner')
                        ? '🍳 Home Chef'
                        : '🛒 Resident Buyer'
                    }
                    sx={{
                      bgcolor:
                        user.role === 'admin'
                          ? 'rgba(46,196,182,0.15)'
                          : (user.role === 'seller' || user.role === 'partner')
                          ? 'rgba(224,90,43,0.15)'
                          : 'rgba(255,255,255,0.08)',
                      color:
                        user.role === 'admin'
                          ? '#2EC4B6'
                          : (user.role === 'seller' || user.role === 'partner')
                          ? '#E05A2B'
                          : '#fff',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                    }}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Flat / Unit:</Typography>
                  <Typography variant="caption" fontWeight="bold" color="#F6BD60">
                    {user.flat_number ? `Flat #${user.flat_number}` : 'Society Resident'}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Status:</Typography>
                  <Chip
                    size="small"
                    label="✅ Verified Resident"
                    sx={{ bgcolor: 'rgba(46,196,182,0.15)', color: '#2EC4B6', fontSize: '0.7rem', height: 20 }}
                  />
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

              {/* Workspace Shortcuts */}
              <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1} sx={{ letterSpacing: '0.5px' }}>
                WORKSPACE SWITCHER
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                component={Link}
                to="/"
                onClick={() => setUserMenuAnchor(null)}
                size="small"
                sx={{ mb: 1, color: '#2EC4B6', borderColor: 'rgba(46,196,182,0.4)', textTransform: 'none', fontWeight: 'bold' }}
              >
                🏡 Resident Space
              </Button>
              {(user.role === 'seller' || user.role === 'partner' || user.role === 'admin' || user.role === 'super_admin') && (
                <Button
                  fullWidth
                  variant="outlined"
                  component={Link}
                  to="/partner"
                  onClick={() => setUserMenuAnchor(null)}
                  size="small"
                  sx={{ mb: 1, color: '#E05A2B', borderColor: 'rgba(224,90,43,0.4)', textTransform: 'none', fontWeight: 'bold' }}
                >
                  🍳 Kitchen Hub (Partner)
                </Button>
              )}
              {(user.role === 'admin' || user.role === 'super_admin') && (
                <Button
                  fullWidth
                  variant="outlined"
                  component={Link}
                  to="/admin"
                  onClick={() => setUserMenuAnchor(null)}
                  size="small"
                  sx={{ mb: 1, color: '#F6BD60', borderColor: 'rgba(246,189,96,0.4)', textTransform: 'none', fontWeight: 'bold' }}
                >
                  🛡️ Society Admin Console
                </Button>
              )}

              {/* Shortcut to the Profile */}
              <Button
                fullWidth
                variant="outlined"
                component={Link}
                to="/profile"
                onClick={() => setUserMenuAnchor(null)}
                size="small"
                sx={{ mb: 1, color: '#fff', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none', fontWeight: 'bold' }}
              >
                👤 View Full Profile & Services
              </Button>

              <Button
                fullWidth
                variant="contained"
                color="error"
                size="small"
                onClick={() => {
                  setUserMenuAnchor(null);
                  handleLogout();
                }}
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              >
                Sign Out
              </Button>
            </Popover>

            <Button color="inherit" onClick={handleLogout} size="small">
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button component={Link} to="/suggestions" color="inherit" size="small" sx={{ mr: 1, color: '#F6BD60' }} startIcon={<LocalFireDepartmentIcon />}>
              Cravings
            </Button>
            <Button color="primary" variant="outlined" component={Link} to="/login" size="small">
              Login
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}


// ── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [tab, setTab] = useState(0); // 0: OTP Login, 1: Password Login, 2: Register
  const [otpStep, setOtpStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(params.get('role') || 'resident');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const getSmartRedirect = (userData) => {
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('/login')) {
      if (next.startsWith('/seller/dashboard') || next.startsWith('/seller')) return '/partner';
      return next;
    }
    const userRole = userData?.role;
    if (userRole === 'admin' || userRole === 'super_admin') {
      return '/admin';
    }
    if (userRole === 'partner' || userRole === 'seller') {
      return '/partner';
    }
    return '/';
  };

  // ── 1. Passwordless OTP Authentication Flow ──────────────────────────────
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await authAPI.requestOtp(email, 'resident', 'email');
      const devOtp = res.data?.dev_otp;
      setInfo(
        devOtp
          ? `Verification code sent to ${email}! (Dev mode code: ${devOtp})`
          : `Verification code sent to ${email}. Please check your inbox.`
      );
      setOtpStep('otp');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send verification code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(email, otp, name);
      const { access_token, user: userData } = res.data;
      login(userData || { email }, access_token);
      navigate(getSmartRedirect(userData));
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── 2. Password Login Flow ───────────────────────────────────────────────
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(email, password, role);
      const { access_token, user: userData } = res.data;
      login(userData || { email, role }, access_token);
      navigate(getSmartRedirect(userData));
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── 3. Register Flow ─────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await authAPI.register(email, password, name, role);
      const loginRes = await authAPI.login(email, password);
      const { access_token, user: userData } = loginRes.data;
      login(userData || { email, name, role }, access_token);
      navigate(getSmartRedirect(userData));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create account. Please check your information.'));
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box
      sx={{
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 30%, rgba(255,107,53,0.08), transparent 60%)',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 460,
          width: '100%',
          border: '1px solid rgba(255,107,53,0.2)',
          borderRadius: 3,
          bgcolor: '#191928',
          color: '#fff',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <RestaurantIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">
            {tab === 0 ? 'Instant Login' : tab === 1 ? 'Welcome Back' : 'Join Society Food'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tab === 0
              ? 'Passwordless sign in with verification code'
              : tab === 1
              ? 'Sign in with your email & password'
              : 'Connect with home cooks and neighbors'}
          </Typography>
        </Box>

        {/* Tab Toggle */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, val) => {
              setTab(val);
              setOtpStep('email');
              setError('');
              setInfo('');
            }}
            variant="fullWidth"
            textColor="inherit"
            indicatorColor="primary"
          >
            <Tab label="✨ Instant OTP" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
            <Tab label="🔑 Password" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
            <Tab label="📝 Register" sx={{ fontWeight: 'bold', textTransform: 'none' }} />
          </Tabs>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}

        {tab === 0 ? (
          /* Instant OTP Flow */
          otpStep === 'email' ? (
            <Box component="form" onSubmit={handleRequestOTP}>
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                sx={{ mb: 3 }}
                placeholder="you@example.com"
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} /> : null}
                sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
              >
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleVerifyOTP}>
              <TextField
                label="6-Digit Verification Code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                fullWidth
                required
                inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: 'bold' } }}
                placeholder="123456"
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={18} /> : null}
                sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', mb: 1.5, '&:hover': { bgcolor: '#c9481c' } }}
              >
                {loading ? 'Verifying...' : 'Verify Code & Sign In'}
              </Button>
              <Button
                variant="text"
                fullWidth
                onClick={() => {
                  setOtpStep('email');
                  setOtp('');
                  setError('');
                }}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
              >
                ← Change Email or Resend
              </Button>
            </Box>
          )
        ) : tab === 1 ? (
          /* Password Login Form */
          <Box component="form" onSubmit={handlePasswordLogin}>
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="••••••••"
            />
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Signing in as:
            </Typography>
            <Box sx={{ mb: 3, display: 'flex', gap: 1.5 }}>
              {[
                { id: 'buyer', label: '🛒 Resident Buyer' },
                { id: 'seller', label: '🍳 Home Chef' },
              ].map((r) => (
                <Button
                  key={r.id}
                  variant={role === r.id ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setRole(r.id)}
                  sx={{ flex: 1, py: 1, fontWeight: 'bold' }}
                >
                  {r.label}
                </Button>
              ))}
            </Box>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
              sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>
        ) : (
          /* Create Account Form */
          <Box component="form" onSubmit={handleRegister}>
            <TextField
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="e.g. Meera Sharma"
            />
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              helperText="Minimum 8 characters"
              sx={{ mb: 2 }}
              placeholder="••••••••"
            />
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              I want to join Society Food as:
            </Typography>
            <Box sx={{ mb: 3, display: 'flex', gap: 1.5 }}>
              {[
                { id: 'resident', label: '🏡 Resident Member' },
                { id: 'partner', label: '🍳 Home Chef (Partner)' },
              ].map((r) => (
                <Button
                  key={r.id}
                  variant={role === r.id ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setRole(r.id)}
                  sx={{ flex: 1, py: 1, fontWeight: 'bold' }}
                >
                  {r.label}
                </Button>
              ))}
            </Box>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : null}
              sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', '&:hover': { bgcolor: '#c9481c' } }}
            >
              {loading ? 'Creating Account...' : 'Create Account & Start'}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
// ── Interactive Multi-Photo Chef Card Component ─────────────────────────────
export function ChefCard({ seller, matchingDishes = [] }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const touchStartX = React.useRef(null);

  // Compute photos list: custom photos -> banner -> matching dishes -> avatar -> fallback
  const photos = (seller.photos && seller.photos.length > 0)
    ? seller.photos
    : (seller.banner_url
      ? [seller.banner_url]
      : (matchingDishes && matchingDishes.length > 0
        ? matchingDishes.map((d) => d.image_url).filter(Boolean)
        : (seller.photo_url ? [seller.photo_url] : ['https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80'])));

  const safePhotoIdx = photoIdx % (photos.length || 1);
  const currentPhoto = photos[safePhotoIdx] || photos[0];
  const photoUrl = currentPhoto?.startsWith('/')
    ? `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${currentPhoto}`
    : currentPhoto;

  const handlePrev = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 35) handleNext(e);
    else if (diff < -35) handlePrev(e);
    touchStartX.current = null;
  };

  return (
    <Card
      sx={{
        bgcolor: '#191928',
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(0,0,0,0.5)' },
        '&:hover .carousel-arrow': { opacity: 1 },
      }}
    >
      {/* Top Multi-Photo Carousel */}
      <Box
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        sx={{
          position: 'relative',
          height: 190,
          width: '100%',
          bgcolor: '#141422',
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          key={photoUrl}
          src={photoUrl}
          alt={seller.name}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.4s ease',
            '&:hover': { transform: 'scale(1.04)' },
          }}
        />

        {/* Gradient Overlay for Text Readability */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(25, 25, 40, 0.95) 0%, transparent 60%)',
          }}
        />

        {/* Open/Closed Badge in Top Right */}
        <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
          <Chip
            size="small"
            label={seller.is_open ? '🟢 OPEN' : '🔴 CLOSED'}
            sx={{
              bgcolor: seller.is_open ? 'rgba(46, 196, 182, 0.9)' : 'rgba(230, 57, 70, 0.9)',
              color: '#fff',
              fontWeight: 'bold',
              backdropFilter: 'blur(6px)',
              fontSize: 11,
            }}
          />
        </Box>

        {/* Previous / Next Arrow Controls */}
        {photos.length > 1 && (
          <>
            <IconButton
              size="small"
              aria-label="Previous photo"
              className="carousel-arrow"
              onClick={handlePrev}
              sx={{
                position: 'absolute',
                top: '50%',
                left: 8,
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(0,0,0,0.65)',
                color: '#fff',
                opacity: { xs: 0.85, md: 0 },
                transition: 'opacity 0.2s',
                zIndex: 3,
                '&:hover': { bgcolor: '#E05A2B' },
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Next photo"
              className="carousel-arrow"
              onClick={handleNext}
              sx={{
                position: 'absolute',
                top: '50%',
                right: 8,
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(0,0,0,0.65)',
                color: '#fff',
                opacity: { xs: 0.85, md: 0 },
                transition: 'opacity 0.2s',
                zIndex: 3,
                '&:hover': { bgcolor: '#E05A2B' },
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </>
        )}

        {/* Bottom Dot Indicators */}
        {photos.length > 1 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 0.8,
              zIndex: 2,
            }}
          >
            {photos.map((_, i) => (
              <Box
                key={i}
                role="button"
                aria-label={`View photo ${i + 1}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPhotoIdx(i);
                }}
                sx={{
                  width: i === safePhotoIdx ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: i === safePhotoIdx ? '#E05A2B' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </Box>
        )}

        {/* Overlapping Chef Avatar */}
        <Avatar
          src={seller.photo_url ? (seller.photo_url.startsWith('/') ? `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${seller.photo_url}` : seller.photo_url) : undefined}
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 16,
            width: 52,
            height: 52,
            bgcolor: '#E05A2B',
            fontWeight: 'bold',
            fontSize: '1.25rem',
            border: '2px solid #191928',
            boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
            zIndex: 3,
          }}
        >
          {seller.name?.[0] || 'C'}
        </Avatar>
      </Box>

      <CardContent sx={{ flexGrow: 1, pt: 2, pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
          <Typography variant="h6" fontWeight="bold">
            {seller.name}
          </Typography>
          <Chip
            icon={<StarIcon sx={{ color: '#F6BD60 !important', fontSize: '14px !important' }} />}
            label={seller.rating ? seller.rating.toFixed(1) : 'New'}
            size="small"
            sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 'bold' }}
          />
        </Box>

        {seller.flat_number && (
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Resident at Flat #{seller.flat_number}
          </Typography>
        )}

        <Typography variant="body2" color="rgba(255,255,255,0.75)" sx={{ mb: 2, minHeight: 38, lineHeight: 1.4 }}>
          {seller.bio || 'Authentic home cook preparing fresh food for neighbors.'}
        </Typography>

        {/* Punctuality and Delivery Badges */}
        <Box display="flex" gap={1} flexWrap="wrap" mb={1.5}>
          <Chip
            size="small"
            label={`⚡ ${seller.on_time_delivery_rate ?? 100}% on-time`}
            sx={{ bgcolor: 'rgba(46, 196, 182, 0.15)', color: '#2EC4B6', fontWeight: 'bold', fontSize: 11 }}
          />
          <Chip
            size="small"
            icon={<DeliveryDiningIcon sx={{ fontSize: '14px !important', color: '#fff !important' }} />}
            label="Doorstep Delivery"
            sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#ddd', fontSize: 11 }}
          />
        </Box>

        {/* Matching Dishes Snippets when Search is Active */}
        {matchingDishes && matchingDishes.length > 0 && (
          <Box sx={{ mt: 1.5, p: 1.2, bgcolor: 'rgba(224, 90, 43, 0.08)', borderRadius: 2, border: '1px solid rgba(224, 90, 43, 0.2)' }}>
            <Typography variant="caption" fontWeight="bold" color="#E05A2B" display="block" mb={0.5}>
              🔥 Special Dishes Matching Search:
            </Typography>
            <Box display="flex" gap={0.8} flexWrap="wrap">
              {matchingDishes.slice(0, 3).map((dish) => (
                <Chip
                  key={dish.id}
                  size="small"
                  label={`🍽️ ${dish.name} • ₹${dish.price}`}
                  component={Link}
                  to={`/menu/${seller.id}?dishId=${dish.id}`}
                  clickable
                  sx={{
                    bgcolor: 'rgba(224, 90, 43, 0.2)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: '#E05A2B' },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          component={Link}
          to={`/menu/${seller.id}`}
          sx={{
            flex: 1,
            color: '#fff',
            borderColor: 'rgba(255,255,255,0.2)',
            textTransform: 'none',
            fontWeight: 'bold',
            borderRadius: 2,
            '&:hover': { borderColor: '#E05A2B', bgcolor: 'rgba(224, 90, 43, 0.08)' },
          }}
        >
          View Menu
        </Button>
        <Button
          size="small"
          variant="contained"
          component={Link}
          to={`/menu/${seller.id}`}
          sx={{
            flex: 1,
            bgcolor: '#E05A2B',
            textTransform: 'none',
            fontWeight: 'bold',
            borderRadius: 2,
            '&:hover': { bgcolor: '#c9481c' },
          }}
        >
          Order Now
        </Button>
      </CardActions>
    </Card>
  );
}

// ── Sellers Listing Page ─────────────────────────────────────────────────────
export function SellersPage({ onAddToCart }) {
  const location = useLocation();
  const initialSearch = new URLSearchParams(location.search).get('search') || '';
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Multi-Select Filters
  const [filters, setFilters] = useState({
    pureVeg: false,
    nonVeg: false,
    openNow: false,
    punctual: false,
    topRated: false,
  });

  // Dedicated Sort Selection: 'recommended' | 'rating' | 'punctual' | 'speed'
  const [sortBy, setSortBy] = useState('recommended');

  // Discovery View Mode: 'chefs' | 'dishes'
  const [viewMode, setViewMode] = useState('chefs');

  // Global Dish Search Results
  const [matchedDishes, setMatchedDishes] = useState([]);
  const [matchedSellersMap, setMatchedSellersMap] = useState({});
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);

  // Maximized Dish Modal for Direct Dish Browsing
  const [carouselDishIndex, setCarouselDishIndex] = useState(null);
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);

  const authContext = useAuth();
  const user = authContext ? authContext.user : null;

  // Fallback: some flows may not have context hydrated yet — read localStorage
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  })();

  const loadSellers = () => {
    setLoading(true);
    sellersAPI.list()
      .then((res) => {
        setSellers(res.data?.sellers || []);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to load sellers.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSellers();
  }, []);

  // Global Special Dish Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchedDishes([]);
      setMatchedSellersMap({});
      setAutocompleteOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      menusAPI.search(searchQuery.trim())
        .then((res) => {
          const items = res.data?.items || [];
          setMatchedDishes(items);
          const map = {};
          items.forEach((item) => {
            if (!map[item.seller_id]) map[item.seller_id] = [];
            map[item.seller_id].push(item);
          });
          setMatchedSellersMap(map);
          setAutocompleteOpen(true);
        })
        .catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleFilter = (filterKey) => {
    setFilters((prev) => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const clearAllFilters = () => {
    setFilters({
      pureVeg: false,
      nonVeg: false,
      openNow: false,
      punctual: false,
      topRated: false,
    });
    setSortBy('recommended');
  };

  // Filter and Sort Sellers
  const filteredSellers = sellers
    .filter((seller) => {
      const q = searchQuery.toLowerCase().trim();
      const hasMatchingDish = Boolean(matchedSellersMap[seller.id]?.length);
      const matchesSearch =
        !q ||
        seller.name?.toLowerCase().includes(q) ||
        seller.bio?.toLowerCase().includes(q) ||
        (seller.flat_number && String(seller.flat_number).toLowerCase().includes(q)) ||
        hasMatchingDish;

      if (!matchesSearch) return false;

      if (filters.openNow && !seller.is_open) return false;
      if (filters.topRated && (seller.rating || 0) < 4.5) return false;
      if (filters.punctual && (seller.on_time_delivery_rate ?? 100) < 90) return false;

      // Dietary filter on chef level
      if (filters.pureVeg) {
        const dishes = matchedSellersMap[seller.id] || [];
        if (dishes.length > 0 && !dishes.some((d) => d.category === 'veg')) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'punctual') return (b.on_time_delivery_rate ?? 100) - (a.on_time_delivery_rate ?? 100);
      if (sortBy === 'speed') return (a.avg_delivery_minutes ?? 25) - (b.avg_delivery_minutes ?? 25);
      // 'recommended'
      const scoreA = (a.rating || 4.0) * ((a.on_time_delivery_rate ?? 100) / 100);
      const scoreB = (b.rating || 4.0) * ((b.on_time_delivery_rate ?? 100) / 100);
      return scoreB - scoreA;
    });

  // Matching chefs for autocomplete
  const matchingChefs = searchQuery.trim()
    ? sellers.filter((s) =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (s.flat_number && String(s.flat_number).toLowerCase().includes(searchQuery.toLowerCase().trim()))
      )
    : [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          🍽️ Society Home Chefs & Kitchens
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Discover verified home cooks, daily kitchens, and special weekend bakers in your community.
        </Typography>
      </Box>

      {/* Global Search Box with Live Autocomplete */}
      <Box sx={{ mb: 3, position: 'relative' }}>
        <TextField
          fullWidth
          placeholder="Search chef name, flat number, or special dishes (e.g. Biryani, Paneer, Dosa)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim()) setAutocompleteOpen(true);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setSearchQuery(''); setAutocompleteOpen(false); }} sx={{ color: '#aaa' }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            bgcolor: '#191928',
            borderRadius: 2,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              fontSize: '1.05rem',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: '#E05A2B' },
              '&.Mui-focused fieldset': { borderColor: '#E05A2B' },
            },
          }}
        />

        {/* Live Search Autocomplete Dropdown */}
        {autocompleteOpen && (matchingChefs.length > 0 || matchedDishes.length > 0) && (
          <Paper
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              mt: 1,
              bgcolor: '#1c1c2e',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 3,
              boxShadow: '0 16px 36px rgba(0,0,0,0.7)',
              zIndex: 10,
              maxHeight: 380,
              overflowY: 'auto',
              p: 2,
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                Instant Search Suggestions
              </Typography>
              <IconButton size="small" onClick={() => setAutocompleteOpen(false)} sx={{ color: '#aaa' }}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Chefs Group */}
            {matchingChefs.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" fontWeight="bold" color="#F6BD60" mb={1} display="flex" alignItems="center" gap={1}>
                  👨‍🍳 Home Chefs & Kitchens ({matchingChefs.length})
                </Typography>
                <Box display="flex" flexDirection="column" gap={0.8}>
                  {matchingChefs.slice(0, 4).map((chef) => (
                    <Box
                      key={chef.id}
                      component={Link}
                      to={`/menu/${chef.id}`}
                      onClick={() => setAutocompleteOpen(false)}
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textDecoration: 'none',
                        color: '#fff',
                        '&:hover': { bgcolor: 'rgba(224, 90, 43, 0.15)' },
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: '#E05A2B', fontSize: 14 }}>
                          {chef.name?.[0] || 'C'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {chef.name}
                          </Typography>
                          {chef.flat_number && (
                            <Typography variant="caption" color="text.secondary">
                              Flat #{chef.flat_number}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Chip label={`⭐ ${chef.rating?.toFixed(1) || 'New'}`} size="small" sx={{ bgcolor: 'rgba(246, 189, 96, 0.15)', color: '#F6BD60', fontWeight: 'bold' }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Special Dishes Group */}
            {matchedDishes.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" color="#E05A2B" mb={1} display="flex" alignItems="center" gap={1}>
                  🍽️ Special Dishes Matching &ldquo;{searchQuery}&rdquo; ({matchedDishes.length})
                </Typography>
                <Box display="flex" flexDirection="column" gap={0.8}>
                  {matchedDishes.slice(0, 6).map((dish) => (
                    <Box
                      key={dish.id}
                      component={Link}
                      to={`/menu/${dish.seller_id}?dishId=${dish.id}`}
                      onClick={() => setAutocompleteOpen(false)}
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textDecoration: 'none',
                        color: '#fff',
                        '&:hover': { bgcolor: 'rgba(224, 90, 43, 0.15)' },
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          component="img"
                          src={getDishImageUrl(dish)}
                          alt={dish.name}
                          sx={{ width: 40, height: 40, borderRadius: 1.5, objectFit: 'cover' }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {dish.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            by <strong>{dish.seller_name}</strong> {dish.seller_flat ? `(Flat #${dish.seller_flat})` : ''}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="subtitle2" fontWeight="bold" color="#E05A2B">
                        ₹{dish.price} →
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* Modern Two-Tier Filter & Sort Toolbar */}
      <Box sx={{ mb: 4, p: 2, bgcolor: '#191928', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Tier 1: Multi-Select Filter Chips */}
          <Grid item xs={12} md={7}>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mr: 0.5, textTransform: 'uppercase' }}>
                Filter:
              </Typography>
              <Chip
                label="🟢 Pure Veg"
                clickable
                onClick={() => toggleFilter('pureVeg')}
                sx={{
                  bgcolor: filters.pureVeg ? '#2EC4B6' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontWeight: filters.pureVeg ? 'bold' : 'normal',
                  border: '1px solid',
                  borderColor: filters.pureVeg ? '#2EC4B6' : 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: filters.pureVeg ? '#25a094' : 'rgba(255,255,255,0.1)' },
                }}
              />
              <Chip
                label="🔴 Non-Veg"
                clickable
                onClick={() => toggleFilter('nonVeg')}
                sx={{
                  bgcolor: filters.nonVeg ? '#E05A2B' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontWeight: filters.nonVeg ? 'bold' : 'normal',
                  border: '1px solid',
                  borderColor: filters.nonVeg ? '#E05A2B' : 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: filters.nonVeg ? '#c9481c' : 'rgba(255,255,255,0.1)' },
                }}
              />
              <Chip
                label="🟢 Open Now"
                clickable
                onClick={() => toggleFilter('openNow')}
                sx={{
                  bgcolor: filters.openNow ? '#4caf50' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontWeight: filters.openNow ? 'bold' : 'normal',
                  border: '1px solid',
                  borderColor: filters.openNow ? '#4caf50' : 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: filters.openNow ? '#388e3c' : 'rgba(255,255,255,0.1)' },
                }}
              />
              <Chip
                label="⚡ High Punctuality"
                clickable
                onClick={() => toggleFilter('punctual')}
                sx={{
                  bgcolor: filters.punctual ? '#E05A2B' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontWeight: filters.punctual ? 'bold' : 'normal',
                  border: '1px solid',
                  borderColor: filters.punctual ? '#E05A2B' : 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: filters.punctual ? '#c9481c' : 'rgba(255,255,255,0.1)' },
                }}
              />
              <Chip
                label="⭐ Top Rated (4.5+)"
                clickable
                onClick={() => toggleFilter('topRated')}
                sx={{
                  bgcolor: filters.topRated ? '#F6BD60' : 'rgba(255,255,255,0.05)',
                  color: filters.topRated ? '#191928' : '#fff',
                  fontWeight: filters.topRated ? 'bold' : 'normal',
                  border: '1px solid',
                  borderColor: filters.topRated ? '#F6BD60' : 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: filters.topRated ? '#e5ad50' : 'rgba(255,255,255,0.1)' },
                }}
              />
              {hasActiveFilters && (
                <Chip
                  label="✕ Reset Filters"
                  clickable
                  onClick={clearAllFilters}
                  sx={{
                    bgcolor: 'rgba(255, 107, 107, 0.15)',
                    color: '#ff6b6b',
                    fontWeight: 'bold',
                    border: '1px solid rgba(255, 107, 107, 0.3)',
                    '&:hover': { bgcolor: 'rgba(255, 107, 107, 0.3)' },
                  }}
                />
              )}
            </Box>
          </Grid>

          {/* Tier 2: Dedicated Sort By Selector */}
          <Grid item xs={12} md={5}>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mr: 0.5, textTransform: 'uppercase' }}>
                Sort By:
              </Typography>
              {[
                { id: 'recommended', label: '✨ Recommended' },
                { id: 'rating', label: '⭐ Rating' },
                { id: 'punctual', label: '⚡ Punctual' },
                { id: 'speed', label: '⏱️ Speed' },
              ].map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  clickable
                  onClick={() => setSortBy(s.id)}
                  sx={{
                    bgcolor: sortBy === s.id ? '#E05A2B' : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontWeight: sortBy === s.id ? 'bold' : 'normal',
                    border: '1px solid',
                    borderColor: sortBy === s.id ? '#E05A2B' : 'rgba(255,255,255,0.08)',
                    '&:hover': { bgcolor: sortBy === s.id ? '#c9481c' : 'rgba(255,255,255,0.1)' },
                  }}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* When Dish Search is Active: Dual Tabs to Browse Chefs vs Browse Dishes */}
      {searchQuery.trim() && matchedDishes.length > 0 && (
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 3 }}>
          <Tabs
            value={viewMode}
            onChange={(e, val) => setViewMode(val)}
            textColor="inherit"
            indicatorColor="primary"
          >
            <Tab
              value="chefs"
              label={`👨‍🍳 Kitchens & Chefs (${filteredSellers.length})`}
              sx={{ fontWeight: 'bold', textTransform: 'none', color: '#fff' }}
            />
            <Tab
              value="dishes"
              label={`🍽️ All Matching Dishes (${matchedDishes.length})`}
              sx={{ fontWeight: 'bold', textTransform: 'none', color: '#fff' }}
            />
          </Tabs>
        </Box>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress color="primary" />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Empty State */}
      {!loading && !error && filteredSellers.length === 0 && matchedDishes.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: '#191928', color: '#fff' }}>
          <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchQuery || hasActiveFilters
              ? 'No chefs or dishes found matching your criteria.'
              : 'No sellers yet in your society.'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || hasActiveFilters ? (
              <Button
                onClick={() => {
                  setSearchQuery('');
                  clearAllFilters();
                }}
                sx={{ color: '#E05A2B', fontWeight: 'bold' }}
              >
                Clear Search & Filters
              </Button>
            ) : (
              'Be the first to register as a chef in your residential building!'
            )}
          </Typography>
          {!searchQuery && !hasActiveFilters && (
            currentUser && currentUser.role === 'seller' ? (
              <Button variant="contained" component={Link} to="/seller/dashboard">
                Your Seller Dashboard
              </Button>
            ) : (
              <Button variant="contained" component={Link} to={`/login?role=seller&next=/seller/dashboard`}>
                Register as Seller
              </Button>
            )
          )}
        </Paper>
      )}

      {/* View 1: Chef Cards Grid with Multi-Photo Carousels */}
      {viewMode === 'chefs' && !loading && (
        <Grid container spacing={3}>
          {filteredSellers.map((seller) => (
            <Grid item xs={12} sm={6} md={4} key={seller.id}>
              <ChefCard
                seller={seller}
                matchingDishes={matchedSellersMap[seller.id] || []}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* View 2: Dishes Marketplace Grid (Side-by-side dish cards) */}
      {viewMode === 'dishes' && !loading && (
        <Grid container spacing={3}>
          {matchedDishes.map((dish, idx) => (
            <Grid item xs={12} sm={6} md={4} key={dish.id}>
              <Card
                sx={{
                  bgcolor: '#191928',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  overflow: 'hidden',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <Box
                  onClick={() => {
                    setCarouselDishIndex(idx);
                    setIsCarouselOpen(true);
                  }}
                  sx={{
                    position: 'relative',
                    height: 180,
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src={getDishImageUrl(dish)}
                    alt={dish.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', '&:hover': { transform: 'scale(1.05)' } }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      display: 'flex',
                      gap: 0.8,
                    }}
                  >
                    <Chip
                      size="small"
                      label={dish.category === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}
                      sx={{ bgcolor: dish.category === 'veg' ? 'rgba(46, 196, 182, 0.9)' : 'rgba(224, 90, 43, 0.9)', color: '#fff', fontWeight: 'bold' }}
                    />
                  </Box>
                </Box>

                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                    <Typography variant="h6" fontWeight="bold">
                      {dish.name}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="#E05A2B">
                      ₹{dish.price}
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" mb={1.5}>
                    by <strong>{dish.seller_name}</strong> {dish.seller_flat ? `(Flat #${dish.seller_flat})` : ''}
                  </Typography>

                  {dish.description && (
                    <Typography variant="body2" color="rgba(255,255,255,0.7)" sx={{ lineHeight: 1.4, mb: 1 }}>
                      {dish.description}
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                  <Button
                    variant="text"
                    onClick={() => {
                      setCarouselDishIndex(idx);
                      setIsCarouselOpen(true);
                    }}
                    sx={{ color: '#2EC4B6', fontWeight: 'bold', textTransform: 'none' }}
                  >
                    Photo & Details →
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddShoppingCartIcon />}
                    onClick={() => {
                      if (onAddToCart) {
                        onAddToCart(dish, dish.seller_id, dish.seller_name, dish.seller_flat);
                      }
                    }}
                    sx={{ bgcolor: '#E05A2B', fontWeight: 'bold', textTransform: 'none', '&:hover': { bgcolor: '#c9481c' } }}
                  >
                    Add to Basket
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Maximized Sliding Lightbox Carousel for Dishes Tab */}
      <DishImageModal
        open={isCarouselOpen && carouselDishIndex !== null && matchedDishes.length > 0}
        onClose={() => {
          setIsCarouselOpen(false);
          setCarouselDishIndex(null);
        }}
        items={matchedDishes}
        currentIndex={carouselDishIndex ?? 0}
        onIndexChange={(newIdx) => setCarouselDishIndex(newIdx)}
        onAddToCart={(dish) => {
          if (onAddToCart) {
            onAddToCart(dish, dish.seller_id, dish.seller_name, dish.seller_flat);
          }
        }}
      />
    </Container>
  );
}

// ── Home / Dashboard Page ────────────────────────────────────────────────────
function HomePage() {
  const { user } = useAuth();

  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 2,
        background: 'radial-gradient(circle at 50% 20%, rgba(255,107,53,0.07), transparent 55%)',
      }}
    >
      <RestaurantIcon sx={{ fontSize: 72, color: 'primary.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Society Food Platform
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
        Homemade food from your neighbours
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
        Connect with home cooks in your residential society. Discover fresh,
        authentic meals and support your community.
      </Typography>
      <Divider sx={{ width: 60, mb: 4, borderColor: 'primary.main' }} />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          component={Link}
          to="/browse"
          startIcon={<StoreIcon />}
          sx={{
            bgcolor: '#E05A2B',
            fontWeight: 'bold',
            px: 3,
            '&:hover': { bgcolor: '#c9481c' },
          }}
        >
          Browse Kitchens
        </Button>
        <Button
          variant="outlined"
          size="large"
          component={Link}
          to="/suggestions"
          startIcon={<LocalFireDepartmentIcon />}
          sx={{
            color: '#F6BD60',
            borderColor: '#F6BD60',
            fontWeight: 'bold',
            px: 3,
            '&:hover': {
              borderColor: '#e5ad50',
              bgcolor: 'rgba(246, 189, 96, 0.08)',
            },
          }}
        >
          Community Cravings
        </Button>
        {!user && (
          <Button
            variant="outlined"
            size="large"
            component={Link}
            to="/login"
            sx={{ fontWeight: 'bold' }}
          >
            Login / Register
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ── Route Guard ───────────────────────────────────────────────────────────────
function PrivateRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'seller' ? '/seller/dashboard' : '/buyer'} replace />;
  }

  return children;
}

PrivateRoute.propTypes = {
  children: PropTypes.node,
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
};

// ── App Root ──────────────────────────────────────────────────────────────────
function AppContent() {
  const { user } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAddToCart = (item, sellerId, sellerName, sellerFlat) => {
    setCartItems((prev) => {
      const existing = prev.find((it) => it.id === item.id);
      if (existing) {
        return prev.map((it) =>
          it.id === item.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          ...item,
          quantity: 1,
          sellerId: sellerId || item.sellerId || item.seller_id,
          sellerName: sellerName || item.sellerName || item.seller_name || 'Home Chef',
          sellerFlat: sellerFlat || item.sellerFlat || item.seller_flat || null,
        },
      ];
    });
    setCartOpen(true);
  };

  const handleUpdateQuantity = (itemId, newQty) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((it) => it.id !== itemId));
    } else {
      setCartItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, quantity: newQty } : it))
      );
    }
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const totalCartCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);


  return (
    <>
      <Navbar cartCount={totalCartCount} onOpenCart={() => setCartOpen(true)} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/browse"
          element={
            <PrivateRoute>
              <SellersPage onAddToCart={handleAddToCart} />
            </PrivateRoute>
          }
        />
        <Route
          path="/sellers"
          element={
            <PrivateRoute>
              <SellersPage onAddToCart={handleAddToCart} />
            </PrivateRoute>
          }
        />
        <Route
          path="/menu/:sellerId"
          element={<MenuPage onAddToCart={handleAddToCart} />}
        />
        <Route
          path="/menus/:sellerId"
          element={<MenuPage onAddToCart={handleAddToCart} />}
        />

        <Route
          path="/suggestions"
          element={<SuggestionsBoard currentUser={user} />}
        />
        <Route path="/landing" element={<LandingPage />} />
        <Route
          path="/orders"
          element={
            <PrivateRoute>
              <OrdersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfilePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/buyer"
          element={
            <PrivateRoute>
              <BuyerDashboardPage currentUser={user} />
            </PrivateRoute>
          }
        />
        {/* Partner Workspace Sub-Pages */}
        <Route
          path="/partner"
          element={
            <PrivateRoute allowedRoles={['seller', 'partner', 'admin']}>
              <PartnerLayout currentUser={user} />
            </PrivateRoute>
          }
        >
          <Route index element={<PartnerOverview />} />
          <Route path="overview" element={<Navigate to="/partner" replace />} />
          <Route path="orders" element={<PartnerOrders />} />
          <Route path="menu" element={<PartnerMenu />} />
          <Route path="gallery" element={<PartnerGallery />} />
          <Route path="finances" element={<PartnerFinances />} />
        </Route>

        {/* Admin Console Sub-Pages */}
        <Route
          path="/admin"
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <AdminLayout currentUser={user} />
            </PrivateRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="overview" element={<Navigate to="/admin" replace />} />
          <Route path="approvals" element={<AdminApprovals />} />
          <Route path="residents" element={<AdminResidents />} />
          <Route path="refunds" element={<AdminRefunds />} />
          <Route path="disputes" element={<Navigate to="/admin/refunds" replace />} />
        </Route>

        {/* Backward-compatibility routes for legacy seller links & test suites */}
        <Route
          path="/seller/dashboard"
          element={
            <PrivateRoute allowedRoles={['seller', 'partner', 'admin']}>
              <SellerDashboardPage currentUser={user} />
            </PrivateRoute>
          }
        />
        <Route path="/seller-dashboard" element={<Navigate to="/partner" replace />} />

        <Route
          path="/seller/dashboard/menus"
          element={
            <PrivateRoute allowedRoles={['seller', 'partner', 'admin']}>
              <Navigate to="/partner/menu" replace />
            </PrivateRoute>
          }
        />
        <Route
          path="/seller/dashboard/orders"
          element={
            <PrivateRoute allowedRoles={['seller', 'partner', 'admin']}>
              <Navigate to="/partner/orders" replace />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>


      {/* Global Slide-Out Multi-Chef Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        onOrderSuccess={() => {
          navigate('/orders');
        }}
      />

      {/* Mobile Bottom Navigation Bar (Modern Food App Inspiration) */}
      {user && (
        <>
          <Box sx={{ display: { xs: 'block', md: 'none' }, height: 68 }} />
          <Paper
            elevation={12}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1100,
              display: { xs: 'flex', md: 'none' },
              justifyContent: 'space-around',
              alignItems: 'center',
              py: 0.8,
              px: 1,
              bgcolor: 'rgba(24, 24, 40, 0.95)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <IconButton
              component={Link}
              to={
                user.role === 'admin' || user.role === 'super_admin'
                  ? '/admin'
                  : (user.role === 'seller' || user.role === 'partner')
                  ? '/partner'
                  : '/'
              }
              aria-label="Mobile Navigation Home"
              sx={{
                flexDirection: 'column',
                color:
                  location.pathname === '/' ||
                  location.pathname === '/buyer' ||
                  location.pathname.startsWith('/seller') ||
                  location.pathname.startsWith('/partner') ||
                  location.pathname.startsWith('/admin')
                    ? '#2EC4B6'
                    : 'text.secondary',
                py: 0.5,
              }}
            >
              <HomeIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Home</Typography>
            </IconButton>

            <IconButton
              component={Link}
              to="/suggestions"
              aria-label="Mobile Navigation Cravings"
              sx={{
                flexDirection: 'column',
                color: location.pathname === '/suggestions' ? '#2EC4B6' : 'text.secondary',
                py: 0.5,
              }}
            >
              <LocalFireDepartmentIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Cravings</Typography>
            </IconButton>

            <IconButton
              component={Link}
              to="/orders"
              aria-label="Mobile Navigation Orders"
              sx={{
                flexDirection: 'column',
                color: location.pathname === '/orders' ? '#2EC4B6' : 'text.secondary',
                py: 0.5,
              }}
            >
              <DeliveryDiningIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Orders</Typography>
            </IconButton>

            <IconButton
              onClick={() => setCartOpen(true)}
              aria-label="Mobile Navigation Cart"
              sx={{
                flexDirection: 'column',
                color: 'text.secondary',
                py: 0.5,
              }}
            >
              <Badge badgeContent={cartItems.reduce((acc, item) => acc + item.quantity, 0)} color="error">
                <ShoppingBagOutlinedIcon fontSize="small" />
              </Badge>
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Cart</Typography>
            </IconButton>

            <IconButton
              component={Link}
              to="/profile"
              aria-label="Mobile Navigation Profile"
              sx={{
                flexDirection: 'column',
                color: location.pathname === '/profile' ? '#2EC4B6' : 'text.secondary',
                py: 0.5,
              }}
            >
              <PersonOutlineIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', mt: 0.2, fontWeight: 600 }}>Profile</Typography>
            </IconButton>
          </Paper>
        </>
      )}

      <Footer />

    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

