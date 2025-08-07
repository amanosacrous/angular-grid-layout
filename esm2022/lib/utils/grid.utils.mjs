import { compact, getFirstCollision, moveElement } from './react-grid-layout.utils';
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
        // Correct the values if they overflow, since 'moveElement' function doesn't do it
        layoutItemsToMove[gridItem.id].x = Math.max(0, layoutItemsToMove[gridItem.id].x);
        layoutItemsToMove[gridItem.id].y = Math.max(0, layoutItemsToMove[gridItem.id].y);
        if (layoutItemsToMove[gridItem.id].x + layoutItemsToMove[gridItem.id].w > config.cols) {
            layoutItemsToMove[gridItem.id].x = Math.max(0, config.cols - layoutItemsToMove[gridItem.id].w);
        }
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
    let newLayoutItems = moveElements(layoutItems, draggedLayoutItem, true, compactionType, config.cols);
    newLayoutItems = compact(newLayoutItems, compactionType, config.cols);
    gridItems.forEach(gridItem => newLayoutItems.find(layoutItem => layoutItem.id === gridItem.id).static = false);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JpZC51dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL2FuZ3VsYXItZ3JpZC1sYXlvdXQvc3JjL2xpYi91dGlscy9ncmlkLnV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQWUsaUJBQWlCLEVBQXNCLFdBQVcsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBSXJILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBR3ZFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUVsRSwySEFBMkg7QUFDM0gsTUFBTSxVQUFVLFlBQVksQ0FBQyxLQUFhLEVBQUUsSUFBa0I7SUFDMUQsT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDO0FBQ25CLENBQUM7QUFFRCxnRkFBZ0Y7QUFDaEYsTUFBTSxVQUFVLHVCQUF1QixDQUFDLE1BQXFCLEVBQUUsVUFBa0IsRUFBRSxHQUFXO0lBQzFGLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQy9GLE1BQU0sY0FBYyxHQUFHLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUNoRCxNQUFNLGtCQUFrQixHQUFHLFVBQVUsR0FBRyxjQUFjLENBQUM7SUFDdkQsT0FBTyxrQkFBa0IsR0FBRyxZQUFZLENBQUM7QUFDN0MsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLGNBQWMsQ0FBQyxNQUFxQixFQUFFLFdBQStCLEVBQUUs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RSxHQUFHLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBRUQsOEVBQThFO0FBQzlFLE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxLQUF3QixFQUFFLEtBQXdCO0lBQzVGLE9BQU8sS0FBSyxDQUFDLEVBQUUsS0FBSyxLQUFLLENBQUMsRUFBRTtXQUNyQixLQUFLLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDO1dBQ25CLEtBQUssQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUM7V0FDbkIsS0FBSyxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQztXQUNuQixLQUFLLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNvbXBhY3QsIENvbXBhY3RUeXBlLCBnZXRGaXJzdENvbGxpc2lvbiwgTGF5b3V0LCBMYXlvdXRJdGVtLCBtb3ZlRWxlbWVudCB9IGZyb20gJy4vcmVhY3QtZ3JpZC1sYXlvdXQudXRpbHMnO1xyXG5pbXBvcnQge1xyXG4gICAgS3RkRHJhZ2dpbmdEYXRhLCBLdGREcmFnZ2luZ011bHRpcGxlRGF0YSwgS3RkR3JpZENmZywgS3RkR3JpZENvbXBhY3RUeXBlLCBLdGRHcmlkSXRlbVJlY3QsIEt0ZEdyaWRJdGVtUmVuZGVyRGF0YSwgS3RkR3JpZExheW91dCwgS3RkR3JpZExheW91dEl0ZW1cclxufSBmcm9tICcuLi9ncmlkLmRlZmluaXRpb25zJztcclxuaW1wb3J0IHsga3RkUG9pbnRlckNsaWVudFgsIGt0ZFBvaW50ZXJDbGllbnRZIH0gZnJvbSAnLi9wb2ludGVyLnV0aWxzJztcclxuaW1wb3J0IHsgS3RkRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uL3R5cGVzJztcclxuaW1wb3J0IHsgS3RkR3JpZEl0ZW1Db21wb25lbnQgfSBmcm9tICcuLi9ncmlkLWl0ZW0vZ3JpZC1pdGVtLmNvbXBvbmVudCc7XHJcbmltcG9ydCB7IG1vdmVFbGVtZW50cyB9IGZyb20gJy4vcmVhY3QtZ3JpZC1sYXlvdXQtbXVsdGlwbGUudXRpbHMnO1xyXG5cclxuLyoqIFRyYWNrcyBpdGVtcyBieSBpZC4gVGhpcyBmdW5jdGlvbiBpcyBtZWFuIHRvIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCB0aGUgbmdGb3IgdGhhdCByZW5kZXJzIHRoZSAna3RkLWdyaWQtaXRlbXMnICovXHJcbmV4cG9ydCBmdW5jdGlvbiBrdGRUcmFja0J5SWQoaW5kZXg6IG51bWJlciwgaXRlbToge2lkOiBzdHJpbmd9KSB7XHJcbiAgICByZXR1cm4gaXRlbS5pZDtcclxufVxyXG5cclxuLyoqIEdpdmVuIGEgbGF5b3V0LCB0aGUgZ3JpZEhlaWdodCBhbmQgdGhlIGdhcCByZXR1cm4gdGhlIHJlc3VsdGluZyByb3dIZWlnaHQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGt0ZEdldEdyaWRJdGVtUm93SGVpZ2h0KGxheW91dDogS3RkR3JpZExheW91dCwgZ3JpZEhlaWdodDogbnVtYmVyLCBnYXA6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBjb25zdCBudW1iZXJPZlJvd3MgPSBsYXlvdXQucmVkdWNlKChhY2MsIGN1cikgPT4gTWF0aC5tYXgoYWNjLCBNYXRoLm1heChjdXIueSArIGN1ci5oLCAwKSksIDApO1xyXG4gICAgY29uc3QgZ2FwVG90YWxIZWlnaHQgPSAobnVtYmVyT2ZSb3dzIC0gMSkgKiBnYXA7XHJcbiAgICBjb25zdCBncmlkSGVpZ2h0TWludXNHYXAgPSBncmlkSGVpZ2h0IC0gZ2FwVG90YWxIZWlnaHQ7XHJcbiAgICByZXR1cm4gZ3JpZEhlaWdodE1pbnVzR2FwIC8gbnVtYmVyT2ZSb3dzO1xyXG59XHJcblxyXG4vKipcclxuICogQ2FsbCByZWFjdC1ncmlkLWxheW91dCB1dGlscyAnY29tcGFjdCgpJyBmdW5jdGlvbiBhbmQgcmV0dXJuIHRoZSBjb21wYWN0ZWQgbGF5b3V0LlxyXG4gKiBAcGFyYW0gbGF5b3V0IHRvIGJlIGNvbXBhY3RlZC5cclxuICogQHBhcmFtIGNvbXBhY3RUeXBlLCB0eXBlIG9mIGNvbXBhY3Rpb24uXHJcbiAqIEBwYXJhbSBjb2xzLCBudW1iZXIgb2YgY29sdW1ucyBvZiB0aGUgZ3JpZC5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBrdGRHcmlkQ29tcGFjdChsYXlvdXQ6IEt0ZEdyaWRMYXlvdXQsIGNvbXBhY3RUeXBlOiBLdGRHcmlkQ29tcGFjdFR5cGUsIGNvbHM6IG51bWJlcik6IEt0ZEdyaWRMYXlvdXQge1xyXG4gICAgcmV0dXJuIGNvbXBhY3QobGF5b3V0LCBjb21wYWN0VHlwZSwgY29scylcclxuICAgICAgICAvLyBQcnVuZSByZWFjdC1ncmlkLWxheW91dCBjb21wYWN0IGV4dHJhIHByb3BlcnRpZXMuXHJcbiAgICAgICAgLm1hcChpdGVtID0+ICh7IGlkOiBpdGVtLmlkLCB4OiBpdGVtLngsIHk6IGl0ZW0ueSwgdzogaXRlbS53LCBoOiBpdGVtLmgsIG1pblc6IGl0ZW0ubWluVywgbWluSDogaXRlbS5taW5ILCBtYXhXOiBpdGVtLm1heFcsIG1heEg6IGl0ZW0ubWF4SCB9KSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNjcmVlblhUb0dyaWRYKHNjcmVlblhQb3M6IG51bWJlciwgY29sczogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBnYXA6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBpZiAoY29scyA8PSAxKSB7XHJcbiAgICAgICAgcmV0dXJuIDA7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdG90YWxHYXBzV2lkdGggPSBnYXAgKiAoY29scyAtIDEpO1xyXG4gICAgY29uc3QgdG90YWxJdGVtc1dpZHRoID0gd2lkdGggLSB0b3RhbEdhcHNXaWR0aDtcclxuICAgIGNvbnN0IGl0ZW1QbHVzR2FwV2lkdGggPSB0b3RhbEl0ZW1zV2lkdGggLyBjb2xzICsgZ2FwO1xyXG4gICAgcmV0dXJuIE1hdGgucm91bmQoc2NyZWVuWFBvcyAvIGl0ZW1QbHVzR2FwV2lkdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzY3JlZW5ZVG9HcmlkWShzY3JlZW5ZUG9zOiBudW1iZXIsIHJvd0hlaWdodDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgZ2FwOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIE1hdGgucm91bmQoc2NyZWVuWVBvcyAvIChyb3dIZWlnaHQgKyBnYXApKTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2NyZWVuV2lkdGhUb0dyaWRXaWR0aChncmlkU2NyZWVuV2lkdGg6IG51bWJlciwgY29sczogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBnYXA6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBjb25zdCB3aWR0aE1pbnVzR2FwcyA9IHdpZHRoIC0gKGdhcCAqIChjb2xzIC0gMSkpO1xyXG4gICAgY29uc3QgaXRlbVdpZHRoID0gd2lkdGhNaW51c0dhcHMgLyBjb2xzO1xyXG4gICAgY29uc3QgZ3JpZFNjcmVlbldpZHRoTWludXNGaXJzdCA9IGdyaWRTY3JlZW5XaWR0aCAtIGl0ZW1XaWR0aDtcclxuICAgIHJldHVybiBNYXRoLnJvdW5kKGdyaWRTY3JlZW5XaWR0aE1pbnVzRmlyc3QgLyAoaXRlbVdpZHRoICsgZ2FwKSkgKyAxO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzY3JlZW5IZWlnaHRUb0dyaWRIZWlnaHQoZ3JpZFNjcmVlbkhlaWdodDogbnVtYmVyLCByb3dIZWlnaHQ6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGdhcDogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IGdyaWRTY3JlZW5IZWlnaHRNaW51c0ZpcnN0ID0gZ3JpZFNjcmVlbkhlaWdodCAtIHJvd0hlaWdodDtcclxuICAgIHJldHVybiBNYXRoLnJvdW5kKGdyaWRTY3JlZW5IZWlnaHRNaW51c0ZpcnN0IC8gKHJvd0hlaWdodCArIGdhcCkpICsgMTtcclxufVxyXG5cclxuLyoqIFJldHVybnMgYSBEaWN0aW9uYXJ5IHdoZXJlIHRoZSBrZXkgaXMgdGhlIGlkIGFuZCB0aGUgdmFsdWUgaXMgdGhlIGNoYW5nZSBhcHBsaWVkIHRvIHRoYXQgaXRlbS4gSWYgbm8gY2hhbmdlcyBEaWN0aW9uYXJ5IGlzIGVtcHR5LiAqL1xyXG5leHBvcnQgZnVuY3Rpb24ga3RkR2V0R3JpZExheW91dERpZmYoZ3JpZExheW91dEE6IEt0ZEdyaWRMYXlvdXRJdGVtW10sIGdyaWRMYXlvdXRCOiBLdGRHcmlkTGF5b3V0SXRlbVtdKTogS3RkRGljdGlvbmFyeTx7IGNoYW5nZTogJ21vdmUnIHwgJ3Jlc2l6ZScgfCAnbW92ZXJlc2l6ZScgfT4ge1xyXG4gICAgY29uc3QgZGlmZjogS3RkRGljdGlvbmFyeTx7IGNoYW5nZTogJ21vdmUnIHwgJ3Jlc2l6ZScgfCAnbW92ZXJlc2l6ZScgfT4gPSB7fTtcclxuXHJcbiAgICBncmlkTGF5b3V0QS5mb3JFYWNoKGl0ZW1BID0+IHtcclxuICAgICAgICBjb25zdCBpdGVtQiA9IGdyaWRMYXlvdXRCLmZpbmQoX2l0ZW1CID0+IF9pdGVtQi5pZCA9PT0gaXRlbUEuaWQpO1xyXG4gICAgICAgIGlmIChpdGVtQiAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBvc0NoYW5nZWQgPSBpdGVtQS54ICE9PSBpdGVtQi54IHx8IGl0ZW1BLnkgIT09IGl0ZW1CLnk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNpemVDaGFuZ2VkID0gaXRlbUEudyAhPT0gaXRlbUIudyB8fCBpdGVtQS5oICE9PSBpdGVtQi5oO1xyXG4gICAgICAgICAgICBjb25zdCBjaGFuZ2U6ICdtb3ZlJyB8ICdyZXNpemUnIHwgJ21vdmVyZXNpemUnIHwgbnVsbCA9IHBvc0NoYW5nZWQgJiYgc2l6ZUNoYW5nZWQgPyAnbW92ZXJlc2l6ZScgOiBwb3NDaGFuZ2VkID8gJ21vdmUnIDogc2l6ZUNoYW5nZWQgPyAncmVzaXplJyA6IG51bGw7XHJcbiAgICAgICAgICAgIGlmIChjaGFuZ2UpIHtcclxuICAgICAgICAgICAgICAgIGRpZmZbaXRlbUIuaWRdID0ge2NoYW5nZX07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBkaWZmO1xyXG59XHJcblxyXG4vKipcclxuICogR2l2ZW4gdGhlIGdyaWQgY29uZmlnICYgbGF5b3V0IGRhdGEgYW5kIHRoZSBjdXJyZW50IGRyYWcgcG9zaXRpb24gJiBpbmZvcm1hdGlvbiwgcmV0dXJucyB0aGUgY29ycmVzcG9uZGluZyBsYXlvdXQgYW5kIGRyYWcgaXRlbSBwb3NpdGlvblxyXG4gKiBAcGFyYW0gZ3JpZEl0ZW0gZ3JpZCBpdGVtIHRoYXQgaXMgYmVlbiBkcmFnZ2VkXHJcbiAqIEBwYXJhbSBjb25maWcgY3VycmVudCBncmlkIGNvbmZpZ3VyYXRpb25cclxuICogQHBhcmFtIGNvbXBhY3Rpb25UeXBlIHR5cGUgb2YgY29tcGFjdGlvbiB0aGF0IHdpbGwgYmUgcGVyZm9ybWVkXHJcbiAqIEBwYXJhbSBkcmFnZ2luZ0RhdGEgY29udGFpbnMgYWxsIHRoZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZHJhZ1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGt0ZEdyaWRJdGVtRHJhZ2dpbmcoZ3JpZEl0ZW06IEt0ZEdyaWRJdGVtQ29tcG9uZW50LCBjb25maWc6IEt0ZEdyaWRDZmcsIGNvbXBhY3Rpb25UeXBlOiBDb21wYWN0VHlwZSwgZHJhZ2dpbmdEYXRhOiBLdGREcmFnZ2luZ0RhdGEpOiB7IGxheW91dDogS3RkR3JpZExheW91dEl0ZW1bXTsgZHJhZ2dlZEl0ZW1Qb3M6IEt0ZEdyaWRJdGVtUmVjdCB9IHtcclxuICAgIGNvbnN0IHtwb2ludGVyRG93bkV2ZW50LCBwb2ludGVyRHJhZ0V2ZW50LCBncmlkRWxlbUNsaWVudFJlY3QsIGRyYWdFbGVtQ2xpZW50UmVjdCwgc2Nyb2xsRGlmZmVyZW5jZX0gPSBkcmFnZ2luZ0RhdGE7XHJcblxyXG4gICAgY29uc3QgZ3JpZEl0ZW1JZCA9IGdyaWRJdGVtLmlkO1xyXG5cclxuICAgIGNvbnN0IGRyYWdnaW5nRWxlbVByZXZJdGVtID0gY29uZmlnLmxheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW1JZCkhO1xyXG5cclxuICAgIGNvbnN0IGNsaWVudFN0YXJ0WCA9IGt0ZFBvaW50ZXJDbGllbnRYKHBvaW50ZXJEb3duRXZlbnQpO1xyXG4gICAgY29uc3QgY2xpZW50U3RhcnRZID0ga3RkUG9pbnRlckNsaWVudFkocG9pbnRlckRvd25FdmVudCk7XHJcbiAgICBjb25zdCBjbGllbnRYID0ga3RkUG9pbnRlckNsaWVudFgocG9pbnRlckRyYWdFdmVudCk7XHJcbiAgICBjb25zdCBjbGllbnRZID0ga3RkUG9pbnRlckNsaWVudFkocG9pbnRlckRyYWdFdmVudCk7XHJcblxyXG4gICAgY29uc3Qgb2Zmc2V0WCA9IGNsaWVudFN0YXJ0WCAtIGRyYWdFbGVtQ2xpZW50UmVjdC5sZWZ0O1xyXG4gICAgY29uc3Qgb2Zmc2V0WSA9IGNsaWVudFN0YXJ0WSAtIGRyYWdFbGVtQ2xpZW50UmVjdC50b3A7XHJcblxyXG4gICAgLy8gR3JpZCBlbGVtZW50IHBvc2l0aW9ucyB0YWtpbmcgaW50byBhY2NvdW50IHRoZSBwb3NzaWJsZSBzY3JvbGwgdG90YWwgZGlmZmVyZW5jZSBmcm9tIHRoZSBiZWdpbm5pbmcuXHJcbiAgICBjb25zdCBncmlkRWxlbWVudExlZnRQb3NpdGlvbiA9IGdyaWRFbGVtQ2xpZW50UmVjdC5sZWZ0ICsgc2Nyb2xsRGlmZmVyZW5jZS5sZWZ0O1xyXG4gICAgY29uc3QgZ3JpZEVsZW1lbnRUb3BQb3NpdGlvbiA9IGdyaWRFbGVtQ2xpZW50UmVjdC50b3AgKyBzY3JvbGxEaWZmZXJlbmNlLnRvcDtcclxuXHJcbiAgICAvLyBDYWxjdWxhdGUgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIGdyaWQgZWxlbWVudC5cclxuICAgIGNvbnN0IGdyaWRSZWxYUG9zID0gY2xpZW50WCAtIGdyaWRFbGVtZW50TGVmdFBvc2l0aW9uIC0gb2Zmc2V0WDtcclxuICAgIGNvbnN0IGdyaWRSZWxZUG9zID0gY2xpZW50WSAtIGdyaWRFbGVtZW50VG9wUG9zaXRpb24gLSBvZmZzZXRZO1xyXG5cclxuICAgIGNvbnN0IHJvd0hlaWdodEluUGl4ZWxzID0gY29uZmlnLnJvd0hlaWdodCA9PT0gJ2ZpdCdcclxuICAgICAgICA/IGt0ZEdldEdyaWRJdGVtUm93SGVpZ2h0KGNvbmZpZy5sYXlvdXQsIGNvbmZpZy5oZWlnaHQgPz8gZ3JpZEVsZW1DbGllbnRSZWN0LmhlaWdodCwgY29uZmlnLmdhcClcclxuICAgICAgICA6IGNvbmZpZy5yb3dIZWlnaHQ7XHJcblxyXG4gICAgLy8gR2V0IGxheW91dCBpdGVtIHBvc2l0aW9uXHJcbiAgICBjb25zdCBsYXlvdXRJdGVtOiBLdGRHcmlkTGF5b3V0SXRlbSA9IHtcclxuICAgICAgICAuLi5kcmFnZ2luZ0VsZW1QcmV2SXRlbSxcclxuICAgICAgICB4OiBzY3JlZW5YVG9HcmlkWChncmlkUmVsWFBvcyAsIGNvbmZpZy5jb2xzLCBncmlkRWxlbUNsaWVudFJlY3Qud2lkdGgsIGNvbmZpZy5nYXApLFxyXG4gICAgICAgIHk6IHNjcmVlbllUb0dyaWRZKGdyaWRSZWxZUG9zLCByb3dIZWlnaHRJblBpeGVscywgZ3JpZEVsZW1DbGllbnRSZWN0LmhlaWdodCwgY29uZmlnLmdhcClcclxuICAgIH07XHJcblxyXG4gICAgLy8gQ29ycmVjdCB0aGUgdmFsdWVzIGlmIHRoZXkgb3ZlcmZsb3csIHNpbmNlICdtb3ZlRWxlbWVudCcgZnVuY3Rpb24gZG9lc24ndCBkbyBpdFxyXG4gICAgbGF5b3V0SXRlbS54ID0gTWF0aC5tYXgoMCwgbGF5b3V0SXRlbS54KTtcclxuICAgIGxheW91dEl0ZW0ueSA9IE1hdGgubWF4KDAsIGxheW91dEl0ZW0ueSk7XHJcbiAgICBpZiAobGF5b3V0SXRlbS54ICsgbGF5b3V0SXRlbS53ID4gY29uZmlnLmNvbHMpIHtcclxuICAgICAgICBsYXlvdXRJdGVtLnggPSBNYXRoLm1heCgwLCBjb25maWcuY29scyAtIGxheW91dEl0ZW0udyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUGFyc2UgdG8gTGF5b3V0SXRlbSBhcnJheSBkYXRhIGluIG9yZGVyIHRvIHVzZSAncmVhY3QuZ3JpZC1sYXlvdXQnIHV0aWxzXHJcbiAgICBjb25zdCBsYXlvdXRJdGVtczogTGF5b3V0SXRlbVtdID0gY29uZmlnLmxheW91dDtcclxuICAgIGNvbnN0IGRyYWdnZWRMYXlvdXRJdGVtOiBMYXlvdXRJdGVtID0gbGF5b3V0SXRlbXMuZmluZChpdGVtID0+IGl0ZW0uaWQgPT09IGdyaWRJdGVtSWQpITtcclxuXHJcbiAgICBsZXQgbmV3TGF5b3V0SXRlbXM6IExheW91dEl0ZW1bXSA9IG1vdmVFbGVtZW50KFxyXG4gICAgICAgIGxheW91dEl0ZW1zLFxyXG4gICAgICAgIGRyYWdnZWRMYXlvdXRJdGVtLFxyXG4gICAgICAgIGxheW91dEl0ZW0ueCxcclxuICAgICAgICBsYXlvdXRJdGVtLnksXHJcbiAgICAgICAgdHJ1ZSxcclxuICAgICAgICBjb25maWcucHJldmVudENvbGxpc2lvbixcclxuICAgICAgICBjb21wYWN0aW9uVHlwZSxcclxuICAgICAgICBjb25maWcuY29sc1xyXG4gICAgKTtcclxuXHJcbiAgICBuZXdMYXlvdXRJdGVtcyA9IGNvbXBhY3QobmV3TGF5b3V0SXRlbXMsIGNvbXBhY3Rpb25UeXBlLCBjb25maWcuY29scyk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsYXlvdXQ6IG5ld0xheW91dEl0ZW1zLFxyXG4gICAgICAgIGRyYWdnZWRJdGVtUG9zOiB7XHJcbiAgICAgICAgICAgIHRvcDogZ3JpZFJlbFlQb3MsXHJcbiAgICAgICAgICAgIGxlZnQ6IGdyaWRSZWxYUG9zLFxyXG4gICAgICAgICAgICB3aWR0aDogZHJhZ0VsZW1DbGllbnRSZWN0LndpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQ6IGRyYWdFbGVtQ2xpZW50UmVjdC5oZWlnaHQsXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogR2l2ZW4gdGhlIGdyaWQgY29uZmlnICYgbGF5b3V0IGRhdGEgYW5kIHRoZSBjdXJyZW50IGRyYWcgcG9zaXRpb24gJiBpbmZvcm1hdGlvbiwgcmV0dXJucyB0aGUgY29ycmVzcG9uZGluZyBsYXlvdXQgYW5kIGRyYWcgaXRlbSBwb3NpdGlvblxyXG4gKiBAcGFyYW0gZ3JpZEl0ZW0gZ3JpZCBpdGVtIHRoYXQgaXMgYmVlbiBkcmFnZ2VkXHJcbiAqIEBwYXJhbSBjb25maWcgY3VycmVudCBncmlkIGNvbmZpZ3VyYXRpb25cclxuICogQHBhcmFtIGNvbXBhY3Rpb25UeXBlIHR5cGUgb2YgY29tcGFjdGlvbiB0aGF0IHdpbGwgYmUgcGVyZm9ybWVkXHJcbiAqIEBwYXJhbSBkcmFnZ2luZ0RhdGEgY29udGFpbnMgYWxsIHRoZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZHJhZ1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGt0ZEdyaWRJdGVtc0RyYWdnaW5nKGdyaWRJdGVtczogS3RkR3JpZEl0ZW1Db21wb25lbnRbXSwgY29uZmlnOiBLdGRHcmlkQ2ZnLCBjb21wYWN0aW9uVHlwZTogQ29tcGFjdFR5cGUsIGRyYWdnaW5nRGF0YTogS3RkRHJhZ2dpbmdNdWx0aXBsZURhdGEpOiB7IGxheW91dDogS3RkR3JpZExheW91dEl0ZW1bXTsgZHJhZ2dlZEl0ZW1Qb3M6ICBLdGREaWN0aW9uYXJ5PEt0ZEdyaWRJdGVtUmVjdD4gfSB7XHJcbiAgICBjb25zdCB7cG9pbnRlckRvd25FdmVudCwgcG9pbnRlckRyYWdFdmVudCwgZ3JpZEVsZW1DbGllbnRSZWN0LCBkcmFnRWxlbWVudHNDbGllbnRSZWN0LCBzY3JvbGxEaWZmZXJlbmNlfSA9IGRyYWdnaW5nRGF0YTtcclxuXHJcbiAgICBjb25zdCBkcmFnZ2luZ0VsZW1QcmV2SXRlbTogS3RkRGljdGlvbmFyeTxLdGRHcmlkTGF5b3V0SXRlbT4gPSB7fVxyXG4gICAgZ3JpZEl0ZW1zLmZvckVhY2goZ3JpZEl0ZW09PiB7XHJcbiAgICAgICAgZHJhZ2dpbmdFbGVtUHJldkl0ZW1bZ3JpZEl0ZW0uaWRdID0gY29uZmlnLmxheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpIVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgY2xpZW50U3RhcnRYID0ga3RkUG9pbnRlckNsaWVudFgocG9pbnRlckRvd25FdmVudCk7XHJcbiAgICBjb25zdCBjbGllbnRTdGFydFkgPSBrdGRQb2ludGVyQ2xpZW50WShwb2ludGVyRG93bkV2ZW50KTtcclxuICAgIGNvbnN0IGNsaWVudFggPSBrdGRQb2ludGVyQ2xpZW50WChwb2ludGVyRHJhZ0V2ZW50KTtcclxuICAgIGNvbnN0IGNsaWVudFkgPSBrdGRQb2ludGVyQ2xpZW50WShwb2ludGVyRHJhZ0V2ZW50KTtcclxuXHJcbiAgICAvLyBHcmlkIGVsZW1lbnQgcG9zaXRpb25zIHRha2luZyBpbnRvIGFjY291bnQgdGhlIHBvc3NpYmxlIHNjcm9sbCB0b3RhbCBkaWZmZXJlbmNlIGZyb20gdGhlIGJlZ2lubmluZy5cclxuICAgIGNvbnN0IGdyaWRFbGVtZW50TGVmdFBvc2l0aW9uID0gZ3JpZEVsZW1DbGllbnRSZWN0LmxlZnQgKyBzY3JvbGxEaWZmZXJlbmNlLmxlZnQ7XHJcbiAgICBjb25zdCBncmlkRWxlbWVudFRvcFBvc2l0aW9uID0gZ3JpZEVsZW1DbGllbnRSZWN0LnRvcCArIHNjcm9sbERpZmZlcmVuY2UudG9wO1xyXG5cclxuICAgIGNvbnN0IHJvd0hlaWdodEluUGl4ZWxzID0gY29uZmlnLnJvd0hlaWdodCA9PT0gJ2ZpdCdcclxuICAgICAgICA/IGt0ZEdldEdyaWRJdGVtUm93SGVpZ2h0KGNvbmZpZy5sYXlvdXQsIGNvbmZpZy5oZWlnaHQgPz8gZ3JpZEVsZW1DbGllbnRSZWN0LmhlaWdodCwgY29uZmlnLmdhcClcclxuICAgICAgICA6IGNvbmZpZy5yb3dIZWlnaHQ7XHJcblxyXG4gICAgY29uc3QgbGF5b3V0SXRlbXNUb01vdmU6ICBLdGREaWN0aW9uYXJ5PEt0ZEdyaWRMYXlvdXRJdGVtPj17fTtcclxuICAgIGNvbnN0IGdyaWRSZWxQb3M6IEt0ZERpY3Rpb25hcnk8e3g6bnVtYmVyLHk6bnVtYmVyfT49e31cclxuICAgIGdyaWRJdGVtcy5mb3JFYWNoKChncmlkSXRlbTogS3RkR3JpZEl0ZW1Db21wb25lbnQpPT57XHJcbiAgICAgICAgY29uc3Qgb2Zmc2V0WCA9IGNsaWVudFN0YXJ0WCAtIGRyYWdFbGVtZW50c0NsaWVudFJlY3RbZ3JpZEl0ZW0uaWRdLmxlZnQ7XHJcbiAgICAgICAgY29uc3Qgb2Zmc2V0WSA9IGNsaWVudFN0YXJ0WSAtIGRyYWdFbGVtZW50c0NsaWVudFJlY3RbZ3JpZEl0ZW0uaWRdLnRvcDtcclxuICAgICAgICAvLyBDYWxjdWxhdGUgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIGdyaWQgZWxlbWVudC5cclxuICAgICAgICBncmlkUmVsUG9zW2dyaWRJdGVtLmlkXT17XHJcbiAgICAgICAgICAgIHg6IGNsaWVudFggLSBncmlkRWxlbWVudExlZnRQb3NpdGlvbiAtIG9mZnNldFgsXHJcbiAgICAgICAgICAgIHk6Y2xpZW50WSAtIGdyaWRFbGVtZW50VG9wUG9zaXRpb24gLSBvZmZzZXRZXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gR2V0IGxheW91dCBpdGVtIHBvc2l0aW9uXHJcbiAgICAgICAgbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdID0ge1xyXG4gICAgICAgICAgICAuLi5kcmFnZ2luZ0VsZW1QcmV2SXRlbVtncmlkSXRlbS5pZF0sXHJcbiAgICAgICAgICAgIHg6IHNjcmVlblhUb0dyaWRYKGdyaWRSZWxQb3NbZ3JpZEl0ZW0uaWRdLnggLCBjb25maWcuY29scywgZ3JpZEVsZW1DbGllbnRSZWN0LndpZHRoLCBjb25maWcuZ2FwKSxcclxuICAgICAgICAgICAgeTogc2NyZWVuWVRvR3JpZFkoZ3JpZFJlbFBvc1tncmlkSXRlbS5pZF0ueSwgcm93SGVpZ2h0SW5QaXhlbHMsIGdyaWRFbGVtQ2xpZW50UmVjdC5oZWlnaHQsIGNvbmZpZy5nYXApXHJcbiAgICAgICAgfTtcclxuICAgICAgICAvLyBDb3JyZWN0IHRoZSB2YWx1ZXMgaWYgdGhleSBvdmVyZmxvdywgc2luY2UgJ21vdmVFbGVtZW50JyBmdW5jdGlvbiBkb2Vzbid0IGRvIGl0XHJcbiAgICAgICAgbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLnggPSBNYXRoLm1heCgwLCBsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueCk7XHJcbiAgICAgICAgbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLnkgPSBNYXRoLm1heCgwLCBsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueSk7XHJcbiAgICAgICAgaWYgKGxheW91dEl0ZW1zVG9Nb3ZlW2dyaWRJdGVtLmlkXS54ICsgbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLncgPiBjb25maWcuY29scykge1xyXG4gICAgICAgICAgICBsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueCA9IE1hdGgubWF4KDAsIGNvbmZpZy5jb2xzIC0gbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLncpO1xyXG4gICAgICAgIH1cclxuICAgIH0pXHJcblxyXG5cclxuXHJcbiAgICAvLyBQYXJzZSB0byBMYXlvdXRJdGVtIGFycmF5IGRhdGEgaW4gb3JkZXIgdG8gdXNlICdyZWFjdC5ncmlkLWxheW91dCcgdXRpbHNcclxuICAgIGNvbnN0IGxheW91dEl0ZW1zOiBMYXlvdXRJdGVtW10gPSBjb25maWcubGF5b3V0O1xyXG4gICAgY29uc3QgZHJhZ2dlZExheW91dEl0ZW06IHtcclxuICAgICAgICBsOiBMYXlvdXRJdGVtLFxyXG4gICAgICAgIHg6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQsXHJcbiAgICAgICAgeTogbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZFxyXG4gICAgfVtdID0gZ3JpZEl0ZW1zLm1hcCgoZ3JpZEl0ZW06S3RkR3JpZEl0ZW1Db21wb25lbnQpPT57XHJcbiAgICAgICAgY29uc3QgZHJhZ2dlZExheW91dEl0ZW06IExheW91dEl0ZW0gPSBsYXlvdXRJdGVtcy5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpITtcclxuICAgICAgICBkcmFnZ2VkTGF5b3V0SXRlbS5zdGF0aWMgPSB0cnVlO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGw6IGRyYWdnZWRMYXlvdXRJdGVtLFxyXG4gICAgICAgICAgICB4OiBsYXlvdXRJdGVtc1RvTW92ZVtncmlkSXRlbS5pZF0ueCxcclxuICAgICAgICAgICAgeTogbGF5b3V0SXRlbXNUb01vdmVbZ3JpZEl0ZW0uaWRdLnlcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBsZXQgbmV3TGF5b3V0SXRlbXM6IExheW91dEl0ZW1bXSA9IG1vdmVFbGVtZW50cyhcclxuICAgICAgICBsYXlvdXRJdGVtcyxcclxuICAgICAgICBkcmFnZ2VkTGF5b3V0SXRlbSxcclxuICAgICAgICB0cnVlLFxyXG4gICAgICAgIGNvbXBhY3Rpb25UeXBlLFxyXG4gICAgICAgIGNvbmZpZy5jb2xzLFxyXG4gICAgKTtcclxuXHJcbiAgICBuZXdMYXlvdXRJdGVtcyA9IGNvbXBhY3QobmV3TGF5b3V0SXRlbXMsIGNvbXBhY3Rpb25UeXBlLCBjb25maWcuY29scyk7XHJcbiAgICBncmlkSXRlbXMuZm9yRWFjaChncmlkSXRlbT0+bmV3TGF5b3V0SXRlbXMuZmluZChsYXlvdXRJdGVtPT5sYXlvdXRJdGVtLmlkID09PSBncmlkSXRlbS5pZCkhLnN0YXRpYyA9IGZhbHNlKTtcclxuICAgIG5ld0xheW91dEl0ZW1zID0gY29tcGFjdChuZXdMYXlvdXRJdGVtcywgY29tcGFjdGlvblR5cGUsIGNvbmZpZy5jb2xzKTtcclxuXHJcbiAgICBjb25zdCBkcmFnZ2VkSXRlbVBvczogS3RkRGljdGlvbmFyeTxLdGRHcmlkSXRlbVJlY3Q+PXt9O1xyXG4gICAgZ3JpZEl0ZW1zLmZvckVhY2goZ3JpZEl0ZW09PlxyXG4gICAgICAgIGRyYWdnZWRJdGVtUG9zW2dyaWRJdGVtLmlkXT17XHJcbiAgICAgICAgICAgIGxlZnQ6IGdyaWRSZWxQb3NbZ3JpZEl0ZW0uaWRdLngsXHJcbiAgICAgICAgICAgIHRvcDogZ3JpZFJlbFBvc1tncmlkSXRlbS5pZF0ueSxcclxuICAgICAgICAgICAgd2lkdGg6IGRyYWdFbGVtZW50c0NsaWVudFJlY3RbZ3JpZEl0ZW0uaWRdLndpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQ6IGRyYWdFbGVtZW50c0NsaWVudFJlY3RbZ3JpZEl0ZW0uaWRdLmhlaWdodCxcclxuICAgICAgICB9XHJcbiAgICApO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbGF5b3V0OiBuZXdMYXlvdXRJdGVtcyxcclxuICAgICAgICBkcmFnZ2VkSXRlbVBvc1xyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdpdmVuIHRoZSBncmlkIGNvbmZpZyAmIGxheW91dCBkYXRhIGFuZCB0aGUgY3VycmVudCBkcmFnIHBvc2l0aW9uICYgaW5mb3JtYXRpb24sIHJldHVybnMgdGhlIGNvcnJlc3BvbmRpbmcgbGF5b3V0IGFuZCBkcmFnIGl0ZW0gcG9zaXRpb25cclxuICogQHBhcmFtIGdyaWRJdGVtIGdyaWQgaXRlbSB0aGF0IGlzIGJlZW4gZHJhZ2dlZFxyXG4gKiBAcGFyYW0gY29uZmlnIGN1cnJlbnQgZ3JpZCBjb25maWd1cmF0aW9uXHJcbiAqIEBwYXJhbSBjb21wYWN0aW9uVHlwZSB0eXBlIG9mIGNvbXBhY3Rpb24gdGhhdCB3aWxsIGJlIHBlcmZvcm1lZFxyXG4gKiBAcGFyYW0gZHJhZ2dpbmdEYXRhIGNvbnRhaW5zIGFsbCB0aGUgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGRyYWdcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBrdGRHcmlkSXRlbVJlc2l6aW5nKGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCwgY29uZmlnOiBLdGRHcmlkQ2ZnLCBjb21wYWN0aW9uVHlwZTogQ29tcGFjdFR5cGUsIGRyYWdnaW5nRGF0YTogS3RkRHJhZ2dpbmdEYXRhKTogeyBsYXlvdXQ6IEt0ZEdyaWRMYXlvdXRJdGVtW107IGRyYWdnZWRJdGVtUG9zOiBLdGRHcmlkSXRlbVJlY3QgfSB7XHJcbiAgICBjb25zdCB7cG9pbnRlckRvd25FdmVudCwgcG9pbnRlckRyYWdFdmVudCwgZ3JpZEVsZW1DbGllbnRSZWN0LCBkcmFnRWxlbUNsaWVudFJlY3QsIHNjcm9sbERpZmZlcmVuY2V9ID0gZHJhZ2dpbmdEYXRhO1xyXG4gICAgY29uc3QgZ3JpZEl0ZW1JZCA9IGdyaWRJdGVtLmlkO1xyXG5cclxuICAgIGNvbnN0IGNsaWVudFN0YXJ0WCA9IGt0ZFBvaW50ZXJDbGllbnRYKHBvaW50ZXJEb3duRXZlbnQpO1xyXG4gICAgY29uc3QgY2xpZW50U3RhcnRZID0ga3RkUG9pbnRlckNsaWVudFkocG9pbnRlckRvd25FdmVudCk7XHJcbiAgICBjb25zdCBjbGllbnRYID0ga3RkUG9pbnRlckNsaWVudFgocG9pbnRlckRyYWdFdmVudCk7XHJcbiAgICBjb25zdCBjbGllbnRZID0ga3RkUG9pbnRlckNsaWVudFkocG9pbnRlckRyYWdFdmVudCk7XHJcblxyXG4gICAgLy8gR2V0IHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIG1vdXNlRG93biBhbmQgdGhlIHBvc2l0aW9uICdyaWdodCcgb2YgdGhlIHJlc2l6ZSBlbGVtZW50LlxyXG4gICAgY29uc3QgcmVzaXplRWxlbU9mZnNldFggPSBkcmFnRWxlbUNsaWVudFJlY3Qud2lkdGggLSAoY2xpZW50U3RhcnRYIC0gZHJhZ0VsZW1DbGllbnRSZWN0LmxlZnQpO1xyXG4gICAgY29uc3QgcmVzaXplRWxlbU9mZnNldFkgPSBkcmFnRWxlbUNsaWVudFJlY3QuaGVpZ2h0IC0gKGNsaWVudFN0YXJ0WSAtIGRyYWdFbGVtQ2xpZW50UmVjdC50b3ApO1xyXG5cclxuICAgIGNvbnN0IGRyYWdnaW5nRWxlbVByZXZJdGVtID0gY29uZmlnLmxheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW1JZCkhO1xyXG4gICAgY29uc3Qgd2lkdGggPSBjbGllbnRYICsgcmVzaXplRWxlbU9mZnNldFggLSAoZHJhZ0VsZW1DbGllbnRSZWN0LmxlZnQgKyBzY3JvbGxEaWZmZXJlbmNlLmxlZnQpO1xyXG4gICAgY29uc3QgaGVpZ2h0ID0gY2xpZW50WSArIHJlc2l6ZUVsZW1PZmZzZXRZIC0gKGRyYWdFbGVtQ2xpZW50UmVjdC50b3AgKyBzY3JvbGxEaWZmZXJlbmNlLnRvcCk7XHJcblxyXG4gICAgY29uc3Qgcm93SGVpZ2h0SW5QaXhlbHMgPSBjb25maWcucm93SGVpZ2h0ID09PSAnZml0J1xyXG4gICAgICAgID8ga3RkR2V0R3JpZEl0ZW1Sb3dIZWlnaHQoY29uZmlnLmxheW91dCwgY29uZmlnLmhlaWdodCA/PyBncmlkRWxlbUNsaWVudFJlY3QuaGVpZ2h0LCBjb25maWcuZ2FwKVxyXG4gICAgICAgIDogY29uZmlnLnJvd0hlaWdodDtcclxuXHJcbiAgICAvLyBHZXQgbGF5b3V0IGl0ZW0gZ3JpZCBwb3NpdGlvblxyXG4gICAgY29uc3QgbGF5b3V0SXRlbTogS3RkR3JpZExheW91dEl0ZW0gPSB7XHJcbiAgICAgICAgLi4uZHJhZ2dpbmdFbGVtUHJldkl0ZW0sXHJcbiAgICAgICAgdzogc2NyZWVuV2lkdGhUb0dyaWRXaWR0aCh3aWR0aCwgY29uZmlnLmNvbHMsIGdyaWRFbGVtQ2xpZW50UmVjdC53aWR0aCwgY29uZmlnLmdhcCksXHJcbiAgICAgICAgaDogc2NyZWVuSGVpZ2h0VG9HcmlkSGVpZ2h0KGhlaWdodCwgcm93SGVpZ2h0SW5QaXhlbHMsIGdyaWRFbGVtQ2xpZW50UmVjdC5oZWlnaHQsIGNvbmZpZy5nYXApXHJcbiAgICB9O1xyXG5cclxuICAgIGxheW91dEl0ZW0udyA9IGxpbWl0TnVtYmVyV2l0aGluUmFuZ2UobGF5b3V0SXRlbS53LCBncmlkSXRlbS5taW5XID8/IGxheW91dEl0ZW0ubWluVywgZ3JpZEl0ZW0ubWF4VyA/PyBsYXlvdXRJdGVtLm1heFcpO1xyXG4gICAgbGF5b3V0SXRlbS5oID0gbGltaXROdW1iZXJXaXRoaW5SYW5nZShsYXlvdXRJdGVtLmgsIGdyaWRJdGVtLm1pbkggPz8gbGF5b3V0SXRlbS5taW5ILCBncmlkSXRlbS5tYXhIID8/IGxheW91dEl0ZW0ubWF4SCk7XHJcblxyXG4gICAgaWYgKGxheW91dEl0ZW0ueCArIGxheW91dEl0ZW0udyA+IGNvbmZpZy5jb2xzKSB7XHJcbiAgICAgICAgbGF5b3V0SXRlbS53ID0gTWF0aC5tYXgoMSwgY29uZmlnLmNvbHMgLSBsYXlvdXRJdGVtLngpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChjb25maWcucHJldmVudENvbGxpc2lvbikge1xyXG4gICAgICAgIGNvbnN0IG1heFcgPSBsYXlvdXRJdGVtLnc7XHJcbiAgICAgICAgY29uc3QgbWF4SCA9IGxheW91dEl0ZW0uaDtcclxuXHJcbiAgICAgICAgbGV0IGNvbGxpZGluZyA9IGhhc0NvbGxpc2lvbihjb25maWcubGF5b3V0LCBsYXlvdXRJdGVtKTtcclxuICAgICAgICBsZXQgc2hydW5rRGltZW5zaW9uOiAndycgfCAnaCcgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIHdoaWxlIChjb2xsaWRpbmcpIHtcclxuICAgICAgICAgICAgc2hydW5rRGltZW5zaW9uID0gZ2V0RGltZW5zaW9uVG9TaHJpbmsobGF5b3V0SXRlbSwgc2hydW5rRGltZW5zaW9uKTtcclxuICAgICAgICAgICAgbGF5b3V0SXRlbVtzaHJ1bmtEaW1lbnNpb25dLS07XHJcbiAgICAgICAgICAgIGNvbGxpZGluZyA9IGhhc0NvbGxpc2lvbihjb25maWcubGF5b3V0LCBsYXlvdXRJdGVtKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChzaHJ1bmtEaW1lbnNpb24gPT09ICd3Jykge1xyXG4gICAgICAgICAgICBsYXlvdXRJdGVtLmggPSBtYXhIO1xyXG5cclxuICAgICAgICAgICAgY29sbGlkaW5nID0gaGFzQ29sbGlzaW9uKGNvbmZpZy5sYXlvdXQsIGxheW91dEl0ZW0pO1xyXG4gICAgICAgICAgICB3aGlsZSAoY29sbGlkaW5nKSB7XHJcbiAgICAgICAgICAgICAgICBsYXlvdXRJdGVtLmgtLTtcclxuICAgICAgICAgICAgICAgIGNvbGxpZGluZyA9IGhhc0NvbGxpc2lvbihjb25maWcubGF5b3V0LCBsYXlvdXRJdGVtKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoc2hydW5rRGltZW5zaW9uID09PSAnaCcpIHtcclxuICAgICAgICAgICAgbGF5b3V0SXRlbS53ID0gbWF4VztcclxuXHJcbiAgICAgICAgICAgIGNvbGxpZGluZyA9IGhhc0NvbGxpc2lvbihjb25maWcubGF5b3V0LCBsYXlvdXRJdGVtKTtcclxuICAgICAgICAgICAgd2hpbGUgKGNvbGxpZGluZykge1xyXG4gICAgICAgICAgICAgICAgbGF5b3V0SXRlbS53LS07XHJcbiAgICAgICAgICAgICAgICBjb2xsaWRpbmcgPSBoYXNDb2xsaXNpb24oY29uZmlnLmxheW91dCwgbGF5b3V0SXRlbSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG5ld0xheW91dEl0ZW1zOiBMYXlvdXRJdGVtW10gPSBjb25maWcubGF5b3V0Lm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICAgIHJldHVybiBpdGVtLmlkID09PSBncmlkSXRlbUlkID8gbGF5b3V0SXRlbSA6IGl0ZW07XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxheW91dDogY29tcGFjdChuZXdMYXlvdXRJdGVtcywgY29tcGFjdGlvblR5cGUsIGNvbmZpZy5jb2xzKSxcclxuICAgICAgICBkcmFnZ2VkSXRlbVBvczoge1xyXG4gICAgICAgICAgICB0b3A6IGRyYWdFbGVtQ2xpZW50UmVjdC50b3AgLSBncmlkRWxlbUNsaWVudFJlY3QudG9wLFxyXG4gICAgICAgICAgICBsZWZ0OiBkcmFnRWxlbUNsaWVudFJlY3QubGVmdCAtIGdyaWRFbGVtQ2xpZW50UmVjdC5sZWZ0LFxyXG4gICAgICAgICAgICB3aWR0aCxcclxuICAgICAgICAgICAgaGVpZ2h0LFxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhc0NvbGxpc2lvbihsYXlvdXQ6IExheW91dCwgbGF5b3V0SXRlbTogTGF5b3V0SXRlbSk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuICEhZ2V0Rmlyc3RDb2xsaXNpb24obGF5b3V0LCBsYXlvdXRJdGVtKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0RGltZW5zaW9uVG9TaHJpbmsobGF5b3V0SXRlbSwgbGFzdFNocnVuayk6ICd3JyB8ICdoJyB7XHJcbiAgICBpZiAobGF5b3V0SXRlbS5oIDw9IDEpIHtcclxuICAgICAgICByZXR1cm4gJ3cnO1xyXG4gICAgfVxyXG4gICAgaWYgKGxheW91dEl0ZW0udyA8PSAxKSB7XHJcbiAgICAgICAgcmV0dXJuICdoJztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbGFzdFNocnVuayA9PT0gJ3cnID8gJ2gnIDogJ3cnO1xyXG59XHJcblxyXG4vKipcclxuICogR2l2ZW4gdGhlIGN1cnJlbnQgbnVtYmVyIGFuZCBtaW4vbWF4IHZhbHVlcywgcmV0dXJucyB0aGUgbnVtYmVyIHdpdGhpbiB0aGUgcmFuZ2VcclxuICogQHBhcmFtIG51bWJlciBjYW4gYmUgYW55IG51bWVyaWMgdmFsdWVcclxuICogQHBhcmFtIG1pbiBtaW5pbXVtIHZhbHVlIG9mIHJhbmdlXHJcbiAqIEBwYXJhbSBtYXggbWF4aW11bSB2YWx1ZSBvZiByYW5nZVxyXG4gKi9cclxuZnVuY3Rpb24gbGltaXROdW1iZXJXaXRoaW5SYW5nZShudW06IG51bWJlciwgbWluOiBudW1iZXIgPSAxLCBtYXg6IG51bWJlciA9IEluZmluaXR5KSB7XHJcbiAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgobnVtLCBtaW4gPCAxID8gMSA6IG1pbiksIG1heCk7XHJcbn1cclxuXHJcbi8qKiBSZXR1cm5zIHRydWUgaWYgYm90aCBpdGVtMSBhbmQgaXRlbTIgS3RkR3JpZExheW91dEl0ZW1zIGFyZSBlcXVpdmFsZW50LiAqL1xyXG5leHBvcnQgZnVuY3Rpb24ga3RkR3JpZEl0ZW1MYXlvdXRJdGVtQXJlRXF1YWwoaXRlbTE6IEt0ZEdyaWRMYXlvdXRJdGVtLCBpdGVtMjogS3RkR3JpZExheW91dEl0ZW0pOiBib29sZWFuIHtcclxuICAgIHJldHVybiBpdGVtMS5pZCA9PT0gaXRlbTIuaWRcclxuICAgICAgICAmJiBpdGVtMS54ID09PSBpdGVtMi54XHJcbiAgICAgICAgJiYgaXRlbTEueSA9PT0gaXRlbTIueVxyXG4gICAgICAgICYmIGl0ZW0xLncgPT09IGl0ZW0yLndcclxuICAgICAgICAmJiBpdGVtMS5oID09PSBpdGVtMi5oXHJcbn1cclxuIl19