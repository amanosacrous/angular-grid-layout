/**
 * IMPORTANT:
 * This utils are taken from the project: https://github.com/STRML/react-grid-layout.
 * The code should be as less modified as possible for easy maintenance.
 */
const DEBUG = false;
/**
 * Return the bottom coordinate of the layout.
 *
 * @param  {Array} layout Layout array.
 * @return {Number}       Bottom coordinate.
 */
export function bottom(layout) {
    let max = 0, bottomY;
    for (let i = 0, len = layout.length; i < len; i++) {
        bottomY = layout[i].y + layout[i].h;
        if (bottomY > max) {
            max = bottomY;
        }
    }
    return max;
}
export function cloneLayout(layout) {
    const newLayout = Array(layout.length);
    for (let i = 0, len = layout.length; i < len; i++) {
        newLayout[i] = cloneLayoutItem(layout[i]);
    }
    return newLayout;
}
// Fast path to cloning, since this is monomorphic
/** NOTE: This code has been modified from the original source */
export function cloneLayoutItem(layoutItem) {
    const clonedLayoutItem = {
        w: layoutItem.w,
        h: layoutItem.h,
        x: layoutItem.x,
        y: layoutItem.y,
        id: layoutItem.id,
        moved: !!layoutItem.moved,
        static: !!layoutItem.static,
    };
    if (layoutItem.minW !== undefined) {
        clonedLayoutItem.minW = layoutItem.minW;
    }
    if (layoutItem.maxW !== undefined) {
        clonedLayoutItem.maxW = layoutItem.maxW;
    }
    if (layoutItem.minH !== undefined) {
        clonedLayoutItem.minH = layoutItem.minH;
    }
    if (layoutItem.maxH !== undefined) {
        clonedLayoutItem.maxH = layoutItem.maxH;
    }
    // These can be null
    if (layoutItem.isDraggable !== undefined) {
        clonedLayoutItem.isDraggable = layoutItem.isDraggable;
    }
    if (layoutItem.isResizable !== undefined) {
        clonedLayoutItem.isResizable = layoutItem.isResizable;
    }
    return clonedLayoutItem;
}
/**
 * Given two layoutitems, check if they collide.
 */
export function collides(l1, l2) {
    if (l1.id === l2.id) {
        return false;
    } // same element
    if (l1.x + l1.w <= l2.x) {
        return false;
    } // l1 is left of l2
    if (l1.x >= l2.x + l2.w) {
        return false;
    } // l1 is right of l2
    if (l1.y + l1.h <= l2.y) {
        return false;
    } // l1 is above l2
    if (l1.y >= l2.y + l2.h) {
        return false;
    } // l1 is below l2
    return true; // boxes overlap
}
/**
 * Given a layout, compact it. This involves going down each y coordinate and removing gaps
 * between items.
 *
 * @param  {Array} layout Layout.
 * @param  {Boolean} verticalCompact Whether or not to compact the layout
 *   vertically.
 * @return {Array}       Compacted Layout.
 */
export function compact(layout, compactType, cols) {
    // Statics go in the compareWith array right away so items flow around them.
    const compareWith = getStatics(layout);
    // We go through the items by row and column.
    const sorted = sortLayoutItems(layout, compactType);
    // Holding for new items.
    const out = Array(layout.length);
    for (let i = 0, len = sorted.length; i < len; i++) {
        let l = cloneLayoutItem(sorted[i]);
        // Don't move static elements
        if (!l.static) {
            l = compactItem(compareWith, l, compactType, cols, sorted);
            // Add to comparison array. We only collide with items before this one.
            // Statics are already in this array.
            compareWith.push(l);
        }
        // Add to output array to make sure they still come out in the right order.
        out[layout.indexOf(sorted[i])] = l;
        // Clear moved flag, if it exists.
        l.moved = false;
    }
    return out;
}
const heightWidth = { x: 'w', y: 'h' };
/**
 * Before moving item down, it will check if the movement will cause collisions and move those items down before.
 */
function resolveCompactionCollision(layout, item, moveToCoord, axis) {
    const sizeProp = heightWidth[axis];
    item[axis] += 1;
    const itemIndex = layout
        .map(layoutItem => {
        return layoutItem.id;
    })
        .indexOf(item.id);
    // Go through each item we collide with.
    for (let i = itemIndex + 1; i < layout.length; i++) {
        const otherItem = layout[i];
        // Ignore static items
        if (otherItem.static) {
            continue;
        }
        // Optimization: we can break early if we know we're past this el
        // We can do this b/c it's a sorted layout
        if (otherItem[axis] > moveToCoord + item[sizeProp]) {
            break;
        }
        if (collides(item, otherItem)) {
            resolveCompactionCollision(layout, otherItem, moveToCoord + item[sizeProp], axis);
        }
    }
    item[axis] = moveToCoord;
}
/**
 * Compact an item in the layout.
 */
export function compactItem(compareWith, l, compactType, cols, fullLayout) {
    const compactV = compactType === 'vertical';
    const compactH = compactType === 'horizontal';
    if (compactV) {
        // Bottom 'y' possible is the bottom of the layout.
        // This allows you to do nice stuff like specify {y: Infinity}
        // This is here because the layout must be sorted in order to get the correct bottom `y`.
        l.y = Math.min(bottom(compareWith), l.y);
        // Move the element up as far as it can go without colliding.
        while (l.y > 0 && !getFirstCollision(compareWith, l)) {
            l.y--;
        }
    }
    else if (compactH) {
        // Move the element left as far as it can go without colliding.
        while (l.x > 0 && !getFirstCollision(compareWith, l)) {
            l.x--;
        }
    }
    // Move it down, and keep moving it down if it's colliding.
    let collides;
    while ((collides = getFirstCollision(compareWith, l))) {
        if (compactH) {
            resolveCompactionCollision(fullLayout, l, collides.x + collides.w, 'x');
        }
        else {
            resolveCompactionCollision(fullLayout, l, collides.y + collides.h, 'y');
        }
        // Since we can't grow without bounds horizontally, if we've overflown, let's move it down and try again.
        if (compactH && l.x + l.w > cols) {
            l.x = cols - l.w;
            l.y++;
            // ALso move element as left as much as we can (ktd-custom-change)
            while (l.x > 0 && !getFirstCollision(compareWith, l)) {
                l.x--;
            }
        }
    }
    // Ensure that there are no negative positions
    l.y = Math.max(l.y, 0);
    l.x = Math.max(l.x, 0);
    return l;
}
/**
 * Given a layout, make sure all elements fit within its bounds.
 *
 * @param  {Array} layout Layout array.
 * @param  {Number} bounds Number of columns.
 */
export function correctBounds(layout, bounds) {
    const collidesWith = getStatics(layout);
    for (let i = 0, len = layout.length; i < len; i++) {
        const l = layout[i];
        // Overflows right
        if (l.x + l.w > bounds.cols) {
            l.x = bounds.cols - l.w;
        }
        // Overflows left
        if (l.x < 0) {
            l.x = 0;
            l.w = bounds.cols;
        }
        if (!l.static) {
            collidesWith.push(l);
        }
        else {
            // If this is static and collides with other statics, we must move it down.
            // We have to do something nicer than just letting them overlap.
            while (getFirstCollision(collidesWith, l)) {
                l.y++;
            }
        }
    }
    return layout;
}
/**
 * Get a layout item by ID. Used so we can override later on if necessary.
 *
 * @param  {Array}  layout Layout array.
 * @param  {String} id     ID
 * @return {LayoutItem}    Item at ID.
 */
export function getLayoutItem(layout, id) {
    for (let i = 0, len = layout.length; i < len; i++) {
        if (layout[i].id === id) {
            return layout[i];
        }
    }
    return null;
}
/**
 * Returns the first item this layout collides with.
 * It doesn't appear to matter which order we approach this from, although
 * perhaps that is the wrong thing to do.
 *
 * @param  {Object} layoutItem Layout item.
 * @return {Object|undefined}  A colliding layout item, or undefined.
 */
export function getFirstCollision(layout, layoutItem) {
    for (let i = 0, len = layout.length; i < len; i++) {
        if (collides(layout[i], layoutItem)) {
            return layout[i];
        }
    }
    return null;
}
export function getAllCollisions(layout, layoutItem) {
    return layout.filter(l => collides(l, layoutItem));
}
/**
 * Get all static elements.
 * @param  {Array} layout Array of layout objects.
 * @return {Array}        Array of static layout items..
 */
export function getStatics(layout) {
    return layout.filter(l => l.static);
}
/**
 * Move an element. Responsible for doing cascading movements of other elements.
 *
 * @param  {Array}      layout            Full layout to modify.
 * @param  {LayoutItem} l                 element to move.
 * @param  {Number}     [x]               X position in grid units.
 * @param  {Number}     [y]               Y position in grid units.
 */
