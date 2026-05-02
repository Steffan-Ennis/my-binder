import { useBinderStore } from './binderStore';

const reset = () => useBinderStore.setState({ currentPage: 1 });

describe('binderStore', () => {
  beforeEach(reset);

  it('initialises currentPage to 1', () => {
    expect(useBinderStore.getState().currentPage).toBe(1);
  });

  it('holds only currentPage on its state surface (no card list)', () => {
    const state = useBinderStore.getState();
    const { nextPage, prevPage, setPage, reset: r, ...stateOnly } = state;
    expect(Object.keys(stateOnly)).toEqual(['currentPage']);
  });

  it('nextPage advances and clamps at totalPages', () => {
    const { nextPage } = useBinderStore.getState();
    nextPage(3);
    expect(useBinderStore.getState().currentPage).toBe(2);
    nextPage(3);
    expect(useBinderStore.getState().currentPage).toBe(3);
    nextPage(3); // clamps
    expect(useBinderStore.getState().currentPage).toBe(3);
  });

  it('prevPage clamps at 1', () => {
    useBinderStore.setState({ currentPage: 2 });
    const { prevPage } = useBinderStore.getState();
    prevPage();
    expect(useBinderStore.getState().currentPage).toBe(1);
    prevPage();
    expect(useBinderStore.getState().currentPage).toBe(1);
  });

  it('setPage clamps inputs above totalPages', () => {
    const { setPage } = useBinderStore.getState();
    setPage(99, 5);
    expect(useBinderStore.getState().currentPage).toBe(5);
    setPage(0, 5);
    expect(useBinderStore.getState().currentPage).toBe(1);
  });

  it('reset returns to page 1 (used after sign-out)', () => {
    useBinderStore.setState({ currentPage: 7 });
    useBinderStore.getState().reset();
    expect(useBinderStore.getState().currentPage).toBe(1);
  });
});