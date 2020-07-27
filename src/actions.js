// @flow
import * as PointSet from "./point-set";
import * as PointMap from "./point-map";
import * as Matrix from "./matrix";
import * as Types from "./types";
import { isActive, setCell, range, updateData } from "./util";

type Action = <Cell: Types.CellBase>(
  state: Types.StoreState<Cell>,
  ...*
) => $Shape<Types.StoreState<Cell>> | null;

export const setData: Action = (state, data) => {
  const nextActive =
    state.active && Matrix.has(state.active.row, state.active.column, data)
      ? state.active
      : null;
  const nextSelected = PointSet.filter(
    point => Matrix.has(point.row, point.column, data),
    state.selected
  );
  const nextBindings = PointMap.map(
    bindings =>
      PointSet.filter(
        point => Matrix.has(point.row, point.column, data),
        bindings
      ),
    PointMap.filter(
      (_, point) => Matrix.has(point.row, point.column, data),
      state.bindings
    )
  );
  return {
    data,
    active: nextActive,
    selected: nextSelected,
    bindings: nextBindings
  };
};

export const select: Action = (state, cellPointer: Types.Point) => {
  if (state.active && !isActive(state.active, cellPointer)) {
    return {
      selected: PointSet.from(
        Matrix.inclusiveRange(
          { row: cellPointer.row, column: cellPointer.column },
          { row: state.active.row, column: state.active.column }
        )
      ),
      mode: "view"
    };
  }
  return null;
};

export const activate: Action = (state, cellPointer: Types.Point) => ({
  selected: PointSet.from([cellPointer]),
  active: cellPointer,
  mode: isActive(state.active, cellPointer) ? "edit" : "view"
});

export function setCellData<Cell: Types.CellBase>(
  state: Types.StoreState<Cell>,
  active: Types.Point,
  data: Cell,
  bindings: Types.Point[]
): $Shape<Types.StoreState<Cell>> | null {
  if (isActiveReadOnly(state)) {
    return null;
  }
  return {
    mode: "edit",
    data: setCell(state, active, data),
    lastChanged: active,
    bindings: PointMap.set(active, PointSet.from(bindings), state.bindings)
  };
}

export function setCellDimensions(
  state: Types.StoreState<*>,
  point: Types.Point,
  dimensions: Types.Dimensions
): $Shape<Types.StoreState<*>> | null {
  const prevRowDimensions = state.rowDimensions[point.row];
  const prevColumnDimensions = state.columnDimensions[point.column];
  if (
    prevRowDimensions &&
    prevColumnDimensions &&
    prevRowDimensions.top === dimensions.top &&
    prevRowDimensions.height === dimensions.height &&
    prevColumnDimensions.left === dimensions.left &&
    prevColumnDimensions.width === dimensions.width
  ) {
    return null;
  }
  return {
    rowDimensions: {
      ...state.rowDimensions,
      [point.row]: { top: dimensions.top, height: dimensions.height }
    },
    columnDimensions: {
      ...state.columnDimensions,
      [point.column]: { left: dimensions.left, width: dimensions.width }
    }
  };
}

export function copy<T>(state: Types.StoreState<T>) {
  return {
    copied: PointSet.reduce(
      (acc, point) =>
        PointMap.set<T>(
          point,
          Matrix.get<T>(point.row, point.column, state.data),
          acc
        ),
      state.selected,
      PointMap.from<T>([])
    ),
    cut: false,
    hasPasted: false
  };
}

export const cut = (state: Types.StoreState<*>) => ({
  ...copy(state),
  cut: true
});

export async function paste<Cell: Types.CellBase>(
  state: Types.StoreState<Cell>,
  text: string
) {
  if (!text) return null;
  const copiedMatrix = Matrix.split(text, value => ({ value }));
  const copied = PointMap.fromMatrix<any>(copiedMatrix);

  const minPoint = PointSet.min(copied);

  type Accumulator = {|
    data: $PropertyType<Types.StoreState<Cell>, "data">,
    selected: $PropertyType<Types.StoreState<Cell>, "selected">,
    commit: $PropertyType<Types.StoreState<Cell>, "lastCommit">
  |};

  const requiredRows = state.active.row + Matrix.getSize(copiedMatrix).rows;
  const paddedData = Matrix.padMatrix(state.data, requiredRows);

  const { data, selected, commit } = PointMap.reduce(
    (acc: Accumulator, value, { row, column }): Accumulator => {
      if (!state.active) {
        return acc;
      }

      let commit =
        acc.commit || ([]: $PropertyType<Types.StoreState<Cell>, "lastCommit">);
      const nextRow = row - minPoint.row + state.active.row;
      const nextColumn = column - minPoint.column + state.active.column;

      const nextData = state.cut
        ? Matrix.unset(row, column, acc.data)
        : acc.data;

      if (state.cut) {
        commit = [...commit, { prevCell: value, nextCell: undefined }];
      }

      if (!Matrix.has(nextRow, nextColumn, paddedData)) {
        return { data: nextData, selected: acc.selected, commit };
      }
      const currentValue = Matrix.get(nextRow, nextColumn, nextData) || {};

      commit = [
        ...commit,
        {
          prevCell: currentValue,
          nextCell: value
        }
      ];

      return {
        data: Matrix.set(
          nextRow,
          nextColumn,
          { ...currentValue, ...value },
          nextData
        ),
        selected: PointSet.add(acc.selected, {
          row: nextRow,
          column: nextColumn
        }),
        commit
      };
    },
    copied,
    { data: paddedData, selected: PointSet.from([]), commit: [] }
  );
  return {
    data,
    selected,
    cut: false,
    hasPasted: true,
    mode: "view",
    lastCommit: commit
  };
}

