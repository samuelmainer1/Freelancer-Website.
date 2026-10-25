import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPill from './StatusPill.jsx';

describe('StatusPill', () => {
  it('renders the status label', () => {
    render(<StatusPill status="accepted" />);
    expect(screen.getByText('accepted')).toBeInTheDocument();
  });

  it('applies the colour for each known status', () => {
    const { container, rerender } = render(<StatusPill status="open" />);
    expect(container.firstChild.className).toContain('emerald');

    rerender(<StatusPill status="rejected" />);
    expect(container.firstChild.className).toContain('rose');

    rerender(<StatusPill status="pending" />);
    expect(container.firstChild.className).toContain('amber');
  });

  it('falls back to a neutral style for unknown statuses', () => {
    const { container } = render(<StatusPill status="mystery" />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
    expect(container.firstChild.className).toContain('bg-slate-100');
  });
});
