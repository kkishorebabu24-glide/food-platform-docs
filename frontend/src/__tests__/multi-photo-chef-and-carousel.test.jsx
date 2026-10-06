import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DishImageModal from '../components/DishImageModal';
import { ChefCard, SellersPage } from '../App';
import * as apiModule from '../services/api';

describe('Multi-Photo Chef Cards, Sliding Dish Modal Carousel, and Filter Enhancements', () => {
  const mockDishes = [
    {
      id: 101,
      name: 'Paneer Tikka Roll',
      price: 150,
      category: 'veg',
      description: 'Charcoal-grilled paneer wrapped in flaky whole wheat paratha.',
      image_url: 'https://images.unsplash.com/photo-paneer',
      spice_level: 'medium',
      portion_size: '1 roll (250g)',
    },
    {
      id: 102,
      name: 'Chicken Dum Biryani',
      price: 260,
      category: 'non_veg',
      description: 'Slow-cooked aromatic basmati rice with succulent chicken pieces.',
      image_url: 'https://images.unsplash.com/photo-biryani',
      spice_level: 'spicy',
      portion_size: 'Serves 1-2 (500g)',
    },
    {
      id: 103,
      name: 'Mango Kulfi',
      price: 80,
      category: 'desserts',
      description: 'Traditional creamy Alphonso mango kulfi on a stick.',
      image_url: 'https://images.unsplash.com/photo-kulfi',
      portion_size: '1 stick',
    },
  ];

  test('DishImageModal supports sliding carousel with next/prev buttons, counter, and keyboard arrows', () => {
    let currentIndex = 0;
    const handleIndexChange = jest.fn((newIdx) => {
      currentIndex = newIdx;
    });
    const handleAddToCart = jest.fn();
    const handleClose = jest.fn();

    const { rerender } = render(
      <DishImageModal
        open={true}
        onClose={handleClose}
        items={mockDishes}
        currentIndex={currentIndex}
        onIndexChange={handleIndexChange}
        onAddToCart={handleAddToCart}
      />
    );

    // Initial state: Dish 1 of 3
    expect(screen.getByText('Dish 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Paneer Tikka Roll')).toBeInTheDocument();
    expect(screen.getByText('🟢 Pure Veg')).toBeInTheDocument();
    expect(screen.getByText('₹150')).toBeInTheDocument();

    // Click next dish arrow button
    const nextBtn = screen.getByRole('button', { name: /Next dish/i });
    fireEvent.click(nextBtn);
    expect(handleIndexChange).toHaveBeenCalledWith(1);

    // Re-render at index 1
    rerender(
      <DishImageModal
        open={true}
        onClose={handleClose}
        items={mockDishes}
        currentIndex={1}
        onIndexChange={handleIndexChange}
        onAddToCart={handleAddToCart}
      />
    );

    expect(screen.getByText('Dish 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Chicken Dum Biryani')).toBeInTheDocument();
    expect(screen.getByText('🔴 Non-Veg')).toBeInTheDocument();
    expect(screen.getByText('₹260')).toBeInTheDocument();

    // Keyboard navigation: press ArrowLeft
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(handleIndexChange).toHaveBeenCalledWith(0);

    // Keyboard navigation: press ArrowRight
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(handleIndexChange).toHaveBeenCalledWith(2);

    // Add to cart from modal
    const addBtn = screen.getByRole('button', { name: /Add to Basket • ₹260/i });
    fireEvent.click(addBtn);
    expect(handleAddToCart).toHaveBeenCalledWith(mockDishes[1]);
  });

  test('ChefCard renders multi-photo gallery carousel with dots and next/prev controls', () => {
    const mockSeller = {
      id: 1,
      name: 'Chef Priyanka',
      flat_number: 'B-402',
      bio: 'Authentic Punjabi & Mughlai cuisine specialist',
      rating: 4.9,
      review_count: 58,
      on_time_delivery_rate: 98.5,
      avg_delivery_minutes: 25,
      is_open: true,
      photo_url: 'https://images.unsplash.com/priyanka-avatar',
      banner_url: 'https://images.unsplash.com/priyanka-kitchen',
      photos: [
        'https://images.unsplash.com/priyanka-kitchen',
        'https://images.unsplash.com/priyanka-dish1',
        'https://images.unsplash.com/priyanka-dish2',
      ],
    };

    render(
      <MemoryRouter>
        <ChefCard seller={mockSeller} />
      </MemoryRouter>
    );

    expect(screen.getByText('Chef Priyanka')).toBeInTheDocument();
    expect(screen.getByText(/Resident at Flat #\s*B-402/i)).toBeInTheDocument();
    expect(screen.getByText('4.9')).toBeInTheDocument();

    // Should render photo navigation dots (3 photos)
    const dotButtons = screen.getAllByRole('button', { name: /View photo \d/i });
    expect(dotButtons.length).toBe(3);

    // Click next photo button
    const nextPhotoBtn = screen.getByRole('button', { name: /Next photo/i });
    fireEvent.click(nextPhotoBtn);

    // Click previous photo button
    const prevPhotoBtn = screen.getByRole('button', { name: /Previous photo/i });
    fireEvent.click(prevPhotoBtn);
  });

  test('SellersPage renders search, multi-select filters, sort controls, and dish search with tabs', async () => {
    const mockSellers = [
      {
        id: 1,
        name: 'Chef Priyanka',
        flat_number: 'B-402',
        rating: 4.9,
        review_count: 58,
        on_time_delivery_rate: 98.5,
        avg_delivery_minutes: 25,
        is_open: true,
        photos: ['https://images.unsplash.com/photo-1'],
      },
      {
        id: 2,
        name: 'Chef Meera',
        flat_number: 'A-101',
        rating: 4.2,
        review_count: 12,
        on_time_delivery_rate: 85.0,
        avg_delivery_minutes: 35,
        is_open: false,
        photos: [],
      },
    ];

    const mockSearchResults = {
      items: [
        {
          id: 501,
          name: 'Hyderabadi Chicken Biryani',
          seller_id: 1,
          seller_name: 'Chef Priyanka',
          seller_flat: 'B-402',
          price: 240,
          category: 'non_veg',
          image_url: 'https://images.unsplash.com/photo-biryani',
        },
      ],
      total: 1,
      matched_sellers: [
        {
          id: 1,
          name: 'Chef Priyanka',
          flat_number: 'B-402',
        },
      ],
    };

    jest.spyOn(apiModule.sellersAPI, 'list').mockResolvedValue({
      data: { sellers: mockSellers },
    });
    jest.spyOn(apiModule.menusAPI, 'search').mockResolvedValue({
      data: mockSearchResults,
    });

    const handleAddToCart = jest.fn();

    render(
      <MemoryRouter>
        <SellersPage onAddToCart={handleAddToCart} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Chef Priyanka')).toBeInTheDocument();
    });
    expect(screen.getByText('Chef Meera')).toBeInTheDocument();

    // Multi-select filter chips
    const vegFilter = screen.getByText(/Pure Veg/i);
    const openNowFilter = screen.getByText(/Open Now/i);
    const punctualFilter = screen.getByText(/High Punctuality/i);
    const topRatedFilter = screen.getByText(/Top Rated/i);

    expect(vegFilter).toBeInTheDocument();
    expect(openNowFilter).toBeInTheDocument();
    expect(punctualFilter).toBeInTheDocument();
    expect(topRatedFilter).toBeInTheDocument();

    // Toggle Open Now filter
    fireEvent.click(openNowFilter);
    expect(screen.getByText('Chef Priyanka')).toBeInTheDocument();
    expect(screen.queryByText('Chef Meera')).not.toBeInTheDocument();

    // Reset filter
    const resetBtn = screen.getByText(/✕ Reset Filters/i);
    fireEvent.click(resetBtn);
    expect(screen.getByText('Chef Meera')).toBeInTheDocument();

    // Dedicated sort chips
    const sortRating = screen.getByText(/Rating/i);
    fireEvent.click(sortRating);

    // Type in search box to trigger dish search and live autocomplete
    const searchInput = screen.getByPlaceholderText(/Search chef name, flat number, or special dishes/i);
    fireEvent.change(searchInput, { target: { value: 'Biryani' } });

    await waitFor(() => {
      expect(screen.getAllByText(/Special Dishes Matching/i).length).toBeGreaterThan(0);
    });

    // Dual tab switching should appear for matching dishes
    const dishesTab = screen.getByRole('tab', { name: /All Matching Dishes/i });
    expect(dishesTab).toBeInTheDocument();
    fireEvent.click(dishesTab);

    // Back to Chefs tab
    const chefsTab = screen.getByRole('tab', { name: /Kitchens & Chefs/i });
    fireEvent.click(chefsTab);
    expect(screen.getAllByText('Chef Priyanka').length).toBeGreaterThan(0);
  });
});
