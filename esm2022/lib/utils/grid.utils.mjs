import { compact, getFirstCollision, moveElement, sortLayoutItems } from './react-grid-layout.utils';
import { ktdPointerClientX, ktdPointerClientY } from './pointer.utils';
import { moveElements } from './react-grid-layout-multiple.utils';
/** Tracks items by id. This function is mean to be used in conjunction with the ngFor that renders the 'ktd-grid-items' */
export function ktdTrackById(index, item) {
    return item.id;
}
/** Given a layout, the gridHeight and the gap return the resulting rowHeight */
export function ktdGetGridItemRowHeight(layout, gridHeight, gap) {
    const numberOfRows = layout.reduce((acc, cur) => Math.max(acc, Math.max(cur.y + cur.h, 0)), 0);
    const gapTotalHeight = (numberOfRows - 1) * gap;
    const gridHeightMinusGap = gridHeight - gapTotalHeight;
    return gridHeightMinusGap / numberOfRows;
}
/**
 * Call react-grid-layout utils 'compact()' function and return the compacted layout.
 * @param layout to be compacted.
 * @param compactType, type of compaction.
 * @param cols, number of columns of the grid.
 */
export function ktdGridCompact(layout, compactType, cols) {
    return compact(layout, compactType, cols)
        // Prune react-grid-layout compact extra properties.
        .map(item => ({ id: item.id, x: item.x, y: item.y, w: item.w, h: item.h, minW: item.minW, minH: item.minH, maxW: item.maxW, maxH: item.maxH }));
}
/**
 * Call react-grid-layout utils 'sortLayoutItems()' function to return the 'layout' sorted by 'compactType'
 * @param {Layout} layout
 * @param {CompactType} compactType
 * @returns {Layout}
 */
export function ktdGridSortLayoutItems(layout, compactType) {
    return sortLayoutItems(layout, compactType);
}
function screenXToGridX(screenXPos, cols, width, gap) {
    if (cols <= 1) {
        return 0;
    }
    const totalGapsWidth = gap * (cols - 1);
    const totalItemsWidth = width - totalGapsWidth;
    const itemPlusGapWidth = totalItemsWidth / cols + gap;
    return Math.round(screenXPos / itemPlusGapWidth);
}
function screenYToGridY(screenYPos, rowHeight, height, gap) {
    return Math.round(screenYPos / (rowHeight + gap));
}
function screenWidthToGridWidth(gridScreenWidth, cols, width, gap) {
    const widthMinusGaps = width - (gap * (cols - 1));
    const itemWidth = widthMinusGaps / cols;
    const gridScreenWidthMinusFirst = gridScreenWidth - itemWidth;
    return Math.round(gridScreenWidthMinusFirst / (itemWidth + gap)) + 1;
}
function screenHeightToGridHeight(gridScreenHeight, rowHeight, height, gap) {
    const gridScreenHeightMinusFirst = gridScreenHeight - rowHeight;
    return Math.round(gridScreenHeightMinusFirst / (rowHeight + gap)) + 1;
}
/** Returns a Dictionary where the key is the id and the value is the change applied to that item. If no changes Dictionary is empty. */
export function ktdGetGridLayoutDiff(gridLayoutA, gridLayoutB) {
    const diff = {};
    gridLayoutA.forEach(itemA => {
        const itemB = gridLayoutB.find(_itemB => _itemB.id === itemA.id);
        if (itemB != null) {
            const posChanged = itemA.x !== itemB.x || itemA.y !== itemB.y;
            const sizeChanged = itemA.w !== itemB.w || itemA.h !== itemB.h;
            const change = posChanged && sizeChanged ? 'moveresize' : posChanged ? 'move' : sizeChanged ? 'resize' : null;
            if (change) {
                diff[itemB.id] = { change };
            }
        }
    });
    return diff;
}
/**
 * Given the grid config & layout data and the current drag position & information, returns the corresponding layout and drag item position
 * @param gridItem grid item that is been dragged
 * @param config current grid configuration
 * @param compactionType type of compaction that will be performed
 * @param draggingData contains all the information about the drag
 */
export function ktdGridItemDragging(gridItem, config, compactionType, draggingData) {
    const { pointerDownEvent, pointerDragEvent, gridElemClientRect, dragElemClientRect, scrollDifference } = draggingData;
    const gridItemId = gridItem.id;
    const draggingElemPrevItem = config.layout.find(item => item.id === gridItemId);
    const clientStartX = ktdPointerClientX(pointerDownEvent);
    const clientStartY = ktdPointerClientY(pointerDownEvent);
    const clientX = ktdPointerClientX(pointerDragEvent);
    const clientY = ktdPointerClientY(pointerDragEvent);
    const offsetX = clientStartX - dragElemClientRect.left;
    const offsetY = clientStartY - dragElemClientRect.top;
    // Grid element positions taking into account the possible scroll total difference from the beginning.
    const gridElementLeftPosition = gridElemClientRect.left + scrollDifference.left;
    const gridElementTopPosition = gridElemClientRect.top + scrollDifference.top;
    // Calculate position relative to the grid element.
    const gridRelXPos = clientX - gridElementLeftPosition - offsetX;
    const gridRelYPos = clientY - gridElementTopPosition - offsetY;
    const rowHeightInPixels = config.rowHeight === 'fit'
        ? ktdGetGridItemRowHeight(config.layout, config.height ?? gridElemClientRect.height, config.gap)
        : config.rowHeight;
    // Get layout item position
    const layoutItem = {
        ...draggingElemPrevItem,
        x: screenXToGridX(gridRelXPos, config.cols, gridElemClientRect.width, config.gap),
        y: screenYToGridY(gridRelYPos, rowHeightInPixels, gridElemClientRect.height, config.gap)
    };
    // Correct the values if they overflow, since 'moveElement' function doesn't do it
    layoutItem.x = Math.max(0, layoutItem.x);
    layoutItem.y = Math.max(0, layoutItem.y);
    if (layoutItem.x + layoutItem.w > config.cols) {
        layoutItem.x = Math.max(0, config.cols - layoutItem.w);
    }
    // Parse to LayoutItem array data in order to use 'react.grid-layout' utils
    const layoutItems = config.layout;
    const draggedLayoutItem = layoutItems.find(item => item.id === gridItemId);
    let newLayoutItems = moveElement(layoutItems, draggedLayoutItem, layoutItem.x, layoutItem.y, true, config.preventCollision, compactionType, config.cols);
    newLayoutItems = compact(newLayoutItems, compactionType, config.cols);
    return {
        layout: newLayoutItems,
        draggedItemPos: {
            top: gridRelYPos,
            left: gridRelXPos,
            width: dragElemClientRect.width,
            height: dragElemClientRect.height,
        }
    };
}
/**
 * Given the grid config & layout data and the current drag position & information, returns the corresponding layout and drag item position
 * @param gridItem grid item that is been dragged
 * @param config current grid configuration
 * @param compactionType type of compaction that will be performed
 * @param draggingData contains all the information about the drag
 */
