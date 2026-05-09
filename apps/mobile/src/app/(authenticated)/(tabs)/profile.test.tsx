import { render, screen } from '@testing-library/react-native';

import Profile from './profile';

describe('profile route shell', () => {
  it('renders <ComingSoonContainer feature="profile" />', () => {
    render(<Profile />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });
});