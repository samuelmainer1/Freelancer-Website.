import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuyConnects from './BuyConnects.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

const payload = (over = {}) => ({
  balance: 2,
  bid_cost: 1,
  total_spent: 8,
  packages: [
    { id: 'starter', name: 'Starter', connects: 10, price_usd: 5, best_value: false },
    { id: 'standard', name: 'Standard', connects: 40, price_usd: 15, best_value: true },
    { id: 'pro', name: 'Pro', connects: 100, price_usd: 30, best_value: false },
  ],
  purchases: [],
  ...over,
});

describe('BuyConnects', () => {
  it('shows the current balance and all packages', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => payload() });
    renderWithProviders(<BuyConnects />);

    expect(await screen.findByTestId('balance')).toHaveTextContent('2');
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    // Per-Connect price is derived from the bundle.
    expect(screen.getByRole('button', { name: /buy for \$15/i })).toBeInTheDocument();
  });

  it('warns when the balance is empty', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => payload({ balance: 0 }),
    });
    renderWithProviders(<BuyConnects />);
    expect(await screen.findByText(/you are out of connects/i)).toBeInTheDocument();
  });

  it('buys a package and refreshes the balance and history', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => payload() })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: 42, purchased: { connects: 40, amount_usd: 15 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          payload({
            balance: 42,
            purchases: [
              {
                id: 1,
                package_id: 'standard',
                connects: 40,
                amount_usd: 15,
                created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
              },
            ],
          }),
      });

    renderWithProviders(<BuyConnects />);
    await user.click(await screen.findByRole('button', { name: /buy for \$15/i }));

    expect(await screen.findByText(/added 40 connects/i)).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent('42');
    // Three calls: initial load, purchase, reload.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(String(fetchSpy.mock.calls[1][1].body)).toContain('standard');
    // Purchase appears in the history table.
    expect(screen.getByText('+40')).toBeInTheDocument();
  });

  it('shows the server error and keeps the old balance on failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => payload() })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Unknown Connects package.' }),
      });

    renderWithProviders(<BuyConnects />);
    await user.click(await screen.findByRole('button', { name: /buy for \$5/i }));

    expect(await screen.findByText('Unknown Connects package.')).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent('2');
  });

  it('shows an empty state before any purchase', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => payload() });
    renderWithProviders(<BuyConnects />);
    expect(await screen.findByText(/no purchases yet/i)).toBeInTheDocument();
  });
});
