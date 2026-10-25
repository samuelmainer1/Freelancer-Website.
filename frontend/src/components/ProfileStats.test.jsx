import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RatingBreakdown, StatTile } from './ProfileStats.jsx';

describe('StatTile', () => {
  it('renders the label, value and hint', () => {
    render(<StatTile label="Total earned" value="$12.5k" hint="6 jobs completed" />);
    expect(screen.getByText('Total earned')).toBeInTheDocument();
    expect(screen.getByText('$12.5k')).toBeInTheDocument();
    expect(screen.getByText('6 jobs completed')).toBeInTheDocument();
  });

  it('renders without a hint', () => {
    render(<StatTile label="Win rate" value="92%" />);
    expect(screen.getByText('92%')).toBeInTheDocument();
  });
});

describe('RatingBreakdown', () => {
  it('renders a row per star with counts', () => {
    render(
      <RatingBreakdown
        breakdown={{ 5: 3, 4: 1, 3: 0, 2: 0, 1: 0 }}
        count={4}
      />
    );
    // Every star rating gets a row, even at zero.
    for (const star of [5, 4, 3, 2, 1]) {
      expect(screen.getByText(`${star}★`)).toBeInTheDocument();
    }
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('is hidden when there are no reviews', () => {
    const { container } = render(<RatingBreakdown breakdown={{}} count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tolerates a missing breakdown', () => {
    render(<RatingBreakdown count={2} />);
    expect(screen.getByText('5★')).toBeInTheDocument();
  });
});
