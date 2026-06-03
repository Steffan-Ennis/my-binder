// Spec 021 T004 — PriceTrendChart (mock-first, presentational). Asserts the
// PROP CONTRACT the component hands `react-native-gifted-charts` `LineChart`
// (mocked in jest.setup.ts to a View tagged `testID="line-chart"` recording its
// props), the 3-entry legend incl. the disabled MTG Goldfish entry (FR-003),
// the `30d ago`/`today` + `$min`/`$max` axis labels (FR-002), colour-independent
// text labels + screen-reader exposure (FR-006), the single-line case (AS4), the
// single-observation crash guard (FR-007 / gifted-charts #484), the always-finite
// `width` (FR-007), and gap markers carried through with no `$0` dip (FR-004).
// `render(...)` is only ever called inside `it(...)`; shared defaults live in the
// module-scope `PriceTrendChartWithDefaults` wrapper (canonical reference:
// `BinderHomeView.test.tsx`).
import { render } from '@testing-library/react-native';
import { FC } from 'react';

import PriceTrendChart from './PriceTrendChart';
import type { ChartLegendEntry, ChartSeries, PriceTrendChartProps } from './types';

const CK_SERIES: ChartSeries = {
  key: 'cardKingdom',
  label: 'Card Kingdom',
  color: '#c9a86b',
  data: [{ value: 15 }, { value: 18 }, { value: 20 }],
};

const TCGP_SERIES: ChartSeries = {
  key: 'tcgPlayer',
  label: 'TCG Player',
  color: '#e9b5b5',
  data: [{ value: 14 }, { value: 16 }, { value: 19 }],
};

const DEFAULT_LEGEND: ChartLegendEntry[] = [
  { label: 'Card Kingdom', color: '#c9a86b', disabled: false },
  { label: 'MTG Goldfish', color: '#a6797a', disabled: true },
  { label: 'TCG Player', color: '#e9b5b5', disabled: false },
];

const defaults: PriceTrendChartProps = {
  chartSeries: [CK_SERIES, TCGP_SERIES],
  chartLegend: DEFAULT_LEGEND,
};

const PriceTrendChartWithDefaults: FC<Partial<PriceTrendChartProps>> = (overrides) => (
  <PriceTrendChart {...defaults} {...overrides} />
);

describe('PriceTrendChart', () => {
  describe('datasets handed to the LineChart (FR-001)', () => {
    it('maps Card Kingdom → data and TCG Player → data2', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      const chart = screen.getByTestId('line-chart');
      expect((chart.props.data as ChartSeries['data']).map((p) => p.value)).toEqual([15, 18, 20]);
      expect((chart.props.data2 as ChartSeries['data']).map((p) => p.value)).toEqual([14, 16, 19]);
    });

    it('passes at most two datasets (MTG Goldfish is never plotted — FR-003)', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      const chart = screen.getByTestId('line-chart');
      // Only `data` + `data2` exist; there is no third dataset prop.
      expect(chart.props.data).toBeDefined();
      expect(chart.props.data2).toBeDefined();
      expect((chart.props as Record<string, unknown>).data3).toBeUndefined();
    });
  });

  describe('legend (FR-003)', () => {
    it('renders all three legend labels as text (colour-independent — FR-006)', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      expect(screen.getByText('Card Kingdom')).toBeTruthy();
      expect(screen.getByText('TCG Player')).toBeTruthy();
      expect(screen.getByText('MTG Goldfish')).toBeTruthy();
    });

    it('marks the MTG Goldfish entry disabled for screen readers with no plotted line', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      const goldfish = screen.getByLabelText('MTG Goldfish coming soon');
      expect(goldfish.props.accessibilityState).toEqual({ disabled: true });
      // Goldfish is not one of the (≤2) plotted datasets.
      const chart = screen.getByTestId('line-chart');
      expect((chart.props.data as ChartSeries['data']).map((p) => p.value)).toEqual([15, 18, 20]);
      expect((chart.props.data2 as ChartSeries['data']).map((p) => p.value)).toEqual([14, 16, 19]);
    });

    it('exposes each active source as a screen-reader text role (FR-006)', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      const ck = screen.getByLabelText('Card Kingdom price trend');
      const tcgp = screen.getByLabelText('TCG Player price trend');
      expect(ck.props.accessibilityRole).toBe('text');
      expect(ck.props.accessibilityState).toEqual({ disabled: false });
      expect(tcgp.props.accessibilityRole).toBe('text');
    });
  });

  describe('axis labels (FR-002)', () => {
    it('labels the x-axis 30d ago → today', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      expect(screen.getByText('30d ago')).toBeTruthy();
      expect(screen.getByText('today')).toBeTruthy();
    });

    it('bounds the y-axis to the observed $min / $max across both series', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      // min across [15,18,20] + [14,16,19] = 14; max = 20.
      expect(screen.getByText('$14')).toBeTruthy();
      expect(screen.getByText('$20')).toBeTruthy();
    });
  });

  describe('single-source input (AS4)', () => {
    it('plots exactly one line with no false-zero second line', () => {
      const screen = render(<PriceTrendChartWithDefaults chartSeries={[CK_SERIES]} />);
      const chart = screen.getByTestId('line-chart');
      expect((chart.props.data as ChartSeries['data']).map((p) => p.value)).toEqual([15, 18, 20]);
      expect(chart.props.data2).toBeUndefined();
    });
  });

  describe('single-observation crash guard (FR-007 — gifted-charts #484)', () => {
    it('pads a length-1 series to two identical points before reaching LineChart', () => {
      const single: ChartSeries = {
        key: 'cardKingdom',
        label: 'Card Kingdom',
        color: '#c9a86b',
        data: [{ value: 20 }],
      };
      const screen = render(<PriceTrendChartWithDefaults chartSeries={[single]} />);
      const chart = screen.getByTestId('line-chart');
      const data = chart.props.data as ChartSeries['data'];
      expect(data).toHaveLength(2);
      expect(data.map((p) => p.value)).toEqual([20, 20]);
    });
  });

  describe('explicit chart width (FR-007 — never NaN/0 in the formSheet)', () => {
    it('always passes a finite, positive width', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      const chart = screen.getByTestId('line-chart');
      const width = chart.props.width as number;
      expect(typeof width).toBe('number');
      expect(Number.isFinite(width)).toBe(true);
      expect(width).toBeGreaterThan(0);
    });
  });

  describe('gap markers (FR-004)', () => {
    it('carries hideDataPoint markers through with no $0 dip', () => {
      const gapped: ChartSeries = {
        key: 'cardKingdom',
        label: 'Card Kingdom',
        color: '#c9a86b',
        data: [{ value: 18 }, { value: 18, hideDataPoint: true }, { value: 19 }],
      };
      const screen = render(<PriceTrendChartWithDefaults chartSeries={[gapped]} />);
      const chart = screen.getByTestId('line-chart');
      const data = chart.props.data as ChartSeries['data'];
      expect(data[1].hideDataPoint).toBe(true);
      expect(data.every((p) => p.value !== 0)).toBe(true);
    });
  });
});
