import { fireEvent, render, screen } from '@testing-library/react-native';

import { LoginView } from './LoginView';

describe('LoginView', () => {
  const baseProps = {
    isSigningIn: false,
    errorMessage: null,
    onSignInPress: jest.fn(),
  };

  it('renders the masthead, title, and Sign in with Google CTA', () => {
    render(<LoginView {...baseProps} />);
    expect(screen.getByText(/ULTRA · ESTABLISHED · 1972/i)).toBeTruthy();
    expect(screen.getByText(/Collectors Album/i)).toBeTruthy();
    expect(screen.getByText(/digital edition/i)).toBeTruthy();
    expect(screen.getByText(/Sign in with Google/i)).toBeTruthy();
  });

  it('does not render any username or password fields', () => {
    const { queryByPlaceholderText } = render(<LoginView {...baseProps} />);
    expect(queryByPlaceholderText(/username/i)).toBeNull();
    expect(queryByPlaceholderText(/email/i)).toBeNull();
    expect(queryByPlaceholderText(/password/i)).toBeNull();
  });

  it('fires onSignInPress when the CTA is pressed', () => {
    const handler = jest.fn();
    render(<LoginView {...baseProps} onSignInPress={handler} />);
    fireEvent.press(screen.getByText(/Sign in with Google/i));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('shows an error banner when errorMessage is set', () => {
    render(<LoginView {...baseProps} errorMessage="Couldn't sign in. Try again." />);
    expect(screen.getByText("Couldn't sign in. Try again.")).toBeTruthy();
  });

  it('disables the CTA while isSigningIn is true', () => {
    const handler = jest.fn();
    render(<LoginView {...baseProps} isSigningIn={true} onSignInPress={handler} />);
    fireEvent.press(screen.getByText(/Sign in with Google/i));
    expect(handler).not.toHaveBeenCalled();
  });
});