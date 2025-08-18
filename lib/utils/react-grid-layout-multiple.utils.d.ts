/**
 * IMPORTANT:
 * This utils are taken from the project: https://github.com/STRML/react-grid-layout.
 * The code should be as less modified as possible for easy maintenance.
 */
import { CompactType, Layout, LayoutItem } from "./react-grid-layout.utils";
/**
 * Move an element. Responsible for doing cascading movements of other elements.
 *
 * @param  {Array}      layout            Full layout to modify.
 * @param  {LayoutItem} l                 element to move.
 * @param  {Number}     [x]               X position in grid units.
 * @param  {Number}     [y]               Y position in grid units.
 */
export declare function moveElements(layout: Layout, items: {
    l: LayoutItem;
    x: number | null | undefined;
    y: number | null | undefined;
}[], isUserAction: boolean | null | undefined, preventCollision: boolean | null | undefined, compactType: CompactType, cols: number): Layout;
export declare function moveElementsAwayFromCollision(layout: Layout, collidesWith: LayoutItem, itemToMove: LayoutItem, isUserAction: boolean | null | undefined, compactType: CompactType, cols: number): Layout;
