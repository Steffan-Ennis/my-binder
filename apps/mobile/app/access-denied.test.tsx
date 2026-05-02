import { render } from '@testing-library/react-native';

import AccessDenied from './access-denied';

jest.mock('@src/components/access-denied/AccessDeniedContainer', () => ({
  __esModule: true,
  AccessDeniedContainer: () => 'AccessDeniedContainer',
  default: () => 'AccessDeniedContainer',
}));

describe('app/access-denied route', () => {
  it('renders exactly the AccessDeniedContainer', () => {
    const { toJSON } = render(<AccessDenied />);
    expect(JSON.stringify(toJSON())).toContain('AccessDeniedContainer');
  });
});