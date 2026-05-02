import { fireEvent, render, screen } from '@testing-library/react-native';

import { AccessDeniedView } from './AccessDeniedView';

describe('AccessDeniedView', () => {
  it('renders the access-not-yet-granted headline and explanatory copy', () => {
    render(
      <AccessDeniedView contactHref="mailto:hello@example.com" onTryDifferentAccount={jest.fn()} />,
    );
    expect(screen.getByText(/access not yet granted/i)).toBeTruthy();
  });

  it('fires onTryDifferentAccount when the secondary CTA is pressed', () => {
    const handler = jest.fn();
    render(<AccessDeniedView contactHref="mailto:hello@example.com" onTryDifferentAccount={handler} />);
    fireEvent.press(screen.getByText(/Try a different account/i));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('renders a contact CTA pointing at the supplied href', () => {
    render(
      <AccessDeniedView contactHref="mailto:hello@example.com" onTryDifferentAccount={jest.fn()} />,
    );
    expect(screen.getByText(/Contact/i)).toBeTruthy();
  });
});