export function ktdGridItemsDragging(gridItems, config, compactionType, draggingData) {
    const { pointerDownEvent, pointerDragEvent, gridElemClientRect, dragElementsClientRect, scrollDifference } = draggingData;
    const draggingElemPrevItem = {};
    gridItems.forEach(gridItem => {
        draggingElemPrevItem[gridItem.id] = config.layout.find(item => item.id === gridItem.id);
    });
    const clientStartX = ktdPointerClientX(pointerDownEvent);
    const clientStartY = ktdPointerClientY(pointerDownEvent);
    const clientX = ktdPointerClientX(pointerDragEvent);
    const clientY = ktdPointerClientY(pointerDragEvent);
    // Grid element positions taking into account the possible scroll total difference from the beginning.
    const gridElementLeftPosition = gridElemClientRect.left + scrollDifference.left;
    const gridElementTopPosition = gridElemClientRect.top + scrollDifference.top;
    const rowHeightInPixels = config.rowHeight === 'fit'
        ? ktdGetGridItemRowHeight(config.layout, config.height ?? gridElemClientRect.height, config.gap)
        : config.rowHeight;
    const layoutItemsToMove = {};
    const gridRelPos = {};
    let maxXMove = 0;
    let maxYMove = 0;
    gridItems.forEach((gridItem) => {
        const offsetX = clientStartX - dragElementsClientRect[gridItem.id].left;
        const offsetY = clientStartY - dragElementsClientRect[gridItem.id].top;
        // Calculate position relative to the grid element.
        gridRelPos[gridItem.id] = {
            x: clientX - gridElementLeftPosition - offsetX,
            y: clientY - gridElementTopPosition - offsetY
        };
        // Get layout item position
        layoutItemsToMove[gridItem.id] = {
            ...draggingElemPrevItem[gridItem.id],
            x: screenXToGridX(gridRelPos[gridItem.id].x, config.cols, gridElemClientRect.width, config.gap),
            y: screenYToGridY(gridRelPos[gridItem.id].y, rowHeightInPixels, gridElemClientRect.height, config.gap)
        };
        // Determine the maximum X and Y displacement where an item has gone outside the grid
        if (0 > layoutItemsToMove[gridItem.id].x && maxXMove > layoutItemsToMove[gridItem.id].x) {
            maxXMove = layoutItemsToMove[gridItem.id].x;
        }
        if (0 > layoutItemsToMove[gridItem.id].y && maxYMove > layoutItemsToMove[gridItem.id].y) {
            maxYMove = layoutItemsToMove[gridItem.id].y;
        }
        if (layoutItemsToMove[gridItem.id].x + layoutItemsToMove[gridItem.id].w > config.cols && maxXMove < layoutItemsToMove[gridItem.id].w + layoutItemsToMove[gridItem.id].x - config.cols) {
            maxXMove = layoutItemsToMove[gridItem.id].w + layoutItemsToMove[gridItem.id].x - config.cols;
        }
    });
    // Correct all the x and y position of the group decreasing/increasing the maximum overflow of an item, to maintain the structure
    Object.entries(layoutItemsToMove).forEach(([key, item]) => {
        layoutItemsToMove[key] = {
            ...item,
            x: item.x - maxXMove,
            y: item.y - maxYMove
        };
    });
    // Parse to LayoutItem array data in order to use 'react.grid-layout' utils
    const layoutItems = config.layout;
    const draggedLayoutItem = gridItems.map((gridItem) => {
        const draggedLayoutItem = layoutItems.find(item => item.id === gridItem.id);
        draggedLayoutItem.static = true;
        return {
            l: draggedLayoutItem,
            x: layoutItemsToMove[gridItem.id].x,
            y: layoutItemsToMove[gridItem.id].y
        };
    });
    let newLayoutItems = moveElements(layoutItems, draggedLayoutItem, true, config.preventCollision, compactionType, config.cols);
    // Compact with selected items as static to preserve the structure of the selected items group
    newLayoutItems = compact(newLayoutItems, compactionType, config.cols);
    gridItems.forEach(gridItem => newLayoutItems.find(layoutItem => layoutItem.id === gridItem.id).static = false);
    // Compact normal to display the layout correctly
    newLayoutItems = compact(newLayoutItems, compactionType, config.cols);
    const draggedItemPos = {};
    gridItems.forEach(gridItem => draggedItemPos[gridItem.id] = {
        left: gridRelPos[gridItem.id].x,
        top: gridRelPos[gridItem.id].y,
        width: dragElementsClientRect[gridItem.id].width,
        height: dragElementsClientRect[gridItem.id].height,
    });
    return {
        layout: newLayoutItems,
        draggedItemPos
    };
}
/**
 * Given the grid config & layout data and the current drag position & information, returns the corresponding layout and drag item position
 * @param gridItem grid item that is been dragged
 * @param config current grid configuration
 * @param compactionType type of compaction that will be performed
 * @param draggingData contains all the information about the drag
 */
export function ktdGridItemResizing(gridItem, config, compactionType, draggingData) {
    const { pointerDownEvent, pointerDragEvent, gridElemClientRect, dragElemClientRect, scrollDifference } = draggingData;
    const gridItemId = gridItem.id;
    const clientStartX = ktdPointerClientX(pointerDownEvent);
    const clientStartY = ktdPointerClientY(pointerDownEvent);
    const clientX = ktdPointerClientX(pointerDragEvent);
    const clientY = ktdPointerClientY(pointerDragEvent);
    // Get the difference between the mouseDown and the position 'right' of the resize element.
    const resizeElemOffsetX = dragElemClientRect.width - (clientStartX - dragElemClientRect.left);
    const resizeElemOffsetY = dragElemClientRect.height - (clientStartY - dragElemClientRect.top);
    const draggingElemPrevItem = config.layout.find(item => item.id === gridItemId);
    const width = clientX + resizeElemOffsetX - (dragElemClientRect.left + scrollDifference.left);
    const height = clientY + resizeElemOffsetY - (dragElemClientRect.top + scrollDifference.top);
    const rowHeightInPixels = config.rowHeight === 'fit'
        ? ktdGetGridItemRowHeight(config.layout, config.height ?? gridElemClientRect.height, config.gap)
        : config.rowHeight;
    // Get layout item grid position
    const layoutItem = {
        ...draggingElemPrevItem,
        w: screenWidthToGridWidth(width, config.cols, gridElemClientRect.width, config.gap),
        h: screenHeightToGridHeight(height, rowHeightInPixels, gridElemClientRect.height, config.gap)
    };
    layoutItem.w = limitNumberWithinRange(layoutItem.w, gridItem.minW ?? layoutItem.minW, gridItem.maxW ?? layoutItem.maxW);
    layoutItem.h = limitNumberWithinRange(layoutItem.h, gridItem.minH ?? layoutItem.minH, gridItem.maxH ?? layoutItem.maxH);
    if (layoutItem.x + layoutItem.w > config.cols) {
        layoutItem.w = Math.max(1, config.cols - layoutItem.x);
    }
    if (config.preventCollision) {
        const maxW = layoutItem.w;
        const maxH = layoutItem.h;
        let colliding = hasCollision(config.layout, layoutItem);
        let shrunkDimension;
        while (colliding) {
            shrunkDimension = getDimensionToShrink(layoutItem, shrunkDimension);
            layoutItem[shrunkDimension]--;
            colliding = hasCollision(config.layout, layoutItem);
        }
        if (shrunkDimension === 'w') {
            layoutItem.h = maxH;
            colliding = hasCollision(config.layout, layoutItem);
            while (colliding) {
                layoutItem.h--;
                colliding = hasCollision(config.layout, layoutItem);
            }
        }
        if (shrunkDimension === 'h') {
            layoutItem.w = maxW;
            colliding = hasCollision(config.layout, layoutItem);
            while (colliding) {
                layoutItem.w--;
                colliding = hasCollision(config.layout, layoutItem);
            }
        }
    }
    const newLayoutItems = config.layout.map((item) => {
        return item.id === gridItemId ? layoutItem : item;
    });
    return {
        layout: compact(newLayoutItems, compactionType, config.cols),
        draggedItemPos: {
            top: dragElemClientRect.top - gridElemClientRect.top,
            left: dragElemClientRect.left - gridElemClientRect.left,
            width,
            height,
        }
    };
}
function hasCollision(layout, layoutItem) {
    return !!getFirstCollision(layout, layoutItem);
}
function getDimensionToShrink(layoutItem, lastShrunk) {
    if (layoutItem.h <= 1) {
        return 'w';
    }
    if (layoutItem.w <= 1) {
        return 'h';
    }
    return lastShrunk === 'w' ? 'h' : 'w';
}
/**
 * Given the current number and min/max values, returns the number within the range
 * @param number can be any numeric value
 * @param min minimum value of range
 * @param max maximum value of range
 */
