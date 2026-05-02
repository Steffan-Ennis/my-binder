import type { FC } from 'react';

import { ComingSoonView } from './ComingSoonView';
import { useComingSoon, type ComingSoonFeature } from './useComingSoon';

export type ComingSoonContainerProps = {
  feature: ComingSoonFeature;
};

const ComingSoonContainer: FC<ComingSoonContainerProps> = ({ feature }) => {
  const { title, message, iconName } = useComingSoon({ feature });
  return <ComingSoonView title={title} message={message} iconName={iconName} />;
};

export default ComingSoonContainer;
export { ComingSoonContainer };