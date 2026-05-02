import { render } from '@testing-library/react-native';

import Login from './login';

jest.mock('@src/components/login/LoginContainer', () => ({
  __esModule: true,
  LoginContainer: () => 'LoginContainer',
  default: () => 'LoginContainer',
}));

describe('app/login route', () => {
  it('renders exactly the LoginContainer', () => {
    const { toJSON } = render(<Login />);
    expect(JSON.stringify(toJSON())).toContain('LoginContainer');
  });
});