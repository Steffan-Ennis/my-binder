import type { Card } from '@my-binder/core';
import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import PagerView, { PagerViewProps } from 'react-native-pager-view';

import Masthead from '@src/components/masthead/Masthead';
import type { MastheadProps } from '@src/components/masthead/types';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import useStyles from './BinderHomeView.theme';
import BinderPage from '@src/components/binder-page/BinderPage';

const RING_COUNT = 3;

export type BinderHomeViewProps = {
  cards: ReadonlyArray<Card>;
  matchedCards: ReadonlyArray<Card>;
  currentPage: number;
  totalPages: number;
  summaryCaption: string;
  noMatches: boolean;
  isLoading: boolean;
  isError: boolean;
  isSearchActive: boolean;
  searchQuery: string;
  hasActiveQuery: boolean;
  onRetryPress: () => void;
  // Spec 020 / FR-001 — opens the card-detail sheet for the tapped populated
  // pocket; empty/skeleton pockets never call it.
  onCardPress: (printingId: string) => void;
  mastheadProps: MastheadProps;
  handlePagerSelected: Required<PagerViewProps>['onPageSelected'];
};

const BinderHomeView: FC<BinderHomeViewProps> = ({
  matchedCards,
  currentPage,
  totalPages,
  summaryCaption,
  noMatches,
  isLoading,
  isError,
  onRetryPress,
  onCardPress,
  mastheadProps,
  handlePagerSelected,
}) => {
  const styles = useStyles();
  return (
    <View style={styles.root} testID="binder-home-root">
      <Masthead {...mastheadProps} />

      <View style={styles.canvas}>
        <Text style={styles.summaryCaption}>{summaryCaption}</Text>

        <View style={styles.binderPage} testID="binder-page-surface">
          <View style={styles.ringColumn} pointerEvents="none">
            {Array.from({ length: RING_COUNT }).map((_, i) => (
              <View key={i} style={styles.ring} testID="binder-page-ring" />
            ))}
          </View>

          {isError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorMessage}>
                We couldn’t load your binder.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading binder"
                onPress={onRetryPress}
                style={styles.retryButton}
              >
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : noMatches ? (
            <View style={styles.errorState}>
              <Text style={styles.errorMessage}>no matches in your binder</Text>
            </View>
          ) : isLoading || matchedCards.length === 0 ? (
            <BinderPage pageIndex={0} cards={[]} isLoading={true} />
          ) : (
            <PagerView
              style={styles.pager}
              testID="binder-pager"
              offscreenPageLimit={1}
              onPageSelected={handlePagerSelected}
            >
              {Array.from({ length: totalPages }).map((_, pageIdx) => {
                const start = pageIdx * SLOTS_PER_BINDER_PAGE;
                const pageCards = matchedCards.slice(
                  start,
                  start + SLOTS_PER_BINDER_PAGE,
                );
                return (pageIdx + 1 === currentPage)
                  ? <BinderPage pageIndex={pageIdx} cards={pageCards} isLoading={isLoading} onCardPress={onCardPress} />
                  : <></>
              })}
            </PagerView>
          )}
        </View>

        <View style={styles.pageNavigator}>
          <View>
            <Text style={styles.pageOf}>{currentPage} of {totalPages}</Text>
          </View>
        </View>
      </View>

    </View>
  );
};

export default BinderHomeView;
