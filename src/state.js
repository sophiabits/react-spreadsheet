import * as PointMap from "./point-map";
import * as PointSet from "./point-set";
import * as Types from "./types";

export const initialState: $Shape<Types.StoreState<any>> = {
  selected: PointSet.from([]),
  copied: PointMap.from([]),
  active: null,
  mode: "view",
  rowDimensions: {},
  columnDimensions: {},
  lastChanged: null,
  bindings: PointMap.from([])
};
