// Presentational leaf for the catalogue-page body. Renders exactly one of the
// four states off its props (error → empty → loading → pager) via early returns
// — extracted from `CatalogueView` so the parent holds no render functions and
// the branch logic lives in a real, independently-testable component.
import type { FC } from 'react';
import { Pressable, Text, View } from 'react-native';
import PagerView, { type PagerViewProps } from 'react-native-pager-view';

import BinderPage from '@src/components/binder-page/BinderPage';

import useStyles from './CatalogueBody.theme';
import type { CataloguePage } from './types';

export type CatalogueBodyProps = {
  pages: ReadonlyArray<CataloguePage>;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onPagerSelected: (pageNumber: number) => void;
  onRetryPress: () => void;
  onCardPress: (printingId: string) => void;
  onFilterClear: () => void;
};

const CatalogueBody: FC<CatalogueBodyProps> = ({
  pages,
  isLoading,
  isError,
  isEmpty,
  onPagerSelected,
  onRetryPress,
  onCardPress,
  onFilterClear,
}) => {
  const styles = useStyles();

  const handlePageSelected: Required<PagerViewProps>['onPageSelected'] = (event) => {
    onPagerSelected(event.nativeEvent.position + 1);
  };

  if (isError) {
    return (
      <View style={styles.errorState}>
        <Text style={styles.errorMessage}>We couldn’t load the catalogue.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading the catalogue"
          onPress={onRetryPress}
          style={styles.retryButton}
        >
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.errorState} testID="catalogue-empty-state">
        <Text style={styles.errorMessage}>no cards match these filters</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
          onPress={onFilterClear}
          style={styles.retryButton}
        >
          <Text style={styles.retryLabel}>Clear filters</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || pages.length === 0) {
    return <BinderPage pageIndex={0} cards={[]} isLoading={true} />;
  }

  return (
    <PagerView
      style={styles.pager}
      testID="catalogue-pager"
      offscreenPageLimit={1}
      onPageSelected={handlePageSelected}
    >
      {pages.map((page, pageIndex) => (
        <BinderPage
          key={pageIndex}
          pageIndex={pageIndex}
          cards={page.cards}
          isLoading={isLoading}
          onCardPress={onCardPress}
        />
      ))}
    </PagerView>
  );
};

export default CatalogueBody;
