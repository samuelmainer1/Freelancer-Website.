import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Profile from './Profile.jsx';
import { AuthContext } from '../AuthContext.jsx';

const ownUser = { id: 3, name: 'Joe Rivera', role: 'freelancer' };

// Profile reads :id from the URL, so it must mount under a real route.
function renderProfile({
  user = ownUser,
  token = 'test-token',
  id = 3,
  profile,
  connects = connectsPayload,
  connectsFail = false,
} = {}) {
  mockApi({ profile, connects, connectsFail });
  const value = {
    token,
    user,
    booting: false,
    login: async () => user,
    register: async () => user,
    logout: () => {},
    refreshUser: async () => user,
  };
  const utils = render(
    <MemoryRouter initialEntries={[`/users/${id}`]}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route path="/users/:id" element={<Profile />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return { ...utils, fetchSpy: global.fetch };
}

const freelancerProfile = (over = {}) => ({
  profile: {
    id: 3,
    name: 'Joe Rivera',
    role: 'freelancer',
    headline: 'Full-stack developer',
    bio: 'Seven years shipping web apps.',
    location: 'Austin, TX',
    company: null,
    website: null,
    skills: ['React', 'Node.js'],
    hourly_rate: 65,
    avatar: null,
    portfolio: null,
    is_public: 1,
    is_verified: 1,
    member_since: '2026-01-05 10:00:00',
    ...over,
  },
  stats: {
    active_bids: 2,
    won_jobs: 6,
    total_bids: 10,
    rejected_bids: 2,
    earned_total: 12500,
    win_rate: 60,
    rating_breakdown: { 5: 4, 4: 2, 3: 0, 2: 0, 1: 0 },
  },
  won_jobs: [
    {
      id: 26,
      title: 'Build a landing page',
      status: 'awarded',
      created_at: '2026-02-01 10:00:00',
      client_name: 'Sarah Kim',
      amount: 950,
      days: 9,
    },
  ],
  count: 6,
  average: 4.7,
  reviews: [],
});

const connectsPayload = {
  balance: 3,
  bid_cost: 1,
  total_spent: 7,
  packages: [],
  purchases: [
    { id: 1, package_id: 'starter', connects: 10, amount_usd: 5, created_at: '2026-03-01 10:00:00' },
  ],
};

// Routes each call by URL so the profile and Connects responses can differ.
function mockApi({ profile, connects = connectsPayload, connectsFail = false } = {}) {
  const body = profile ?? freelancerProfile();
  return vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    if (String(url).includes('/api/connects')) {
      if (connectsFail) {
        return { ok: false, status: 403, json: async () => ({ error: 'Freelancers only.' }) };
      }
      return { ok: true, json: async () => connects };
    }
    return { ok: true, json: async () => body };
  });
}

describe('Profile — freelancer track record', () => {
  it('shows total earned, jobs done, win rate and active bids', async () => {
    renderProfile();

    expect(await screen.findByText('Total earned')).toBeInTheDocument();
    expect(screen.getByText('$12.5k')).toBeInTheDocument();
    expect(screen.getByText('Jobs done')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.getByText('Active bids')).toBeInTheDocument();
    expect(screen.getByText('6 jobs completed')).toBeInTheDocument();
    expect(screen.getByText('10 bids placed')).toBeInTheDocument();
  });

  it('shows the verified badge for a verified account', async () => {
    renderProfile();
    expect(await screen.findByRole('img', { name: /verified account/i })).toBeInTheDocument();
  });

  it('shows no verified badge for an unverified account', async () => {
    renderProfile({ profile: freelancerProfile({ is_verified: 0 }) });

    await screen.findByText('Total earned');
    expect(screen.queryByRole('img', { name: /verified account/i })).not.toBeInTheDocument();
  });

  it('shows the rating distribution, not just the average', async () => {
    renderProfile();

    const fiveStar = await screen.findByText('5★');
    const panel = fiveStar.closest('div.rounded-2xl');
    // 4.7 also appears in the header badge, so assert inside the breakdown.
    expect(within(panel).getByText('4.7')).toBeInTheDocument();
    expect(within(panel).getByText('6 reviews')).toBeInTheDocument();
    for (const star of ['5★', '4★', '3★', '2★', '1★']) {
      expect(within(panel).getByText(star)).toBeInTheDocument();
    }
  });

  it('shows the agreed amount on won work', async () => {
    renderProfile();
    expect(await screen.findByText('$950')).toBeInTheDocument();
  });

  it('shows an em dash instead of 0% when the freelancer has never bid', async () => {
    const p = freelancerProfile();
    p.stats = {
      ...p.stats,
      total_bids: 0,
      won_jobs: 0,
      earned_total: 0,
      win_rate: null,
      active_bids: 0,
    };
    p.count = 0;
    p.average = null;
    p.won_jobs = [];
    renderProfile({ profile: p });

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByText(/no awarded jobs yet/i)).toBeInTheDocument();
  });
});


describe('Profile — Connects visibility', () => {
  it('shows my Connects balance on my own profile with a buy link', async () => {
    renderProfile();

    expect(await screen.findByTestId('connects-left')).toHaveTextContent('3');
    expect(screen.getByText(/connects left/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^buy more$/i })).toHaveAttribute('href', '/connects');
  });

  it('labels the button "Buy Connects" when the balance is empty', async () => {
    renderProfile({ connects: { ...connectsPayload, balance: 0 } });

    expect(await screen.findByTestId('connects-left')).toHaveTextContent('0');
    expect(screen.getByRole('link', { name: /buy connects/i })).toHaveAttribute('href', '/connects');
  });

  it("never shows the Connects balance on someone else's profile", async () => {
    const { fetchSpy } = renderProfile({ user: { id: 99, name: 'Other', role: 'freelancer' } });

    await screen.findByText('Total earned');
    expect(screen.queryByTestId('connects-left')).not.toBeInTheDocument();
    // It must not even request the private balance.
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/connects'))).toBe(false);
  });

  it('hides the Connects panel when signed out', async () => {
    const { fetchSpy } = renderProfile({ user: null, token: null });

    await screen.findByText('Total earned');
    expect(screen.queryByTestId('connects-left')).not.toBeInTheDocument();
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/connects'))).toBe(false);
  });

  it('still renders the profile if the Connects call fails', async () => {
    renderProfile({ connectsFail: true });

    expect(await screen.findByText('Total earned')).toBeInTheDocument();
    expect(screen.queryByTestId('connects-left')).not.toBeInTheDocument();
  });
});

describe('Profile — clients', () => {
  it('shows posted jobs instead of bid stats', async () => {
    renderProfile({
      user: { id: 1, name: 'Alice Chen', role: 'client' },
      id: 1,
      profile: {
        profile: {
          ...freelancerProfile().profile,
          id: 1,
          name: 'Alice Chen',
          role: 'client',
          company: 'Acme',
          is_verified: 0,
        },
        jobs: [
          {
            id: 5,
            title: 'Design a logo',
            category: 'Design',
            budget_min: 500,
            budget_max: 900,
            status: 'open',
            created_at: '2026-03-02 10:00:00',
            client_name: 'Alice Chen',
            bid_count: 3,
          },
        ],
        count: 0,
        average: null,
        reviews: [],
      },
    });

    expect(await screen.findByText('Jobs posted by Alice')).toBeInTheDocument();
    expect(screen.getByText('Design a logo')).toBeInTheDocument();
    expect(screen.queryByText('Total earned')).not.toBeInTheDocument();
  });
});
