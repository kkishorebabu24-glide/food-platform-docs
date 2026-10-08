import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiModule from '../services/api';
import App from '../App';

describe('Role Selection & Switching Flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('allows selecting Home Chef role on Password login tab and logs in as seller', async () => {
    const mockLoginResponse = {
      data: {
        access_token: 'fake-seller-token',
        refresh_token: 'fake-refresh-token',
        user: {
          id: 101,
          email: 'chef.meera@society.local',
          name: 'Chef Meera',
          role: 'seller',
          verification_status: 'verified',
          is_verified: true,
        },
      },
    };

    const loginSpy = jest.spyOn(apiModule.authAPI, 'login').mockResolvedValue(mockLoginResponse);

    render(<App />);

    // Click on Login button in Navbar (exact match)
    const loginNavBtn = screen.getByRole('link', { name: /^Login$/i });
    fireEvent.click(loginNavBtn);

    // Switch to Password Tab by role
    const passwordTab = screen.getByRole('tab', { name: /Password/i });
    fireEvent.click(passwordTab);

    // Fill in credentials
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(emailInput, { target: { value: 'chef.meera@society.local' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // Select Home Chef role
    const chefRoleBtn = screen.getByRole('button', { name: /🍳 Home Chef/i });
    fireEvent.click(chefRoleBtn);

    // Click Sign In
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith(
        'chef.meera@society.local',
        'secret123',
        'seller'
      );
      // Verify user is now authenticated as seller and sees Kitchen Hub in Navbar
      expect(screen.getByText(/Chef Meera \(seller\)/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Kitchen Hub/i })).toBeInTheDocument();
    });
  });

  test('displays Workspace Switcher in User Popover and confirms obsolete mode toggle button is removed', async () => {
    // Pre-seed authenticated buyer in localStorage
    const initialUser = {
      id: 202,
      email: 'resident.anil@society.local',
      name: 'Anil Kumar',
      role: 'buyer',
      verification_status: 'verified',
      is_verified: true,
    };
    localStorage.setItem('user', JSON.stringify(initialUser));
    localStorage.setItem('access_token', 'initial-buyer-token');

    render(<App />);

    // Verify initial resident navbar
    expect(screen.getByText(/Anil Kumar \(buyer\)/i)).toBeInTheDocument();

    // Verify that the obsolete mode switch button is completely removed from navbar
    expect(screen.queryByRole('button', { name: /Switch to Chef Mode/i })).not.toBeInTheDocument();

    // Click User Chip to open User Popover
    const userChip = screen.getByText(/Anil Kumar \(buyer\)/i);
    fireEvent.click(userChip);

    // Verify Workspace Switcher shortcuts in Popover
    await waitFor(() => {
      expect(screen.getByText('WORKSPACE SWITCHER')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Resident Space/i })).toBeInTheDocument();
    });
  });
});