function limitNumberWithinRange(num, min = 1, max = Infinity) {
    return Math.min(Math.max(num, min < 1 ? 1 : min), max);
}
/** Returns true if both item1 and item2 KtdGridLayoutItems are equivalent. */
export function ktdGridItemLayoutItemAreEqual(item1, item2) {
    return item1.id === item2.id
        && item1.x === item2.x
        && item1.y === item2.y
        && item1.w === item2.w
        && item1.h === item2.h;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JpZC51dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL2FuZ3VsYXItZ3JpZC1sYXlvdXQvc3JjL2xpYi91dGlscy9ncmlkLnV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQWUsaUJBQWlCLEVBQXNCLFdBQVcsRUFBRSxlQUFlLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUl0SSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUd2RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFbEUsMkhBQTJIO0FBQzNILE1BQU0sVUFBVSxZQUFZLENBQUMsS0FBYSxFQUFFLElBQWtCO0lBQzFELE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQztBQUNuQixDQUFDO0FBRUQsZ0ZBQWdGO0FBQ2hGLE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxNQUFxQixFQUFFLFVBQWtCLEVBQUUsR0FBVztJQUMxRixNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvRixNQUFNLGNBQWMsR0FBRyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDaEQsTUFBTSxrQkFBa0IsR0FBRyxVQUFVLEdBQUcsY0FBYyxDQUFDO0lBQ3ZELE9BQU8sa0JBQWtCLEdBQUcsWUFBWSxDQUFDO0FBQzdDLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsTUFBcUIsRUFBRSxX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Q0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUM7V0FDbkIsS0FBSyxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQztXQUNuQixLQUFLLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNvbXBhY3QsIENvbXBhY3RUeXBlLCBnZXRGaXJzdENvbGxpc2lvbiwgTGF5b3V0LCBMYXlvdXRJdGVtLCBtb3ZlRWxlbWVudCwgc29ydExheW91dEl0ZW1zIH0gZnJvbSAnLi9yZWFjdC1ncmlkLWxheW91dC51dGlscyc7XHJcbmltcG9ydCB7XHJcbiAgICBLdGREcmFnZ2luZ0RhdGEsIEt0ZERyYWdnaW5nTXVsdGlwbGVEYXRhLCBLdGRHcmlkQ2ZnLCBLdGRHcmlkQ29tcGFjdFR5cGUsIEt0ZEdyaWRJdGVtUmVjdCwgS3RkR3JpZEl0ZW1SZW5kZXJEYXRhLCBLdGRHcmlkTGF5b3V0LCBLdGRHcmlkTGF5b3V0SXRlbVxyXG59IGZyb20gJy4uL2dyaWQuZGVmaW5pdGlvbnMnO1xyXG5pbXBvcnQgeyBrdGRQb2ludGVyQ2xpZW50WCwga3RkUG9pbnRlckNsaWVudFkgfSBmcm9tICcuL3BvaW50ZXIudXRpbHMnO1xyXG5pbXBvcnQgeyBLdGREaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBLdGRHcmlkSXRlbUNvbXBvbmVudCB9IGZyb20gJy4uL2dyaWQtaXRlbS9ncmlkLWl0ZW0uY29tcG9uZW50JztcclxuaW1wb3J0IHsgbW92ZUVsZW1lbnRzIH0gZnJvbSAnLi9yZWFjdC1ncmlkLWxheW91dC1tdWx0aXBsZS51dGlscyc7XHJcblxyXG4vKiogVHJhY2tzIGl0ZW1zIGJ5IGlkLiBUaGlzIGZ1bmN0aW9uIGlzIG1lYW4gdG8gYmUgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIHRoZSBuZ0ZvciB0aGF0IHJlbmRlcnMgdGhlICdrdGQtZ3JpZC1pdGVtcycgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGt0ZFRyYWNrQnlJZChpbmRleDogbnVtYmVyLCBpdGVtOiB7aWQ6IHN0cmluZ30pIHtcclxuICAgIHJldHVybiBpdGVtLmlkO1xyXG59XHJcblxyXG4vKiogR2l2ZW4gYSBsYXlvdXQsIHRoZSBncmlkSGVpZ2h0IGFuZCB0aGUgZ2FwIHJldHVybiB0aGUgcmVzdWx0aW5nIHJvd0hlaWdodCAqL1xyXG5leHBvcnQgZnVuY3Rpb24ga3RkR2V0R3JpZEl0ZW1Sb3dIZWlnaHQobGF5b3V0OiBLdGRHcmlkTGF5b3V0LCBncmlkSGVpZ2h0OiBudW1iZXIsIGdhcDogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IG51bWJlck9mUm93cyA9IGxheW91dC5yZWR1Y2UoKGFjYywgY3VyKSA9PiBNYXRoLm1heChhY2MsIE1hdGgubWF4KGN1ci55ICsgY3VyLmgsIDApKSwgMCk7XHJcbiAgICBjb25zdCBnYXBUb3RhbEhlaWdodCA9IChudW1iZXJPZlJvd3MgLSAxKSAqIGdhcDtcclxuICAgIGNvbnN0IGdyaWRIZWlnaHRNaW51c0dhcCA9IGdyaWRIZWlnaHQgLSBnYXBUb3RhbEhlaWdodDtcclxuICAgIHJldHVybiBncmlkSGVpZ2h0TWludXNHYXAgLyBudW1iZXJPZlJvd3M7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDYWxsIHJlYWN0LWdyaWQtbGF5b3V0IHV0aWxzICdjb21wYWN0KCknIGZ1bmN0aW9uIGFuZCByZXR1cm4gdGhlIGNvbXBhY3RlZCBsYXlvdXQuXHJcbiAqIEBwYXJhbSBsYXlvdXQgdG8gYmUgY29tcGFjdGVkLlxyXG4gKiBAcGFyYW0gY29tcGFjdFR5cGUsIHR5cGUgb2YgY29tcGFjdGlvbi5cclxuICogQHBhcmFtIGNvbHMsIG51bWJlciBvZiBjb2x1bW5zIG9mIHRoZSBncmlkLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGt0ZEdyaWRDb21wYWN0KGxheW91dDogS3RkR3JpZExheW91dCwgY29tcGFjdFR5cGU6IEt0ZEdyaWRDb21wYWN0VHlwZSwgY29sczogbnVtYmVyKTogS3RkR3JpZExheW91dCB7XHJcbiAgICByZXR1cm4gY29tcGFjdChsYXlvdXQsIGNvbXBhY3RUeXBlLCBjb2xzKVxyXG4gICAgICAgIC8vIFBydW5lIHJlYWN0LWdyaWQtbGF5b3V0IGNvbXBhY3QgZXh0cmEgcHJvcGVydGllcy5cclxuICAgICAgICAubWFwKGl0ZW0gPT4gKHsgaWQ6IGl0ZW0uaWQsIHg6IGl0ZW0ueCwgeTogaXRlbS55LCB3OiBpdGVtLncsIGg6IGl0ZW0uaCwgbWluVzogaXRlbS5taW5XLCBtaW5IOiBpdGVtLm1pbkgsIG1heFc6IGl0ZW0ubWF4VywgbWF4SDogaXRlbS5tYXhIIH0pKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGwgcmVhY3QtZ3JpZC1sYXlvdXQgdXRpbHMgJ3NvcnRMYXlvdXRJdGVtcygpJyBmdW5jdGlvbiB0byByZXR1cm4gdGhlICdsYXlvdXQnIHNvcnRlZCBieSAnY29tcGFjdFR5cGUnXHJcbiAqIEBwYXJhbSB7TGF5b3V0fSBsYXlvdXRcclxuICogQHBhcmFtIHtDb21wYWN0VHlwZX0gY29tcGFjdFR5cGVcclxuICogQHJldHVybnMge0xheW91dH1cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBrdGRHcmlkU29ydExheW91dEl0ZW1zKFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBjb21wYWN0VHlwZTogQ29tcGFjdFR5cGUsXHJcbik6IExheW91dCB7XHJcbiAgICByZXR1cm4gc29ydExheW91dEl0ZW1zKGxheW91dCxjb21wYWN0VHlwZSlcclxufVxyXG5cclxuZnVuY3Rpb24gc2NyZWVuWFRvR3JpZFgoc2NyZWVuWFBvczogbnVtYmVyLCBjb2xzOiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGdhcDogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIGlmIChjb2xzIDw9IDEpIHtcclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB0b3RhbEdhcHNXaWR0aCA9IGdhcCAqIChjb2xzIC0gMSk7XHJcbiAgICBjb25zdCB0b3RhbEl0ZW1zV2lkdGggPSB3aWR0aCAtIHRvdGFsR2Fwc1dpZHRoO1xyXG4gICAgY29uc3QgaXRlbVBsdXNHYXBXaWR0aCA9IHRvdGFsSXRlbXNXaWR0aCAvIGNvbHMgKyBnYXA7XHJcbiAgICByZXR1cm4gTWF0aC5yb3VuZChzY3JlZW5YUG9zIC8gaXRlbVBsdXNHYXBXaWR0aCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNjcmVlbllUb0dyaWRZKHNjcmVlbllQb3M6IG51bWJlciwgcm93SGVpZ2h0OiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBnYXA6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICByZXR1cm4gTWF0aC5yb3VuZChzY3JlZW5ZUG9zIC8gKHJvd0hlaWdodCArIGdhcCkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzY3JlZW5XaWR0aFRvR3JpZFdpZHRoKGdyaWRTY3JlZW5XaWR0aDogbnVtYmVyLCBjb2xzOiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGdhcDogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IHdpZHRoTWludXNHYXBzID0gd2lkdGggLSAoZ2FwICogKGNvbHMgLSAxKSk7XHJcbiAgICBjb25zdCBpdGVtV2lkdGggPSB3aWR0aE1pbnVzR2FwcyAvIGNvbHM7XHJcbiAgICBjb25zdCBncmlkU2NyZWVuV2lkdGhNaW51c0ZpcnN0ID0gZ3JpZFNjcmVlbldpZHRoIC0gaXRlbVdpZHRoO1xyXG4gICAgcmV0dXJuIE1hdGgucm91bmQoZ3JpZFNjcmVlbldpZHRoTWludXNGaXJzdCAvIChpdGVtV2lkdGggKyBnYXApKSArIDE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNjcmVlbkhlaWdodFRvR3JpZEhlaWdodChncmlkU2NyZWVuSGVpZ2h0OiBudW1iZXIsIHJvd0hlaWdodDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgZ2FwOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgY29uc3QgZ3JpZFNjcmVlbkhlaWdodE1pbnVzRmlyc3QgPSBncmlkU2NyZWVuSGVpZ2h0IC0gcm93SGVpZ2h0O1xyXG4gICAgcmV0dXJuIE1hdGgucm91bmQoZ3JpZFNjcmVlbkhlaWdodE1pbnVzRmlyc3QgLyAocm93SGVpZ2h0ICsgZ2FwKSkgKyAxO1xyXG59XHJcblxyXG4vKiogUmV0dXJucyBhIERpY3Rpb25hcnkgd2hlcmUgdGhlIGtleSBpcyB0aGUgaWQgYW5kIHRoZSB2YWx1ZSBpcyB0aGUgY2hhbmdlIGFwcGxpZWQgdG8gdGhhdCBpdGVtLiBJZiBubyBjaGFuZ2VzIERpY3Rpb25hcnkgaXMgZW1wdHkuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBrdGRHZXRHcmlkTGF5b3V0RGlmZihncmlkTGF5b3V0QTogS3RkR3JpZExheW91dEl0ZW1bXSwgZ3JpZExheW91dEI6IEt0ZEdyaWRMYXlvdXRJdGVtW10pOiBLdGREaWN0aW9uYXJ5PHsgY2hhbmdlOiAnbW92ZScgfCAncmVzaXplJyB8ICdtb3ZlcmVzaXplJyB9PiB7XHJcbiAgICBjb25zdCBkaWZmOiBLdGREaWN0aW9uYXJ5PHsgY2hhbmdlOiAnbW92ZScgfCAncmVzaXplJyB8ICdtb3ZlcmVzaXplJyB9PiA9IHt9O1xyXG5cclxuICAgIGdyaWRMYXlvdXRBLmZvckVhY2goaXRlbUEgPT4ge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1CID0gZ3JpZExheW91dEIuZmluZChfaXRlbUIgPT4gX2l0ZW1CLmlkID09PSBpdGVtQS5pZCk7XHJcbiAgICAgICAgaWYgKGl0ZW1CICE9IG51bGwpIHtcclxuICAgICAgICAgICAgY29uc3QgcG9zQ2hhbmdlZCA9IGl0ZW1BLnggIT09IGl0ZW1CLnggfHwgaXRlbUEueSAhPT0gaXRlbUIueTtcclxuICAgICAgICAgICAgY29uc3Qgc2l6ZUNoYW5nZWQgPSBpdGVtQS53ICE9PSBpdGVtQi53IHx8IGl0ZW1BLmggIT09IGl0ZW1CLmg7XHJcbiAgICAgICAgICAgIGNvbnN0IGNoYW5nZTogJ21vdmUnIHwgJ3Jlc2l6ZScgfCAnbW92ZXJlc2l6ZScgfCBudWxsID0gcG9zQ2hhbmdlZCAmJiBzaXplQ2hhbmdlZCA/ICdtb3ZlcmVzaXplJyA6IHBvc0NoYW5nZWQgPyAnbW92ZScgOiBzaXplQ2hhbmdlZCA/ICdyZXNpemUnIDogbnVsbDtcclxuICAgICAgICAgICAgaWYgKGNoYW5nZSkge1xyXG4gICAgICAgICAgICAgICAgZGlmZltpdGVtQi5pZF0gPSB7Y2hhbmdlfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIGRpZmY7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHaXZlbiB0aGUgZ3JpZCBjb25maWcgJiBsYXlvdXQgZGF0YSBhbmQgdGhlIGN1cnJlbnQgZHJhZyBwb3NpdGlvbiAmIGluZm9ybWF0aW9uLCByZXR1cm5zIHRoZSBjb3JyZXNwb25kaW5nIGxheW91dCBhbmQgZHJhZyBpdGVtIHBvc2l0aW9uXHJcbiAqIEBwYXJhbSBncmlkSXRlbSBncmlkIGl0ZW0gdGhhdCBpcyBiZWVuIGRyYWdnZWRcclxuICogQHBhcmFtIGNvbmZpZyBjdXJyZW50IGdyaWQgY29uZmlndXJhdGlvblxyXG4gKiBAcGFyYW0gY29tcGFjdGlvblR5cGUgdHlwZSBvZiBjb21wYWN0aW9uIHRoYXQgd2lsbCBiZSBwZXJmb3JtZWRcclxuICogQHBhcmFtIGRyYWdnaW5nRGF0YSBjb250YWlucyBhbGwgdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoZSBkcmFnXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24ga3RkR3JpZEl0ZW1EcmFnZ2luZyhncmlkSXRlbTogS3RkR3JpZEl0ZW1Db21wb25lbnQsIGNvbmZpZzogS3RkR3JpZENmZywgY29tcGFjdGlvblR5cGU6IENvbXBhY3RUeXBlLCBkcmFnZ2luZ0RhdGE6IEt0ZERyYWdnaW5nRGF0YSk6IHsgbGF5b3V0OiBLdGRHcmlkTGF5b3V0SXRlbVtdOyBkcmFnZ2VkSXRlbVBvczogS3RkR3JpZEl0ZW1SZWN0IH0ge1xyXG4gICAgY29uc3Qge3BvaW50ZXJEb3duRXZlbnQsIHBvaW50ZXJEcmFnRXZlbnQsIGdyaWRFbGVtQ2xpZW50UmVjdCwgZHJhZ0VsZW1DbGllbnRSZWN0LCBzY3JvbGxEaWZmZXJlbmNlfSA9IGRyYWdnaW5nRGF0YTtcclxuXHJcbiAgICBjb25zdCBncmlkSXRlbUlkID0gZ3JpZEl0ZW0uaWQ7XHJcblxyXG4gICAgY29uc3QgZHJhZ2dpbmdFbGVtUHJldkl0ZW0gPSBjb25maWcubGF5b3V0LmZpbmQoaXRlbSA9PiBpdGVtLmlkID09PSBncmlkSXRlbUlkKSE7XHJcblxyXG4gICAgY29uc3QgY2xpZW50U3RhcnRYID0ga3RkUG9pbnRlckNsaWVudFgocG9pbnRlckRvd25FdmVudCk7XHJcbiAgICBjb25zdCBjbGllbnRTdGFydFkgPSBrdGRQb2ludGVyQ2xpZW50WShwb2ludGVyRG93bkV2ZW50KTtcclxuICAgIGNvbnN0IGNsaWVudFggPSBrdGRQb2ludGVyQ2xpZW50WChwb2ludGVyRHJhZ0V2ZW50KTtcclxuICAgIGNvbnN0IGNsaWVudFkgPSBrdGRQb2ludGVyQ2xpZW50WShwb2ludGVyRHJhZ0V2ZW50KTtcclxuXHJcbiAgICBjb25zdCBvZmZzZXRYID0gY2xpZW50U3RhcnRYIC0gZHJhZ0VsZW1DbGllbnRSZWN0LmxlZnQ7XHJcbiAgICBjb25zdCBvZmZzZXRZID0gY2xpZW50U3RhcnRZIC0gZHJhZ0VsZW1DbGllbnRSZWN0LnRvcDtcclxuXHJcbiAgICAvLyBHcmlkIGVsZW1lbnQgcG9zaXRpb25zIHRha2luZyBpbnRvIGFjY291bnQgdGhlIHBvc3NpYmxlIHNjcm9sbCB0b3RhbCBkaWZmZXJlbmNlIGZyb20gdGhlIGJlZ2lubmluZy5cclxuICAgIGNvbnN0IGdyaWRFbGVtZW50TGVmdFBvc2l0aW9uID0gZ3JpZEVsZW1DbGllbnRSZWN0LmxlZnQgKyBzY3JvbGxEaWZmZXJlbmNlLmxlZnQ7XHJcbiAgICBjb25zdCBncmlkRWxlbWVudFRvcFBvc2l0aW9uID0gZ3JpZEVsZW1DbGllbnRSZWN0LnRvcCArIHNjcm9sbERpZmZlcmVuY2UudG9wO1xyXG5cclxuICAgIC8vIENhbGN1bGF0ZSBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgZ3JpZCBlbGVtZW50LlxyXG4gICAgY29uc3QgZ3JpZFJlbFhQb3MgPSBjbGllbnRYIC0gZ3JpZEVsZW1lbnRMZWZ0UG9zaXRpb24gLSBvZmZzZXRYO1xyXG4gICAgY29uc3QgZ3JpZFJlbFlQb3MgPSBjbGllbnRZIC0gZ3JpZEVsZW1lbnRUb3BQb3NpdGlvbiAtIG9mZnNldFk7XHJcblxyXG4gICAgY29uc3Qgcm93SGVpZ2h0SW5QaXhlbHMgPSBjb25maWcucm93SGVpZ2h0ID09PSAnZml0J1xyXG4gICAgICAgID8ga3RkR2V0R3JpZEl0ZW1Sb3dIZWlnaHQoY29uZmlnLmxheW91dCwgY29uZmlnLmhlaWdodCA/PyBncmlkRWxlbUNsaWVudFJlY3QuaGVpZ2h0LCBjb25maWcuZ2FwKVxyXG4gICAgICAgIDogY29uZmlnLnJvd0hlaWdodDtcclxuXHJcbiAgICAvLyBHZXQgbGF5b3V0IGl0ZW0gcG9zaXRpb25cclxuICAgIGNvbnN0IGxheW91dEl0ZW06IEt0ZEdyaWRMYXlvdXRJdGVtID0ge1xyXG4gICAgICAgIC4uLmRyYWdnaW5nRWxlbVByZXZJdGVtLFxyXG4gICAgICAgIHg6IHNjcmVlblhUb0dyaWRYKGdyaWRSZWxYUG9zICwgY29uZmlnLmNvbHMsIGdyaWRFbGVtQ2xpZW50UmVjdC53aWR0aCwgY29uZmlnLmdhcCksXHJcbiAgICAgICAgeTogc2NyZWVuWVRvR3JpZFkoZ3JpZFJlbFlQb3MsIHJvd0hlaWdodEluUGl4ZWxzLCBncmlkRWxlbUNsaWVudFJlY3QuaGVpZ2h0LCBjb25maWcuZ2FwKVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBDb3JyZWN0IHRoZSB2YWx1ZXMgaWYgdGhleSBvdmVyZmxvdywgc2luY2UgJ21vdmVFbGVtZW50JyBmdW5jdGlvbiBkb2Vzbid0IGRvIGl0XHJcbiAgICBsYXlvdXRJdGVtLnggPSBNYXRoLm1heCgwLCBsYXlvdXRJdGVtLngpO1xyXG4gICAgbGF5b3V0SXRlbS55ID0gTWF0aC5tYXgoMCwgbGF5b3V0SXRlbS55KTtcclxuICAgIGlmIChsYXlvdXRJdGVtLnggKyBsYXlvdXRJdGVtLncgPiBjb25maWcuY29scykge1xyXG4gICAgICAgIGxheW91dEl0ZW0ueCA9IE1hdGgubWF4KDAsIGNvbmZpZy5jb2xzIC0gbGF5b3V0SXRlbS53KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBQYXJzZSB0byBMYXlvdXRJdGVtIGFycmF5IGRhdGEgaW4gb3JkZXIgdG8gdXNlICdyZWFjdC5ncmlkLWxheW91dCcgdXRpbHNcclxuICAgIGNvbnN0IGxheW91dEl0ZW1zOiBMYXlvdXRJdGVtW10gPSBjb25maWcubGF5b3V0O1xyXG4gICAgY29uc3QgZHJhZ2dlZExheW91dEl0ZW06IExheW91dEl0ZW0gPSBsYXlvdXRJdGVtcy5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW1JZCkhO1xyXG5cclxuICAgIGxldCBuZXdMYXlvdXRJdGVtczogTGF5b3V0SXRlbVtdID0gbW92ZUVsZW1lbnQoXHJcbiAgICAgICAgbGF5b3V0SXRlbXMsXHJcbiAgICAgICAgZHJhZ2dlZExheW91dEl0ZW0sXHJcbiAgICAgICAgbGF5b3V0SXRlbS54LFxyXG4gICAgICAgIGxheW91dEl0ZW0ueSxcclxuICAgICAgICB0cnVlLFxyXG4gICAgICAgIGNvbmZpZy5wcmV2ZW50Q29sbGlzaW9uLFxyXG4gICAgICAgIGNvbXBhY3Rpb25UeXBlLFxyXG4gICAgICAgIGNvbmZpZy5jb2xzXHJcbiAgICApO1xyXG5cclxuICAgIG5ld0xheW91dEl0ZW1zID0gY29tcGFjdChuZXdMYXlvdXRJdGVtcywgY29tcGFjdGlvblR5cGUsIGNvbmZpZy5jb2xzKTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxheW91dDogbmV3TGF5b3V0SXRlbXMsXHJcbiAgICAgICAgZHJhZ2dlZEl0ZW1Qb3M6IHtcclxuICAgICAgICAgICAgdG9wOiBncmlkUmVsWVBvcyxcclxuICAgICAgICAgICAgbGVmdDogZ3JpZFJlbFhQb3MsXHJcbiAgICAgICAgICAgIHdpZHRoOiBkcmFnRWxlbUNsaWVudFJlY3Qud2lkdGgsXHJcbiAgICAgICAgICAgIGhlaWdodDogZHJhZ0VsZW1DbGllbnRSZWN0LmhlaWdodCxcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiBHaXZlbiB0aGUgZ3JpZCBjb25maWcgJiBsYXlvdXQgZGF0YSBhbmQgdGhlIGN1cnJlbnQgZHJhZyBwb3NpdGlvbiAmIGluZm9ybWF0aW9uLCByZXR1cm5zIHRoZSBjb3JyZXNwb25kaW5nIGxheW91dCBhbmQgZHJhZyBpdGVtIHBvc2l0aW9uXHJcbiAqIEBwYXJhbSBncmlkSXRlbSBncmlkIGl0ZW0gdGhhdCBpcyBiZWVuIGRyYWdnZWRcclxuICogQHBhcmFtIGNvbmZpZyBjdXJyZW50IGdyaWQgY29uZmlndXJhdGlvblxyXG4gKiBAcGFyYW0gY29tcGFjdGlvblR5cGUgdHlwZSBvZiBjb21wYWN0aW9uIHRoYXQgd2lsbCBiZSBwZXJmb3JtZWRcclxuICogQHBhcmFtIGRyYWdnaW5nRGF0YSBjb250YWlucyBhbGwgdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoZSBkcmFnXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24ga3RkR3JpZEl0ZW1zRHJhZ2dpbmcoZ3JpZEl0ZW1zOiBLdGRHcmlkSXRlbUNvbXBvbmVudFtdLCBjb25maWc6IEt0ZEdyaWRDZmcsIGNvbXBhY3Rpb25UeXBlOiBDb21wYWN0VHlwZSwgZHJhZ2dpbmdEYXRhOiBLdGREcmFnZ2luZ011bHRpcGxlRGF0YSk6IHsgbGF5b3V0OiBLdGRHcmlkTGF5b3V0SXRlbVtdOyBkcmFnZ2VkSXRlbVBvczogIEt0ZERpY3Rpb25hcnk8S3RkR3JpZEl0ZW1SZWN0PiB9IHtcclxuICAgIGNvbnN0IHtwb2ludGVyRG93bkV2ZW50LCBwb2ludGVyRHJhZ0V2ZW50LCBncmlkRWxlbUNsaWVudFJlY3QsIGRyYWdFbGVtZW50c0NsaWVudFJlY3QsIHNjcm9sbERpZmZlcmVuY2V9ID0gZHJhZ2dpbmdEYXRhO1xyXG5cclxuICAgIGNvbnN0IGRyYWdnaW5nRWxlbVByZXZJdGVtOiBLdGREaWN0aW9uYXJ5PEt0ZEdyaWRMYXlvdXRJdGVtPiA9IHt9XHJcbiAgICBncmlkSXRlbXMuZm9yRWFjaChncmlkSXRlbT0+IHtcclxuICAgICAgICBkcmFnZ2luZ0VsZW1QcmV2SXRlbVtncmlkSXRlbS5pZF0gPSBjb25maWcubGF5b3V0LmZpbmQoaXRlbSA9PiBpdGVtLmlkID09PSBncmlkSXRlbS5pZCkhXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBjbGllbnRTdGFydFggPSBrdGRQb2ludGVyQ2xpZW50WChwb2ludGVyRG93bkV2ZW50KTtcclxuICAgIGNvbnN0IGNsaWVudFN0YXJ0WSA9IGt0ZFBvaW50ZXJDbGllbnRZKHBvaW50ZXJEb3duRXZlbnQpO1xyXG4gICAgY29uc3QgY2xpZW50WCA9IGt0ZFBvaW50ZXJDbGllbnRYKHBvaW50ZXJEcmFnRXZlbnQpO1xyXG4gICAgY29uc3QgY2xpZW50WSA9IGt0ZFBvaW50ZXJDbGllbnRZKHBvaW50ZXJEcmFnRXZlbnQpO1xyXG5cclxuICAgIC8vIEdyaWQgZWxlbWVudCBwb3NpdGlvbnMgdGFraW5nIGludG8gYWNjb3VudCB0aGUgcG9zc2libGUgc2Nyb2xsIHRvdGFsIGRpZmZlcmVuY2UgZnJvbSB0aGUgYmVnaW5uaW5nLlxyXG4gICAgY29uc3QgZ3JpZEVsZW1lbnRMZWZ0UG9zaXRpb24gPSBncmlkRWxlbUNsaWVudFJlY3QubGVmdCArIHNjcm9sbERpZmZlcmVuY2UubGVmdDtcclxuICAgIGNvbnN0IGdyaWRFbGVtZW50VG9wUG9zaXRpb24gPSBncmlkRWxlbUNsaWVudFJlY3QudG9wICsgc2Nyb2xsRGlmZmVyZW5jZS50b3A7XHJcblxyXG4gICAgY29uc3Qgcm93SGVpZ2h0SW5QaXhlbHMgPSBjb25maWcucm93SGVpZ2h0ID09PSAnZml0J1xyXG4gICAgICAgID8ga3RkR2V0R3JpZEl0ZW1Sb3dIZWlnaHQoY29uZmlnLmxheW91dCwgY29uZmlnLmhlaWdodCA/PyBncmlkRWxlbUNsaWVudFJlY3QuaGVpZ2h0LCBjb25maWcuZ2FwKVxyXG4gICAgICAgIDogY29uZmlnLnJvd0hlaWdodDtcclxuXHJcbiAgICBjb25zdCBsYXlvdXRJdGVtc1RvTW92ZTogIEt0ZERpY3Rpb25hcnk8S3RkR3JpZExheW91dEl0ZW0+PXt9O1xyXG4gICAgY29uc3QgZ3JpZFJlbFBvczogS3RkRGljdGlvbmFyeTx7eDpudW1iZXIseTpudW1iZXJ9Pj17fVxyXG4gICAgbGV0IG1heFhNb3ZlOiBudW1iZXIgPSAwO1xyXG4gICAgbGV0IG1heFlNb3ZlOiBudW1iZXIgPSAwO1xyXG4gICAgZ3JpZEl0ZW1zLmZvckVhY2goKGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCk9PntcclxuICAgICAgICBjb25zdCBvZmZzZXRYID0gY2xpZW50U3RhcnRYIC0gZHJhZ0VsZW1lbnRzQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0ubGVmdDtcclxuICAgICAgICBjb25zdCBvZmZzZXRZID0gY2xpZW50U3RhcnRZIC0gZHJhZ0VsZW1lbnRzQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0udG9wO1xyXG4gICAgICAgIC8vIENhbGN1bGF0ZSBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgZ3JpZCBlbGVtZW50LlxyXG4gICAgICAgIGdyaWRSZWxQb3NbZ3JpZEl0ZW0uaWRdPXtcclxuICAgICAgICAgICAgeDogY2xpZW50WCAtIGdyaWRFbGVtZW50TGVmdFBvc2l0aW9uIC0gb2Zmc2V0WCxcclxuICAgICAgICAgICAgeTogY2xpZW50WSAtIGdyaWRFbGVtZW50VG9wUG9zaXRpb24gLSBvZmZzZXRZXHJcbiAgICAgICAgfTtcclxuICAgICAgICAvLyBHZXQgbGF5b3V0IGl0ZW0gcG9zaXRpb25cclxuICAgICAgICBsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0gPSB7XHJcbiAgICAgICAgICAgIC4uLmRyYWdnaW5nRWxlbVByZXZJdGVtW2dyaWRJdGVtLmlkXSxcclxuICAgICAgICAgICAgeDogc2NyZWVuWFRvR3JpZFgoZ3JpZFJlbFBvc1tncmlkSXRlbS5pZF0ueCAsIGNvbmZpZy5jb2xzLCBncmlkRWxlbUNsaWVudFJlY3Qud2lkdGgsIGNvbmZpZy5nYXApLFxyXG4gICAgICAgICAgICB5OiBzY3JlZW5ZVG9HcmlkWShncmlkUmVsUG9zW2dyaWRJdGVtLmlkXS55LCByb3dIZWlnaHRJblBpeGVscywgZ3JpZEVsZW1DbGllbnRSZWN0LmhlaWdodCwgY29uZmlnLmdhcClcclxuICAgICAgICB9O1xyXG4gICAgICAgIC8vIERldGVybWluZSB0aGUgbWF4aW11bSBYIGFuZCBZIGRpc3BsYWNlbWVudCB3aGVyZSBhbiBpdGVtIGhhcyBnb25lIG91dHNpZGUgdGhlIGdyaWRcclxuICAgICAgICBpZigwPmxheW91dEl0ZW1zVG9Nb3ZlW2dyaWRJdGVtLmlkXS54ICYmIG1heFhNb3ZlPmxheW91dEl0ZW1zVG9Nb3ZlW2dyaWRJdGVtLmlkXS54KXtcclxuICAgICAgICAgICAgbWF4WE1vdmUgPSBsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYoMD5sYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueSAmJiBtYXhZTW92ZT5sYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueSl7XHJcbiAgICAgICAgICAgIG1heFlNb3ZlID0gbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLnk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKGxheW91dEl0ZW1zVG9Nb3ZlW2dyaWRJdGVtLmlkXS54ICsgbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLncgPiBjb25maWcuY29scyAmJiBtYXhYTW92ZTxsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0udyArIGxheW91dEl0ZW1zVG9Nb3ZlW2dyaWRJdGVtLmlkXS54IC0gY29uZmlnLmNvbHMpe1xyXG4gICAgICAgICAgICBtYXhYTW92ZSA9IGxheW91dEl0ZW1zVG9Nb3ZlW2dyaWRJdGVtLmlkXS53ICsgbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLnggLSBjb25maWcuY29sc1xyXG4gICAgICAgIH1cclxuICAgIH0pXHJcbiAgICAvLyBDb3JyZWN0IGFsbCB0aGUgeCBhbmQgeSBwb3NpdGlvbiBvZiB0aGUgZ3JvdXAgZGVjcmVhc2luZy9pbmNyZWFzaW5nIHRoZSBtYXhpbXVtIG92ZXJmbG93IG9mIGFuIGl0ZW0sIHRvIG1haW50YWluIHRoZSBzdHJ1Y3R1cmVcclxuICAgIE9iamVjdC5lbnRyaWVzKGxheW91dEl0ZW1zVG9Nb3ZlKS5mb3JFYWNoKChba2V5LCBpdGVtXSkgPT4ge1xyXG4gICAgICAgIGxheW91dEl0ZW1zVG9Nb3ZlW2tleV0gPSB7XHJcbiAgICAgICAgICAgIC4uLml0ZW0sXHJcbiAgICAgICAgICAgIHg6IGl0ZW0ueCAtIG1heFhNb3ZlLFxyXG4gICAgICAgICAgICB5OiBpdGVtLnkgLSBtYXhZTW92ZVxyXG4gICAgICAgIH07XHJcbiAgICB9KVxyXG5cclxuICAgIC8vIFBhcnNlIHRvIExheW91dEl0ZW0gYXJyYXkgZGF0YSBpbiBvcmRlciB0byB1c2UgJ3JlYWN0LmdyaWQtbGF5b3V0JyB1dGlsc1xyXG4gICAgY29uc3QgbGF5b3V0SXRlbXM6IExheW91dEl0ZW1bXSA9IGNvbmZpZy5sYXlvdXQ7XHJcbiAgICBjb25zdCBkcmFnZ2VkTGF5b3V0SXRlbToge1xyXG4gICAgICAgIGw6IExheW91dEl0ZW0sXHJcbiAgICAgICAgeDogbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgICAgICB5OiBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkXHJcbiAgICB9W10gPSBncmlkSXRlbXMubWFwKChncmlkSXRlbTpLdGRHcmlkSXRlbUNvbXBvbmVudCk9PntcclxuICAgICAgICBjb25zdCBkcmFnZ2VkTGF5b3V0SXRlbTogTGF5b3V0SXRlbSA9IGxheW91dEl0ZW1zLmZpbmQoaXRlbSA9PiBpdGVtLmlkID09PSBncmlkSXRlbS5pZCkhO1xyXG4gICAgICAgIGRyYWdnZWRMYXlvdXRJdGVtLnN0YXRpYyA9IHRydWU7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgbDogZHJhZ2dlZExheW91dEl0ZW0sXHJcbiAgICAgICAgICAgIHg6IGxheW91dEl0ZW1zVG9Nb3ZlW2dyaWRJdGVtLmlkXS54LFxyXG4gICAgICAgICAgICB5OiBsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueVxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGxldCBuZXdMYXlvdXRJdGVtczogTGF5b3V0SXRlbVtdID0gbW92ZUVsZW1lbnRzKFxyXG4gICAgICAgIGxheW91dEl0ZW1zLFxyXG4gICAgICAgIGRyYWdnZWRMYXlvdXRJdGVtLFxyXG4gICAgICAgIHRydWUsXHJcbiAgICAgICAgY29uZmlnLnByZXZlbnRDb2xsaXNpb24sXHJcbiAgICAgICAgY29tcGFjdGlvblR5cGUsXHJcbiAgICAgICAgY29uZmlnLmNvbHMsXHJcbiAgICApO1xyXG5cclxuICAgIC8vIENvbXBhY3Qgd2l0aCBzZWxlY3RlZCBpdGVtcyBhcyBzdGF0aWMgdG8gcHJlc2VydmUgdGhlIHN0cnVjdHVyZSBvZiB0aGUgc2VsZWN0ZWQgaXRlbXMgZ3JvdXBcclxuICAgIG5ld0xheW91dEl0ZW1zID0gY29tcGFjdChuZXdMYXlvdXRJdGVtcywgY29tcGFjdGlvblR5cGUsIGNvbmZpZy5jb2xzKTtcclxuICAgIGdyaWRJdGVtcy5mb3JFYWNoKGdyaWRJdGVtPT5uZXdMYXlvdXRJdGVtcy5maW5kKGxheW91dEl0ZW09PmxheW91dEl0ZW0uaWQgPT09IGdyaWRJdGVtLmlkKSEuc3RhdGljID0gZmFsc2UpO1xyXG4gICAgLy8gQ29tcGFjdCBub3JtYWwgdG8gZGlzcGxheSB0aGUgbGF5b3V0IGNvcnJlY3RseVxyXG4gICAgbmV3TGF5b3V0SXRlbXMgPSBjb21wYWN0KG5ld0xheW91dEl0ZW1zLCBjb21wYWN0aW9uVHlwZSwgY29uZmlnLmNvbHMpO1xyXG5cclxuICAgIGNvbnN0IGRyYWdnZWRJdGVtUG9zOiBLdGREaWN0aW9uYXJ5PEt0ZEdyaWRJdGVtUmVjdD49e307XHJcbiAgICBncmlkSXRlbXMuZm9yRWFjaChncmlkSXRlbT0+XHJcbiAgICAgICAgZHJhZ2dlZEl0ZW1Qb3NbZ3JpZEl0ZW0uaWRdPXtcclxuICAgICAgICAgICAgbGVmdDogZ3JpZFJlbFBvc1tncmlkSXRlbS5pZF0ueCxcclxuICAgICAgICAgICAgdG9wOiBncmlkUmVsUG9zW2dyaWRJdGVtLmlkXS55LFxyXG4gICAgICAgICAgICB3aWR0aDogZHJhZ0VsZW1lbnRzQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0ud2lkdGgsXHJcbiAgICAgICAgICAgIGhlaWdodDogZHJhZ0VsZW1lbnRzQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0uaGVpZ2h0LFxyXG4gICAgICAgIH1cclxuICAgICk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsYXlvdXQ6IG5ld0xheW91dEl0ZW1zLFxyXG4gICAgICAgIGRyYWdnZWRJdGVtUG9zXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKipcclxuICogR2l2ZW4gdGhlIGdyaWQgY29uZmlnICYgbGF5b3V0IGRhdGEgYW5kIHRoZSBjdXJyZW50IGRyYWcgcG9zaXRpb24gJiBpbmZvcm1hdGlvbiwgcmV0dXJucyB0aGUgY29ycmVzcG9uZGluZyBsYXlvdXQgYW5kIGRyYWcgaXRlbSBwb3NpdGlvblxyXG4gKiBAcGFyYW0gZ3JpZEl0ZW0gZ3JpZCBpdGVtIHRoYXQgaXMgYmVlbiBkcmFnZ2VkXHJcbiAqIEBwYXJhbSBjb25maWcgY3VycmVudCBncmlkIGNvbmZpZ3VyYXRpb25cclxuICogQHBhcmFtIGNvbXBhY3Rpb25UeXBlIHR5cGUgb2YgY29tcGFjdGlvbiB0aGF0IHdpbGwgYmUgcGVyZm9ybWVkXHJcbiAqIEBwYXJhbSBkcmFnZ2luZ0RhdGEgY29udGFpbnMgYWxsIHRoZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZHJhZ1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGt0ZEdyaWRJdGVtUmVzaXppbmcoZ3JpZEl0ZW06IEt0ZEdyaWRJdGVtQ29tcG9uZW50LCBjb25maWc6IEt0ZEdyaWRDZmcsIGNvbXBhY3Rpb25UeXBlOiBDb21wYWN0VHlwZSwgZHJhZ2dpbmdEYXRhOiBLdGREcmFnZ2luZ0RhdGEpOiB7IGxheW91dDogS3RkR3JpZExheW91dEl0ZW1bXTsgZHJhZ2dlZEl0ZW1Qb3M6IEt0ZEdyaWRJdGVtUmVjdCB9IHtcclxuICAgIGNvbnN0IHtwb2ludGVyRG93bkV2ZW50LCBwb2ludGVyRHJhZ0V2ZW50LCBncmlkRWxlbUNsaWVudFJlY3QsIGRyYWdFbGVtQ2xpZW50UmVjdCwgc2Nyb2xsRGlmZmVyZW5jZX0gPSBkcmFnZ2luZ0RhdGE7XHJcbiAgICBjb25zdCBncmlkSXRlbUlkID0gZ3JpZEl0ZW0uaWQ7XHJcblxyXG4gICAgY29uc3QgY2xpZW50U3RhcnRYID0ga3RkUG9pbnRlckNsaWVudFgocG9pbnRlckRvd25FdmVudCk7XHJcbiAgICBjb25zdCBjbGllbnRTdGFydFkgPSBrdGRQb2ludGVyQ2xpZW50WShwb2ludGVyRG93bkV2ZW50KTtcclxuICAgIGNvbnN0IGNsaWVudFggPSBrdGRQb2ludGVyQ2xpZW50WChwb2ludGVyRHJhZ0V2ZW50KTtcclxuICAgIGNvbnN0IGNsaWVudFkgPSBrdGRQb2ludGVyQ2xpZW50WShwb2ludGVyRHJhZ0V2ZW50KTtcclxuXHJcbiAgICAvLyBHZXQgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgbW91c2VEb3duIGFuZCB0aGUgcG9zaXRpb24gJ3JpZ2h0JyBvZiB0aGUgcmVzaXplIGVsZW1lbnQuXHJcbiAgICBjb25zdCByZXNpemVFbGVtT2Zmc2V0WCA9IGRyYWdFbGVtQ2xpZW50UmVjdC53aWR0aCAtIChjbGllbnRTdGFydFggLSBkcmFnRWxlbUNsaWVudFJlY3QubGVmdCk7XHJcbiAgICBjb25zdCByZXNpemVFbGVtT2Zmc2V0WSA9IGRyYWdFbGVtQ2xpZW50UmVjdC5oZWlnaHQgLSAoY2xpZW50U3RhcnRZIC0gZHJhZ0VsZW1DbGllbnRSZWN0LnRvcCk7XHJcblxyXG4gICAgY29uc3QgZHJhZ2dpbmdFbGVtUHJldkl0ZW0gPSBjb25maWcubGF5b3V0LmZpbmQoaXRlbSA9PiBpdGVtLmlkID09PSBncmlkSXRlbUlkKSE7XHJcbiAgICBjb25zdCB3aWR0aCA9IGNsaWVudFggKyByZXNpemVFbGVtT2Zmc2V0WCAtIChkcmFnRWxlbUNsaWVudFJlY3QubGVmdCArIHNjcm9sbERpZmZlcmVuY2UubGVmdCk7XHJcbiAgICBjb25zdCBoZWlnaHQgPSBjbGllbnRZICsgcmVzaXplRWxlbU9mZnNldFkgLSAoZHJhZ0VsZW1DbGllbnRSZWN0LnRvcCArIHNjcm9sbERpZmZlcmVuY2UudG9wKTtcclxuXHJcbiAgICBjb25zdCByb3dIZWlnaHRJblBpeGVscyA9IGNvbmZpZy5yb3dIZWlnaHQgPT09ICdmaXQnXHJcbiAgICAgICAgPyBrdGRHZXRHcmlkSXRlbVJvd0hlaWdodChjb25maWcubGF5b3V0LCBjb25maWcuaGVpZ2h0ID8/IGdyaWRFbGVtQ2xpZW50UmVjdC5oZWlnaHQsIGNvbmZpZy5nYXApXHJcbiAgICAgICAgOiBjb25maWcucm93SGVpZ2h0O1xyXG5cclxuICAgIC8vIEdldCBsYXlvdXQgaXRlbSBncmlkIHBvc2l0aW9uXHJcbiAgICBjb25zdCBsYXlvdXRJdGVtOiBLdGRHcmlkTGF5b3V0SXRlbSA9IHtcclxuICAgICAgICAuLi5kcmFnZ2luZ0VsZW1QcmV2SXRlbSxcclxuICAgICAgICB3OiBzY3JlZW5XaWR0aFRvR3JpZFdpZHRoKHdpZHRoLCBjb25maWcuY29scywgZ3JpZEVsZW1DbGllbnRSZWN0LndpZHRoLCBjb25maWcuZ2FwKSxcclxuICAgICAgICBoOiBzY3JlZW5IZWlnaHRUb0dyaWRIZWlnaHQoaGVpZ2h0LCByb3dIZWlnaHRJblBpeGVscywgZ3JpZEVsZW1DbGllbnRSZWN0LmhlaWdodCwgY29uZmlnLmdhcClcclxuICAgIH07XHJcblxyXG4gICAgbGF5b3V0SXRlbS53ID0gbGltaXROdW1iZXJXaXRoaW5SYW5nZShsYXlvdXRJdGVtLncsIGdyaWRJdGVtLm1pblcgPz8gbGF5b3V0SXRlbS5taW5XLCBncmlkSXRlbS5tYXhXID8/IGxheW91dEl0ZW0ubWF4Vyk7XHJcbiAgICBsYXlvdXRJdGVtLmggPSBsaW1pdE51bWJlcldpdGhpblJhbmdlKGxheW91dEl0ZW0uaCwgZ3JpZEl0ZW0ubWluSCA/PyBsYXlvdXRJdGVtLm1pbkgsIGdyaWRJdGVtLm1heEggPz8gbGF5b3V0SXRlbS5tYXhIKTtcclxuXHJcbiAgICBpZiAobGF5b3V0SXRlbS54ICsgbGF5b3V0SXRlbS53ID4gY29uZmlnLmNvbHMpIHtcclxuICAgICAgICBsYXlvdXRJdGVtLncgPSBNYXRoLm1heCgxLCBjb25maWcuY29scyAtIGxheW91dEl0ZW0ueCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvbmZpZy5wcmV2ZW50Q29sbGlzaW9uKSB7XHJcbiAgICAgICAgY29uc3QgbWF4VyA9IGxheW91dEl0ZW0udztcclxuICAgICAgICBjb25zdCBtYXhIID0gbGF5b3V0SXRlbS5oO1xyXG5cclxuICAgICAgICBsZXQgY29sbGlkaW5nID0gaGFzQ29sbGlzaW9uKGNvbmZpZy5sYXlvdXQsIGxheW91dEl0ZW0pO1xyXG4gICAgICAgIGxldCBzaHJ1bmtEaW1lbnNpb246ICd3JyB8ICdoJyB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgd2hpbGUgKGNvbGxpZGluZykge1xyXG4gICAgICAgICAgICBzaHJ1bmtEaW1lbnNpb24gPSBnZXREaW1lbnNpb25Ub1NocmluayhsYXlvdXRJdGVtLCBzaHJ1bmtEaW1lbnNpb24pO1xyXG4gICAgICAgICAgICBsYXlvdXRJdGVtW3NocnVua0RpbWVuc2lvbl0tLTtcclxuICAgICAgICAgICAgY29sbGlkaW5nID0gaGFzQ29sbGlzaW9uKGNvbmZpZy5sYXlvdXQsIGxheW91dEl0ZW0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHNocnVua0RpbWVuc2lvbiA9PT0gJ3cnKSB7XHJcbiAgICAgICAgICAgIGxheW91dEl0ZW0uaCA9IG1heEg7XHJcblxyXG4gICAgICAgICAgICBjb2xsaWRpbmcgPSBoYXNDb2xsaXNpb24oY29uZmlnLmxheW91dCwgbGF5b3V0SXRlbSk7XHJcbiAgICAgICAgICAgIHdoaWxlIChjb2xsaWRpbmcpIHtcclxuICAgICAgICAgICAgICAgIGxheW91dEl0ZW0uaC0tO1xyXG4gICAgICAgICAgICAgICAgY29sbGlkaW5nID0gaGFzQ29sbGlzaW9uKGNvbmZpZy5sYXlvdXQsIGxheW91dEl0ZW0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzaHJ1bmtEaW1lbnNpb24gPT09ICdoJykge1xyXG4gICAgICAgICAgICBsYXlvdXRJdGVtLncgPSBtYXhXO1xyXG5cclxuICAgICAgICAgICAgY29sbGlkaW5nID0gaGFzQ29sbGlzaW9uKGNvbmZpZy5sYXlvdXQsIGxheW91dEl0ZW0pO1xyXG4gICAgICAgICAgICB3aGlsZSAoY29sbGlkaW5nKSB7XHJcbiAgICAgICAgICAgICAgICBsYXlvdXRJdGVtLnctLTtcclxuICAgICAgICAgICAgICAgIGNvbGxpZGluZyA9IGhhc0NvbGxpc2lvbihjb25maWcubGF5b3V0LCBsYXlvdXRJdGVtKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbmV3TGF5b3V0SXRlbXM6IExheW91dEl0ZW1bXSA9IGNvbmZpZy5sYXlvdXQubWFwKChpdGVtKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIGl0ZW0uaWQgPT09IGdyaWRJdGVtSWQgPyBsYXlvdXRJdGVtIDogaXRlbTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbGF5b3V0OiBjb21wYWN0KG5ld0xheW91dEl0ZW1zLCBjb21wYWN0aW9uVHlwZSwgY29uZmlnLmNvbHMpLFxyXG4gICAgICAgIGRyYWdnZWRJdGVtUG9zOiB7XHJcbiAgICAgICAgICAgIHRvcDogZHJhZ0VsZW1DbGllbnRSZWN0LnRvcCAtIGdyaWRFbGVtQ2xpZW50UmVjdC50b3AsXHJcbiAgICAgICAgICAgIGxlZnQ6IGRyYWdFbGVtQ2xpZW50UmVjdC5sZWZ0IC0gZ3JpZEVsZW1DbGllbnRSZWN0LmxlZnQsXHJcbiAgICAgICAgICAgIHdpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQsXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gaGFzQ29sbGlzaW9uKGxheW91dDogTGF5b3V0LCBsYXlvdXRJdGVtOiBMYXlvdXRJdGVtKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gISFnZXRGaXJzdENvbGxpc2lvbihsYXlvdXQsIGxheW91dEl0ZW0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXREaW1lbnNpb25Ub1NocmluayhsYXlvdXRJdGVtLCBsYXN0U2hydW5rKTogJ3cnIHwgJ2gnIHtcclxuICAgIGlmIChsYXlvdXRJdGVtLmggPD0gMSkge1xyXG4gICAgICAgIHJldHVybiAndyc7XHJcbiAgICB9XHJcbiAgICBpZiAobGF5b3V0SXRlbS53IDw9IDEpIHtcclxuICAgICAgICByZXR1cm4gJ2gnO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBsYXN0U2hydW5rID09PSAndycgPyAnaCcgOiAndyc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHaXZlbiB0aGUgY3VycmVudCBudW1iZXIgYW5kIG1pbi9tYXggdmFsdWVzLCByZXR1cm5zIHRoZSBudW1iZXIgd2l0aGluIHRoZSByYW5nZVxyXG4gKiBAcGFyYW0gbnVtYmVyIGNhbiBiZSBhbnkgbnVtZXJpYyB2YWx1ZVxyXG4gKiBAcGFyYW0gbWluIG1pbmltdW0gdmFsdWUgb2YgcmFuZ2VcclxuICogQHBhcmFtIG1heCBtYXhpbXVtIHZhbHVlIG9mIHJhbmdlXHJcbiAqL1xyXG5mdW5jdGlvbiBsaW1pdE51bWJlcldpdGhpblJhbmdlKG51bTogbnVtYmVyLCBtaW46IG51bWJlciA9IDEsIG1heDogbnVtYmVyID0gSW5maW5pdHkpIHtcclxuICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChudW0sIG1pbiA8IDEgPyAxIDogbWluKSwgbWF4KTtcclxufVxyXG5cclxuLyoqIFJldHVybnMgdHJ1ZSBpZiBib3RoIGl0ZW0xIGFuZCBpdGVtMiBLdGRHcmlkTGF5b3V0SXRlbXMgYXJlIGVxdWl2YWxlbnQuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBrdGRHcmlkSXRlbUxheW91dEl0ZW1BcmVFcXVhbChpdGVtMTogS3RkR3JpZExheW91dEl0ZW0sIGl0ZW0yOiBLdGRHcmlkTGF5b3V0SXRlbSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGl0ZW0xLmlkID09PSBpdGVtMi5pZFxyXG4gICAgICAgICYmIGl0ZW0xLnggPT09IGl0ZW0yLnhcclxuICAgICAgICAmJiBpdGVtMS55ID09PSBpdGVtMi55XHJcbiAgICAgICAgJiYgaXRlbTEudyA9PT0gaXRlbTIud1xyXG4gICAgICAgICYmIGl0ZW0xLmggPT09IGl0ZW0yLmhcclxufVxyXG4iXX0=