export function moveElement(layout, l, x, y, isUserAction, preventCollision, compactType, cols) {
    // If this is static and not explicitly enabled as draggable,
    // no move is possible, so we can short-circuit this immediately.
    if (l.static && l.isDraggable !== true) {
        return layout;
    }
    // Short-circuit if nothing to do.
    if (l.y === y && l.x === x) {
        return layout;
    }
    log(`Moving element ${l.id} to [${String(x)},${String(y)}] from [${l.x},${l.y}]`);
    const oldX = l.x;
    const oldY = l.y;
    // This is quite a bit faster than extending the object
    if (typeof x === 'number') {
        l.x = x;
    }
    if (typeof y === 'number') {
        l.y = y;
    }
    l.moved = true;
    // If this collides with anything, move it.
    // When doing this comparison, we have to sort the items we compare with
    // to ensure, in the case of multiple collisions, that we're getting the
    // nearest collision.
    let sorted = sortLayoutItems(layout, compactType);
    const movingUp = compactType === 'vertical' && typeof y === 'number'
        ? oldY >= y
        : compactType === 'horizontal' && typeof x === 'number'
            ? oldX >= x
            : false;
    if (movingUp) {
        sorted = sorted.reverse();
    }
    const collisions = getAllCollisions(sorted, l);
    // There was a collision; abort
    if (preventCollision && collisions.length) {
        log(`Collision prevented on ${l.id}, reverting.`);
        l.x = oldX;
        l.y = oldY;
        l.moved = false;
        return layout;
    }
    // Move each item that collides away from this element.
    for (let i = 0, len = collisions.length; i < len; i++) {
        const collision = collisions[i];
        log(`Resolving collision between ${l.id} at [${l.x},${l.y}] and ${collision.id} at [${collision.x},${collision.y}]`);
        // Short circuit so we can't infinite loop
        if (collision.moved) {
            continue;
        }
        // Don't move static items - we have to move *this* element away
        if (collision.static) {
            layout = moveElementAwayFromCollision(layout, collision, l, isUserAction, compactType, cols);
        }
        else {
            layout = moveElementAwayFromCollision(layout, l, collision, isUserAction, compactType, cols);
        }
    }
    return layout;
}
/**
 * This is where the magic needs to happen - given a collision, move an element away from the collision.
 * We attempt to move it up if there's room, otherwise it goes below.
 *
 * @param  {Array} layout            Full layout to modify.
 * @param  {LayoutItem} collidesWith Layout item we're colliding with.
 * @param  {LayoutItem} itemToMove   Layout item we're moving.
 */
export function moveElementAwayFromCollision(layout, collidesWith, itemToMove, isUserAction, compactType, cols) {
    const compactH = compactType === 'horizontal';
    // Compact vertically if not set to horizontal
    const compactV = compactType !== 'horizontal';
    const preventCollision = collidesWith.static; // we're already colliding (not for static items)
    // If there is enough space above the collision to put this element, move it there.
    // We only do this on the main collision as this can get funky in cascades and cause
    // unwanted swapping behavior.
    if (isUserAction) {
        // Reset isUserAction flag because we're not in the main collision anymore.
        isUserAction = false;
        // Make a mock item so we don't modify the item here, only modify in moveElement.
        const fakeItem = {
            x: compactH
                ? Math.max(collidesWith.x - itemToMove.w, 0)
                : itemToMove.x,
            y: compactV
                ? Math.max(collidesWith.y - itemToMove.h, 0)
                : itemToMove.y,
            w: itemToMove.w,
            h: itemToMove.h,
            id: '-1',
        };
        // No collision? If so, we can go up there; otherwise, we'll end up moving down as normal
        if (!getFirstCollision(layout, fakeItem)) {
            log(`Doing reverse collision on ${itemToMove.id} up to [${fakeItem.x},${fakeItem.y}].`);
            return moveElement(layout, itemToMove, compactH ? fakeItem.x : undefined, compactV ? fakeItem.y : undefined, isUserAction, preventCollision, compactType, cols);
        }
    }
    return moveElement(layout, itemToMove, compactH ? itemToMove.x + 1 : undefined, compactV ? itemToMove.y + 1 : undefined, isUserAction, preventCollision, compactType, cols);
}
/**
 * Helper to convert a number to a percentage string.
 *
 * @param  {Number} num Any number
 * @return {String}     That number as a percentage.
 */
export function perc(num) {
    return num * 100 + '%';
}
export function setTransform({ top, left, width, height }) {
    // Replace unitless items with px
    const translate = `translate(${left}px,${top}px)`;
    return {
        transform: translate,
        WebkitTransform: translate,
        MozTransform: translate,
        msTransform: translate,
        OTransform: translate,
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
    };
}
export function setTopLeft({ top, left, width, height }) {
    return {
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
    };
}
/**
 * Get layout items sorted from top left to right and down.
 *
 * @return {Array} Array of layout objects.
 * @return {Array}        Layout, sorted static items first.
 */
export function sortLayoutItems(layout, compactType) {
    if (compactType === 'horizontal') {
        return sortLayoutItemsByColRow(layout);
    }
    else {
        return sortLayoutItemsByRowCol(layout);
    }
}
export function sortLayoutItemsByRowCol(layout) {
    return [].concat(layout).sort(function (a, b) {
        if (a.y > b.y || (a.y === b.y && a.x > b.x)) {
            return 1;
        }
        else if (a.y === b.y && a.x === b.x) {
            // Without this, we can get different sort results in IE vs. Chrome/FF
            return 0;
        }
        return -1;
    });
}
export function sortLayoutItemsByColRow(layout) {
    return [].concat(layout).sort(function (a, b) {
        if (a.x > b.x || (a.x === b.x && a.y > b.y)) {
            return 1;
        }
        return -1;
    });
}
/**
 * Validate a layout. Throws errors.
 *
 * @param  {Array}  layout        Array of layout items.
 * @param  {String} [contextName] Context name for errors.
 * @throw  {Error}                Validation error.
 */
