import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PartnerLayout from '../pages/partner/PartnerLayout';
import PartnerOverview from '../pages/partner/PartnerOverview';
import PartnerOrders from '../pages/partner/PartnerOrders';
import PartnerMenu from '../pages/partner/PartnerMenu';
import PartnerGallery from '../pages/partner/PartnerGallery';
import PartnerFinances from '../pages/partner/PartnerFinances';

// Mock APIs
jest.mock('../services/api', () => ({
  __esModule: true,
  sellersAPI: {
    getMe: () =>
      Promise.resolve({
        data: {
          id: 5,
          name: 'Chef Ananya',
          is_open: true,
          on_time_delivery_rate: 99.0,
          avg_delivery_minutes: 20,
          punctuality_rating: 4.95,
          total_orders_completed: 85,
          upi_id: 'ananya@upi',
          photos: ['/uploads/kitchen1.jpg'],
        },
      }),
    setOpenStatus: () => Promise.resolve({ data: { is_open: false } }),
    updateProfile: () => Promise.resolve({ data: { upi_id: 'ananya@upi' } }),
    uploadPhoto: () => Promise.resolve({ data: { photo_url: '/uploads/new.jpg' } }),
    deletePhoto: () => Promise.resolve({ data: { success: true } }),
  },
  partnersAPI: {
    getMe: () =>
      Promise.resolve({
        data: {
          id: 5,
          name: 'Chef Ananya',
          is_open: true,
          on_time_delivery_rate: 99.0,
          avg_delivery_minutes: 20,
          punctuality_rating: 4.95,
          total_orders_completed: 85,
          upi_id: 'ananya@upi',
          photos: ['/uploads/kitchen1.jpg'],
        },
      }),
  },
  ordersAPI: {
    list: () =>
      Promise.resolve({
        data: {
          orders: [
            {
              id: 501,
              buyer_id: 12,
              seller_id: 5,
              status: 'pending',
              items: [{ menu_id: 10, name: 'Palak Paneer', quantity: 2, price: 160 }],
              total_price: 320,
              is_preorder: true,
              delivery_slot: 'lunch_today',
              delivery_type: 'doorstep',
              created_at: '2026-10-07T10:00:00Z',
            },
          ],
          total: 1,
        },
      }),
    updateStatus: jest.fn().mockResolvedValue({ data: { status: 'accepted' } }),
  },
  menusAPI: {
    bySeller: () =>
      Promise.resolve({
        data: {
          items: [
            {
              id: 10,
              name: 'Palak Paneer',
              price: 160,
              category: 'veg',
              description: 'Fresh spinach puree with cottage cheese cubes',
              quantity: 8,
              is_available: true,
              spice_level: 'medium',
            },
          ],
        },
      }),
    create: jest.fn().mockResolvedValue({ data: { id: 11 } }),
    update: jest.fn().mockResolvedValue({ data: { id: 10 } }),
    delete: jest.fn().mockResolvedValue({ data: { success: true } }),
    updatePortions: jest.fn().mockResolvedValue({ data: { success: true } }),
    toggleAvailability: jest.fn().mockResolvedValue({ data: { success: true } }),
  },
  paymentsAPI: {
    getBalance: () =>
      Promise.resolve({
        data: { current_balance: 1850.0, total_earned: 9400.0 },
      }),
    getMaintenanceStatus: () =>
      Promise.resolve({
        data: {
          free_orders_remaining: 42,
          free_orders_total: 50,
          maintenance_balance: 0.0,
          is_availability_allowed: true,
        },
      }),
    getLedger: () =>
      Promise.resolve({
        data: {
          entries: [
            {
              id: 1,
              entry_type: 'credit',
              amount: 320,
              description: 'Order #501 payment credit',
              created_at: '2026-10-07T10:00:00Z',
            },
          ],
          total: 1,
        },
      }),
    topupMaintenanceWallet: jest.fn().mockResolvedValue({ data: { success: true } }),
    confirmReceived: jest.fn().mockResolvedValue({ data: { status: 'captured' } }),
  },
  deliveryAPI: {
    updateStatus: jest.fn().mockResolvedValue({ data: {} }),
  },
  getErrorMessage: (err, fallback) => fallback,
}));

describe('Partner Workspace Sub-Pages Suite', () => {
  const currentUser = { id: 5, name: 'Chef Ananya', role: 'partner' };

  test('renders PartnerLayout shell with status bar and navigation tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <Routes>
          <Route path="/partner" element={<PartnerLayout currentUser={currentUser} />}>
            <Route index element={<PartnerOverview />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Chef Ananya/i)).toBeInTheDocument();
      expect(screen.getByText(/KITCHEN OPEN/i)).toBeInTheDocument();
      expect(screen.getByText(/42\/50 Free Orders/i)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Live Orders/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Menu & Batches/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Gallery & Branding/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Finances & SaaS Pass/i })).toBeInTheDocument();
    });
  });

  test('renders PartnerOrders fulfillment pipeline with active order cards', async () => {
    render(
      <MemoryRouter initialEntries={['/partner/orders']}>
        <Routes>
          <Route path="/partner" element={<PartnerLayout currentUser={currentUser} />}>
            <Route path="orders" element={<PartnerOrders />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Live Kitchen Order Pipeline/i)).toBeInTheDocument();
      expect(screen.getByText(/Order #501/i)).toBeInTheDocument();
      expect(screen.getByText(/Palak Paneer/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Accept Order/i })).toBeInTheDocument();
    });
  });

  test('renders PartnerMenu catalog and displays portion controls and spice badge', async () => {
    render(
      <MemoryRouter initialEntries={['/partner/menu']}>
        <Routes>
          <Route path="/partner" element={<PartnerLayout currentUser={currentUser} />}>
            <Route path="menu" element={<PartnerMenu />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Menu & Batch Inventory/i)).toBeInTheDocument();
      expect(screen.getByText('Palak Paneer')).toBeInTheDocument();
      expect(screen.getByText('₹160')).toBeInTheDocument();
      expect(screen.getByText('IN STOCK')).toBeInTheDocument();
    });
  });

  test('renders PartnerGallery with chef photo branding and preset options', async () => {
    render(
      <MemoryRouter initialEntries={['/partner/gallery']}>
        <Routes>
          <Route path="/partner" element={<PartnerLayout currentUser={currentUser} />}>
            <Route path="gallery" element={<PartnerGallery />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Kitchen Branding & Multi-Photo Showcase/i)).toBeInTheDocument();
      expect(screen.getByText(/Curated Kitchen Background Presets/i)).toBeInTheDocument();
      expect(screen.getByText(/Bakery & Sweets/i)).toBeInTheDocument();
    });
  });

  test('renders PartnerFinances with SaaS Pass meter and P2PM UPI settings', async () => {
    render(
      <MemoryRouter initialEntries={['/partner/finances']}>
        <Routes>
          <Route path="/partner" element={<PartnerLayout currentUser={currentUser} />}>
            <Route path="finances" element={<PartnerFinances />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Finances, SaaS Pass & Direct P2PM UPI/i)).toBeInTheDocument();
      expect(screen.getByText(/Direct P2PM UPI Settlement Details/i)).toBeInTheDocument();
      expect(screen.getByText(/Maintenance Credits & Fee Deduction Ledger/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Top Up/i })).toBeInTheDocument();
    });
  });
});
