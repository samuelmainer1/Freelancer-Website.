import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewForm from '../components/ReviewForm.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const bid = { id: 5, status: 'accepted' };

describe('ReviewForm', () => {
  it('labels the button with the reviewee name', () => {
    renderWithProviders(<ReviewForm bid={bid} revieweeName="Sarah" />);
    expect(screen.getByRole('button', { name: /review sarah/i })).toBeInTheDocument();
  });

  it('addresses a client correctly when reviewing in that direction', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReviewForm bid={bid} revieweeName="Sarah" revieweeRole="client" />
    );
    await user.click(screen.getByRole('button', { name: /review sarah/i }));
    expect(screen.getByText('How did Sarah do as a client?')).toBeInTheDocument();
  });

  it('defaults to freelancer wording', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReviewForm bid={bid} revieweeName="Joe" />);
    await user.click(screen.getByRole('button', { name: /review joe/i }));
    expect(screen.getByText('How did Joe do as a freelancer?')).toBeInTheDocument();
  });

  it('shows "Edit your review" when a review already exists', () => {
    renderWithProviders(
      <ReviewForm bid={bid} revieweeName="Sarah" existing={{ id: 9, rating: 4, comment: 'ok' }} />
    );
    expect(screen.getByRole('button', { name: /edit your review/i })).toBeInTheDocument();
  });

  it('refuses to submit without a star rating', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderWithProviders(<ReviewForm bid={bid} revieweeName="Sarah" />);

    await user.click(screen.getByRole('button', { name: /review sarah/i }));
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText(/choose a star rating first/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the rating and comment, then reports the saved review', async () => {
    const user = userEvent.setup();
    const saved = { id: 42, rating: 5, comment: 'Great client.' };
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ review: saved }),
    });
    const onSaved = vi.fn();

    renderWithProviders(
      <ReviewForm bid={bid} revieweeName="Sarah" revieweeRole="client" onSaved={onSaved} />
    );

    await user.click(screen.getByRole('button', { name: /review sarah/i }));
    await user.click(screen.getByRole('radio', { name: /5 stars/i }));
    await user.type(screen.getByPlaceholderText(/share how the project went/i), 'Great client.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/bids/5/review');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body)).toEqual({ rating: 5, comment: 'Great client.' });

    // The form collapses back to the trigger button after a successful save.
    expect(screen.getByRole('button', { name: /review sarah/i })).toBeInTheDocument();
  });

  it('surfaces a server error and stays open', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Only freelance' + 'rs can perform this action.' }),
    });

    renderWithProviders(<ReviewForm bid={bid} revieweeName="Sarah" />);
    await user.click(screen.getByRole('button', { name: /review sarah/i }));
    await user.click(screen.getByRole('radio', { name: /3 stars/i }));
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText(/can perform this action/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
  });

  it('cancels without saving', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderWithProviders(<ReviewForm bid={bid} revieweeName="Sarah" />);

    await user.click(screen.getByRole('button', { name: /review sarah/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByRole('button', { name: /review sarah/i })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