export function validateLayout(layout, contextName = 'Layout') {
    const subProps = ['x', 'y', 'w', 'h'];
    if (!Array.isArray(layout)) {
        throw new Error(contextName + ' must be an array!');
    }
    for (let i = 0, len = layout.length; i < len; i++) {
        const item = layout[i];
        for (let j = 0; j < subProps.length; j++) {
            if (typeof item[subProps[j]] !== 'number') {
                throw new Error('ReactGridLayout: ' +
                    contextName +
                    '[' +
                    i +
                    '].' +
                    subProps[j] +
                    ' must be a number!');
            }
        }
        if (item.id && typeof item.id !== 'string') {
            throw new Error('ReactGridLayout: ' +
                contextName +
                '[' +
                i +
                '].i must be a string!');
        }
        if (item.static !== undefined && typeof item.static !== 'boolean') {
            throw new Error('ReactGridLayout: ' +
                contextName +
                '[' +
                i +
                '].static must be a boolean!');
        }
    }
}
// Flow can't really figure this out, so we just use Object
export function autoBindHandlers(el, fns) {
    fns.forEach(key => (el[key] = el[key].bind(el)));
}
function log(...args) {
    if (!DEBUG) {
        return;
    }
    // eslint-disable-next-line no-console
    console.log(...args);
}
export const noop = () => { };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhY3QtZ3JpZC1sYXlvdXQudXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvdXRpbHMvcmVhY3QtZ3JpZC1sYXlvdXQudXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQXFFSCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUM7QUFFcEI7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsTUFBTSxDQUFDLE1BQWM7SUFDakMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUNQLE9BQU8sQ0FBQztJQUNaLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0MsT0FBTyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQyxJQUFJLE9BQU8sR0FBRyxHQUFHLEVBQUU7WUFDZixHQUFHLEdBQUcsT0FBTyxDQUFDO1NBQ2pCO0tBQ0o7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNmLENBQUM7QUFFRCxNQUFNLFVBQVUsV0FBVyxDQUFDLE1BQWM7SUFDdEMsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQy9DLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDN0M7SUFDRCxPQUFPLFNBQVMsQ0FBQztBQUNyQixDQUFDO0FBRUQs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TyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckQsQ0FBQztBQUVELFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSTtJQUNoQixJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1IsT0FBTztLQUNWO0lBQ0Qsc0NBQXNDO0lBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUN6QixDQUFDO0FBRUQsTUFBTSxDQUFDLE1BQU0sSUFBSSxHQUFHLEdBQUcsRUFBRSxHQUFFLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBJTVBPUlRBTlQ6XHJcbiAqIFRoaXMgdXRpbHMgYXJlIHRha2VuIGZyb20gdGhlIHByb2plY3Q6IGh0dHBzOi8vZ2l0aHViLmNvbS9TVFJNTC9yZWFjdC1ncmlkLWxheW91dC5cclxuICogVGhlIGNvZGUgc2hvdWxkIGJlIGFzIGxlc3MgbW9kaWZpZWQgYXMgcG9zc2libGUgZm9yIGVhc3kgbWFpbnRlbmFuY2UuXHJcbiAqL1xyXG5cclxuLy8gRGlzYWJsZSBsaW50IHNpbmNlIHdlIGRvbid0IHdhbnQgdG8gbW9kaWZ5IHRoaXMgY29kZVxyXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xyXG5leHBvcnQgdHlwZSBMYXlvdXRJdGVtID0ge1xyXG4gICAgdzogbnVtYmVyO1xyXG4gICAgaDogbnVtYmVyO1xyXG4gICAgeDogbnVtYmVyO1xyXG4gICAgeTogbnVtYmVyO1xyXG4gICAgaWQ6IHN0cmluZztcclxuICAgIG1pblc/OiBudW1iZXI7XHJcbiAgICBtaW5IPzogbnVtYmVyO1xyXG4gICAgbWF4Vz86IG51bWJlcjtcclxuICAgIG1heEg/OiBudW1iZXI7XHJcbiAgICBtb3ZlZD86IGJvb2xlYW47XHJcbiAgICBzdGF0aWM/OiBib29sZWFuO1xyXG4gICAgaXNEcmFnZ2FibGU/OiBib29sZWFuIHwgbnVsbCB8IHVuZGVmaW5lZDtcclxuICAgIGlzUmVzaXphYmxlPzogYm9vbGVhbiB8IG51bGwgfCB1bmRlZmluZWQ7XHJcbn07XHJcbmV4cG9ydCB0eXBlIExheW91dCA9IEFycmF5PExheW91dEl0ZW0+O1xyXG5leHBvcnQgdHlwZSBQb3NpdGlvbiA9IHtcclxuICAgIGxlZnQ6IG51bWJlcjtcclxuICAgIHRvcDogbnVtYmVyO1xyXG4gICAgd2lkdGg6IG51bWJlcjtcclxuICAgIGhlaWdodDogbnVtYmVyO1xyXG59O1xyXG5leHBvcnQgdHlwZSBSZWFjdERyYWdnYWJsZUNhbGxiYWNrRGF0YSA9IHtcclxuICAgIG5vZGU6IEhUTUxFbGVtZW50O1xyXG4gICAgeD86IG51bWJlcjtcclxuICAgIHk/OiBudW1iZXI7XHJcbiAgICBkZWx0YVg6IG51bWJlcjtcclxuICAgIGRlbHRhWTogbnVtYmVyO1xyXG4gICAgbGFzdFg/OiBudW1iZXI7XHJcbiAgICBsYXN0WT86IG51bWJlcjtcclxufTtcclxuXHJcbmV4cG9ydCB0eXBlIFBhcnRpYWxQb3NpdGlvbiA9IHsgbGVmdDogbnVtYmVyOyB0b3A6IG51bWJlciB9O1xyXG5leHBvcnQgdHlwZSBEcm9wcGluZ1Bvc2l0aW9uID0geyB4OiBudW1iZXI7IHk6IG51bWJlcjsgZTogRXZlbnQgfTtcclxuZXhwb3J0IHR5cGUgU2l6ZSA9IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfTtcclxuZXhwb3J0IHR5cGUgR3JpZERyYWdFdmVudCA9IHtcclxuICAgIGU6IEV2ZW50O1xyXG4gICAgbm9kZTogSFRNTEVsZW1lbnQ7XHJcbiAgICBuZXdQb3NpdGlvbjogUGFydGlhbFBvc2l0aW9uO1xyXG59O1xyXG5leHBvcnQgdHlwZSBHcmlkUmVzaXplRXZlbnQgPSB7IGU6IEV2ZW50OyBub2RlOiBIVE1MRWxlbWVudDsgc2l6ZTogU2l6ZSB9O1xyXG5leHBvcnQgdHlwZSBEcmFnT3ZlckV2ZW50ID0gTW91c2VFdmVudCAmIHtcclxuICAgIG5hdGl2ZUV2ZW50OiB7XHJcbiAgICAgICAgbGF5ZXJYOiBudW1iZXI7XHJcbiAgICAgICAgbGF5ZXJZOiBudW1iZXI7XHJcbiAgICAgICAgdGFyZ2V0OiB7XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZTogU3RyaW5nO1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG59O1xyXG5cclxuLy90eXBlIFJFbCA9IFJlYWN0RWxlbWVudDxhbnk+O1xyXG4vL2V4cG9ydCB0eXBlIFJlYWN0Q2hpbGRyZW4gPSBSZWFjdENoaWxkcmVuQXJyYXk8UkVsPjtcclxuXHJcbi8vIEFsbCBjYWxsYmFja3MgYXJlIG9mIHRoZSBzaWduYXR1cmUgKGxheW91dCwgb2xkSXRlbSwgbmV3SXRlbSwgcGxhY2Vob2xkZXIsIGUpLlxyXG5leHBvcnQgdHlwZSBFdmVudENhbGxiYWNrID0gKFxyXG4gICAgYXJnMDogTGF5b3V0LFxyXG4gICAgb2xkSXRlbTogTGF5b3V0SXRlbSB8IG51bGwgfCB1bmRlZmluZWQsXHJcbiAgICBuZXdJdGVtOiBMYXlvdXRJdGVtIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgIHBsYWNlaG9sZGVyOiBMYXlvdXRJdGVtIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgIGFyZzQ6IEV2ZW50LFxyXG4gICAgYXJnNTogSFRNTEVsZW1lbnQgfCBudWxsIHwgdW5kZWZpbmVkLFxyXG4pID0+IHZvaWQ7XHJcbmV4cG9ydCB0eXBlIENvbXBhY3RUeXBlID0gKCdob3Jpem9udGFsJyB8ICd2ZXJ0aWNhbCcpIHwgbnVsbCB8IHVuZGVmaW5lZDtcclxuXHJcbmNvbnN0IERFQlVHID0gZmFsc2U7XHJcblxyXG4vKipcclxuICogUmV0dXJuIHRoZSBib3R0b20gY29vcmRpbmF0ZSBvZiB0aGUgbGF5b3V0LlxyXG4gKlxyXG4gKiBAcGFyYW0gIHtBcnJheX0gbGF5b3V0IExheW91dCBhcnJheS5cclxuICogQHJldHVybiB7TnVtYmVyfSAgICAgICBCb3R0b20gY29vcmRpbmF0ZS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBib3R0b20obGF5b3V0OiBMYXlvdXQpOiBudW1iZXIge1xyXG4gICAgbGV0IG1heCA9IDAsXHJcbiAgICAgICAgYm90dG9tWTtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXlvdXQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICBib3R0b21ZID0gbGF5b3V0W2ldLnkgKyBsYXlvdXRbaV0uaDtcclxuICAgICAgICBpZiAoYm90dG9tWSA+IG1heCkge1xyXG4gICAgICAgICAgICBtYXggPSBib3R0b21ZO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBtYXg7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjbG9uZUxheW91dChsYXlvdXQ6IExheW91dCk6IExheW91dCB7XHJcbiAgICBjb25zdCBuZXdMYXlvdXQgPSBBcnJheShsYXlvdXQubGVuZ3RoKTtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXlvdXQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICBuZXdMYXlvdXRbaV0gPSBjbG9uZUxheW91dEl0ZW0obGF5b3V0W2ldKTtcclxuICAgIH1cclxuICAgIHJldHVybiBuZXdMYXlvdXQ7XHJcbn1cclxuXHJcbi8vIEZhc3QgcGF0aCB0byBjbG9uaW5nLCBzaW5jZSB0aGlzIGlzIG1vbm9tb3JwaGljXHJcbi8qKiBOT1RFOiBUaGlzIGNvZGUgaGFzIGJlZW4gbW9kaWZpZWQgZnJvbSB0aGUgb3JpZ2luYWwgc291cmNlICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjbG9uZUxheW91dEl0ZW0obGF5b3V0SXRlbTogTGF5b3V0SXRlbSk6IExheW91dEl0ZW0ge1xyXG4gICAgY29uc3QgY2xvbmVkTGF5b3V0SXRlbTogTGF5b3V0SXRlbSA9IHtcclxuICAgICAgICB3OiBsYXlvdXRJdGVtLncsXHJcbiAgICAgICAgaDogbGF5b3V0SXRlbS5oLFxyXG4gICAgICAgIHg6IGxheW91dEl0ZW0ueCxcclxuICAgICAgICB5OiBsYXlvdXRJdGVtLnksXHJcbiAgICAgICAgaWQ6IGxheW91dEl0ZW0uaWQsXHJcbiAgICAgICAgbW92ZWQ6ICEhbGF5b3V0SXRlbS5tb3ZlZCxcclxuICAgICAgICBzdGF0aWM6ICEhbGF5b3V0SXRlbS5zdGF0aWMsXHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChsYXlvdXRJdGVtLm1pblcgIT09IHVuZGVmaW5lZCkgeyBjbG9uZWRMYXlvdXRJdGVtLm1pblcgPSBsYXlvdXRJdGVtLm1pblc7fVxyXG4gICAgaWYgKGxheW91dEl0ZW0ubWF4VyAhPT0gdW5kZWZpbmVkKSB7IGNsb25lZExheW91dEl0ZW0ubWF4VyA9IGxheW91dEl0ZW0ubWF4Vzt9XHJcbiAgICBpZiAobGF5b3V0SXRlbS5taW5IICE9PSB1bmRlZmluZWQpIHsgY2xvbmVkTGF5b3V0SXRlbS5taW5IID0gbGF5b3V0SXRlbS5taW5IO31cclxuICAgIGlmIChsYXlvdXRJdGVtLm1heEggIT09IHVuZGVmaW5lZCkgeyBjbG9uZWRMYXlvdXRJdGVtLm1heEggPSBsYXlvdXRJdGVtLm1heEg7fVxyXG4gICAgLy8gVGhlc2UgY2FuIGJlIG51bGxcclxuICAgIGlmIChsYXlvdXRJdGVtLmlzRHJhZ2dhYmxlICE9PSB1bmRlZmluZWQpIHsgY2xvbmVkTGF5b3V0SXRlbS5pc0RyYWdnYWJsZSA9IGxheW91dEl0ZW0uaXNEcmFnZ2FibGU7fVxyXG4gICAgaWYgKGxheW91dEl0ZW0uaXNSZXNpemFibGUgIT09IHVuZGVmaW5lZCkgeyBjbG9uZWRMYXlvdXRJdGVtLmlzUmVzaXphYmxlID0gbGF5b3V0SXRlbS5pc1Jlc2l6YWJsZTt9XHJcblxyXG4gICAgcmV0dXJuIGNsb25lZExheW91dEl0ZW07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHaXZlbiB0d28gbGF5b3V0aXRlbXMsIGNoZWNrIGlmIHRoZXkgY29sbGlkZS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb2xsaWRlcyhsMTogTGF5b3V0SXRlbSwgbDI6IExheW91dEl0ZW0pOiBib29sZWFuIHtcclxuICAgIGlmIChsMS5pZCA9PT0gbDIuaWQpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9IC8vIHNhbWUgZWxlbWVudFxyXG4gICAgaWYgKGwxLnggKyBsMS53IDw9IGwyLngpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9IC8vIGwxIGlzIGxlZnQgb2YgbDJcclxuICAgIGlmIChsMS54ID49IGwyLnggKyBsMi53KSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSAvLyBsMSBpcyByaWdodCBvZiBsMlxyXG4gICAgaWYgKGwxLnkgKyBsMS5oIDw9IGwyLnkpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9IC8vIGwxIGlzIGFib3ZlIGwyXHJcbiAgICBpZiAobDEueSA+PSBsMi55ICsgbDIuaCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0gLy8gbDEgaXMgYmVsb3cgbDJcclxuICAgIHJldHVybiB0cnVlOyAvLyBib3hlcyBvdmVybGFwXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHaXZlbiBhIGxheW91dCwgY29tcGFjdCBpdC4gVGhpcyBpbnZvbHZlcyBnb2luZyBkb3duIGVhY2ggeSBjb29yZGluYXRlIGFuZCByZW1vdmluZyBnYXBzXHJcbiAqIGJldHdlZW4gaXRlbXMuXHJcbiAqXHJcbiAqIEBwYXJhbSAge0FycmF5fSBsYXlvdXQgTGF5b3V0LlxyXG4gKiBAcGFyYW0gIHtCb29sZWFufSB2ZXJ0aWNhbENvbXBhY3QgV2hldGhlciBvciBub3QgdG8gY29tcGFjdCB0aGUgbGF5b3V0XHJcbiAqICAgdmVydGljYWxseS5cclxuICogQHJldHVybiB7QXJyYXl9ICAgICAgIENvbXBhY3RlZCBMYXlvdXQuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29tcGFjdChcclxuICAgIGxheW91dDogTGF5b3V0LFxyXG4gICAgY29tcGFjdFR5cGU6IENvbXBhY3RUeXBlLFxyXG4gICAgY29sczogbnVtYmVyLFxyXG4pOiBMYXlvdXQge1xyXG4gICAgLy8gU3RhdGljcyBnbyBpbiB0aGUgY29tcGFyZVdpdGggYXJyYXkgcmlnaHQgYXdheSBzbyBpdGVtcyBmbG93IGFyb3VuZCB0aGVtLlxyXG4gICAgY29uc3QgY29tcGFyZVdpdGggPSBnZXRTdGF0aWNzKGxheW91dCk7XHJcbiAgICAvLyBXZSBnbyB0aHJvdWdoIHRoZSBpdGVtcyBieSByb3cgYW5kIGNvbHVtbi5cclxuICAgIGNvbnN0IHNvcnRlZCA9IHNvcnRMYXlvdXRJdGVtcyhsYXlvdXQsIGNvbXBhY3RUeXBlKTtcclxuICAgIC8vIEhvbGRpbmcgZm9yIG5ldyBpdGVtcy5cclxuICAgIGNvbnN0IG91dCA9IEFycmF5KGxheW91dC5sZW5ndGgpO1xyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHNvcnRlZC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIGxldCBsID0gY2xvbmVMYXlvdXRJdGVtKHNvcnRlZFtpXSk7XHJcblxyXG4gICAgICAgIC8vIERvbid0IG1vdmUgc3RhdGljIGVsZW1lbnRzXHJcbiAgICAgICAgaWYgKCFsLnN0YXRpYykge1xyXG4gICAgICAgICAgICBsID0gY29tcGFjdEl0ZW0oY29tcGFyZVdpdGgsIGwsIGNvbXBhY3RUeXBlLCBjb2xzLCBzb3J0ZWQpO1xyXG5cclxuICAgICAgICAgICAgLy8gQWRkIHRvIGNvbXBhcmlzb24gYXJyYXkuIFdlIG9ubHkgY29sbGlkZSB3aXRoIGl0ZW1zIGJlZm9yZSB0aGlzIG9uZS5cclxuICAgICAgICAgICAgLy8gU3RhdGljcyBhcmUgYWxyZWFkeSBpbiB0aGlzIGFycmF5LlxyXG4gICAgICAgICAgICBjb21wYXJlV2l0aC5wdXNoKGwpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQWRkIHRvIG91dHB1dCBhcnJheSB0byBtYWtlIHN1cmUgdGhleSBzdGlsbCBjb21lIG91dCBpbiB0aGUgcmlnaHQgb3JkZXIuXHJcbiAgICAgICAgb3V0W2xheW91dC5pbmRleE9mKHNvcnRlZFtpXSldID0gbDtcclxuXHJcbiAgICAgICAgLy8gQ2xlYXIgbW92ZWQgZmxhZywgaWYgaXQgZXhpc3RzLlxyXG4gICAgICAgIGwubW92ZWQgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gb3V0O1xyXG59XHJcblxyXG5jb25zdCBoZWlnaHRXaWR0aCA9IHt4OiAndycsIHk6ICdoJ307XHJcblxyXG4vKipcclxuICogQmVmb3JlIG1vdmluZyBpdGVtIGRvd24sIGl0IHdpbGwgY2hlY2sgaWYgdGhlIG1vdmVtZW50IHdpbGwgY2F1c2UgY29sbGlzaW9ucyBhbmQgbW92ZSB0aG9zZSBpdGVtcyBkb3duIGJlZm9yZS5cclxuICovXHJcbmZ1bmN0aW9uIHJlc29sdmVDb21wYWN0aW9uQ29sbGlzaW9uKFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBpdGVtOiBMYXlvdXRJdGVtLFxyXG4gICAgbW92ZVRvQ29vcmQ6IG51bWJlcixcclxuICAgIGF4aXM6ICd4JyB8ICd5JyxcclxuKSB7XHJcbiAgICBjb25zdCBzaXplUHJvcCA9IGhlaWdodFdpZHRoW2F4aXNdO1xyXG4gICAgaXRlbVtheGlzXSArPSAxO1xyXG4gICAgY29uc3QgaXRlbUluZGV4ID0gbGF5b3V0XHJcbiAgICAgICAgLm1hcChsYXlvdXRJdGVtID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIGxheW91dEl0ZW0uaWQ7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuaW5kZXhPZihpdGVtLmlkKTtcclxuXHJcbiAgICAvLyBHbyB0aHJvdWdoIGVhY2ggaXRlbSB3ZSBjb2xsaWRlIHdpdGguXHJcbiAgICBmb3IgKGxldCBpID0gaXRlbUluZGV4ICsgMTsgaSA8IGxheW91dC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IG90aGVySXRlbSA9IGxheW91dFtpXTtcclxuICAgICAgICAvLyBJZ25vcmUgc3RhdGljIGl0ZW1zXHJcbiAgICAgICAgaWYgKG90aGVySXRlbS5zdGF0aWMpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBPcHRpbWl6YXRpb246IHdlIGNhbiBicmVhayBlYXJseSBpZiB3ZSBrbm93IHdlJ3JlIHBhc3QgdGhpcyBlbFxyXG4gICAgICAgIC8vIFdlIGNhbiBkbyB0aGlzIGIvYyBpdCdzIGEgc29ydGVkIGxheW91dFxyXG4gICAgICAgIGlmIChvdGhlckl0ZW1bYXhpc10gPiBtb3ZlVG9Db29yZCtpdGVtW3NpemVQcm9wXSkge1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChjb2xsaWRlcyhpdGVtLCBvdGhlckl0ZW0pKSB7XHJcbiAgICAgICAgICAgIHJlc29sdmVDb21wYWN0aW9uQ29sbGlzaW9uKFxyXG4gICAgICAgICAgICAgICAgbGF5b3V0LFxyXG4gICAgICAgICAgICAgICAgb3RoZXJJdGVtLFxyXG4gICAgICAgICAgICAgICAgbW92ZVRvQ29vcmQgKyBpdGVtW3NpemVQcm9wXSxcclxuICAgICAgICAgICAgICAgIGF4aXMsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGl0ZW1bYXhpc10gPSBtb3ZlVG9Db29yZDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBhY3QgYW4gaXRlbSBpbiB0aGUgbGF5b3V0LlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhY3RJdGVtKFxyXG4gICAgY29tcGFyZVdpdGg6IExheW91dCxcclxuICAgIGw6IExheW91dEl0ZW0sXHJcbiAgICBjb21wYWN0VHlwZTogQ29tcGFjdFR5cGUsXHJcbiAgICBjb2xzOiBudW1iZXIsXHJcbiAgICBmdWxsTGF5b3V0OiBMYXlvdXQsXHJcbik6IExheW91dEl0ZW0ge1xyXG4gICAgY29uc3QgY29tcGFjdFYgPSBjb21wYWN0VHlwZSA9PT0gJ3ZlcnRpY2FsJztcclxuICAgIGNvbnN0IGNvbXBhY3RIID0gY29tcGFjdFR5cGUgPT09ICdob3Jpem9udGFsJztcclxuICAgIGlmIChjb21wYWN0Vikge1xyXG4gICAgICAgIC8vIEJvdHRvbSAneScgcG9zc2libGUgaXMgdGhlIGJvdHRvbSBvZiB0aGUgbGF5b3V0LlxyXG4gICAgICAgIC8vIFRoaXMgYWxsb3dzIHlvdSB0byBkbyBuaWNlIHN0dWZmIGxpa2Ugc3BlY2lmeSB7eTogSW5maW5pdHl9XHJcbiAgICAgICAgLy8gVGhpcyBpcyBoZXJlIGJlY2F1c2UgdGhlIGxheW91dCBtdXN0IGJlIHNvcnRlZCBpbiBvcmRlciB0byBnZXQgdGhlIGNvcnJlY3QgYm90dG9tIGB5YC5cclxuICAgICAgICBsLnkgPSBNYXRoLm1pbihib3R0b20oY29tcGFyZVdpdGgpLCBsLnkpO1xyXG4gICAgICAgIC8vIE1vdmUgdGhlIGVsZW1lbnQgdXAgYXMgZmFyIGFzIGl0IGNhbiBnbyB3aXRob3V0IGNvbGxpZGluZy5cclxuICAgICAgICB3aGlsZSAobC55ID4gMCAmJiAhZ2V0Rmlyc3RDb2xsaXNpb24oY29tcGFyZVdpdGgsIGwpKSB7XHJcbiAgICAgICAgICAgIGwueS0tO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAoY29tcGFjdEgpIHtcclxuICAgICAgICAvLyBNb3ZlIHRoZSBlbGVtZW50IGxlZnQgYXMgZmFyIGFzIGl0IGNhbiBnbyB3aXRob3V0IGNvbGxpZGluZy5cclxuICAgICAgICB3aGlsZSAobC54ID4gMCAmJiAhZ2V0Rmlyc3RDb2xsaXNpb24oY29tcGFyZVdpdGgsIGwpKSB7XHJcbiAgICAgICAgICAgIGwueC0tO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBNb3ZlIGl0IGRvd24sIGFuZCBrZWVwIG1vdmluZyBpdCBkb3duIGlmIGl0J3MgY29sbGlkaW5nLlxyXG4gICAgbGV0IGNvbGxpZGVzO1xyXG4gICAgd2hpbGUgKChjb2xsaWRlcyA9IGdldEZpcnN0Q29sbGlzaW9uKGNvbXBhcmVXaXRoLCBsKSkpIHtcclxuICAgICAgICBpZiAoY29tcGFjdEgpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZUNvbXBhY3Rpb25Db2xsaXNpb24oZnVsbExheW91dCwgbCwgY29sbGlkZXMueCArIGNvbGxpZGVzLncsICd4Jyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVzb2x2ZUNvbXBhY3Rpb25Db2xsaXNpb24oZnVsbExheW91dCwgbCwgY29sbGlkZXMueSArIGNvbGxpZGVzLmgsICd5JywpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBTaW5jZSB3ZSBjYW4ndCBncm93IHdpdGhvdXQgYm91bmRzIGhvcml6b250YWxseSwgaWYgd2UndmUgb3ZlcmZsb3duLCBsZXQncyBtb3ZlIGl0IGRvd24gYW5kIHRyeSBhZ2Fpbi5cclxuICAgICAgICBpZiAoY29tcGFjdEggJiYgbC54ICsgbC53ID4gY29scykge1xyXG4gICAgICAgICAgICBsLnggPSBjb2xzIC0gbC53O1xyXG4gICAgICAgICAgICBsLnkrKztcclxuXHJcbiAgICAgICAgICAgIC8vIEFMc28gbW92ZSBlbGVtZW50IGFzIGxlZnQgYXMgbXVjaCBhcyB3ZSBjYW4gKGt0ZC1jdXN0b20tY2hhbmdlKVxyXG4gICAgICAgICAgICB3aGlsZSAobC54ID4gMCAmJiAhZ2V0Rmlyc3RDb2xsaXNpb24oY29tcGFyZVdpdGgsIGwpKSB7XHJcbiAgICAgICAgICAgICAgICBsLngtLTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIEVuc3VyZSB0aGF0IHRoZXJlIGFyZSBubyBuZWdhdGl2ZSBwb3NpdGlvbnNcclxuICAgIGwueSA9IE1hdGgubWF4KGwueSwgMCk7XHJcbiAgICBsLnggPSBNYXRoLm1heChsLngsIDApO1xyXG5cclxuICAgIHJldHVybiBsO1xyXG59XHJcblxyXG4vKipcclxuICogR2l2ZW4gYSBsYXlvdXQsIG1ha2Ugc3VyZSBhbGwgZWxlbWVudHMgZml0IHdpdGhpbiBpdHMgYm91bmRzLlxyXG4gKlxyXG4gKiBAcGFyYW0gIHtBcnJheX0gbGF5b3V0IExheW91dCBhcnJheS5cclxuICogQHBhcmFtICB7TnVtYmVyfSBib3VuZHMgTnVtYmVyIG9mIGNvbHVtbnMuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29ycmVjdEJvdW5kcyhsYXlvdXQ6IExheW91dCwgYm91bmRzOiB7IGNvbHM6IG51bWJlciB9KTogTGF5b3V0IHtcclxuICAgIGNvbnN0IGNvbGxpZGVzV2l0aCA9IGdldFN0YXRpY3MobGF5b3V0KTtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXlvdXQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICBjb25zdCBsID0gbGF5b3V0W2ldO1xyXG4gICAgICAgIC8vIE92ZXJmbG93cyByaWdodFxyXG4gICAgICAgIGlmIChsLnggKyBsLncgPiBib3VuZHMuY29scykge1xyXG4gICAgICAgICAgICBsLnggPSBib3VuZHMuY29scyAtIGwudztcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gT3ZlcmZsb3dzIGxlZnRcclxuICAgICAgICBpZiAobC54IDwgMCkge1xyXG4gICAgICAgICAgICBsLnggPSAwO1xyXG4gICAgICAgICAgICBsLncgPSBib3VuZHMuY29scztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFsLnN0YXRpYykge1xyXG4gICAgICAgICAgICBjb2xsaWRlc1dpdGgucHVzaChsKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBJZiB0aGlzIGlzIHN0YXRpYyBhbmQgY29sbGlkZXMgd2l0aCBvdGhlciBzdGF0aWNzLCB3ZSBtdXN0IG1vdmUgaXQgZG93bi5cclxuICAgICAgICAgICAgLy8gV2UgaGF2ZSB0byBkbyBzb21ldGhpbmcgbmljZXIgdGhhbiBqdXN0IGxldHRpbmcgdGhlbSBvdmVybGFwLlxyXG4gICAgICAgICAgICB3aGlsZSAoZ2V0Rmlyc3RDb2xsaXNpb24oY29sbGlkZXNXaXRoLCBsKSkge1xyXG4gICAgICAgICAgICAgICAgbC55Kys7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbGF5b3V0O1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IGEgbGF5b3V0IGl0ZW0gYnkgSUQuIFVzZWQgc28gd2UgY2FuIG92ZXJyaWRlIGxhdGVyIG9uIGlmIG5lY2Vzc2FyeS5cclxuICpcclxuICogQHBhcmFtICB7QXJyYXl9ICBsYXlvdXQgTGF5b3V0IGFycmF5LlxyXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGlkICAgICBJRFxyXG4gKiBAcmV0dXJuIHtMYXlvdXRJdGVtfSAgICBJdGVtIGF0IElELlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldExheW91dEl0ZW0oXHJcbiAgICBsYXlvdXQ6IExheW91dCxcclxuICAgIGlkOiBzdHJpbmcsXHJcbik6IExheW91dEl0ZW0gfCBudWxsIHwgdW5kZWZpbmVkIHtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXlvdXQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICBpZiAobGF5b3V0W2ldLmlkID09PSBpZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbGF5b3V0W2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgZmlyc3QgaXRlbSB0aGlzIGxheW91dCBjb2xsaWRlcyB3aXRoLlxyXG4gKiBJdCBkb2Vzbid0IGFwcGVhciB0byBtYXR0ZXIgd2hpY2ggb3JkZXIgd2UgYXBwcm9hY2ggdGhpcyBmcm9tLCBhbHRob3VnaFxyXG4gKiBwZXJoYXBzIHRoYXQgaXMgdGhlIHdyb25nIHRoaW5nIHRvIGRvLlxyXG4gKlxyXG4gKiBAcGFyYW0gIHtPYmplY3R9IGxheW91dEl0ZW0gTGF5b3V0IGl0ZW0uXHJcbiAqIEByZXR1cm4ge09iamVjdHx1bmRlZmluZWR9ICBBIGNvbGxpZGluZyBsYXlvdXQgaXRlbSwgb3IgdW5kZWZpbmVkLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEZpcnN0Q29sbGlzaW9uKFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBsYXlvdXRJdGVtOiBMYXlvdXRJdGVtLFxyXG4pOiBMYXlvdXRJdGVtIHwgbnVsbCB8IHVuZGVmaW5lZCB7XHJcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGF5b3V0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGNvbGxpZGVzKGxheW91dFtpXSwgbGF5b3V0SXRlbSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGxheW91dFtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEFsbENvbGxpc2lvbnMoXHJcbiAgICBsYXlvdXQ6IExheW91dCxcclxuICAgIGxheW91dEl0ZW06IExheW91dEl0ZW0sXHJcbik6IEFycmF5PExheW91dEl0ZW0+IHtcclxuICAgIHJldHVybiBsYXlvdXQuZmlsdGVyKGwgPT4gY29sbGlkZXMobCwgbGF5b3V0SXRlbSkpO1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IGFsbCBzdGF0aWMgZWxlbWVudHMuXHJcbiAqIEBwYXJhbSAge0FycmF5fSBsYXlvdXQgQXJyYXkgb2YgbGF5b3V0IG9iamVjdHMuXHJcbiAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgQXJyYXkgb2Ygc3RhdGljIGxheW91dCBpdGVtcy4uXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RhdGljcyhsYXlvdXQ6IExheW91dCk6IEFycmF5PExheW91dEl0ZW0+IHtcclxuICAgIHJldHVybiBsYXlvdXQuZmlsdGVyKGwgPT4gbC5zdGF0aWMpO1xyXG59XHJcblxyXG4vKipcclxuICogTW92ZSBhbiBlbGVtZW50LiBSZXNwb25zaWJsZSBmb3IgZG9pbmcgY2FzY2FkaW5nIG1vdmVtZW50cyBvZiBvdGhlciBlbGVtZW50cy5cclxuICpcclxuICogQHBhcmFtICB7QXJyYXl9ICAgICAgbGF5b3V0ICAgICAgICAgICAgRnVsbCBsYXlvdXQgdG8gbW9kaWZ5LlxyXG4gKiBAcGFyYW0gIHtMYXlvdXRJdGVtfSBsICAgICAgICAgICAgICAgICBlbGVtZW50IHRvIG1vdmUuXHJcbiAqIEBwYXJhbSAge051bWJlcn0gICAgIFt4XSAgICAgICAgICAgICAgIFggcG9zaXRpb24gaW4gZ3JpZCB1bml0cy5cclxuICogQHBhcmFtICB7TnVtYmVyfSAgICAgW3ldICAgICAgICAgICAgICAgWSBwb3NpdGlvbiBpbiBncmlkIHVuaXRzLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG1vdmVFbGVtZW50KFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBsOiBMYXlvdXRJdGVtLFxyXG4gICAgeDogbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgIHk6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQsXHJcbiAgICBpc1VzZXJBY3Rpb246IGJvb2xlYW4gfCBudWxsIHwgdW5kZWZpbmVkLFxyXG4gICAgcHJldmVudENvbGxpc2lvbjogYm9vbGVhbiB8IG51bGwgfCB1bmRlZmluZWQsXHJcbiAgICBjb21wYWN0VHlwZTogQ29tcGFjdFR5cGUsXHJcbiAgICBjb2xzOiBudW1iZXIsXHJcbik6IExheW91dCB7XHJcbiAgICAvLyBJZiB0aGlzIGlzIHN0YXRpYyBhbmQgbm90IGV4cGxpY2l0bHkgZW5hYmxlZCBhcyBkcmFnZ2FibGUsXHJcbiAgICAvLyBubyBtb3ZlIGlzIHBvc3NpYmxlLCBzbyB3ZSBjYW4gc2hvcnQtY2lyY3VpdCB0aGlzIGltbWVkaWF0ZWx5LlxyXG4gICAgaWYgKGwuc3RhdGljICYmIGwuaXNEcmFnZ2FibGUgIT09IHRydWUpIHtcclxuICAgICAgICByZXR1cm4gbGF5b3V0O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFNob3J0LWNpcmN1aXQgaWYgbm90aGluZyB0byBkby5cclxuICAgIGlmIChsLnkgPT09IHkgJiYgbC54ID09PSB4KSB7XHJcbiAgICAgICAgcmV0dXJuIGxheW91dDtcclxuICAgIH1cclxuXHJcbiAgICBsb2coXHJcbiAgICAgICAgYE1vdmluZyBlbGVtZW50ICR7bC5pZH0gdG8gWyR7U3RyaW5nKHgpfSwke1N0cmluZyh5KX1dIGZyb20gWyR7bC54fSwke1xyXG4gICAgICAgICAgICBsLnlcclxuICAgICAgICB9XWAsXHJcbiAgICApO1xyXG4gICAgY29uc3Qgb2xkWCA9IGwueDtcclxuICAgIGNvbnN0IG9sZFkgPSBsLnk7XHJcblxyXG4gICAgLy8gVGhpcyBpcyBxdWl0ZSBhIGJpdCBmYXN0ZXIgdGhhbiBleHRlbmRpbmcgdGhlIG9iamVjdFxyXG4gICAgaWYgKHR5cGVvZiB4ID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgIGwueCA9IHg7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHkgPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgbC55ID0geTtcclxuICAgIH1cclxuICAgIGwubW92ZWQgPSB0cnVlO1xyXG5cclxuICAgIC8vIElmIHRoaXMgY29sbGlkZXMgd2l0aCBhbnl0aGluZywgbW92ZSBpdC5cclxuICAgIC8vIFdoZW4gZG9pbmcgdGhpcyBjb21wYXJpc29uLCB3ZSBoYXZlIHRvIHNvcnQgdGhlIGl0ZW1zIHdlIGNvbXBhcmUgd2l0aFxyXG4gICAgLy8gdG8gZW5zdXJlLCBpbiB0aGUgY2FzZSBvZiBtdWx0aXBsZSBjb2xsaXNpb25zLCB0aGF0IHdlJ3JlIGdldHRpbmcgdGhlXHJcbiAgICAvLyBuZWFyZXN0IGNvbGxpc2lvbi5cclxuICAgIGxldCBzb3J0ZWQgPSBzb3J0TGF5b3V0SXRlbXMobGF5b3V0LCBjb21wYWN0VHlwZSk7XHJcbiAgICBjb25zdCBtb3ZpbmdVcCA9XHJcbiAgICAgICAgY29tcGFjdFR5cGUgPT09ICd2ZXJ0aWNhbCcgJiYgdHlwZW9mIHkgPT09ICdudW1iZXInXHJcbiAgICAgICAgICAgID8gb2xkWSA+PSB5XHJcbiAgICAgICAgICAgIDogY29tcGFjdFR5cGUgPT09ICdob3Jpem9udGFsJyAmJiB0eXBlb2YgeCA9PT0gJ251bWJlcidcclxuICAgICAgICAgICAgICAgID8gb2xkWCA+PSB4XHJcbiAgICAgICAgICAgICAgICA6IGZhbHNlO1xyXG4gICAgaWYgKG1vdmluZ1VwKSB7XHJcbiAgICAgICAgc29ydGVkID0gc29ydGVkLnJldmVyc2UoKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGNvbGxpc2lvbnMgPSBnZXRBbGxDb2xsaXNpb25zKHNvcnRlZCwgbCk7XHJcblxyXG4gICAgLy8gVGhlcmUgd2FzIGEgY29sbGlzaW9uOyBhYm9ydFxyXG4gICAgaWYgKHByZXZlbnRDb2xsaXNpb24gJiYgY29sbGlzaW9ucy5sZW5ndGgpIHtcclxuICAgICAgICBsb2coYENvbGxpc2lvbiBwcmV2ZW50ZWQgb24gJHtsLmlkfSwgcmV2ZXJ0aW5nLmApO1xyXG4gICAgICAgIGwueCA9IG9sZFg7XHJcbiAgICAgICAgbC55ID0gb2xkWTtcclxuICAgICAgICBsLm1vdmVkID0gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIGxheW91dDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBNb3ZlIGVhY2ggaXRlbSB0aGF0IGNvbGxpZGVzIGF3YXkgZnJvbSB0aGlzIGVsZW1lbnQuXHJcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gY29sbGlzaW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIGNvbnN0IGNvbGxpc2lvbiA9IGNvbGxpc2lvbnNbaV07XHJcbiAgICAgICAgbG9nKFxyXG4gICAgICAgICAgICBgUmVzb2x2aW5nIGNvbGxpc2lvbiBiZXR3ZWVuICR7bC5pZH0gYXQgWyR7bC54fSwke2wueX1dIGFuZCAke1xyXG4gICAgICAgICAgICAgICAgY29sbGlzaW9uLmlkXHJcbiAgICAgICAgICAgIH0gYXQgWyR7Y29sbGlzaW9uLnh9LCR7Y29sbGlzaW9uLnl9XWAsXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCBzbyB3ZSBjYW4ndCBpbmZpbml0ZSBsb29wXHJcbiAgICAgICAgaWYgKGNvbGxpc2lvbi5tb3ZlZCkge1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIERvbid0IG1vdmUgc3RhdGljIGl0ZW1zIC0gd2UgaGF2ZSB0byBtb3ZlICp0aGlzKiBlbGVtZW50IGF3YXlcclxuICAgICAgICBpZiAoY29sbGlzaW9uLnN0YXRpYykge1xyXG4gICAgICAgICAgICBsYXlvdXQgPSBtb3ZlRWxlbWVudEF3YXlGcm9tQ29sbGlzaW9uKFxyXG4gICAgICAgICAgICAgICAgbGF5b3V0LFxyXG4gICAgICAgICAgICAgICAgY29sbGlzaW9uLFxyXG4gICAgICAgICAgICAgICAgbCxcclxuICAgICAgICAgICAgICAgIGlzVXNlckFjdGlvbixcclxuICAgICAgICAgICAgICAgIGNvbXBhY3RUeXBlLFxyXG4gICAgICAgICAgICAgICAgY29scyxcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBsYXlvdXQgPSBtb3ZlRWxlbWVudEF3YXlGcm9tQ29sbGlzaW9uKFxyXG4gICAgICAgICAgICAgICAgbGF5b3V0LFxyXG4gICAgICAgICAgICAgICAgbCxcclxuICAgICAgICAgICAgICAgIGNvbGxpc2lvbixcclxuICAgICAgICAgICAgICAgIGlzVXNlckFjdGlvbixcclxuICAgICAgICAgICAgICAgIGNvbXBhY3RUeXBlLFxyXG4gICAgICAgICAgICAgICAgY29scyxcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGxheW91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFRoaXMgaXMgd2hlcmUgdGhlIG1hZ2ljIG5lZWRzIHRvIGhhcHBlbiAtIGdpdmVuIGEgY29sbGlzaW9uLCBtb3ZlIGFuIGVsZW1lbnQgYXdheSBmcm9tIHRoZSBjb2xsaXNpb24uXHJcbiAqIFdlIGF0dGVtcHQgdG8gbW92ZSBpdCB1cCBpZiB0aGVyZSdzIHJvb20sIG90aGVyd2lzZSBpdCBnb2VzIGJlbG93LlxyXG4gKlxyXG4gKiBAcGFyYW0gIHtBcnJheX0gbGF5b3V0ICAgICAgICAgICAgRnVsbCBsYXlvdXQgdG8gbW9kaWZ5LlxyXG4gKiBAcGFyYW0gIHtMYXlvdXRJdGVtfSBjb2xsaWRlc1dpdGggTGF5b3V0IGl0ZW0gd2UncmUgY29sbGlkaW5nIHdpdGguXHJcbiAqIEBwYXJhbSAge0xheW91dEl0ZW19IGl0ZW1Ub01vdmUgICBMYXlvdXQgaXRlbSB3ZSdyZSBtb3ZpbmcuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbW92ZUVsZW1lbnRBd2F5RnJvbUNvbGxpc2lvbihcclxuICAgIGxheW91dDogTGF5b3V0LFxyXG4gICAgY29sbGlkZXNXaXRoOiBMYXlvdXRJdGVtLFxyXG4gICAgaXRlbVRvTW92ZTogTGF5b3V0SXRlbSxcclxuICAgIGlzVXNlckFjdGlvbjogYm9vbGVhbiB8IG51bGwgfCB1bmRlZmluZWQsXHJcbiAgICBjb21wYWN0VHlwZTogQ29tcGFjdFR5cGUsXHJcbiAgICBjb2xzOiBudW1iZXIsXHJcbik6IExheW91dCB7XHJcbiAgICBjb25zdCBjb21wYWN0SCA9IGNvbXBhY3RUeXBlID09PSAnaG9yaXpvbnRhbCc7XHJcbiAgICAvLyBDb21wYWN0IHZlcnRpY2FsbHkgaWYgbm90IHNldCB0byBob3Jpem9udGFsXHJcbiAgICBjb25zdCBjb21wYWN0ViA9IGNvbXBhY3RUeXBlICE9PSAnaG9yaXpvbnRhbCc7XHJcbiAgICBjb25zdCBwcmV2ZW50Q29sbGlzaW9uID0gY29sbGlkZXNXaXRoLnN0YXRpYzsgLy8gd2UncmUgYWxyZWFkeSBjb2xsaWRpbmcgKG5vdCBmb3Igc3RhdGljIGl0ZW1zKVxyXG5cclxuICAgIC8vIElmIHRoZXJlIGlzIGVub3VnaCBzcGFjZSBhYm92ZSB0aGUgY29sbGlzaW9uIHRvIHB1dCB0aGlzIGVsZW1lbnQsIG1vdmUgaXQgdGhlcmUuXHJcbiAgICAvLyBXZSBvbmx5IGRvIHRoaXMgb24gdGhlIG1haW4gY29sbGlzaW9uIGFzIHRoaXMgY2FuIGdldCBmdW5reSBpbiBjYXNjYWRlcyBhbmQgY2F1c2VcclxuICAgIC8vIHVud2FudGVkIHN3YXBwaW5nIGJlaGF2aW9yLlxyXG4gICAgaWYgKGlzVXNlckFjdGlvbikge1xyXG4gICAgICAgIC8vIFJlc2V0IGlzVXNlckFjdGlvbiBmbGFnIGJlY2F1c2Ugd2UncmUgbm90IGluIHRoZSBtYWluIGNvbGxpc2lvbiBhbnltb3JlLlxyXG4gICAgICAgIGlzVXNlckFjdGlvbiA9IGZhbHNlO1xyXG5cclxuICAgICAgICAvLyBNYWtlIGEgbW9jayBpdGVtIHNvIHdlIGRvbid0IG1vZGlmeSB0aGUgaXRlbSBoZXJlLCBvbmx5IG1vZGlmeSBpbiBtb3ZlRWxlbWVudC5cclxuICAgICAgICBjb25zdCBmYWtlSXRlbTogTGF5b3V0SXRlbSA9IHtcclxuICAgICAgICAgICAgeDogY29tcGFjdEhcclxuICAgICAgICAgICAgICAgID8gTWF0aC5tYXgoY29sbGlkZXNXaXRoLnggLSBpdGVtVG9Nb3ZlLncsIDApXHJcbiAgICAgICAgICAgICAgICA6IGl0ZW1Ub01vdmUueCxcclxuICAgICAgICAgICAgeTogY29tcGFjdFZcclxuICAgICAgICAgICAgICAgID8gTWF0aC5tYXgoY29sbGlkZXNXaXRoLnkgLSBpdGVtVG9Nb3ZlLmgsIDApXHJcbiAgICAgICAgICAgICAgICA6IGl0ZW1Ub01vdmUueSxcclxuICAgICAgICAgICAgdzogaXRlbVRvTW92ZS53LFxyXG4gICAgICAgICAgICBoOiBpdGVtVG9Nb3ZlLmgsXHJcbiAgICAgICAgICAgIGlkOiAnLTEnLFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vIE5vIGNvbGxpc2lvbj8gSWYgc28sIHdlIGNhbiBnbyB1cCB0aGVyZTsgb3RoZXJ3aXNlLCB3ZSdsbCBlbmQgdXAgbW92aW5nIGRvd24gYXMgbm9ybWFsXHJcbiAgICAgICAgaWYgKCFnZXRGaXJzdENvbGxpc2lvbihsYXlvdXQsIGZha2VJdGVtKSkge1xyXG4gICAgICAgICAgICBsb2coXHJcbiAgICAgICAgICAgICAgICBgRG9pbmcgcmV2ZXJzZSBjb2xsaXNpb24gb24gJHtpdGVtVG9Nb3ZlLmlkfSB1cCB0byBbJHtcclxuICAgICAgICAgICAgICAgICAgICBmYWtlSXRlbS54XHJcbiAgICAgICAgICAgICAgICB9LCR7ZmFrZUl0ZW0ueX1dLmAsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIHJldHVybiBtb3ZlRWxlbWVudChcclxuICAgICAgICAgICAgICAgIGxheW91dCxcclxuICAgICAgICAgICAgICAgIGl0ZW1Ub01vdmUsXHJcbiAgICAgICAgICAgICAgICBjb21wYWN0SCA/IGZha2VJdGVtLnggOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICBjb21wYWN0ViA/IGZha2VJdGVtLnkgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICBpc1VzZXJBY3Rpb24sXHJcbiAgICAgICAgICAgICAgICBwcmV2ZW50Q29sbGlzaW9uLFxyXG4gICAgICAgICAgICAgICAgY29tcGFjdFR5cGUsXHJcbiAgICAgICAgICAgICAgICBjb2xzLFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbW92ZUVsZW1lbnQoXHJcbiAgICAgICAgbGF5b3V0LFxyXG4gICAgICAgIGl0ZW1Ub01vdmUsXHJcbiAgICAgICAgY29tcGFjdEggPyBpdGVtVG9Nb3ZlLnggKyAxIDogdW5kZWZpbmVkLFxyXG4gICAgICAgIGNvbXBhY3RWID8gaXRlbVRvTW92ZS55ICsgMSA6IHVuZGVmaW5lZCxcclxuICAgICAgICBpc1VzZXJBY3Rpb24sXHJcbiAgICAgICAgcHJldmVudENvbGxpc2lvbixcclxuICAgICAgICBjb21wYWN0VHlwZSxcclxuICAgICAgICBjb2xzLFxyXG4gICAgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhlbHBlciB0byBjb252ZXJ0IGEgbnVtYmVyIHRvIGEgcGVyY2VudGFnZSBzdHJpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSAge051bWJlcn0gbnVtIEFueSBudW1iZXJcclxuICogQHJldHVybiB7U3RyaW5nfSAgICAgVGhhdCBudW1iZXIgYXMgYSBwZXJjZW50YWdlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHBlcmMobnVtOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIG51bSAqIDEwMCArICclJztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNldFRyYW5zZm9ybSh7dG9wLCBsZWZ0LCB3aWR0aCwgaGVpZ2h0fTogUG9zaXRpb24pOiBPYmplY3Qge1xyXG4gICAgLy8gUmVwbGFjZSB1bml0bGVzcyBpdGVtcyB3aXRoIHB4XHJcbiAgICBjb25zdCB0cmFuc2xhdGUgPSBgdHJhbnNsYXRlKCR7bGVmdH1weCwke3RvcH1weClgO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSxcclxuICAgICAgICBXZWJraXRUcmFuc2Zvcm06IHRyYW5zbGF0ZSxcclxuICAgICAgICBNb3pUcmFuc2Zvcm06IHRyYW5zbGF0ZSxcclxuICAgICAgICBtc1RyYW5zZm9ybTogdHJhbnNsYXRlLFxyXG4gICAgICAgIE9UcmFuc2Zvcm06IHRyYW5zbGF0ZSxcclxuICAgICAgICB3aWR0aDogYCR7d2lkdGh9cHhgLFxyXG4gICAgICAgIGhlaWdodDogYCR7aGVpZ2h0fXB4YCxcclxuICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcclxuICAgIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzZXRUb3BMZWZ0KHt0b3AsIGxlZnQsIHdpZHRoLCBoZWlnaHR9OiBQb3NpdGlvbik6IE9iamVjdCB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRvcDogYCR7dG9wfXB4YCxcclxuICAgICAgICBsZWZ0OiBgJHtsZWZ0fXB4YCxcclxuICAgICAgICB3aWR0aDogYCR7d2lkdGh9cHhgLFxyXG4gICAgICAgIGhlaWdodDogYCR7aGVpZ2h0fXB4YCxcclxuICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXQgbGF5b3V0IGl0ZW1zIHNvcnRlZCBmcm9tIHRvcCBsZWZ0IHRvIHJpZ2h0IGFuZCBkb3duLlxyXG4gKlxyXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgbGF5b3V0IG9iamVjdHMuXHJcbiAqIEByZXR1cm4ge0FycmF5fSAgICAgICAgTGF5b3V0LCBzb3J0ZWQgc3RhdGljIGl0ZW1zIGZpcnN0LlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNvcnRMYXlvdXRJdGVtcyhcclxuICAgIGxheW91dDogTGF5b3V0LFxyXG4gICAgY29tcGFjdFR5cGU6IENvbXBhY3RUeXBlLFxyXG4pOiBMYXlvdXQge1xyXG4gICAgaWYgKGNvbXBhY3RUeXBlID09PSAnaG9yaXpvbnRhbCcpIHtcclxuICAgICAgICByZXR1cm4gc29ydExheW91dEl0ZW1zQnlDb2xSb3cobGF5b3V0KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHNvcnRMYXlvdXRJdGVtc0J5Um93Q29sKGxheW91dCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzb3J0TGF5b3V0SXRlbXNCeVJvd0NvbChsYXlvdXQ6IExheW91dCk6IExheW91dCB7XHJcbiAgICByZXR1cm4gKFtdIGFzIGFueVtdKS5jb25jYXQobGF5b3V0KS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcclxuICAgICAgICBpZiAoYS55ID4gYi55IHx8IChhLnkgPT09IGIueSAmJiBhLnggPiBiLngpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAxO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoYS55ID09PSBiLnkgJiYgYS54ID09PSBiLngpIHtcclxuICAgICAgICAgICAgLy8gV2l0aG91dCB0aGlzLCB3ZSBjYW4gZ2V0IGRpZmZlcmVudCBzb3J0IHJlc3VsdHMgaW4gSUUgdnMuIENocm9tZS9GRlxyXG4gICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzb3J0TGF5b3V0SXRlbXNCeUNvbFJvdyhsYXlvdXQ6IExheW91dCk6IExheW91dCB7XHJcbiAgICByZXR1cm4gKFtdIGFzIGFueVtdKS5jb25jYXQobGF5b3V0KS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcclxuICAgICAgICBpZiAoYS54ID4gYi54IHx8IChhLnggPT09IGIueCAmJiBhLnkgPiBiLnkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAxO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFZhbGlkYXRlIGEgbGF5b3V0LiBUaHJvd3MgZXJyb3JzLlxyXG4gKlxyXG4gKiBAcGFyYW0gIHtBcnJheX0gIGxheW91dCAgICAgICAgQXJyYXkgb2YgbGF5b3V0IGl0ZW1zLlxyXG4gKiBAcGFyYW0gIHtTdHJpbmd9IFtjb250ZXh0TmFtZV0gQ29udGV4dCBuYW1lIGZvciBlcnJvcnMuXHJcbiAqIEB0aHJvdyAge0Vycm9yfSAgICAgICAgICAgICAgICBWYWxpZGF0aW9uIGVycm9yLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlTGF5b3V0KFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBjb250ZXh0TmFtZTogc3RyaW5nID0gJ0xheW91dCcsXHJcbik6IHZvaWQge1xyXG4gICAgY29uc3Qgc3ViUHJvcHMgPSBbJ3gnLCAneScsICd3JywgJ2gnXTtcclxuICAgIGlmICghQXJyYXkuaXNBcnJheShsYXlvdXQpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGNvbnRleHROYW1lICsgJyBtdXN0IGJlIGFuIGFycmF5IScpO1xyXG4gICAgfVxyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheW91dC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XHJcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBzdWJQcm9wcy5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW1bc3ViUHJvcHNbal1dICE9PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgICAgICAgICdSZWFjdEdyaWRMYXlvdXQ6ICcgK1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHROYW1lICtcclxuICAgICAgICAgICAgICAgICAgICAnWycgK1xyXG4gICAgICAgICAgICAgICAgICAgIGkgK1xyXG4gICAgICAgICAgICAgICAgICAgICddLicgK1xyXG4gICAgICAgICAgICAgICAgICAgIHN1YlByb3BzW2pdICtcclxuICAgICAgICAgICAgICAgICAgICAnIG11c3QgYmUgYSBudW1iZXIhJyxcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGl0ZW0uaWQgJiYgdHlwZW9mIGl0ZW0uaWQgIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgICAgICdSZWFjdEdyaWRMYXlvdXQ6ICcgK1xyXG4gICAgICAgICAgICAgICAgY29udGV4dE5hbWUgK1xyXG4gICAgICAgICAgICAgICAgJ1snICtcclxuICAgICAgICAgICAgICAgIGkgK1xyXG4gICAgICAgICAgICAgICAgJ10uaSBtdXN0IGJlIGEgc3RyaW5nIScsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpdGVtLnN0YXRpYyAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBpdGVtLnN0YXRpYyAhPT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgICAgICdSZWFjdEdyaWRMYXlvdXQ6ICcgK1xyXG4gICAgICAgICAgICAgICAgY29udGV4dE5hbWUgK1xyXG4gICAgICAgICAgICAgICAgJ1snICtcclxuICAgICAgICAgICAgICAgIGkgK1xyXG4gICAgICAgICAgICAgICAgJ10uc3RhdGljIG11c3QgYmUgYSBib29sZWFuIScsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vLyBGbG93IGNhbid0IHJlYWxseSBmaWd1cmUgdGhpcyBvdXQsIHNvIHdlIGp1c3QgdXNlIE9iamVjdFxyXG5leHBvcnQgZnVuY3Rpb24gYXV0b0JpbmRIYW5kbGVycyhlbDogT2JqZWN0LCBmbnM6IEFycmF5PHN0cmluZz4pOiB2b2lkIHtcclxuICAgIGZucy5mb3JFYWNoKGtleSA9PiAoZWxba2V5XSA9IGVsW2tleV0uYmluZChlbCkpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbG9nKC4uLmFyZ3MpIHtcclxuICAgIGlmICghREVCVUcpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxyXG4gICAgY29uc29sZS5sb2coLi4uYXJncyk7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBub29wID0gKCkgPT4ge307XHJcbiJdfQ==