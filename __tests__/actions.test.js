import createStore from "unistore";

import {
  activate,
  goToEnd,
  growLarger,
  growSmaller,
  select
} from "../src/actions";

import { createEmptyMatrix } from "../src/util";
import { initialState } from "../src/state";

function useStore(data = createEmptyMatrix(5, 5)) {
  const store = createStore({
    ...initialState,
    data
  });

  const dispatch = (actionCreator, ...args) => {
    store.setState(actionCreator(store.getState(), ...args));
  }

  return [store, dispatch];
}

describe("Actions", () => {
  test("goToEnd", () => {
    const [store, dispatch] = useStore();
    dispatch(activate, { column: 2, row: 2 });

    // ctrl+up
    dispatch(goToEnd(-1, 0));
    expect(store.getState().selected).toEqual({
      0: { 2: true }
    });

    // ctrl+right
    dispatch(goToEnd(0, 1));
    expect(store.getState().selected).toEqual({
      0: { 4: true }
    });

    // ctrl+down/left
    dispatch(goToEnd(1, -1));
    expect(store.getState().selected).toEqual({
      4: { 0: true }
    });
  });

  test("growLarger / growSmaller", () => {
    const [store, dispatch] = useStore();
    dispatch(activate, { column: 2, row: 2 });

    // ctrl+shift+right
    dispatch(growLarger('column'));
    expect(store.getState().selected).toEqual({
      2: { 2: true, 3: true, 4: true }
    });

    // ctrl+shift+left
    dispatch(growSmaller('column'));
    expect(store.getState().selected).toEqual({
      2: { 0: true, 1: true, 2: true }
    });

    // ctrl+shift+down
    dispatch(growLarger('row'));
    expect(store.getState().selected).toEqual({
      2: { 0: true, 1: true, 2: true },
      3: { 0: true, 1: true, 2: true },
      4: { 0: true, 1: true, 2: true }
    });

    // ctrl+shift+up
    dispatch(growSmaller('row'));
    expect(store.getState().selected).toEqual({
      0: { 0: true, 1: true, 2: true },
      1: { 0: true, 1: true, 2: true },
      2: { 0: true, 1: true, 2: true }
    });

    // ctrl+shift+down with "weird" active cell in the middle
    dispatch(select, { column: 1, row: 1 });
    dispatch(growLarger('row'));
    expect(store.getState().selected).toEqual({
      2: { 1: true, 2: true },
      3: { 1: true, 2: true },
      4: { 1: true, 2: true },
    });
  });
});
