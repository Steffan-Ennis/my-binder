import type { FC } from 'react';

import { AccessDeniedView } from './AccessDeniedView';
import { useAccessDenied } from './useAccessDenied';

const AccessDeniedContainer: FC = () => {
  const { contactHref, onTryDifferentAccount } = useAccessDenied();
  return (
    <AccessDeniedView contactHref={contactHref} onTryDifferentAccount={onTryDifferentAccount} />
  );
};

export default AccessDeniedContainer;
export { AccessDeniedContainer };