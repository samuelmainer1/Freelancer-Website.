import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Stars, { StarPicker } from './Stars.jsx';

describe('Stars', () => {
  it('renders the rating for screen readers', () => {
    render(<Stars value={4} />);
    // The star glyphs are aria-hidden, so the sr-only text is the accessible name.
    expect(screen.getByText('4 out of 5 stars')).toBeInTheDocument();
  });

  it('rounds fractional ratings', () => {
    render(<Stars value={3.6} />);
    expect(screen.getByText('4 out of 5 stars')).toBeInTheDocument();
  });

  it('shows the numeric value when asked', () => {
    render(<Stars value={4.25} showValue />);
    expect(screen.getByText('4.3')).toBeInTheDocument();
  });

  it('renders an em dash when there is no rating', () => {
    render(<Stars value={0} showValue />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('handles a missing value without crashing', () => {
    render(<Stars />);
    expect(screen.getByText('0 out of 5 stars')).toBeInTheDocument();
  });
});

describe('StarPicker', () => {
  it('exposes a radiogroup of five stars', () => {
    render(<StarPicker value={0} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: /rating/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('marks the selected star as checked', () => {
    render(<StarPicker value={3} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '4 stars' })).toHaveAttribute('aria-checked', 'false');
  });

  it('uses singular wording for one star', () => {
    render(<StarPicker value={0} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '1 star' })).toBeInTheDocument();
  });

  it('reports the clicked value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarPicker value={0} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
