// Spec 021 T004 — PriceTrendChart (mock-first, presentational). Asserts the
// PROP CONTRACT the component hands `react-native-gifted-charts` `LineChart`
// (mocked in jest.setup.ts to a View tagged `testID="line-chart"` recording its
// props), the 3-entry legend incl. the disabled MTG Goldfish entry (FR-003),
// the native axes — a rotated per-day M/D date tick on each point and 6
// evenly-spaced whole-dollar y-axis labels (FR-002), colour-independent
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
  data: [
    { value: 15, label: '5/1' },
    { value: 18, label: '5/2' },
    { value: 20, label: '5/3' },
  ],
};

const TCGP_SERIES: ChartSeries = {
  key: 'tcgPlayer',
  label: 'TCG Player',
  color: '#e9b5b5',
  data: [
    { value: 14, label: '5/1' },
    { value: 16, label: '5/2' },
    { value: 19, label: '5/3' },
  ],
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

  describe('x-axis date labels (FR-002)', () => {
    it('rotates a per-day M/D date tick carried on each plotted point', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      const chart = screen.getByTestId('line-chart');
      expect(chart.props.rotateLabel).toBe(true);
      // The dates flow through from `priceSeriesToChartData` on each point and
      // drive the native x-axis labels (one per day).
      const data = chart.props.data as ChartSeries['data'];
      expect(data.map((p) => p.label)).toEqual(['5/1', '5/2', '5/3']);
    });
  });

  describe('y-axis labels (FR-002)', () => {
    it('frames the observed range with 6 evenly-spaced whole-dollar labels', () => {
      const screen = render(<PriceTrendChartWithDefaults />);
      const chart = screen.getByTestId('line-chart');
      // 5 sections → 6 labels. Range is [14,20]: a nice $2 step from a round
      // baseline (floor(14/2)=14) spans $14–$24 (offset-relative maxValue = 10),
      // covering max=20 with no clipping.
      expect(chart.props.noOfSections).toBe(5);
      expect(chart.props.yAxisLabelTexts).toEqual(['$14', '$16', '$18', '$20', '$22', '$24']);
      expect(chart.props.yAxisOffset).toBe(14);
      expect(chart.props.maxValue).toBe(10);
      expect(chart.props.stepValue).toBe(2);
    });

    it('anchors the baseline at $0 when the data starts near zero', () => {
      const lowSeries: ChartSeries = {
        key: 'cardKingdom',
        label: 'Card Kingdom',
        color: '#c9a86b',
        data: [{ value: 0 }, { value: 5 }, { value: 9 }],
      };
      const screen = render(<PriceTrendChartWithDefaults chartSeries={[lowSeries]} />);
      const chart = screen.getByTestId('line-chart');
      expect(chart.props.yAxisLabelTexts).toEqual(['$0', '$2', '$4', '$6', '$8', '$10']);
    });

    it('grows the step to the next nice value so the top point never clips', () => {
      // [3,13]: a $2 step from baseline $2 spans only $2–$12 (< 13). The y-axis
      // must widen to a $5 step so max=13 stays inside the band.
      const tightSeries: ChartSeries = {
        key: 'cardKingdom',
        label: 'Card Kingdom',
        color: '#c9a86b',
        data: [{ value: 3 }, { value: 8 }, { value: 13 }],
      };
      const screen = render(<PriceTrendChartWithDefaults chartSeries={[tightSeries]} />);
      const chart = screen.getByTestId('line-chart');
      expect(chart.props.stepValue).toBe(5);
      expect(chart.props.yAxisLabelTexts).toEqual(['$0', '$5', '$10', '$15', '$20', '$25']);
      // max (13) − offset (0) = 13 ≤ maxValue (25): inside the plotted band.
      expect(chart.props.maxValue).toBeGreaterThanOrEqual(13);
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