export const edit = <Cell: Types.CellBase>(state: Types.StoreState<Cell>) => {
  if (isActiveReadOnly(state)) {
    return null;
  }
  return { mode: "edit" };
};

export const view = () => ({
  mode: "view"
});

export const clear = <Cell: Types.CellBase>(state: Types.StoreState<Cell>) => {
  if (!state.active) {
    return null;
  }

  const { row, column } = state.active;
  const cell = Matrix.get(row, column, state.data);
  return {
    data: PointSet.reduce(
      (acc, point) =>
        updateData<Cell>(acc, {
          ...point,
          data: { ...cell, value: "" }
        }),
      state.selected,
      state.data
    ),
    ...commit(
      state,
      PointSet.toArray(state.selected).map(point => {
        const cell = Matrix.get(point.row, point.column, state.data);
        return {
          prevCell: cell,
          nextCell: { ...cell, value: "" }
        };
      })
    )
  };
};

export type KeyDownHandler<Cell: Types.CellBase> = (
  state: Types.StoreState<Cell>,
  event: SyntheticKeyboardEvent<*>
) => $Shape<Types.StoreState<Cell>> | null;

export const go = <Cell: Types.CellBase>(
  rowDelta: number,
  columnDelta: number
): KeyDownHandler<Cell> => (state, event) => {
  if (!state.active) {
    return null;
  }
  const nextActive = {
    row: state.active.row + rowDelta,
    column: state.active.column + columnDelta
  };
  if (!Matrix.has(nextActive.row, nextActive.column, state.data)) {
    return { mode: "view" };
  }
  return {
    active: nextActive,
    selected: PointSet.from([nextActive]),
    mode: "view"
  };
};

/**
 * Moves the spreadsheet's selection to the edge. This is used to implement
 * ctrl+ArrowKey navigation.
 *
 * Directions are either -1, 0, or +1
 *    -1: Means to move this dimension towards the smaller edge (top or left)
 *     0: Means to maintain the current value for this dimension
 *    +1: Means to move this dimension towards the larger edge (bottom or right)
 *
 * For instance, `goToEnd(-1, -1)` will move the selection to the top-left cell of the spreadsheet.
 */
export const goToEnd = <Cell: Types.CellBase>(
  rowDirection: number,
  columnDirection: number
): KeyDownHandler<Cell> => (state, event) => {
  if (!state.active) {
    return null;
  }

  const { columns, rows } = Matrix.getSize(state.data);

  // Calculates the number of cells needed in order to reach the edge
  const getDistanceToTarget = (direction: number, currentIndex: number, maxIndex: number) => {
    if (direction === 1) {
      return maxIndex - currentIndex;
    } else if (direction === -1) {
      return -currentIndex;
    } else {
      return 0;
    }
  };

  return go(
    getDistanceToTarget(rowDirection, state.active.row, rows - 1),
    getDistanceToTarget(columnDirection, state.active.column, columns - 1)
  )(state, event);
};

// Handle ctrl+shift+{left, up}
export const growSmaller = <Cell: Types.BaseCell>(
  field: $Keys<Types.Point>
): KeyDownHandler<Cell> => (state, event) => {
  if (!state.active) {
    return null;
  }

  const activeIndex = state.active[field];

  // We want `maxSelectedIndex` -> `activeIndex`
  const maxSelectedIndex = PointSet.max(state.selected)[field];
  // We want `minSelectedIndex` -> `0`
  const minSelectedIndex = PointSet.min(state.selected)[field];

  let nextSelected = state.selected;

  // Grow the selection towards the edge
  range(minSelectedIndex).forEach(() => {
    nextSelected = PointSet.extendEdge(nextSelected, field, -1);
  });

  // Shrink the selection towards the active cell
  range(maxSelectedIndex - activeIndex).forEach(() => {
    nextSelected = PointSet.shrinkEdge(nextSelected, field, 1);
  });

  return {
    selected: PointSet.filter(
      point => Matrix.has(point.row, point.column, state.data),
      nextSelected
    )
  };
};

