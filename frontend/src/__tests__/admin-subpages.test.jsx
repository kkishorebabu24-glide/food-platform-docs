import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminOverview from '../pages/admin/AdminOverview';
import AdminApprovals from '../pages/admin/AdminApprovals';
import AdminResidents from '../pages/admin/AdminResidents';
import AdminRefunds from '../pages/admin/AdminRefunds';

// Mock API
jest.mock('../services/api', () => ({
  __esModule: true,
  adminAPI: {
    getAnalytics: () =>
      Promise.resolve({
        data: {
          total_partners: 12,
          total_residents: 85,
          total_orders: 140,
          completed_orders: 125,
          pending_partner_approvals: 2,
          revenue: {
            total_gross_inr: 45000,
            total_refunded_inr: 1200,
            net_inr: 43800,
          },
        },
      }),
    getPendingPartners: () =>
      Promise.resolve({
        data: [
          {
            id: 9,
            name: 'Chef Rajesh',
            flat_number: 'TowerC-102',
            bio: 'Expert in street chaat and tiffins',
            upi_id: 'rajesh@upi',
          },
        ],
      }),
    approvePartner: jest.fn(() => Promise.resolve({ data: { message: 'Approved' } })),
    rejectPartner: jest.fn(() => Promise.resolve({ data: { message: 'Rejected' } })),
    getResidents: () =>
      Promise.resolve({
        data: {
          residents: [
            {
              id: 1,
              name: 'Amit Patel',
              email: 'amit@society.com',
              flat_number: 'TowerA-301',
              role: 'resident',
              is_active: true,
            },
            {
              id: 2,
              name: 'Meera Rao',
              email: 'meera@society.com',
              flat_number: 'TowerB-104',
              role: 'partner',
              is_active: true,
            },
          ],
          total: 2,
        },
      }),
    setUserStatus: jest.fn(() => Promise.resolve({ data: { message: 'Updated' } })),
    refundOrder: jest.fn(() => Promise.resolve({ data: { amount_refunded: 350, status: 'refunded' } })),
  },
  sellersAPI: {
    list: () => Promise.resolve({ data: [] }),
  },
  ordersAPI: {
    list: () =>
      Promise.resolve({
        data: {
          orders: [
            {
              id: 501,
              created_at: '2026-10-06T14:00:00Z',
              total_price: 350,
              status: 'delivered',
              items: [{ name: 'Biryani Platter', quantity: 1 }],
            },
          ],
        },
      }),
  },
  getErrorMessage: (err, fallback) => fallback,
}));

describe('Admin Console Sub-Pages Suite', () => {
  const mockAdminUser = { id: 99, name: 'Admin Supervisor', role: 'admin' };

  test('AdminLayout renders supervisor header and admin sub-navigation tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout currentUser={mockAdminUser} />}>
            <Route index element={<AdminOverview />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Society Platform Admin/i)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Overview & KPIs/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Chef Approvals/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Residents & Members/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Disputes & Refunds/i })).toBeInTheDocument();
    });
  });

  test('AdminOverview renders platform GMV and volume metrics', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout currentUser={mockAdminUser} />}>
            <Route index element={<AdminOverview />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Platform Financial Performance/i)).toBeInTheDocument();
      expect(screen.getByText(/₹45,000/i)).toBeInTheDocument(); // Gross GMV
      expect(screen.getByText(/₹1,200/i)).toBeInTheDocument();  // Refunded
      expect(screen.getByText(/₹43,800/i)).toBeInTheDocument();  // Net GMV
    });
  });

  test('AdminApprovals renders applicant review queue and approve button', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/approvals']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout currentUser={mockAdminUser} />}>
            <Route path="approvals" element={<AdminApprovals />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Home Chef Onboarding & Approvals/i)).toBeInTheDocument();
      expect(screen.getByText(/Chef Rajesh/i)).toBeInTheDocument();
      expect(screen.getByText(/Flat #TowerC-102/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Approve & Activate/i })).toBeInTheDocument();
    });
  });

  test('AdminResidents renders member directory with active switches', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/residents']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout currentUser={mockAdminUser} />}>
            <Route path="residents" element={<AdminResidents />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Society Resident & Member Directory/i)).toBeInTheDocument();
      expect(screen.getByText(/Amit Patel/i)).toBeInTheDocument();
      expect(screen.getByText(/Flat #TowerA-301/i)).toBeInTheDocument();
      expect(screen.getByText(/Meera Rao/i)).toBeInTheDocument();
    });
  });

  test('AdminRefunds renders order audit log and refund action', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/refunds']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout currentUser={mockAdminUser} />}>
            <Route path="refunds" element={<AdminRefunds />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Order Issues, Audits & Payments Refunds/i)).toBeInTheDocument();
      expect(screen.getByText(/#501/i)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Refund/i }).length).toBeGreaterThanOrEqual(1);
    });
  });
});
