import { Ionicons } from '@expo/vector-icons';
import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import Masthead from '@src/components/masthead/Masthead';
import CatalogueBody from './CatalogueBody';
import useStyles, { type CatalogueViewStyles } from './CatalogueView.theme';
import type { CatalogueViewProps } from './types';

const RING_COUNT = 3;
const SEARCH_PLACEHOLDER = 'Search the catalogue';

const FilterOpenerPill: FC<{
  styles: CatalogueViewStyles;
  onPress: () => void;
}> = ({ styles, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Open filters"
    onPress={onPress}
    hitSlop={6}
    testID="filter-opener-pill"
    style={styles.filterOpenerPill}
  >
    <Ionicons name="options-outline" size={14} style={styles.filterOpenerIcon} />
    <Text style={styles.filterOpenerLabel}>Filters</Text>
  </Pressable>
);

const CatalogueView: FC<CatalogueViewProps> = ({
  pages,
  currentPage,
  totalPages,
  summaryCaption,
  isLoading,
  isError,
  isEmpty,
  isSearchActive,
  searchQuery,
  hasActiveQuery,
  resultsAreStale,
  onSearchOpen,
  onSearchChange,
  onSearchClose,
  onProfilePress,
  onPagerSelected,
  onRetryPress,
  onCardPress,
  onFilterSheetOpen,
  onFilterClear,
  onRefreshPress,
}) => {
  const styles = useStyles();

  return (
    <View style={styles.root} testID="catalogue-root">
      <Masthead
        subtitle="Catalogue"
        searchPlaceholder={SEARCH_PLACEHOLDER}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        hasActiveQuery={hasActiveQuery}
        onSearchOpen={onSearchOpen}
        onSearchChange={onSearchChange}
        onSearchClose={onSearchClose}
        onProfilePress={onProfilePress}
        filterPills={
          (
            <View
              style={styles.filterPillRowSingle}
              testID="catalogue-filter-pill-row"
            >
              <FilterOpenerPill styles={styles} onPress={onFilterSheetOpen} />
            </View>
          )
        }
      />

      <View style={styles.canvas}>
        <Text style={styles.summaryCaption}>{summaryCaption}</Text>

        {resultsAreStale ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh catalogue results"
            onPress={onRefreshPress}
            style={styles.refreshHint}
            testID="catalogue-refresh-hint"
          >
            <Text style={styles.refreshHintLabel}>
              Results out of date — tap to refresh
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.binderPage} testID="catalogue-page-surface">
          <View style={styles.ringColumn} pointerEvents="none">
            {Array.from({ length: RING_COUNT }).map((_, i) => (
              <View key={i} style={styles.ring} testID="catalogue-page-ring" />
            ))}
          </View>

          <CatalogueBody
            pages={pages}
            isLoading={isLoading}
            isError={isError}
            isEmpty={isEmpty}
            onPagerSelected={onPagerSelected}
            onRetryPress={onRetryPress}
            onCardPress={onCardPress}
            onFilterClear={onFilterClear}
          />
        </View>

        <View style={styles.pageNavigator}>
          <Text style={styles.pageOf} testID="catalogue-page-indicator">
            { currentPage } of { totalPages }
          </Text>
        </View>
      </View>
    </View>
  );
};

export default CatalogueView;