// Handle ctrl+shift+{right, down}
export const growLarger = <Cell: Types.BaseCell>(
  field: $Keys<Types.Point>
): KeyDownHandler<Cell> => (state, event) => {
  if (!state.active) {
    return null;
  }

  const activeIndex = state.active[field];

  const dimensions = Matrix.getSize(state.data);
  const maxIndex = dimensions[field + "s"];

  // We want `maxSelectedIndex` -> `maxIndex`
  const maxSelectedIndex = PointSet.max(state.selected)[field];
  // We want `minSelectedIndex` -> `activeIndex`
  const minSelectedIndex = PointSet.min(state.selected)[field];

  // Grow the selection towards the edge
  let nextSelected = state.selected;
  range(maxIndex - maxSelectedIndex).forEach(() => {
    nextSelected = PointSet.extendEdge(nextSelected, field, 1);
  });

  // Shrink the selection towards the selected cell
  range(activeIndex - minSelectedIndex).forEach(() => {
    nextSelected = PointSet.shrinkEdge(nextSelected, field, -1);
  });

  return {
    selected: PointSet.filter(
      point => Matrix.has(point.row, point.column, state.data),
      nextSelected
    )
  };
};

export const modifyEdge = (field: $Keys<Types.Point>, delta: number) => (
  state: Types.StoreState<*>,
  event: *
) => {
  if (!state.active) {
    return null;
  }

  const edgeOffsets = PointSet.has(state.selected, {
    ...state.active,
    [field]: state.active[field] + delta * -1
  });

  const nextSelected = edgeOffsets
    ? PointSet.shrinkEdge(state.selected, field, delta * -1)
    : PointSet.extendEdge(state.selected, field, delta);

  return {
    selected: PointSet.filter(
      point => Matrix.has(point.row, point.column, state.data),
      nextSelected
    )
  };
};

export const blur = () => ({
  active: null
});

// Key Bindings

type KeyDownHandlers<Cell: Types.CellBase> = {
  [eventType: string]: KeyDownHandler<Cell>
};

/** @todo handle inactive state? */
const keyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: go(-1, 0),
  ArrowDown: go(+1, 0),
  ArrowLeft: go(0, -1),
  ArrowRight: go(0, +1),
  Tab: go(0, +1),
  Enter: edit,
  Backspace: clear,
  Escape: blur
};

const editKeyDownHandlers: KeyDownHandlers<*> = {
  Escape: view,
  Tab: keyDownHandlers.Tab,
  Enter: keyDownHandlers.ArrowDown
};

const controlKeyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: goToEnd(-1, 0),
  ArrowDown: goToEnd(+1, 0),
  ArrowLeft: goToEnd(0, -1),
  ArrowRight: goToEnd(0, +1)
};

const controlShiftKeyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: growSmaller("row"),
  ArrowDown: growLarger("row"),
  ArrowLeft: growSmaller("column"),
  ArrowRight: growLarger("column")
};

const shiftKeyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: modifyEdge("row", -1),
  ArrowDown: modifyEdge("row", 1),
  ArrowLeft: modifyEdge("column", -1),
  ArrowRight: modifyEdge("column", 1)
};

const shiftMetaKeyDownHandlers: KeyDownHandlers<*> = {};
const metaKeyDownHandlers: KeyDownHandlers<*> = {};

function getActive<Cell: Types.CellBase>(state: Types.StoreState<Cell>): ?Cell {
  return (
    state.active &&
    Matrix.get(state.active.row, state.active.column, state.data)
  );
}

const isActiveReadOnly = <Cell: Types.CellBase>(
  state: Types.StoreState<Cell>
): boolean => {
  const activeCell = getActive(state);
  return Boolean(activeCell && activeCell.readOnly);
};

export function keyPress<Cell: Types.CellBase>(
  state: Types.StoreState<Cell>,
  event: SyntheticKeyboardEvent<HTMLElement>
) {
  if (isActiveReadOnly(state) || event.metaKey) {
    return null;
  }
  if (state.mode === "view" && state.active) {
    return { mode: "edit" };
  }
  return null;
}

export function getKeyDownHandler<Cell: Types.CellBase>(
  state: Types.StoreState<Cell>,
  event: SyntheticKeyboardEvent<HTMLElement>
): KeyDownHandler<Cell> {
  const { key } = event;
  let handlers;
  // Order matters
  if (state.mode === "edit") {
    handlers = editKeyDownHandlers;
  } else if (event.shiftKey && event.metaKey) {
    handlers = shiftMetaKeyDownHandlers;
  } else if (event.ctrlKey && event.shiftKey) {
    handlers = controlShiftKeyDownHandlers;
  } else if (event.shiftKey) {
    handlers = shiftKeyDownHandlers;
  } else if (event.ctrlKey) {
    handlers = controlKeyDownHandlers;
  } else if (event.metaKey) {
    handlers = metaKeyDownHandlers;
  } else {
    handlers = keyDownHandlers;
  }
  return handlers[key];
}

export function keyDown<Cell: Types.CellBase>(
  state: Types.StoreState<Cell>,
  event: SyntheticKeyboardEvent<HTMLElement>
) {
  const handler = getKeyDownHandler<Cell>(state, event);
  if (handler) {
    return handler(state, event);
  }
  return null;
}

export function dragStart<T>(state: Types.StoreState<T>) {
  return { dragging: true };
}

export function dragEnd<T>(state: Types.StoreState<T>) {
  return { dragging: false };
}

export function commit<T>(
  state: Types.StoreState<T>,
  changes: Array<{ prevCell: T | null, nextCell: T | null }>
) {
  return { lastCommit: changes };
}
