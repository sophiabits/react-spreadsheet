declare module 'react-spreadsheet' {
  import * as React from 'react';

  interface Point {
    column: number,
    row: number,
  }

  type Matrix<T> = Array<Array<T | typeof undefined>>;

  // see: https://stackoverflow.com/a/50375286
  type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

  type OnSignatures<ListenersT> =
    { [EventT in keyof ListenersT]: (event: EventT, listener: ListenersT[EventT]) => void };
  type OnAll<ListenersT> =
    UnionToIntersection<OnSignatures<ListenersT>[keyof ListenersT]>;

  interface FormulaParserCoords { index: number }
  interface FormulaParserCell {
    // label: string,
    row: FormulaParserCoords,
    column: FormulaParserCoords,
  }

  type FormulaParserDone = (nextValue: any) => void;

  interface FormulaParserEvents {
    callCellValue: (cellCoord: FormulaParserCell, done: FormulaParserDone) => void,
    callRangeValue: (startCellCoord: FormulaParserCell, endCellCoord: FormulaParserCell, done: FormulaParserDone) => void,
  }

  interface FormulaParserResult {
    error: string | null,
    result: boolean | string | number | null,
  }

  export interface IFormulaParser {
    on: OnAll<FormulaParserEvents>,
    parse: (formula: string) => FormulaParserResult,
  }

  interface CellDescriptor<Cell> extends Point {
    data?: Cell,
  }

  type CellGetter<Cell, Value> = (cell: CellDescriptor<Cell>) => Value;

  interface CellComponentProps<Cell, Value> {
    cell?: Cell,
    getValue: CellGetter<Cell, Value>,
  }

  export type DataViewerProps<Cell, Value> = CellComponentProps<Cell, Value> & {
    column: number,
    formulaParser: IFormulaParser,
    row: number,
    getValue: CellGetter<Cell, Value>,
  };

  export type DataEditorProps<Cell, Value> = CellComponentProps<Cell, Value> & {
    onChange: (cell: Cell) => void,
  };

  export type CellProps<Data, Value> = {
    column: number,
    row: number,
    DataViewer: React.ComponentType<DataViewerProps<Data, Value>>,
    getValue: CellGetter<Data, Value>,
    formulaParser: IFormulaParser,
  };

  export type ColumnIndicatorProps = {
    column: number,
    label?: React.ReactNode,
  };

  export type RowProps = { children: React.ReactNode };

  export type RowIndicatorProps = {
    row: number,
    label?: React.ReactNode,
  };

  export type TableProps = {
    children: React.ReactNode,
    columns: number,
    hideColumnIndicators?: boolean,
  };

  export interface DefaultCell {
    className?: string,
    readOnly?: boolean,

    DataViewer?: React.ComponentType<DataViewerProps<any, any>>,
    DataEditor?: React.ComponentType<DataEditorProps<any, any>>,
  }

  export interface DefaultCellValue {
    value: string | number | boolean | null,
  }

  export type SpreadsheetProps<Cell, Value> = {
    // Spreadsheet
    data: Matrix<Value>,
    formulaParser?: IFormulaParser,
    columnLabels?: string[]
    ColumnIndicator?: React.ComponentType<ColumnIndicatorProps>,
    rowLabels?: string[],
    RowIndicator?: React.ComponentType<RowIndicatorProps>,
    hideRowIndicators?: boolean,
    hideColumnIndicators?: boolean,
    Table?: React.ComponentType<TableProps>,
    Row?: React.ComponentType<RowProps>,
    Cell?: React.ComponentType<CellProps<Cell, Value>>,
    DataViewer?: React.ComponentType<DataViewerProps<Cell, Value>>,
    DataEditor?: React.ComponentType<DataEditorProps<Cell, Value>>,

    onKeyDown?: (event: React.SyntheticEvent<HTMLElement, KeyboardEvent>) => void,
    getValue?: CellGetter<Cell, Value>,
    getBindingsForCell?: CellGetter<Cell, Point[]>,

    // SpreadsheetStateProvider
    onActivate?: (active: Point) => void,
    onCellCommit?: (prevCell: Cell, nextCell: Cell, coords: Point) => void,
    onChange?: (data: Matrix<Value>) => void,
    onModeChange?: (mode: 'edit' | 'view') => void,
    onSelect?: (selected: Point[]) => void,
  };

  export function createEmptyMatrix<T = DefaultCellValue>(rows: number, columns: number): Matrix<T>;

  class Spreadsheet<Cell = DefaultCell, Value = DefaultCellValue> extends React.Component<SpreadsheetProps<Cell, Value>> {}

  export default Spreadsheet;
}