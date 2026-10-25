import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BidForm from './BidForm.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

describe('BidForm', () => {
  it('charges a Connect on a new bid and shows the cost up front', () => {
    renderWithProviders(<BidForm myBid={null} busy={false} onSubmit={() => {}} connectBalance={4} />);

    expect(screen.getByRole('heading', { name: /place a bid/i })).toBeInTheDocument();
    expect(screen.getByText(/costs 1 connect/i)).toBeInTheDocument();
    expect(screen.getByText(/you have 4 connects left/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit bid/i })).toBeEnabled();
  });

  it('uses the singular "Connect" when only one is left', () => {
    renderWithProviders(<BidForm myBid={null} busy={false} onSubmit={() => {}} connectBalance={1} />);
    expect(screen.getByText(/you have 1 connect left/i)).toBeInTheDocument();
  });

  it('does not charge when updating an existing bid', () => {
    const myBid = { id: 9, amount: 1200, days: 7, proposal: 'My existing pitch.' };
    renderWithProviders(<BidForm myBid={myBid} busy={false} onSubmit={() => {}} connectBalance={0} />);

    expect(screen.getByRole('heading', { name: /update your bid/i })).toBeInTheDocument();
    expect(screen.queryByText(/costs 1 connect/i)).not.toBeInTheDocument();
    expect(screen.getByText(/updates it for free/i)).toBeInTheDocument();
    // Critically: an existing bid stays editable with zero Connects.
    expect(screen.getByRole('button', { name: /update bid/i })).toBeEnabled();
  });

  it('blocks a new bid at zero Connects and points at the buy page', () => {
    renderWithProviders(<BidForm myBid={null} busy={false} onSubmit={() => {}} connectBalance={0} />);

    expect(screen.getByText(/you are out of connects/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /buy connects/i })).toHaveAttribute('href', '/connects');
    expect(screen.getByRole('button', { name: /submit bid/i })).toBeDisabled();
  });

  it('prefills the form from an existing bid', () => {
    const myBid = { id: 9, amount: 1200, days: 7, proposal: 'My existing pitch.' };
    renderWithProviders(<BidForm myBid={myBid} busy={false} onSubmit={() => {}} />);

    expect(screen.getByDisplayValue('1200')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My existing pitch.')).toBeInTheDocument();
  });

  it('submits numeric amount and days', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<BidForm myBid={null} busy={false} onSubmit={onSubmit} connectBalance={3} />);

    await user.type(screen.getByPlaceholderText('1500'), '2500');
    await user.type(screen.getByPlaceholderText('14'), '10');
    await user.type(screen.getByRole('textbox', { name: /proposal/i }), 'I can ship this in 10 days.');
    await user.click(screen.getByRole('button', { name: /submit bid/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      amount: 2500,
      days: 10,
      proposal: 'I can ship this in 10 days.',
    });
  });
});
