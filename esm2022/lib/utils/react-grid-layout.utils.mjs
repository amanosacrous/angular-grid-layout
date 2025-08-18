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
        if ((axis === 'x' && otherItem.y > item.y + item.h) || (axis === 'y' && otherItem.y > moveToCoord + item.h)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhY3QtZ3JpZC1sYXlvdXQudXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvdXRpbHMvcmVhY3QtZ3JpZC1sYXlvdXQudXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQXFFSCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUM7QUFFcEI7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsTUFBTSxDQUFDLE1BQWM7SUFDakMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUNQLE9BQU8sQ0FBQztJQUNaLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0MsT0FBTyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQyxJQUFJLE9BQU8sR0FBRyxHQUFHLEVBQUU7WUFDZixHQUFHLEdBQUcsT0FBTyxDQUFDO1NBQ2pCO0tBQ0o7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNmLENBQUM7QUFFRCxNQUFNLFVBQVUsV0FBVyxDQUFDLE1BQWM7SUFDdEMsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQy9DLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDN0M7SUFDRCxPQUFPLFNBQVMsQ0FBQztBQUNyQixDQUFDO0FBRUQsa0RBQWtEO0FBQ2xELGlFQUFpRTtBQUNqRSxNQUFNLFVBQVUsZUFBZSxDQUFDLFVBQXNCO0lBQ2xELE1BQU0sZ0JBQWdCLEdBQWU7UUFDakMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2YsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2YsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2YsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2YsRUFBRSxFQUFFLFVBQVUsQ0FBQyxFQUFFO1FBQ2pCLEtBQUssRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUs7UUFDekIsTUFBTSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTTtLQUM5QixDQUFDO0lBRUYsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtRQUFFLGdCQUFnQixDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO0tBQUM7SUFDOUUsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtRQUFFLGdCQUFnQixDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO0tBQUM7SUFDOUUsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtRQUFFLGdCQUFnQixDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO0tBQUM7SUFDOUUsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtRQUFFLGdCQUFnQixDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO0tBQUM7SUFDOUUsb0JBQW9CO0lBQ3BCLElBQUksVUFBVSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7UUFBRSxnQkFBZ0IsQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQztLQUFDO0lBQ25HLElBQUksVUFBVSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7UUFBRSxnQkFBZ0IsQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQztLQUFDO0lBRW5HLE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLFFBQVEsQ0FBQyxFQUFjLEVBQUUsRUFBYztJQUNuRCxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNqQixPQUFPLEtBQUssQ0FBQztLQUNoQixDQUFDLGVBQWU7SUFDakIsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRTtRQUNyQixPQUFPLEtBQUssQ0FBQztLQUNoQixDQUFDLG1CQUFtQjtJQUNyQixJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sS0FBSyxDQUFDO0tBQ2hCLENBQUMsb0JBQW9CO0lBQ3RCLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUU7UUFDckIsT0FBTyxLQUFLLENBQUM7S0FDaEIsQ0FBQyxpQkFBaUI7SUFDbkIsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUNyQixPQUFPLEtBQUssQ0FBQztLQUNoQixDQUFDLGlCQUFpQjtJQUNuQixPQUFPLElBQUksQ0FBQyxDQUFDLGdCQUFnQjtBQUNqQyxDQUFDO0FBRUQ7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLFVBQVUsT0FBTyxDQUNuQixNQUFjLEVBQ2QsV0FBd0IsRUFDeEIsSUFBWTtJQUVaLDRFQUE0RTtJQUM1RSxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdkMsNkNBQTZDO0lBQzdDLE1BQU0sTUFBTSxHQUFHLGVBQWUsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDcEQseUJBQXlCO0lBQ3pCLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDakMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMvQyxJQUFJLENBQUMsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFbkMsNkJBQTZCO1FBQzdCLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFO1lBQ1gsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFFM0QsdUVBQXVFO1lBQ3ZFLHFDQUFxQztZQUNyQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3ZCO1FBRUQsMkVBQTJFO1FBQzNFLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRW5DLGtDQUFrQztRQUNsQyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztLQUNuQjtJQUVELE9BQU8sR0FBRyxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sV0FBVyxHQUFHLEVBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFDLENBQUM7QUFFckM7O0dBRUc7QUFDSCxTQUFTLDBCQUEwQixDQUMvQixNQUFjLEVBQ2QsSUFBZ0IsRUFDaEIsV0FBbUIsRUFDbkIsSUFBZTtJQUVmLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hCLE1BQU0sU0FBUyxHQUFHLE1BQU07U0FDbkIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ2QsT0FBTyxVQUFVLENBQUMsRUFBRSxDQUFDO0lBQ3pCLENBQUMsQ0FBQztTQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFdEIsd0NBQXdDO0lBQ3hDLEtBQUssSUFBSSxDQUFDLEdBQUcsU0FBUyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNoRCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUIsc0JBQXNCO1FBQ3RCLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRTtZQUNsQixTQUFTO1NBQ1o7UUFFRCxpRUFBaUU7UUFDakUsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxJQUFJLEtBQUcsR0FBRyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFFLElBQUksQ0FBQyxJQUFJLEtBQUcsR0FBRyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxHQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNwRyxNQUFNO1NBQ1Q7UUFFRCxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEVBQUU7WUFDM0IsMEJBQTBCLENBQ3RCLE1BQU0sRUFDTixTQUFTLEVBQ1QsV0FBVyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsRUFDNUIsSUFBSSxDQUNQLENBQUM7U0FDTDtLQUNKO0lBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQztBQUM3QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUN2QixXQUFtQixFQUNuQixDQUFhLEVBQ2IsV0FBd0IsRUFDeEIsSUFBWSxFQUNaLFVBQWtCO0lBRWxCLE1BQU0sUUFBUSxHQUFHLFdBQVcsS0FBSyxVQUFVLENBQUM7SUFDNUMsTUFBTSxRQUFRLEdBQUcsV0FBVyxLQUFLLFlBQVksQ0FBQztJQUM5QyxJQUFJLFFBQVEsRUFBRTtRQUNWLG1EQUFtRDtRQUNuRCw4REFBOEQ7UUFDOUQseUZBQXlGO1FBQ3pGLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLDZEQUE2RDtRQUM3RCxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ2xELENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztTQUNUO0tBQ0o7U0FBTSxJQUFJLFFBQVEsRUFBRTtRQUNqQiwrREFBK0Q7UUFDL0QsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUNsRCxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7U0FDVDtLQUNKO0lBRUQsMkRBQTJEO0lBQzNELElBQUksUUFBUSxDQUFDO0lBQ2IsT0FBTyxDQUFDLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUNuRCxJQUFJLFFBQVEsRUFBRTtZQUNWLDBCQUEwQixDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQzNFO2FBQU07WUFDSCwwQkFBMEIsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUUsQ0FBQztTQUM1RTtRQUNELHlHQUF5RztRQUN6RyxJQUFJLFFBQVEsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFO1lBQzlCLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBRU4sa0VBQWtFO1lBQ2xFLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2xELENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUNUO1NBQ0o7S0FDSjtJQUNELDhDQUE4QztJQUM5QyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN2QixDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUV2QixPQUFPLENBQUMsQ0FBQztBQUNiLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUMsTUFBYyxFQUFFLE1BQXdCO0lBQ2xFLE1BQU0sWUFBWSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQy9DLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQixrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLElBQUksRUFBRTtZQUN6QixDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUMzQjtRQUNELGlCQUFpQjtRQUNqQixJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ1QsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDUixDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7U0FDckI7UUFDRCxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRTtZQUNYLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDeEI7YUFBTTtZQUNILDJFQUEyRTtZQUMzRSxnRUFBZ0U7WUFDaEUsT0FBTyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3ZDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUNUO1NBQ0o7S0FDSjtJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2xCLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsYUFBYSxDQUN6QixNQUFjLEVBQ2QsRUFBVTtJQUVWLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0MsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUNyQixPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNwQjtLQUNKO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQzdCLE1BQWMsRUFDZCxVQUFzQjtJQUV0QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQy9DLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsRUFBRTtZQUNqQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNwQjtLQUNKO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQztBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FDNUIsTUFBYyxFQUNkLFVBQXNCO0lBRXRCLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxVQUFVLENBQUMsTUFBYztJQUNyQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDeEMsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsV0FBVyxDQUN2QixNQUFjLEVBQ2QsQ0FBYSxFQUNiLENBQTRCLEVBQzVCLENBQTRCLEVBQzVCLFlBQXdDLEVBQ3hDLGdCQUE0QyxFQUM1QyxXQUF3QixFQUN4QixJQUFZO0lBRVosNkRBQTZEO0lBQzdELGlFQUFpRTtJQUNqRSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLFdBQVcsS0FBSyxJQUFJLEVBQUU7UUFDcEMsT0FBTyxNQUFNLENBQUM7S0FDakI7SUFFRCxrQ0FBa0M7SUFDbEMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN4QixPQUFPLE1BQU0sQ0FBQztLQUNqQjtJQUVELEdBQUcsQ0FDQyxrQkFBa0IsQ0FBQyxDQUFDLEVBQUUsUUFBUSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQzlELENBQUMsQ0FBQyxDQUNOLEdBQUcsQ0FDTixDQUFDO0lBQ0YsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQixNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRWpCLHVEQUF1RDtJQUN2RCxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsRUFBRTtRQUN2QixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNYO0lBQ0QsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLEVBQUU7UUFDdkIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDWDtJQUNELENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO0lBRWYsMkNBQTJDO0lBQzNDLHdFQUF3RTtJQUN4RSx3RUFBd0U7SUFDeEUscUJBQXFCO0lBQ3JCLElBQUksTUFBTSxHQUFHLGVBQWUsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDbEQsTUFBTSxRQUFRLEdBQ1YsV0FBVyxLQUFLLFVBQVUsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRO1FBQy9DLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQztRQUNYLENBQUMsQ0FBQyxXQUFXLEtBQUssWUFBWSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVE7WUFDbkQsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDO1lBQ1gsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUNwQixJQUFJLFFBQVEsRUFBRTtRQUNWLE1BQU0sR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDN0I7SUFDRCxNQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFL0MsK0JBQStCO0lBQy9CLElBQUksZ0JBQWdCLElBQUksVUFBVSxDQUFDLE1BQU0sRUFBRTtRQUN2QyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ2xELENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ1gsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDWCxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNoQixPQUFPLE1BQU0sQ0FBQztLQUNqQjtJQUVELHVEQUF1RDtJQUN2RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ25ELE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoQyxHQUFHLENBQ0MsK0JBQStCLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUNqRCxTQUFTLENBQUMsRUFDZCxRQUFRLFNBQVMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsR0FBRyxDQUN4QyxDQUFDO1FBRUYsMENBQTBDO1FBQzFDLElBQUksU0FBUyxDQUFDLEtBQUssRUFBRTtZQUNqQixTQUFTO1NBQ1o7UUFFRCxnRUFBZ0U7UUFDaEUsSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFO1lBQ2xCLE1BQU0sR0FBRyw0QkFBNEIsQ0FDakMsTUFBTSxFQUNOLFNBQVMsRUFDVCxDQUFDLEVBQ0QsWUFBWSxFQUNaLFdBQVcsRUFDWCxJQUFJLENBQ1AsQ0FBQztTQUNMO2FBQU07WUFDSCxNQUFNLEdBQUcsNEJBQTRCLENBQ2pDLE1BQU0sRUFDTixDQUFDLEVBQ0QsU0FBUyxFQUNULFlBQVksRUFDWixXQUFXLEVBQ1gsSUFBSSxDQUNQLENBQUM7U0FDTDtLQUNKO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQ3hDLE1BQWMsRUFDZCxZQUF3QixFQUN4QixVQUFzQixFQUN0QixZQUF3QyxFQUN4QyxXQUF3QixFQUN4QixJQUFZO0lBRVosTUFBTSxRQUFRLEdBQUcsV0FBVyxLQUFLLFlBQVksQ0FBQztJQUM5Qyw4Q0FBOEM7SUFDOUMsTUFBTSxRQUFRLEdBQUcsV0FBVyxLQUFLLFlBQVksQ0FBQztJQUM5QyxNQUFNLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxpREFBaUQ7SUFFL0YsbUZBQW1GO0lBQ25GLG9GQUFvRjtJQUNwRiw4QkFBOEI7SUFDOUIsSUFBSSxZQUFZLEVBQUU7UUFDZCwyRUFBMkU7UUFDM0UsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUVyQixpRkFBaUY7UUFDakYsTUFBTSxRQUFRLEdBQWU7WUFDekIsQ0FBQyxFQUFFLFFBQVE7Z0JBQ1AsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDNUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ2xCLENBQUMsRUFBRSxRQUFRO2dCQUNQLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzVDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNsQixDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDZixDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDZixFQUFFLEVBQUUsSUFBSTtTQUNYLENBQUM7UUFFRix5RkFBeUY7UUFDekYsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsRUFBRTtZQUN0QyxHQUFHLENBQ0MsOEJBQThCLFVBQVUsQ0FBQyxFQUFFLFdBQ3ZDLFFBQVEsQ0FBQyxDQUNiLElBQUksUUFBUSxDQUFDLENBQUMsSUFBSSxDQUNyQixDQUFDO1lBQ0YsT0FBTyxXQUFXLENBQ2QsTUFBTSxFQUNOLFVBQVUsRUFDVixRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFDakMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQ2pDLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsV0FBVyxFQUNYLElBQUksQ0FDUCxDQUFDO1NBQ0w7S0FDSjtJQUVELE9BQU8sV0FBVyxDQUNkLE1BQU0sRUFDTixVQUFVLEVBQ1YsUUFBUSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUN2QyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQ3ZDLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsV0FBVyxFQUNYLElBQUksQ0FDUCxDQUFDO0FBQ04sQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLElBQUksQ0FBQyxHQUFXO0lBQzVCLE9BQU8sR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDM0IsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQUMsRUFBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQVc7SUFDN0QsaUNBQWlDO0lBQ2pDLE1BQU0sU0FBUyxHQUFHLGFBQWEsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO0lBQ2xELE9BQU87UUFDSCxTQUFTLEVBQUUsU0FBUztRQUNwQixlQUFlLEVBQUUsU0FBUztRQUMxQixZQUFZLEVBQUUsU0FBUztRQUN2QixXQUFXLEVBQUUsU0FBUztRQUN0QixVQUFVLEVBQUUsU0FBUztRQUNyQixLQUFLLEVBQUUsR0FBRyxLQUFLLElBQUk7UUFDbkIsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFJO1FBQ3JCLFFBQVEsRUFBRSxVQUFVO0tBQ3ZCLENBQUM7QUFDTixDQUFDO0FBRUQsTUFBTSxVQUFVLFVBQVUsQ0FBQyxFQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBVztJQUMzRCxPQUFPO1FBQ0gsR0FBRyxFQUFFLEdBQUcsR0FBRyxJQUFJO1FBQ2YsSUFBSSxFQUFFLEdBQUcsSUFBSSxJQUFJO1FBQ2pCLEtBQUssRUFBRSxHQUFHLEtBQUssSUFBSTtRQUNuQixNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUk7UUFDckIsUUFBUSxFQUFFLFVBQVU7S0FDdkIsQ0FBQztBQUNOLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQzNCLE1BQWMsRUFDZCxXQUF3QjtJQUV4QixJQUFJLFdBQVcsS0FBSyxZQUFZLEVBQUU7UUFDOUIsT0FBTyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUMxQztTQUFNO1FBQ0gsT0FBTyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUMxQztBQUNMLENBQUM7QUFFRCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsTUFBYztJQUNsRCxPQUFRLEVBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVMsQ0FBQyxFQUFFLENBQUM7UUFDbEQsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDekMsT0FBTyxDQUFDLENBQUM7U0FDWjthQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNuQyxzRUFBc0U7WUFDdEUsT0FBTyxDQUFDLENBQUM7U0FDWjtRQUNELE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDZCxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsTUFBYztJQUNsRCxPQUFRLEVBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVMsQ0FBQyxFQUFFLENBQUM7UUFDbEQsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDekMsT0FBTyxDQUFDLENBQUM7U0FDWjtRQUNELE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDZCxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUMxQixNQUFjLEVBQ2QsY0FBc0IsUUFBUTtJQUU5QixNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMsV0FBVyxHQUFHLG9CQUFvQixDQUFDLENBQUM7S0FDdkQ7SUFDRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQy9DLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN0QyxJQUFJLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsRUFBRTtnQkFDdkMsTUFBTSxJQUFJLEtBQUssQ0FDWCxtQkFBbUI7b0JBQ25CLFdBQVc7b0JBQ1gsR0FBRztvQkFDSCxDQUFDO29CQUNELElBQUk7b0JBQ0osUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDWCxvQkFBb0IsQ0FDdkIsQ0FBQzthQUNMO1NBQ0o7UUFDRCxJQUFJLElBQUksQ0FBQyxFQUFFLElBQUksT0FBTyxJQUFJLENBQUMsRUFBRSxLQUFLLFFBQVEsRUFBRTtZQUN4QyxNQUFNLElBQUksS0FBSyxDQUNYLG1CQUFtQjtnQkFDbkIsV0FBVztnQkFDWCxHQUFHO2dCQUNILENBQUM7Z0JBQ0QsdUJBQXVCLENBQzFCLENBQUM7U0FDTDtRQUNELElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxTQUFTLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtZQUMvRCxNQUFNLElBQUksS0FBSyxDQUNYLG1CQUFtQjtnQkFDbkIsV0FBVztnQkFDWCxHQUFHO2dCQUNILENBQUM7Z0JBQ0QsNkJBQTZCLENBQ2hDLENBQUM7U0FDTDtLQUNKO0FBQ0wsQ0FBQztBQUVELDJEQUEyRDtBQUMzRCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsRUFBVSxFQUFFLEdBQWtCO0lBQzNELEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyRCxDQUFDO0FBRUQsU0FBUyxHQUFHLENBQUMsR0FBRyxJQUFJO0lBQ2hCLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDUixPQUFPO0tBQ1Y7SUFDRCxzQ0FBc0M7SUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0FBQ3pCLENBQUM7QUFFRCxNQUFNLENBQUMsTUFBTSxJQUFJLEdBQUcsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIElNUE9SVEFOVDpcclxuICogVGhpcyB1dGlscyBhcmUgdGFrZW4gZnJvbSB0aGUgcHJvamVjdDogaHR0cHM6Ly9naXRodWIuY29tL1NUUk1ML3JlYWN0LWdyaWQtbGF5b3V0LlxyXG4gKiBUaGUgY29kZSBzaG91bGQgYmUgYXMgbGVzcyBtb2RpZmllZCBhcyBwb3NzaWJsZSBmb3IgZWFzeSBtYWludGVuYW5jZS5cclxuICovXHJcblxyXG4vLyBEaXNhYmxlIGxpbnQgc2luY2Ugd2UgZG9uJ3Qgd2FudCB0byBtb2RpZnkgdGhpcyBjb2RlXHJcbi8qIGVzbGludC1kaXNhYmxlICovXHJcbmV4cG9ydCB0eXBlIExheW91dEl0ZW0gPSB7XHJcbiAgICB3OiBudW1iZXI7XHJcbiAgICBoOiBudW1iZXI7XHJcbiAgICB4OiBudW1iZXI7XHJcbiAgICB5OiBudW1iZXI7XHJcbiAgICBpZDogc3RyaW5nO1xyXG4gICAgbWluVz86IG51bWJlcjtcclxuICAgIG1pbkg/OiBudW1iZXI7XHJcbiAgICBtYXhXPzogbnVtYmVyO1xyXG4gICAgbWF4SD86IG51bWJlcjtcclxuICAgIG1vdmVkPzogYm9vbGVhbjtcclxuICAgIHN0YXRpYz86IGJvb2xlYW47XHJcbiAgICBpc0RyYWdnYWJsZT86IGJvb2xlYW4gfCBudWxsIHwgdW5kZWZpbmVkO1xyXG4gICAgaXNSZXNpemFibGU/OiBib29sZWFuIHwgbnVsbCB8IHVuZGVmaW5lZDtcclxufTtcclxuZXhwb3J0IHR5cGUgTGF5b3V0ID0gQXJyYXk8TGF5b3V0SXRlbT47XHJcbmV4cG9ydCB0eXBlIFBvc2l0aW9uID0ge1xyXG4gICAgbGVmdDogbnVtYmVyO1xyXG4gICAgdG9wOiBudW1iZXI7XHJcbiAgICB3aWR0aDogbnVtYmVyO1xyXG4gICAgaGVpZ2h0OiBudW1iZXI7XHJcbn07XHJcbmV4cG9ydCB0eXBlIFJlYWN0RHJhZ2dhYmxlQ2FsbGJhY2tEYXRhID0ge1xyXG4gICAgbm9kZTogSFRNTEVsZW1lbnQ7XHJcbiAgICB4PzogbnVtYmVyO1xyXG4gICAgeT86IG51bWJlcjtcclxuICAgIGRlbHRhWDogbnVtYmVyO1xyXG4gICAgZGVsdGFZOiBudW1iZXI7XHJcbiAgICBsYXN0WD86IG51bWJlcjtcclxuICAgIGxhc3RZPzogbnVtYmVyO1xyXG59O1xyXG5cclxuZXhwb3J0IHR5cGUgUGFydGlhbFBvc2l0aW9uID0geyBsZWZ0OiBudW1iZXI7IHRvcDogbnVtYmVyIH07XHJcbmV4cG9ydCB0eXBlIERyb3BwaW5nUG9zaXRpb24gPSB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyBlOiBFdmVudCB9O1xyXG5leHBvcnQgdHlwZSBTaXplID0geyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9O1xyXG5leHBvcnQgdHlwZSBHcmlkRHJhZ0V2ZW50ID0ge1xyXG4gICAgZTogRXZlbnQ7XHJcbiAgICBub2RlOiBIVE1MRWxlbWVudDtcclxuICAgIG5ld1Bvc2l0aW9uOiBQYXJ0aWFsUG9zaXRpb247XHJcbn07XHJcbmV4cG9ydCB0eXBlIEdyaWRSZXNpemVFdmVudCA9IHsgZTogRXZlbnQ7IG5vZGU6IEhUTUxFbGVtZW50OyBzaXplOiBTaXplIH07XHJcbmV4cG9ydCB0eXBlIERyYWdPdmVyRXZlbnQgPSBNb3VzZUV2ZW50ICYge1xyXG4gICAgbmF0aXZlRXZlbnQ6IHtcclxuICAgICAgICBsYXllclg6IG51bWJlcjtcclxuICAgICAgICBsYXllclk6IG51bWJlcjtcclxuICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAgICAgY2xhc3NOYW1lOiBTdHJpbmc7XHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcbn07XHJcblxyXG4vL3R5cGUgUkVsID0gUmVhY3RFbGVtZW50PGFueT47XHJcbi8vZXhwb3J0IHR5cGUgUmVhY3RDaGlsZHJlbiA9IFJlYWN0Q2hpbGRyZW5BcnJheTxSRWw+O1xyXG5cclxuLy8gQWxsIGNhbGxiYWNrcyBhcmUgb2YgdGhlIHNpZ25hdHVyZSAobGF5b3V0LCBvbGRJdGVtLCBuZXdJdGVtLCBwbGFjZWhvbGRlciwgZSkuXHJcbmV4cG9ydCB0eXBlIEV2ZW50Q2FsbGJhY2sgPSAoXHJcbiAgICBhcmcwOiBMYXlvdXQsXHJcbiAgICBvbGRJdGVtOiBMYXlvdXRJdGVtIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgIG5ld0l0ZW06IExheW91dEl0ZW0gfCBudWxsIHwgdW5kZWZpbmVkLFxyXG4gICAgcGxhY2Vob2xkZXI6IExheW91dEl0ZW0gfCBudWxsIHwgdW5kZWZpbmVkLFxyXG4gICAgYXJnNDogRXZlbnQsXHJcbiAgICBhcmc1OiBIVE1MRWxlbWVudCB8IG51bGwgfCB1bmRlZmluZWQsXHJcbikgPT4gdm9pZDtcclxuZXhwb3J0IHR5cGUgQ29tcGFjdFR5cGUgPSAoJ2hvcml6b250YWwnIHwgJ3ZlcnRpY2FsJykgfCBudWxsIHwgdW5kZWZpbmVkO1xyXG5cclxuY29uc3QgREVCVUcgPSBmYWxzZTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gdGhlIGJvdHRvbSBjb29yZGluYXRlIG9mIHRoZSBsYXlvdXQuXHJcbiAqXHJcbiAqIEBwYXJhbSAge0FycmF5fSBsYXlvdXQgTGF5b3V0IGFycmF5LlxyXG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgICAgIEJvdHRvbSBjb29yZGluYXRlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGJvdHRvbShsYXlvdXQ6IExheW91dCk6IG51bWJlciB7XHJcbiAgICBsZXQgbWF4ID0gMCxcclxuICAgICAgICBib3R0b21ZO1xyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheW91dC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIGJvdHRvbVkgPSBsYXlvdXRbaV0ueSArIGxheW91dFtpXS5oO1xyXG4gICAgICAgIGlmIChib3R0b21ZID4gbWF4KSB7XHJcbiAgICAgICAgICAgIG1heCA9IGJvdHRvbVk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG1heDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNsb25lTGF5b3V0KGxheW91dDogTGF5b3V0KTogTGF5b3V0IHtcclxuICAgIGNvbnN0IG5ld0xheW91dCA9IEFycmF5KGxheW91dC5sZW5ndGgpO1xyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheW91dC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIG5ld0xheW91dFtpXSA9IGNsb25lTGF5b3V0SXRlbShsYXlvdXRbaV0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ld0xheW91dDtcclxufVxyXG5cclxuLy8gRmFzdCBwYXRoIHRvIGNsb25pbmcsIHNpbmNlIHRoaXMgaXMgbW9ub21vcnBoaWNcclxuLyoqIE5PVEU6IFRoaXMgY29kZSBoYXMgYmVlbiBtb2RpZmllZCBmcm9tIHRoZSBvcmlnaW5hbCBzb3VyY2UgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNsb25lTGF5b3V0SXRlbShsYXlvdXRJdGVtOiBMYXlvdXRJdGVtKTogTGF5b3V0SXRlbSB7XHJcbiAgICBjb25zdCBjbG9uZWRMYXlvdXRJdGVtOiBMYXlvdXRJdGVtID0ge1xyXG4gICAgICAgIHc6IGxheW91dEl0ZW0udyxcclxuICAgICAgICBoOiBsYXlvdXRJdGVtLmgsXHJcbiAgICAgICAgeDogbGF5b3V0SXRlbS54LFxyXG4gICAgICAgIHk6IGxheW91dEl0ZW0ueSxcclxuICAgICAgICBpZDogbGF5b3V0SXRlbS5pZCxcclxuICAgICAgICBtb3ZlZDogISFsYXlvdXRJdGVtLm1vdmVkLFxyXG4gICAgICAgIHN0YXRpYzogISFsYXlvdXRJdGVtLnN0YXRpYyxcclxuICAgIH07XHJcblxyXG4gICAgaWYgKGxheW91dEl0ZW0ubWluVyAhPT0gdW5kZWZpbmVkKSB7IGNsb25lZExheW91dEl0ZW0ubWluVyA9IGxheW91dEl0ZW0ubWluVzt9XHJcbiAgICBpZiAobGF5b3V0SXRlbS5tYXhXICE9PSB1bmRlZmluZWQpIHsgY2xvbmVkTGF5b3V0SXRlbS5tYXhXID0gbGF5b3V0SXRlbS5tYXhXO31cclxuICAgIGlmIChsYXlvdXRJdGVtLm1pbkggIT09IHVuZGVmaW5lZCkgeyBjbG9uZWRMYXlvdXRJdGVtLm1pbkggPSBsYXlvdXRJdGVtLm1pbkg7fVxyXG4gICAgaWYgKGxheW91dEl0ZW0ubWF4SCAhPT0gdW5kZWZpbmVkKSB7IGNsb25lZExheW91dEl0ZW0ubWF4SCA9IGxheW91dEl0ZW0ubWF4SDt9XHJcbiAgICAvLyBUaGVzZSBjYW4gYmUgbnVsbFxyXG4gICAgaWYgKGxheW91dEl0ZW0uaXNEcmFnZ2FibGUgIT09IHVuZGVmaW5lZCkgeyBjbG9uZWRMYXlvdXRJdGVtLmlzRHJhZ2dhYmxlID0gbGF5b3V0SXRlbS5pc0RyYWdnYWJsZTt9XHJcbiAgICBpZiAobGF5b3V0SXRlbS5pc1Jlc2l6YWJsZSAhPT0gdW5kZWZpbmVkKSB7IGNsb25lZExheW91dEl0ZW0uaXNSZXNpemFibGUgPSBsYXlvdXRJdGVtLmlzUmVzaXphYmxlO31cclxuXHJcbiAgICByZXR1cm4gY2xvbmVkTGF5b3V0SXRlbTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdpdmVuIHR3byBsYXlvdXRpdGVtcywgY2hlY2sgaWYgdGhleSBjb2xsaWRlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNvbGxpZGVzKGwxOiBMYXlvdXRJdGVtLCBsMjogTGF5b3V0SXRlbSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKGwxLmlkID09PSBsMi5pZCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0gLy8gc2FtZSBlbGVtZW50XHJcbiAgICBpZiAobDEueCArIGwxLncgPD0gbDIueCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0gLy8gbDEgaXMgbGVmdCBvZiBsMlxyXG4gICAgaWYgKGwxLnggPj0gbDIueCArIGwyLncpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9IC8vIGwxIGlzIHJpZ2h0IG9mIGwyXHJcbiAgICBpZiAobDEueSArIGwxLmggPD0gbDIueSkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0gLy8gbDEgaXMgYWJvdmUgbDJcclxuICAgIGlmIChsMS55ID49IGwyLnkgKyBsMi5oKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSAvLyBsMSBpcyBiZWxvdyBsMlxyXG4gICAgcmV0dXJuIHRydWU7IC8vIGJveGVzIG92ZXJsYXBcclxufVxyXG5cclxuLyoqXHJcbiAqIEdpdmVuIGEgbGF5b3V0LCBjb21wYWN0IGl0LiBUaGlzIGludm9sdmVzIGdvaW5nIGRvd24gZWFjaCB5IGNvb3JkaW5hdGUgYW5kIHJlbW92aW5nIGdhcHNcclxuICogYmV0d2VlbiBpdGVtcy5cclxuICpcclxuICogQHBhcmFtICB7QXJyYXl9IGxheW91dCBMYXlvdXQuXHJcbiAqIEBwYXJhbSAge0Jvb2xlYW59IHZlcnRpY2FsQ29tcGFjdCBXaGV0aGVyIG9yIG5vdCB0byBjb21wYWN0IHRoZSBsYXlvdXRcclxuICogICB2ZXJ0aWNhbGx5LlxyXG4gKiBAcmV0dXJuIHtBcnJheX0gICAgICAgQ29tcGFjdGVkIExheW91dC5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb21wYWN0KFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBjb21wYWN0VHlwZTogQ29tcGFjdFR5cGUsXHJcbiAgICBjb2xzOiBudW1iZXIsXHJcbik6IExheW91dCB7XHJcbiAgICAvLyBTdGF0aWNzIGdvIGluIHRoZSBjb21wYXJlV2l0aCBhcnJheSByaWdodCBhd2F5IHNvIGl0ZW1zIGZsb3cgYXJvdW5kIHRoZW0uXHJcbiAgICBjb25zdCBjb21wYXJlV2l0aCA9IGdldFN0YXRpY3MobGF5b3V0KTtcclxuICAgIC8vIFdlIGdvIHRocm91Z2ggdGhlIGl0ZW1zIGJ5IHJvdyBhbmQgY29sdW1uLlxyXG4gICAgY29uc3Qgc29ydGVkID0gc29ydExheW91dEl0ZW1zKGxheW91dCwgY29tcGFjdFR5cGUpO1xyXG4gICAgLy8gSG9sZGluZyBmb3IgbmV3IGl0ZW1zLlxyXG4gICAgY29uc3Qgb3V0ID0gQXJyYXkobGF5b3V0Lmxlbmd0aCk7XHJcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gc29ydGVkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgbGV0IGwgPSBjbG9uZUxheW91dEl0ZW0oc29ydGVkW2ldKTtcclxuXHJcbiAgICAgICAgLy8gRG9uJ3QgbW92ZSBzdGF0aWMgZWxlbWVudHNcclxuICAgICAgICBpZiAoIWwuc3RhdGljKSB7XHJcbiAgICAgICAgICAgIGwgPSBjb21wYWN0SXRlbShjb21wYXJlV2l0aCwgbCwgY29tcGFjdFR5cGUsIGNvbHMsIHNvcnRlZCk7XHJcblxyXG4gICAgICAgICAgICAvLyBBZGQgdG8gY29tcGFyaXNvbiBhcnJheS4gV2Ugb25seSBjb2xsaWRlIHdpdGggaXRlbXMgYmVmb3JlIHRoaXMgb25lLlxyXG4gICAgICAgICAgICAvLyBTdGF0aWNzIGFyZSBhbHJlYWR5IGluIHRoaXMgYXJyYXkuXHJcbiAgICAgICAgICAgIGNvbXBhcmVXaXRoLnB1c2gobCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBBZGQgdG8gb3V0cHV0IGFycmF5IHRvIG1ha2Ugc3VyZSB0aGV5IHN0aWxsIGNvbWUgb3V0IGluIHRoZSByaWdodCBvcmRlci5cclxuICAgICAgICBvdXRbbGF5b3V0LmluZGV4T2Yoc29ydGVkW2ldKV0gPSBsO1xyXG5cclxuICAgICAgICAvLyBDbGVhciBtb3ZlZCBmbGFnLCBpZiBpdCBleGlzdHMuXHJcbiAgICAgICAgbC5tb3ZlZCA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBvdXQ7XHJcbn1cclxuXHJcbmNvbnN0IGhlaWdodFdpZHRoID0ge3g6ICd3JywgeTogJ2gnfTtcclxuXHJcbi8qKlxyXG4gKiBCZWZvcmUgbW92aW5nIGl0ZW0gZG93biwgaXQgd2lsbCBjaGVjayBpZiB0aGUgbW92ZW1lbnQgd2lsbCBjYXVzZSBjb2xsaXNpb25zIGFuZCBtb3ZlIHRob3NlIGl0ZW1zIGRvd24gYmVmb3JlLlxyXG4gKi9cclxuZnVuY3Rpb24gcmVzb2x2ZUNvbXBhY3Rpb25Db2xsaXNpb24oXHJcbiAgICBsYXlvdXQ6IExheW91dCxcclxuICAgIGl0ZW06IExheW91dEl0ZW0sXHJcbiAgICBtb3ZlVG9Db29yZDogbnVtYmVyLFxyXG4gICAgYXhpczogJ3gnIHwgJ3knLFxyXG4pIHtcclxuICAgIGNvbnN0IHNpemVQcm9wID0gaGVpZ2h0V2lkdGhbYXhpc107XHJcbiAgICBpdGVtW2F4aXNdICs9IDE7XHJcbiAgICBjb25zdCBpdGVtSW5kZXggPSBsYXlvdXRcclxuICAgICAgICAubWFwKGxheW91dEl0ZW0gPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gbGF5b3V0SXRlbS5pZDtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5pbmRleE9mKGl0ZW0uaWQpO1xyXG5cclxuICAgIC8vIEdvIHRocm91Z2ggZWFjaCBpdGVtIHdlIGNvbGxpZGUgd2l0aC5cclxuICAgIGZvciAobGV0IGkgPSBpdGVtSW5kZXggKyAxOyBpIDwgbGF5b3V0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgY29uc3Qgb3RoZXJJdGVtID0gbGF5b3V0W2ldO1xyXG4gICAgICAgIC8vIElnbm9yZSBzdGF0aWMgaXRlbXNcclxuICAgICAgICBpZiAob3RoZXJJdGVtLnN0YXRpYykge1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE9wdGltaXphdGlvbjogd2UgY2FuIGJyZWFrIGVhcmx5IGlmIHdlIGtub3cgd2UncmUgcGFzdCB0aGlzIGVsXHJcbiAgICAgICAgLy8gV2UgY2FuIGRvIHRoaXMgYi9jIGl0J3MgYSBzb3J0ZWQgbGF5b3V0XHJcbiAgICAgICAgaWYgKChheGlzPT09J3gnICYmIG90aGVySXRlbS55ID4gaXRlbS55ICsgaXRlbS5oICkgfHwgKGF4aXM9PT0neScgJiYgb3RoZXJJdGVtLnkgPiBtb3ZlVG9Db29yZCtpdGVtLmgpKSB7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNvbGxpZGVzKGl0ZW0sIG90aGVySXRlbSkpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZUNvbXBhY3Rpb25Db2xsaXNpb24oXHJcbiAgICAgICAgICAgICAgICBsYXlvdXQsXHJcbiAgICAgICAgICAgICAgICBvdGhlckl0ZW0sXHJcbiAgICAgICAgICAgICAgICBtb3ZlVG9Db29yZCArIGl0ZW1bc2l6ZVByb3BdLFxyXG4gICAgICAgICAgICAgICAgYXhpcyxcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaXRlbVtheGlzXSA9IG1vdmVUb0Nvb3JkO1xyXG59XHJcblxyXG4vKipcclxuICogQ29tcGFjdCBhbiBpdGVtIGluIHRoZSBsYXlvdXQuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29tcGFjdEl0ZW0oXHJcbiAgICBjb21wYXJlV2l0aDogTGF5b3V0LFxyXG4gICAgbDogTGF5b3V0SXRlbSxcclxuICAgIGNvbXBhY3RUeXBlOiBDb21wYWN0VHlwZSxcclxuICAgIGNvbHM6IG51bWJlcixcclxuICAgIGZ1bGxMYXlvdXQ6IExheW91dCxcclxuKTogTGF5b3V0SXRlbSB7XHJcbiAgICBjb25zdCBjb21wYWN0ViA9IGNvbXBhY3RUeXBlID09PSAndmVydGljYWwnO1xyXG4gICAgY29uc3QgY29tcGFjdEggPSBjb21wYWN0VHlwZSA9PT0gJ2hvcml6b250YWwnO1xyXG4gICAgaWYgKGNvbXBhY3RWKSB7XHJcbiAgICAgICAgLy8gQm90dG9tICd5JyBwb3NzaWJsZSBpcyB0aGUgYm90dG9tIG9mIHRoZSBsYXlvdXQuXHJcbiAgICAgICAgLy8gVGhpcyBhbGxvd3MgeW91IHRvIGRvIG5pY2Ugc3R1ZmYgbGlrZSBzcGVjaWZ5IHt5OiBJbmZpbml0eX1cclxuICAgICAgICAvLyBUaGlzIGlzIGhlcmUgYmVjYXVzZSB0aGUgbGF5b3V0IG11c3QgYmUgc29ydGVkIGluIG9yZGVyIHRvIGdldCB0aGUgY29ycmVjdCBib3R0b20gYHlgLlxyXG4gICAgICAgIGwueSA9IE1hdGgubWluKGJvdHRvbShjb21wYXJlV2l0aCksIGwueSk7XHJcbiAgICAgICAgLy8gTW92ZSB0aGUgZWxlbWVudCB1cCBhcyBmYXIgYXMgaXQgY2FuIGdvIHdpdGhvdXQgY29sbGlkaW5nLlxyXG4gICAgICAgIHdoaWxlIChsLnkgPiAwICYmICFnZXRGaXJzdENvbGxpc2lvbihjb21wYXJlV2l0aCwgbCkpIHtcclxuICAgICAgICAgICAgbC55LS07XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIGlmIChjb21wYWN0SCkge1xyXG4gICAgICAgIC8vIE1vdmUgdGhlIGVsZW1lbnQgbGVmdCBhcyBmYXIgYXMgaXQgY2FuIGdvIHdpdGhvdXQgY29sbGlkaW5nLlxyXG4gICAgICAgIHdoaWxlIChsLnggPiAwICYmICFnZXRGaXJzdENvbGxpc2lvbihjb21wYXJlV2l0aCwgbCkpIHtcclxuICAgICAgICAgICAgbC54LS07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIE1vdmUgaXQgZG93biwgYW5kIGtlZXAgbW92aW5nIGl0IGRvd24gaWYgaXQncyBjb2xsaWRpbmcuXHJcbiAgICBsZXQgY29sbGlkZXM7XHJcbiAgICB3aGlsZSAoKGNvbGxpZGVzID0gZ2V0Rmlyc3RDb2xsaXNpb24oY29tcGFyZVdpdGgsIGwpKSkge1xyXG4gICAgICAgIGlmIChjb21wYWN0SCkge1xyXG4gICAgICAgICAgICByZXNvbHZlQ29tcGFjdGlvbkNvbGxpc2lvbihmdWxsTGF5b3V0LCBsLCBjb2xsaWRlcy54ICsgY29sbGlkZXMudywgJ3gnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXNvbHZlQ29tcGFjdGlvbkNvbGxpc2lvbihmdWxsTGF5b3V0LCBsLCBjb2xsaWRlcy55ICsgY29sbGlkZXMuaCwgJ3knLCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFNpbmNlIHdlIGNhbid0IGdyb3cgd2l0aG91dCBib3VuZHMgaG9yaXpvbnRhbGx5LCBpZiB3ZSd2ZSBvdmVyZmxvd24sIGxldCdzIG1vdmUgaXQgZG93biBhbmQgdHJ5IGFnYWluLlxyXG4gICAgICAgIGlmIChjb21wYWN0SCAmJiBsLnggKyBsLncgPiBjb2xzKSB7XHJcbiAgICAgICAgICAgIGwueCA9IGNvbHMgLSBsLnc7XHJcbiAgICAgICAgICAgIGwueSsrO1xyXG5cclxuICAgICAgICAgICAgLy8gQUxzbyBtb3ZlIGVsZW1lbnQgYXMgbGVmdCBhcyBtdWNoIGFzIHdlIGNhbiAoa3RkLWN1c3RvbS1jaGFuZ2UpXHJcbiAgICAgICAgICAgIHdoaWxlIChsLnggPiAwICYmICFnZXRGaXJzdENvbGxpc2lvbihjb21wYXJlV2l0aCwgbCkpIHtcclxuICAgICAgICAgICAgICAgIGwueC0tO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gRW5zdXJlIHRoYXQgdGhlcmUgYXJlIG5vIG5lZ2F0aXZlIHBvc2l0aW9uc1xyXG4gICAgbC55ID0gTWF0aC5tYXgobC55LCAwKTtcclxuICAgIGwueCA9IE1hdGgubWF4KGwueCwgMCk7XHJcblxyXG4gICAgcmV0dXJuIGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHaXZlbiBhIGxheW91dCwgbWFrZSBzdXJlIGFsbCBlbGVtZW50cyBmaXQgd2l0aGluIGl0cyBib3VuZHMuXHJcbiAqXHJcbiAqIEBwYXJhbSAge0FycmF5fSBsYXlvdXQgTGF5b3V0IGFycmF5LlxyXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IGJvdW5kcyBOdW1iZXIgb2YgY29sdW1ucy5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb3JyZWN0Qm91bmRzKGxheW91dDogTGF5b3V0LCBib3VuZHM6IHsgY29sczogbnVtYmVyIH0pOiBMYXlvdXQge1xyXG4gICAgY29uc3QgY29sbGlkZXNXaXRoID0gZ2V0U3RhdGljcyhsYXlvdXQpO1xyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheW91dC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIGNvbnN0IGwgPSBsYXlvdXRbaV07XHJcbiAgICAgICAgLy8gT3ZlcmZsb3dzIHJpZ2h0XHJcbiAgICAgICAgaWYgKGwueCArIGwudyA+IGJvdW5kcy5jb2xzKSB7XHJcbiAgICAgICAgICAgIGwueCA9IGJvdW5kcy5jb2xzIC0gbC53O1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBPdmVyZmxvd3MgbGVmdFxyXG4gICAgICAgIGlmIChsLnggPCAwKSB7XHJcbiAgICAgICAgICAgIGwueCA9IDA7XHJcbiAgICAgICAgICAgIGwudyA9IGJvdW5kcy5jb2xzO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWwuc3RhdGljKSB7XHJcbiAgICAgICAgICAgIGNvbGxpZGVzV2l0aC5wdXNoKGwpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgc3RhdGljIGFuZCBjb2xsaWRlcyB3aXRoIG90aGVyIHN0YXRpY3MsIHdlIG11c3QgbW92ZSBpdCBkb3duLlxyXG4gICAgICAgICAgICAvLyBXZSBoYXZlIHRvIGRvIHNvbWV0aGluZyBuaWNlciB0aGFuIGp1c3QgbGV0dGluZyB0aGVtIG92ZXJsYXAuXHJcbiAgICAgICAgICAgIHdoaWxlIChnZXRGaXJzdENvbGxpc2lvbihjb2xsaWRlc1dpdGgsIGwpKSB7XHJcbiAgICAgICAgICAgICAgICBsLnkrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBsYXlvdXQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXQgYSBsYXlvdXQgaXRlbSBieSBJRC4gVXNlZCBzbyB3ZSBjYW4gb3ZlcnJpZGUgbGF0ZXIgb24gaWYgbmVjZXNzYXJ5LlxyXG4gKlxyXG4gKiBAcGFyYW0gIHtBcnJheX0gIGxheW91dCBMYXlvdXQgYXJyYXkuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gaWQgICAgIElEXHJcbiAqIEByZXR1cm4ge0xheW91dEl0ZW19ICAgIEl0ZW0gYXQgSUQuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGF5b3V0SXRlbShcclxuICAgIGxheW91dDogTGF5b3V0LFxyXG4gICAgaWQ6IHN0cmluZyxcclxuKTogTGF5b3V0SXRlbSB8IG51bGwgfCB1bmRlZmluZWQge1xyXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheW91dC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgIGlmIChsYXlvdXRbaV0uaWQgPT09IGlkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBsYXlvdXRbaV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIHRoZSBmaXJzdCBpdGVtIHRoaXMgbGF5b3V0IGNvbGxpZGVzIHdpdGguXHJcbiAqIEl0IGRvZXNuJ3QgYXBwZWFyIHRvIG1hdHRlciB3aGljaCBvcmRlciB3ZSBhcHByb2FjaCB0aGlzIGZyb20sIGFsdGhvdWdoXHJcbiAqIHBlcmhhcHMgdGhhdCBpcyB0aGUgd3JvbmcgdGhpbmcgdG8gZG8uXHJcbiAqXHJcbiAqIEBwYXJhbSAge09iamVjdH0gbGF5b3V0SXRlbSBMYXlvdXQgaXRlbS5cclxuICogQHJldHVybiB7T2JqZWN0fHVuZGVmaW5lZH0gIEEgY29sbGlkaW5nIGxheW91dCBpdGVtLCBvciB1bmRlZmluZWQuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rmlyc3RDb2xsaXNpb24oXHJcbiAgICBsYXlvdXQ6IExheW91dCxcclxuICAgIGxheW91dEl0ZW06IExheW91dEl0ZW0sXHJcbik6IExheW91dEl0ZW0gfCBudWxsIHwgdW5kZWZpbmVkIHtcclxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXlvdXQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICBpZiAoY29sbGlkZXMobGF5b3V0W2ldLCBsYXlvdXRJdGVtKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbGF5b3V0W2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0QWxsQ29sbGlzaW9ucyhcclxuICAgIGxheW91dDogTGF5b3V0LFxyXG4gICAgbGF5b3V0SXRlbTogTGF5b3V0SXRlbSxcclxuKTogQXJyYXk8TGF5b3V0SXRlbT4ge1xyXG4gICAgcmV0dXJuIGxheW91dC5maWx0ZXIobCA9PiBjb2xsaWRlcyhsLCBsYXlvdXRJdGVtKSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXQgYWxsIHN0YXRpYyBlbGVtZW50cy5cclxuICogQHBhcmFtICB7QXJyYXl9IGxheW91dCBBcnJheSBvZiBsYXlvdXQgb2JqZWN0cy5cclxuICogQHJldHVybiB7QXJyYXl9ICAgICAgICBBcnJheSBvZiBzdGF0aWMgbGF5b3V0IGl0ZW1zLi5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRTdGF0aWNzKGxheW91dDogTGF5b3V0KTogQXJyYXk8TGF5b3V0SXRlbT4ge1xyXG4gICAgcmV0dXJuIGxheW91dC5maWx0ZXIobCA9PiBsLnN0YXRpYyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNb3ZlIGFuIGVsZW1lbnQuIFJlc3BvbnNpYmxlIGZvciBkb2luZyBjYXNjYWRpbmcgbW92ZW1lbnRzIG9mIG90aGVyIGVsZW1lbnRzLlxyXG4gKlxyXG4gKiBAcGFyYW0gIHtBcnJheX0gICAgICBsYXlvdXQgICAgICAgICAgICBGdWxsIGxheW91dCB0byBtb2RpZnkuXHJcbiAqIEBwYXJhbSAge0xheW91dEl0ZW19IGwgICAgICAgICAgICAgICAgIGVsZW1lbnQgdG8gbW92ZS5cclxuICogQHBhcmFtICB7TnVtYmVyfSAgICAgW3hdICAgICAgICAgICAgICAgWCBwb3NpdGlvbiBpbiBncmlkIHVuaXRzLlxyXG4gKiBAcGFyYW0gIHtOdW1iZXJ9ICAgICBbeV0gICAgICAgICAgICAgICBZIHBvc2l0aW9uIGluIGdyaWQgdW5pdHMuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbW92ZUVsZW1lbnQoXHJcbiAgICBsYXlvdXQ6IExheW91dCxcclxuICAgIGw6IExheW91dEl0ZW0sXHJcbiAgICB4OiBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkLFxyXG4gICAgeTogbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgIGlzVXNlckFjdGlvbjogYm9vbGVhbiB8IG51bGwgfCB1bmRlZmluZWQsXHJcbiAgICBwcmV2ZW50Q29sbGlzaW9uOiBib29sZWFuIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgIGNvbXBhY3RUeXBlOiBDb21wYWN0VHlwZSxcclxuICAgIGNvbHM6IG51bWJlcixcclxuKTogTGF5b3V0IHtcclxuICAgIC8vIElmIHRoaXMgaXMgc3RhdGljIGFuZCBub3QgZXhwbGljaXRseSBlbmFibGVkIGFzIGRyYWdnYWJsZSxcclxuICAgIC8vIG5vIG1vdmUgaXMgcG9zc2libGUsIHNvIHdlIGNhbiBzaG9ydC1jaXJjdWl0IHRoaXMgaW1tZWRpYXRlbHkuXHJcbiAgICBpZiAobC5zdGF0aWMgJiYgbC5pc0RyYWdnYWJsZSAhPT0gdHJ1ZSkge1xyXG4gICAgICAgIHJldHVybiBsYXlvdXQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU2hvcnQtY2lyY3VpdCBpZiBub3RoaW5nIHRvIGRvLlxyXG4gICAgaWYgKGwueSA9PT0geSAmJiBsLnggPT09IHgpIHtcclxuICAgICAgICByZXR1cm4gbGF5b3V0O1xyXG4gICAgfVxyXG5cclxuICAgIGxvZyhcclxuICAgICAgICBgTW92aW5nIGVsZW1lbnQgJHtsLmlkfSB0byBbJHtTdHJpbmcoeCl9LCR7U3RyaW5nKHkpfV0gZnJvbSBbJHtsLnh9LCR7XHJcbiAgICAgICAgICAgIGwueVxyXG4gICAgICAgIH1dYCxcclxuICAgICk7XHJcbiAgICBjb25zdCBvbGRYID0gbC54O1xyXG4gICAgY29uc3Qgb2xkWSA9IGwueTtcclxuXHJcbiAgICAvLyBUaGlzIGlzIHF1aXRlIGEgYml0IGZhc3RlciB0aGFuIGV4dGVuZGluZyB0aGUgb2JqZWN0XHJcbiAgICBpZiAodHlwZW9mIHggPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgbC54ID0geDtcclxuICAgIH1cclxuICAgIGlmICh0eXBlb2YgeSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICBsLnkgPSB5O1xyXG4gICAgfVxyXG4gICAgbC5tb3ZlZCA9IHRydWU7XHJcblxyXG4gICAgLy8gSWYgdGhpcyBjb2xsaWRlcyB3aXRoIGFueXRoaW5nLCBtb3ZlIGl0LlxyXG4gICAgLy8gV2hlbiBkb2luZyB0aGlzIGNvbXBhcmlzb24sIHdlIGhhdmUgdG8gc29ydCB0aGUgaXRlbXMgd2UgY29tcGFyZSB3aXRoXHJcbiAgICAvLyB0byBlbnN1cmUsIGluIHRoZSBjYXNlIG9mIG11bHRpcGxlIGNvbGxpc2lvbnMsIHRoYXQgd2UncmUgZ2V0dGluZyB0aGVcclxuICAgIC8vIG5lYXJlc3QgY29sbGlzaW9uLlxyXG4gICAgbGV0IHNvcnRlZCA9IHNvcnRMYXlvdXRJdGVtcyhsYXlvdXQsIGNvbXBhY3RUeXBlKTtcclxuICAgIGNvbnN0IG1vdmluZ1VwID1cclxuICAgICAgICBjb21wYWN0VHlwZSA9PT0gJ3ZlcnRpY2FsJyAmJiB0eXBlb2YgeSA9PT0gJ251bWJlcidcclxuICAgICAgICAgICAgPyBvbGRZID49IHlcclxuICAgICAgICAgICAgOiBjb21wYWN0VHlwZSA9PT0gJ2hvcml6b250YWwnICYmIHR5cGVvZiB4ID09PSAnbnVtYmVyJ1xyXG4gICAgICAgICAgICAgICAgPyBvbGRYID49IHhcclxuICAgICAgICAgICAgICAgIDogZmFsc2U7XHJcbiAgICBpZiAobW92aW5nVXApIHtcclxuICAgICAgICBzb3J0ZWQgPSBzb3J0ZWQucmV2ZXJzZSgpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY29sbGlzaW9ucyA9IGdldEFsbENvbGxpc2lvbnMoc29ydGVkLCBsKTtcclxuXHJcbiAgICAvLyBUaGVyZSB3YXMgYSBjb2xsaXNpb247IGFib3J0XHJcbiAgICBpZiAocHJldmVudENvbGxpc2lvbiAmJiBjb2xsaXNpb25zLmxlbmd0aCkge1xyXG4gICAgICAgIGxvZyhgQ29sbGlzaW9uIHByZXZlbnRlZCBvbiAke2wuaWR9LCByZXZlcnRpbmcuYCk7XHJcbiAgICAgICAgbC54ID0gb2xkWDtcclxuICAgICAgICBsLnkgPSBvbGRZO1xyXG4gICAgICAgIGwubW92ZWQgPSBmYWxzZTtcclxuICAgICAgICByZXR1cm4gbGF5b3V0O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE1vdmUgZWFjaCBpdGVtIHRoYXQgY29sbGlkZXMgYXdheSBmcm9tIHRoaXMgZWxlbWVudC5cclxuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBjb2xsaXNpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgY29sbGlzaW9uID0gY29sbGlzaW9uc1tpXTtcclxuICAgICAgICBsb2coXHJcbiAgICAgICAgICAgIGBSZXNvbHZpbmcgY29sbGlzaW9uIGJldHdlZW4gJHtsLmlkfSBhdCBbJHtsLnh9LCR7bC55fV0gYW5kICR7XHJcbiAgICAgICAgICAgICAgICBjb2xsaXNpb24uaWRcclxuICAgICAgICAgICAgfSBhdCBbJHtjb2xsaXNpb24ueH0sJHtjb2xsaXNpb24ueX1dYCxcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHNvIHdlIGNhbid0IGluZmluaXRlIGxvb3BcclxuICAgICAgICBpZiAoY29sbGlzaW9uLm1vdmVkKSB7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRG9uJ3QgbW92ZSBzdGF0aWMgaXRlbXMgLSB3ZSBoYXZlIHRvIG1vdmUgKnRoaXMqIGVsZW1lbnQgYXdheVxyXG4gICAgICAgIGlmIChjb2xsaXNpb24uc3RhdGljKSB7XHJcbiAgICAgICAgICAgIGxheW91dCA9IG1vdmVFbGVtZW50QXdheUZyb21Db2xsaXNpb24oXHJcbiAgICAgICAgICAgICAgICBsYXlvdXQsXHJcbiAgICAgICAgICAgICAgICBjb2xsaXNpb24sXHJcbiAgICAgICAgICAgICAgICBsLFxyXG4gICAgICAgICAgICAgICAgaXNVc2VyQWN0aW9uLFxyXG4gICAgICAgICAgICAgICAgY29tcGFjdFR5cGUsXHJcbiAgICAgICAgICAgICAgICBjb2xzLFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxheW91dCA9IG1vdmVFbGVtZW50QXdheUZyb21Db2xsaXNpb24oXHJcbiAgICAgICAgICAgICAgICBsYXlvdXQsXHJcbiAgICAgICAgICAgICAgICBsLFxyXG4gICAgICAgICAgICAgICAgY29sbGlzaW9uLFxyXG4gICAgICAgICAgICAgICAgaXNVc2VyQWN0aW9uLFxyXG4gICAgICAgICAgICAgICAgY29tcGFjdFR5cGUsXHJcbiAgICAgICAgICAgICAgICBjb2xzLFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbGF5b3V0O1xyXG59XHJcblxyXG4vKipcclxuICogVGhpcyBpcyB3aGVyZSB0aGUgbWFnaWMgbmVlZHMgdG8gaGFwcGVuIC0gZ2l2ZW4gYSBjb2xsaXNpb24sIG1vdmUgYW4gZWxlbWVudCBhd2F5IGZyb20gdGhlIGNvbGxpc2lvbi5cclxuICogV2UgYXR0ZW1wdCB0byBtb3ZlIGl0IHVwIGlmIHRoZXJlJ3Mgcm9vbSwgb3RoZXJ3aXNlIGl0IGdvZXMgYmVsb3cuXHJcbiAqXHJcbiAqIEBwYXJhbSAge0FycmF5fSBsYXlvdXQgICAgICAgICAgICBGdWxsIGxheW91dCB0byBtb2RpZnkuXHJcbiAqIEBwYXJhbSAge0xheW91dEl0ZW19IGNvbGxpZGVzV2l0aCBMYXlvdXQgaXRlbSB3ZSdyZSBjb2xsaWRpbmcgd2l0aC5cclxuICogQHBhcmFtICB7TGF5b3V0SXRlbX0gaXRlbVRvTW92ZSAgIExheW91dCBpdGVtIHdlJ3JlIG1vdmluZy5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtb3ZlRWxlbWVudEF3YXlGcm9tQ29sbGlzaW9uKFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBjb2xsaWRlc1dpdGg6IExheW91dEl0ZW0sXHJcbiAgICBpdGVtVG9Nb3ZlOiBMYXlvdXRJdGVtLFxyXG4gICAgaXNVc2VyQWN0aW9uOiBib29sZWFuIHwgbnVsbCB8IHVuZGVmaW5lZCxcclxuICAgIGNvbXBhY3RUeXBlOiBDb21wYWN0VHlwZSxcclxuICAgIGNvbHM6IG51bWJlcixcclxuKTogTGF5b3V0IHtcclxuICAgIGNvbnN0IGNvbXBhY3RIID0gY29tcGFjdFR5cGUgPT09ICdob3Jpem9udGFsJztcclxuICAgIC8vIENvbXBhY3QgdmVydGljYWxseSBpZiBub3Qgc2V0IHRvIGhvcml6b250YWxcclxuICAgIGNvbnN0IGNvbXBhY3RWID0gY29tcGFjdFR5cGUgIT09ICdob3Jpem9udGFsJztcclxuICAgIGNvbnN0IHByZXZlbnRDb2xsaXNpb24gPSBjb2xsaWRlc1dpdGguc3RhdGljOyAvLyB3ZSdyZSBhbHJlYWR5IGNvbGxpZGluZyAobm90IGZvciBzdGF0aWMgaXRlbXMpXHJcblxyXG4gICAgLy8gSWYgdGhlcmUgaXMgZW5vdWdoIHNwYWNlIGFib3ZlIHRoZSBjb2xsaXNpb24gdG8gcHV0IHRoaXMgZWxlbWVudCwgbW92ZSBpdCB0aGVyZS5cclxuICAgIC8vIFdlIG9ubHkgZG8gdGhpcyBvbiB0aGUgbWFpbiBjb2xsaXNpb24gYXMgdGhpcyBjYW4gZ2V0IGZ1bmt5IGluIGNhc2NhZGVzIGFuZCBjYXVzZVxyXG4gICAgLy8gdW53YW50ZWQgc3dhcHBpbmcgYmVoYXZpb3IuXHJcbiAgICBpZiAoaXNVc2VyQWN0aW9uKSB7XHJcbiAgICAgICAgLy8gUmVzZXQgaXNVc2VyQWN0aW9uIGZsYWcgYmVjYXVzZSB3ZSdyZSBub3QgaW4gdGhlIG1haW4gY29sbGlzaW9uIGFueW1vcmUuXHJcbiAgICAgICAgaXNVc2VyQWN0aW9uID0gZmFsc2U7XHJcblxyXG4gICAgICAgIC8vIE1ha2UgYSBtb2NrIGl0ZW0gc28gd2UgZG9uJ3QgbW9kaWZ5IHRoZSBpdGVtIGhlcmUsIG9ubHkgbW9kaWZ5IGluIG1vdmVFbGVtZW50LlxyXG4gICAgICAgIGNvbnN0IGZha2VJdGVtOiBMYXlvdXRJdGVtID0ge1xyXG4gICAgICAgICAgICB4OiBjb21wYWN0SFxyXG4gICAgICAgICAgICAgICAgPyBNYXRoLm1heChjb2xsaWRlc1dpdGgueCAtIGl0ZW1Ub01vdmUudywgMClcclxuICAgICAgICAgICAgICAgIDogaXRlbVRvTW92ZS54LFxyXG4gICAgICAgICAgICB5OiBjb21wYWN0VlxyXG4gICAgICAgICAgICAgICAgPyBNYXRoLm1heChjb2xsaWRlc1dpdGgueSAtIGl0ZW1Ub01vdmUuaCwgMClcclxuICAgICAgICAgICAgICAgIDogaXRlbVRvTW92ZS55LFxyXG4gICAgICAgICAgICB3OiBpdGVtVG9Nb3ZlLncsXHJcbiAgICAgICAgICAgIGg6IGl0ZW1Ub01vdmUuaCxcclxuICAgICAgICAgICAgaWQ6ICctMScsXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gTm8gY29sbGlzaW9uPyBJZiBzbywgd2UgY2FuIGdvIHVwIHRoZXJlOyBvdGhlcndpc2UsIHdlJ2xsIGVuZCB1cCBtb3ZpbmcgZG93biBhcyBub3JtYWxcclxuICAgICAgICBpZiAoIWdldEZpcnN0Q29sbGlzaW9uKGxheW91dCwgZmFrZUl0ZW0pKSB7XHJcbiAgICAgICAgICAgIGxvZyhcclxuICAgICAgICAgICAgICAgIGBEb2luZyByZXZlcnNlIGNvbGxpc2lvbiBvbiAke2l0ZW1Ub01vdmUuaWR9IHVwIHRvIFske1xyXG4gICAgICAgICAgICAgICAgICAgIGZha2VJdGVtLnhcclxuICAgICAgICAgICAgICAgIH0sJHtmYWtlSXRlbS55fV0uYCxcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgcmV0dXJuIG1vdmVFbGVtZW50KFxyXG4gICAgICAgICAgICAgICAgbGF5b3V0LFxyXG4gICAgICAgICAgICAgICAgaXRlbVRvTW92ZSxcclxuICAgICAgICAgICAgICAgIGNvbXBhY3RIID8gZmFrZUl0ZW0ueCA6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIGNvbXBhY3RWID8gZmFrZUl0ZW0ueSA6IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIGlzVXNlckFjdGlvbixcclxuICAgICAgICAgICAgICAgIHByZXZlbnRDb2xsaXNpb24sXHJcbiAgICAgICAgICAgICAgICBjb21wYWN0VHlwZSxcclxuICAgICAgICAgICAgICAgIGNvbHMsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBtb3ZlRWxlbWVudChcclxuICAgICAgICBsYXlvdXQsXHJcbiAgICAgICAgaXRlbVRvTW92ZSxcclxuICAgICAgICBjb21wYWN0SCA/IGl0ZW1Ub01vdmUueCArIDEgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgY29tcGFjdFYgPyBpdGVtVG9Nb3ZlLnkgKyAxIDogdW5kZWZpbmVkLFxyXG4gICAgICAgIGlzVXNlckFjdGlvbixcclxuICAgICAgICBwcmV2ZW50Q29sbGlzaW9uLFxyXG4gICAgICAgIGNvbXBhY3RUeXBlLFxyXG4gICAgICAgIGNvbHMsXHJcbiAgICApO1xyXG59XHJcblxyXG4vKipcclxuICogSGVscGVyIHRvIGNvbnZlcnQgYSBudW1iZXIgdG8gYSBwZXJjZW50YWdlIHN0cmluZy5cclxuICpcclxuICogQHBhcmFtICB7TnVtYmVyfSBudW0gQW55IG51bWJlclxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9ICAgICBUaGF0IG51bWJlciBhcyBhIHBlcmNlbnRhZ2UuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcGVyYyhudW06IG51bWJlcik6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gbnVtICogMTAwICsgJyUnO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2V0VHJhbnNmb3JtKHt0b3AsIGxlZnQsIHdpZHRoLCBoZWlnaHR9OiBQb3NpdGlvbik6IE9iamVjdCB7XHJcbiAgICAvLyBSZXBsYWNlIHVuaXRsZXNzIGl0ZW1zIHdpdGggcHhcclxuICAgIGNvbnN0IHRyYW5zbGF0ZSA9IGB0cmFuc2xhdGUoJHtsZWZ0fXB4LCR7dG9wfXB4KWA7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlLFxyXG4gICAgICAgIFdlYmtpdFRyYW5zZm9ybTogdHJhbnNsYXRlLFxyXG4gICAgICAgIE1velRyYW5zZm9ybTogdHJhbnNsYXRlLFxyXG4gICAgICAgIG1zVHJhbnNmb3JtOiB0cmFuc2xhdGUsXHJcbiAgICAgICAgT1RyYW5zZm9ybTogdHJhbnNsYXRlLFxyXG4gICAgICAgIHdpZHRoOiBgJHt3aWR0aH1weGAsXHJcbiAgICAgICAgaGVpZ2h0OiBgJHtoZWlnaHR9cHhgLFxyXG4gICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNldFRvcExlZnQoe3RvcCwgbGVmdCwgd2lkdGgsIGhlaWdodH06IFBvc2l0aW9uKTogT2JqZWN0IHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgdG9wOiBgJHt0b3B9cHhgLFxyXG4gICAgICAgIGxlZnQ6IGAke2xlZnR9cHhgLFxyXG4gICAgICAgIHdpZHRoOiBgJHt3aWR0aH1weGAsXHJcbiAgICAgICAgaGVpZ2h0OiBgJHtoZWlnaHR9cHhgLFxyXG4gICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdldCBsYXlvdXQgaXRlbXMgc29ydGVkIGZyb20gdG9wIGxlZnQgdG8gcmlnaHQgYW5kIGRvd24uXHJcbiAqXHJcbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBsYXlvdXQgb2JqZWN0cy5cclxuICogQHJldHVybiB7QXJyYXl9ICAgICAgICBMYXlvdXQsIHNvcnRlZCBzdGF0aWMgaXRlbXMgZmlyc3QuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc29ydExheW91dEl0ZW1zKFxyXG4gICAgbGF5b3V0OiBMYXlvdXQsXHJcbiAgICBjb21wYWN0VHlwZTogQ29tcGFjdFR5cGUsXHJcbik6IExheW91dCB7XHJcbiAgICBpZiAoY29tcGFjdFR5cGUgPT09ICdob3Jpem9udGFsJykge1xyXG4gICAgICAgIHJldHVybiBzb3J0TGF5b3V0SXRlbXNCeUNvbFJvdyhsYXlvdXQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gc29ydExheW91dEl0ZW1zQnlSb3dDb2wobGF5b3V0KTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNvcnRMYXlvdXRJdGVtc0J5Um93Q29sKGxheW91dDogTGF5b3V0KTogTGF5b3V0IHtcclxuICAgIHJldHVybiAoW10gYXMgYW55W10pLmNvbmNhdChsYXlvdXQpLnNvcnQoZnVuY3Rpb24oYSwgYikge1xyXG4gICAgICAgIGlmIChhLnkgPiBiLnkgfHwgKGEueSA9PT0gYi55ICYmIGEueCA+IGIueCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDE7XHJcbiAgICAgICAgfSBlbHNlIGlmIChhLnkgPT09IGIueSAmJiBhLnggPT09IGIueCkge1xyXG4gICAgICAgICAgICAvLyBXaXRob3V0IHRoaXMsIHdlIGNhbiBnZXQgZGlmZmVyZW50IHNvcnQgcmVzdWx0cyBpbiBJRSB2cy4gQ2hyb21lL0ZGXHJcbiAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNvcnRMYXlvdXRJdGVtc0J5Q29sUm93KGxheW91dDogTGF5b3V0KTogTGF5b3V0IHtcclxuICAgIHJldHVybiAoW10gYXMgYW55W10pLmNvbmNhdChsYXlvdXQpLnNvcnQoZnVuY3Rpb24oYSwgYikge1xyXG4gICAgICAgIGlmIChhLnggPiBiLnggfHwgKGEueCA9PT0gYi54ICYmIGEueSA+IGIueSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAtMTtcclxuICAgIH0pO1xyXG59XHJcblxyXG4vKipcclxuICogVmFsaWRhdGUgYSBsYXlvdXQuIFRocm93cyBlcnJvcnMuXHJcbiAqXHJcbiAqIEBwYXJhbSAge0FycmF5fSAgbGF5b3V0ICAgICAgICBBcnJheSBvZiBsYXlvdXQgaXRlbXMuXHJcbiAqIEBwYXJhbSAge1N0cmluZ30gW2NvbnRleHROYW1lXSBDb250ZXh0IG5hbWUgZm9yIGVycm9ycy5cclxuICogQHRocm93ICB7RXJyb3J9ICAgICAgICAgICAgICAgIFZhbGlkYXRpb24gZXJyb3IuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVMYXlvdXQoXHJcbiAgICBsYXlvdXQ6IExheW91dCxcclxuICAgIGNvbnRleHROYW1lOiBzdHJpbmcgPSAnTGF5b3V0JyxcclxuKTogdm9pZCB7XHJcbiAgICBjb25zdCBzdWJQcm9wcyA9IFsneCcsICd5JywgJ3cnLCAnaCddO1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGxheW91dCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoY29udGV4dE5hbWUgKyAnIG11c3QgYmUgYW4gYXJyYXkhJyk7XHJcbiAgICB9XHJcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGF5b3V0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgaXRlbSA9IGxheW91dFtpXTtcclxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHN1YlByb3BzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbVtzdWJQcm9wc1tqXV0gIT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgICAgICAgICAgJ1JlYWN0R3JpZExheW91dDogJyArXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dE5hbWUgK1xyXG4gICAgICAgICAgICAgICAgICAgICdbJyArXHJcbiAgICAgICAgICAgICAgICAgICAgaSArXHJcbiAgICAgICAgICAgICAgICAgICAgJ10uJyArXHJcbiAgICAgICAgICAgICAgICAgICAgc3ViUHJvcHNbal0gK1xyXG4gICAgICAgICAgICAgICAgICAgICcgbXVzdCBiZSBhIG51bWJlciEnLFxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoaXRlbS5pZCAmJiB0eXBlb2YgaXRlbS5pZCAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgICAgJ1JlYWN0R3JpZExheW91dDogJyArXHJcbiAgICAgICAgICAgICAgICBjb250ZXh0TmFtZSArXHJcbiAgICAgICAgICAgICAgICAnWycgK1xyXG4gICAgICAgICAgICAgICAgaSArXHJcbiAgICAgICAgICAgICAgICAnXS5pIG11c3QgYmUgYSBzdHJpbmchJyxcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGl0ZW0uc3RhdGljICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGl0ZW0uc3RhdGljICE9PSAnYm9vbGVhbicpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgICAgJ1JlYWN0R3JpZExheW91dDogJyArXHJcbiAgICAgICAgICAgICAgICBjb250ZXh0TmFtZSArXHJcbiAgICAgICAgICAgICAgICAnWycgK1xyXG4gICAgICAgICAgICAgICAgaSArXHJcbiAgICAgICAgICAgICAgICAnXS5zdGF0aWMgbXVzdCBiZSBhIGJvb2xlYW4hJyxcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIEZsb3cgY2FuJ3QgcmVhbGx5IGZpZ3VyZSB0aGlzIG91dCwgc28gd2UganVzdCB1c2UgT2JqZWN0XHJcbmV4cG9ydCBmdW5jdGlvbiBhdXRvQmluZEhhbmRsZXJzKGVsOiBPYmplY3QsIGZuczogQXJyYXk8c3RyaW5nPik6IHZvaWQge1xyXG4gICAgZm5zLmZvckVhY2goa2V5ID0+IChlbFtrZXldID0gZWxba2V5XS5iaW5kKGVsKSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBsb2coLi4uYXJncykge1xyXG4gICAgaWYgKCFERUJVRykge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXHJcbiAgICBjb25zb2xlLmxvZyguLi5hcmdzKTtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IG5vb3AgPSAoKSA9PiB7fTtcclxuIl19