import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../AuthContext.jsx';

// Renders a component with a router and a signed-in auth context, without
// booting the real AuthProvider (which would call /auth/me on mount).
export function renderWithProviders(
  ui,
  { token = 'test-token', user = { id: 3, name: 'Joe Rivera', role: 'freelancer' }, route = '/' } = {}
) {
  const value = {
    token,
    user,
    booting: false,
    login: async () => user,
    register: async () => user,
    logout: () => {},
    refreshUser: async () => user,
  };
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </MemoryRouter>
  );
}
