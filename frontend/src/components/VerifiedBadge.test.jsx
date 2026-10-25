import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerifiedBadge from './VerifiedBadge.jsx';

describe('VerifiedBadge', () => {
  it('renders nothing for an unverified account', () => {
    const { container } = render(<VerifiedBadge verified={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an accessible trust mark when verified', () => {
    render(<VerifiedBadge verified={1} />);
    expect(screen.getByRole('img', { name: /verified account/i })).toBeInTheDocument();
    expect(screen.getByTitle(/verified account/i)).toBeInTheDocument();
  });
});
