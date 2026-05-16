// Mobile-only types for the reusable `<Card />` component (spec 017).
// These never cross the wire — kept inside the mobile workspace.

export type CardFootprint = 'pocket' | 'detail';

export type CardViewState =
  | { kind: 'loading' }
  | { kind: 'loaded'; imageUrl: string }
  | { kind: 'notFound' }
  | { kind: 'error'; onRetry: () => void };

export type CardViewProps = {
  state: CardViewState;
  footprint: CardFootprint;
};
