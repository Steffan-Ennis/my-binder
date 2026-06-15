import type { Card } from '@my-binder/core';
import type { FC } from 'react';
import { Text, View } from 'react-native';
import type { PagerViewProps } from 'react-native-pager-view';

import Masthead from '@src/components/masthead/Masthead';
import type { MastheadProps } from '@src/components/masthead/types';

import BinderBody from './BinderBody';
import useStyles from './BinderHomeView.theme';

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

          <BinderBody
            matchedCards={matchedCards}
            currentPage={currentPage}
            totalPages={totalPages}
            noMatches={noMatches}
            isLoading={isLoading}
            isError={isError}
            onRetryPress={onRetryPress}
            onCardPress={onCardPress}
            handlePagerSelected={handlePagerSelected}
          />
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
