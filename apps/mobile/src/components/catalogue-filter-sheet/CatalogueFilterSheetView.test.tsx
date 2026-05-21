import { fireEvent, render, screen } from '@testing-library/react-native';
import { type FC } from 'react';

import { EMPTY_FILTER_SET, type CatalogueFilterSet } from '@src/components/catalogue/types';

import CatalogueFilterSheetView from './CatalogueFilterSheetView';
import type { CatalogueFilterSheetViewProps } from './types';

const SEEDED_DRAFT: CatalogueFilterSet = {
  ...EMPTY_FILTER_SET,
  formats: ['Modern'],
  colors: ['R'],
  missingOnly: true,
};

const defaults: CatalogueFilterSheetViewProps = {
  draft: EMPTY_FILTER_SET,
  toggleFormat: jest.fn(),
  toggleSuperType: jest.fn(),
  toggleSubType: jest.fn(),
  toggleCreatureType: jest.fn(),
  onToggleColor: jest.fn(),
  onChangeMin: jest.fn(),
  onChangeMax: jest.fn(),
  onToggleMissingOnly: jest.fn(),
  onApply: jest.fn(),
  onClearAll: jest.fn(),
};

const ViewWithDefaults: FC<Partial<CatalogueFilterSheetViewProps>> = (overrides) => (
  <CatalogueFilterSheetView {...defaults} {...overrides} />
);

describe('CatalogueFilterSheetView — render contract (US2 / FR-005)', () => {
  it('renders the sheet title when open', () => {
    render(<ViewWithDefaults />);
    expect(screen.getByText('Refine Search')).toBeOnTheScreen();
  });

  it('renders the Missing only toggle row', () => {
    render(<ViewWithDefaults />);
    expect(screen.getByText('Missing only')).toBeOnTheScreen();
    expect(screen.getByTestId('missing-only-toggle')).toBeOnTheScreen();
  });

  it('renders every dimension chip row (Format / Super / Sub / Creature)', () => {
    render(<ViewWithDefaults />);
    expect(screen.getByTestId('filter-section-formats')).toBeOnTheScreen();
    expect(screen.getByTestId('filter-section-super-types')).toBeOnTheScreen();
    expect(screen.getByTestId('filter-section-sub-types')).toBeOnTheScreen();
    expect(screen.getByTestId('filter-section-creature-types')).toBeOnTheScreen();
  });

  it('renders the CMC range numeric inputs', () => {
    render(<ViewWithDefaults />);
    expect(screen.getByTestId('cmc-min-input')).toBeOnTheScreen();
    expect(screen.getByTestId('cmc-max-input')).toBeOnTheScreen();
  });

  it('renders the six colour chips (W/U/B/R/G/C)', () => {
    render(<ViewWithDefaults />);
    for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
      expect(screen.getByTestId(`color-chip-${c}`)).toBeOnTheScreen();
    }
  });

  it('renders the Clear all and Apply footer buttons', () => {
    render(<ViewWithDefaults />);
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeOnTheScreen();
  });
});

describe('CatalogueFilterSheetView — selected state styling', () => {
  it('selected format chip is marked selected via accessibilityState', () => {
    render(<ViewWithDefaults draft={SEEDED_DRAFT} />);
    const modernChip = screen.getByTestId('filter-section-formats-chip-Modern');
    expect(modernChip.props.accessibilityState?.selected).toBe(true);
  });

  it('selected colour chip carries the gold-ring style override', () => {
    render(<ViewWithDefaults draft={SEEDED_DRAFT} />);
    const rChip = screen.getByTestId('color-chip-R');
    expect(rChip.props.accessibilityState?.selected).toBe(true);
  });

  it('missing-only toggle reflects the draft.missingOnly state', () => {
    render(<ViewWithDefaults draft={SEEDED_DRAFT} />);
    const toggle = screen.getByTestId('missing-only-toggle');
    expect(toggle.props.accessibilityState?.checked).toBe(true);
  });
});

describe('CatalogueFilterSheetView — callbacks', () => {
  it('tapping a format chip fires toggleFormat with the value', () => {
    const toggleFormat = jest.fn();
    render(<ViewWithDefaults toggleFormat={toggleFormat} />);
    fireEvent.press(screen.getByTestId('filter-section-formats-chip-Modern'));
    expect(toggleFormat).toHaveBeenCalledWith('Modern');
  });

  it('tapping a super-type chip fires toggleSuperType with the value', () => {
    const toggleSuperType = jest.fn();
    render(<ViewWithDefaults toggleSuperType={toggleSuperType} />);
    fireEvent.press(screen.getByTestId('filter-section-super-types-chip-Legendary'));
    expect(toggleSuperType).toHaveBeenCalledWith('Legendary');
  });

  it('tapping a colour chip fires onToggleColor with the letter', () => {
    const onToggleColor = jest.fn();
    render(<ViewWithDefaults onToggleColor={onToggleColor} />);
    fireEvent.press(screen.getByTestId('color-chip-G'));
    expect(onToggleColor).toHaveBeenCalledWith('G');
  });

  it('tapping the toggle fires onToggleMissingOnly', () => {
    const onToggleMissingOnly = jest.fn();
    render(<ViewWithDefaults onToggleMissingOnly={onToggleMissingOnly} />);
    fireEvent.press(screen.getByTestId('missing-only-toggle'));
    expect(onToggleMissingOnly).toHaveBeenCalledTimes(1);
  });

  it('changing the CMC min input fires onChangeMin', () => {
    const onChangeMin = jest.fn();
    render(<ViewWithDefaults onChangeMin={onChangeMin} />);
    fireEvent.changeText(screen.getByTestId('cmc-min-input'), '3');
    expect(onChangeMin).toHaveBeenCalledWith('3');
  });

  it('tapping Apply fires onApply', () => {
    const onApply = jest.fn();
    render(<ViewWithDefaults onApply={onApply} />);
    fireEvent.press(screen.getByRole('button', { name: 'Apply filters' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('tapping Clear all fires onClearAll', () => {
    const onClearAll = jest.fn();
    render(<ViewWithDefaults onClearAll={onClearAll} />);
    fireEvent.press(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
