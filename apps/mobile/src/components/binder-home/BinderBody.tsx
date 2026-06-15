// Presentational leaf for the binder-page body. Renders exactly one of the four
// states off its props (error → no-matches → loading → pager) via early returns
// — extracted from `BinderHomeView` so the parent holds no render functions and
// the branch logic lives in a real, independently-testable component.
import type { Card } from '@my-binder/core';
import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import PagerView, { type PagerViewProps } from 'react-native-pager-view';

import BinderPage from '@src/components/binder-page/BinderPage';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import useStyles from './BinderBody.theme';

export type BinderBodyProps = {
  matchedCards: ReadonlyArray<Card>;
  currentPage: number;
  totalPages: number;
  noMatches: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetryPress: () => void;
  onCardPress: (printingId: string) => void;
  handlePagerSelected: Required<PagerViewProps>['onPageSelected'];
};

const BinderBody: FC<BinderBodyProps> = ({
  matchedCards,
  currentPage,
  totalPages,
  noMatches,
  isLoading,
  isError,
  onRetryPress,
  onCardPress,
  handlePagerSelected,
}) => {
  const styles = useStyles();

  if (isError) {
    return (
      <View style={styles.errorState}>
        <Text style={styles.errorMessage}>We couldn’t load your binder.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading binder"
          onPress={onRetryPress}
          style={styles.retryButton}
        >
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (noMatches) {
    return (
      <View style={styles.errorState}>
        <Text style={styles.errorMessage}>no matches in your binder</Text>
      </View>
    );
  }

  if (isLoading || matchedCards.length === 0) {
    return <BinderPage pageIndex={0} cards={[]} isLoading={true} />;
  }

  return (
    <PagerView
      style={styles.pager}
      testID="binder-pager"
      offscreenPageLimit={1}
      onPageSelected={handlePagerSelected}
    >
      {Array.from({ length: totalPages }).map((_, pageIdx) => {
        const start = pageIdx * SLOTS_PER_BINDER_PAGE;
        const pageCards = matchedCards.slice(start, start + SLOTS_PER_BINDER_PAGE);
        return pageIdx + 1 === currentPage ? (
          <BinderPage
            key={pageIdx}
            pageIndex={pageIdx}
            cards={pageCards}
            isLoading={isLoading}
            onCardPress={onCardPress}
          />
        ) : (
          <View key={pageIdx} />
        );
      })}
    </PagerView>
  );
};

export default BinderBody;
