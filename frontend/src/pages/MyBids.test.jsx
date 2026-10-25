import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyBids from '../pages/MyBids.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const bid = (over = {}) => ({
  id: 5,
  job_id: 26,
  job_title: 'Build a landing page',
  job_status: 'awarded',
  client_id: 2,
  client_name: 'Sarah Kim',
  status: 'accepted',
  amount: 1200,
  days: 7,
  proposal: 'I can deliver this in a week.',
  created_at: '2026-01-01 00:00:00',
  client_review_id: null,
  client_review_rating: null,
  ...over,
});

function mockBids(bids) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ bids }) });
}

describe('MyBids', () => {
  it('renders the freelancer → client review form on an accepted bid', async () => {
    mockBids([bid()]);
    renderWithProviders(<MyBids />);

    // Regression: this form was previously unreachable from the UI even though
    // the API supported it.
    const review = await screen.findByRole('button', { name: /review sarah/i });
    expect(review).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(review);
    expect(screen.getByText('How did Sarah do as a client?')).toBeInTheDocument();
  });

  it('links to the client thread and shows the client name', async () => {
    mockBids([bid()]);
    renderWithProviders(<MyBids />);

    const msg = await screen.findByRole('link', { name: /message client/i });
    expect(msg).toHaveAttribute('href', '/messages/26/2');
    expect(screen.getByRole('link', { name: 'Sarah Kim' })).toHaveAttribute('href', '/users/2');
    expect(screen.getByRole('link', { name: 'Build a landing page' })).toHaveAttribute(
      'href',
      '/jobs/26'
    );
  });

  it('shows "Edit your review" and the existing rating once reviewed', async () => {
    mockBids([bid({ client_review_id: 3, client_review_rating: 4 })]);
    renderWithProviders(<MyBids />);

    expect(await screen.findByText(/you rated this client/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit your review/i })).toBeInTheDocument();
  });

  it('hides review controls on a bid that is not accepted', async () => {
    mockBids([bid({ status: 'pending' })]);
    renderWithProviders(<MyBids />);

    await screen.findByText('Build a landing page');
    expect(screen.queryByRole('button', { name: /review sarah/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /message client/i })).not.toBeInTheDocument();
  });

  it('still shows the client rating on a rejected bid that was reviewed', async () => {
    mockBids([bid({ status: 'rejected', client_review_id: 8, client_review_rating: 3 })]);
    renderWithProviders(<MyBids />);

    expect(await screen.findByText(/you rated this client/i)).toBeInTheDocument();
    // Not accepted any more, so no new review can be submitted.
    expect(screen.queryByRole('button', { name: /edit your review/i })).not.toBeInTheDocument();
  });

  it('updates the card after a review is saved, without refetching', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ bids: [bid()] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ review: { id: 77, rating: 5 } }),
      });

    renderWithProviders(<MyBids />);

    await user.click(await screen.findByRole('button', { name: /review sarah/i }));
    await user.click(screen.getByRole('radio', { name: /5 stars/i }));
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() => expect(screen.getByText(/you rated this client/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /edit your review/i })).toBeInTheDocument();
    // Only the initial list fetch plus the one review POST.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when there are no bids', async () => {
    mockBids([]);
    renderWithProviders(<MyBids />);
    expect(await screen.findByText(/haven't placed any bids yet/i)).toBeInTheDocument();
  });

  it('shows the API error message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Authentication required. Please log in.' }),
    });
    renderWithProviders(<MyBids />);
    expect(await screen.findByText(/authentication required/i)).toBeInTheDocument();
  });
});
