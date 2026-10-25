import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import ConnectPill from './ConnectPill.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

function mockConnects(balance) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ balance }),
  });
}

describe('ConnectPill', () => {
  it('shows the balance for a freelancer and links to the buy page', async () => {
    mockConnects(7);
    renderWithProviders(<ConnectPill />);

    const count = await screen.findByTestId('connect-count');
    expect(count).toHaveTextContent('7');
    expect(screen.getByText('Connects')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/connects');
  });

  it('uses the singular when exactly one Connect is left', async () => {
    mockConnects(1);
    renderWithProviders(<ConnectPill />);
    expect(await screen.findByTestId('connect-count')).toHaveTextContent('1');
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('nudges the user to buy when the balance is empty', async () => {
    mockConnects(0);
    renderWithProviders(<ConnectPill />);

    expect(await screen.findByTestId('connect-count')).toHaveTextContent('0');
    expect(screen.getByText(/buy/i)).toBeInTheDocument();
  });

  it('renders nothing for clients', () => {
    const fetchSpy = mockConnects(5);
    const { container } = renderWithProviders(<ConnectPill />, {
      user: { id: 1, name: 'Alice Chen', role: 'client' },
    });
    expect(container).toBeEmptyDOMElement();
    // Clients must not hit the freelancer-only endpoint at all.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders nothing when signed out', () => {
    const fetchSpy = mockConnects(5);
    const { container } = renderWithProviders(<ConnectPill />, { user: null, token: null });
    expect(container).toBeEmptyDOMElement();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
