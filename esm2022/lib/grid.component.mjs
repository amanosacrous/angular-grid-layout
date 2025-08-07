import { ChangeDetectionStrategy, Component, ContentChildren, EventEmitter, Inject, Input, Output, ViewEncapsulation } from '@angular/core';
import { coerceNumberProperty } from './coercion/number-property';
import { KtdGridItemComponent } from './grid-item/grid-item.component';
import { combineLatest, merge, NEVER, Observable, of } from 'rxjs';
import { exhaustMap, map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { ktdGetGridItemRowHeight, ktdGridItemDragging, ktdGridItemLayoutItemAreEqual, ktdGridItemResizing, ktdGridItemsDragging } from './utils/grid.utils';
import { compact } from './utils/react-grid-layout.utils';
import { GRID_ITEM_GET_RENDER_DATA_TOKEN } from './grid.definitions';
import { ktdPointerUp, ktdPointerClientX, ktdPointerClientY } from './utils/pointer.utils';
import { getMutableClientRect } from './utils/client-rect';
import { ktdGetScrollTotalRelativeDifference$, ktdScrollIfNearElementClientRect$ } from './utils/scroll';
import { coerceBooleanProperty } from './coercion/boolean-property';
import { getTransformTransitionDurationInMs } from './utils/transition-duration';
import { DOCUMENT } from '@angular/common';
import * as i0 from "@angular/core";
import * as i1 from "./grid.service";
function getDragResizeEventData(gridItem, layout, multipleSelection) {
    return {
        layout,
        layoutItem: layout.find((item) => item.id === gridItem.id),
        gridItemRef: gridItem,
        selectedItems: multipleSelection && multipleSelection.map(selectedItem => ({
            layoutItem: layout.find((layoutItem) => layoutItem.id === selectedItem.id),
            gridItemRef: selectedItem
        }))
    };
}
function getColumnWidth(config, width) {
    const { cols, gap } = config;
    const widthExcludingGap = width - Math.max((gap * (cols - 1)), 0);
    return (widthExcludingGap / cols);
}
function getRowHeightInPixels(config, height) {
    const { rowHeight, layout, gap } = config;
    return rowHeight === 'fit' ? ktdGetGridItemRowHeight(layout, height, gap) : rowHeight;
}
function layoutToRenderItems(config, width, height) {
    const { layout, gap } = config;
    const rowHeightInPixels = getRowHeightInPixels(config, height);
    const itemWidthPerColumn = getColumnWidth(config, width);
    const renderItems = {};
    for (const item of layout) {
        renderItems[item.id] = {
            id: item.id,
            top: item.y * rowHeightInPixels + gap * item.y,
            left: item.x * itemWidthPerColumn + gap * item.x,
            width: item.w * itemWidthPerColumn + gap * Math.max(item.w - 1, 0),
            height: item.h * rowHeightInPixels + gap * Math.max(item.h - 1, 0),
        };
    }
    return renderItems;
}
function getGridHeight(layout, rowHeight, gap) {
    return layout.reduce((acc, cur) => Math.max(acc, (cur.y + cur.h) * rowHeight + Math.max(cur.y + cur.h - 1, 0) * gap), 0);
}
// eslint-disable-next-line @katoid/prefix-exported-code
export function parseRenderItemToPixels(renderItem) {
    return {
        id: renderItem.id,
        top: `${renderItem.top}px`,
        left: `${renderItem.left}px`,
        width: `${renderItem.width}px`,
        height: `${renderItem.height}px`
    };
}
// eslint-disable-next-line @katoid/prefix-exported-code
export function __gridItemGetRenderDataFactoryFunc(gridCmp) {
    return function (id) {
        return parseRenderItemToPixels(gridCmp.getItemRenderData(id));
    };
}
export function ktdGridItemGetRenderDataFactoryFunc(gridCmp) {
    // Workaround explained: https://github.com/ng-packagr/ng-packagr/issues/696#issuecomment-387114613
    const resultFunc = __gridItemGetRenderDataFactoryFunc(gridCmp);
    return resultFunc;
}
const defaultBackgroundConfig = {
    borderColor: '#ffa72678',
    gapColor: 'transparent',
    rowColor: 'transparent',
    columnColor: 'transparent',
    borderWidth: 1,
};
export class KtdGridComponent {
    /** Whether or not to update the internal layout when some dependent property change. */
    get compactOnPropsChange() { return this._compactOnPropsChange; }
    set compactOnPropsChange(value) {
        this._compactOnPropsChange = coerceBooleanProperty(value);
    }
    /** If true, grid items won't change position when being dragged over. Handy when using no compaction */
    get preventCollision() { return this._preventCollision; }
    set preventCollision(value) {
        this._preventCollision = coerceBooleanProperty(value);
    }
    /** Number of CSS pixels that would be scrolled on each 'tick' when auto scroll is performed. */
    get scrollSpeed() { return this._scrollSpeed; }
    set scrollSpeed(value) {
        this._scrollSpeed = coerceNumberProperty(value, 2);
    }
    /** Type of compaction that will be applied to the layout (vertical, horizontal or free). Defaults to 'vertical' */
    get compactType() {
        return this._compactType;
    }
    set compactType(val) {
        this._compactType = val;
    }
    /**
     * Row height as number or as 'fit'.
     * If rowHeight is a number value, it means that each row would have those css pixels in height.
     * if rowHeight is 'fit', it means that rows will fit in the height available. If 'fit' value is set, a 'height' should be also provided.
     */
    get rowHeight() { return this._rowHeight; }
    set rowHeight(val) {
        this._rowHeight = val === 'fit' ? val : Math.max(1, Math.round(coerceNumberProperty(val)));
    }
    /** Number of columns  */
    get cols() { return this._cols; }
    set cols(val) {
        this._cols = Math.max(1, Math.round(coerceNumberProperty(val)));
    }
    /** Layout of the grid. Array of all the grid items with its 'id' and position on the grid. */
    get layout() { return this._layout; }
    set layout(layout) {
        /**
         * Enhancement:
         * Only set layout if it's reference has changed and use a boolean to track whenever recalculate the layout on ngOnChanges.
         *
         * Why:
         * The normal use of this lib is having the variable layout in the outer component or in a store, assigning it whenever it changes and
         * binded in the component with it's input [layout]. In this scenario, we would always calculate one unnecessary change on the layout when
         * it is re-binded on the input.
         */
        this._layout = layout;
    }
    /** Grid gap in css pixels */
    get gap() {
        return this._gap;
    }
    set gap(val) {
        this._gap = Math.max(coerceNumberProperty(val), 0);
    }
    /**
     * If height is a number, fixes the height of the grid to it, recommended when rowHeight = 'fit' is used.
     * If height is null, height will be automatically set according to its inner grid items.
     * Defaults to null.
     * */
    get height() {
        return this._height;
    }
    set height(val) {
        this._height = typeof val === 'number' ? Math.max(val, 0) : null;
    }
    /**
     * Multiple items drag/resize
     * A list of selected items to move (drag or resize) together as a group.
     * The multi-selection of items is managed externally. By default, the library manages a single item, but if a set of item IDs is provided, the specified group will be handled as a unit."
     */
    get selectedItemsIds() {
        return this._selectedItemsIds;
    }
    set selectedItemsIds(val) {
        this._selectedItemsIds = val;
        if (val) {
            this.selectedItems = val.map((layoutItemId) => this._gridItems.find((gridItem) => gridItem.id === layoutItemId));
        }
        else {
            this.selectedItems = undefined;
        }
    }
    get backgroundConfig() {
        return this._backgroundConfig;
    }
    set backgroundConfig(val) {
        this._backgroundConfig = val;
        // If there is background configuration, add main grid background class. Grid background class comes with opacity 0.
        // It is done this way for adding opacity animation and to don't add any styles when grid background is null.
        const classList = this.elementRef.nativeElement.classList;
        this._backgroundConfig !== null ? classList.add('ktd-grid-background') : classList.remove('ktd-grid-background');
        // Set background visibility
        this.setGridBackgroundVisible(this._backgroundConfig?.show === 'always');
    }
    get config() {
        return {
            cols: this.cols,
            rowHeight: this.rowHeight,
            height: this.height,
            layout: this.layout,
            preventCollision: this.preventCollision,
            gap: this.gap,
        };
    }
    constructor(gridService, elementRef, viewContainerRef, renderer, ngZone, document) {
        this.gridService = gridService;
        this.elementRef = elementRef;
        this.viewContainerRef = viewContainerRef;
        this.renderer = renderer;
        this.ngZone = ngZone;
        this.document = document;
        /** Emits when layout change */
        this.layoutUpdated = new EventEmitter();
        /** Emits when drag starts */
        this.dragStarted = new EventEmitter();
        /** Emits when resize starts */
        this.resizeStarted = new EventEmitter();
        /** Emits when drag ends */
        this.dragEnded = new EventEmitter();
        /** Emits when resize ends */
        this.resizeEnded = new EventEmitter();
        /** Emits when a grid item is being resized and its bounds have changed */
        this.gridItemResize = new EventEmitter();
        /**
         * Parent element that contains the scroll. If an string is provided it would search that element by id on the dom.
         * If no data provided or null autoscroll is not performed.
         */
        this.scrollableParent = null;
        this._compactOnPropsChange = true;
        this._preventCollision = false;
        this._scrollSpeed = 2;
        this._compactType = 'vertical';
        this._rowHeight = 100;
        this._cols = 6;
        this._gap = 0;
        this._height = null;
        this.multiItemAlgorithm = 'default';
        this._backgroundConfig = null;
        /** References to the views of the placeholder elements. */
        this.placeholderRef = {};
        /** Elements that are rendered as placeholder when a list of grid items are being dragged */
        this.placeholder = {};
        this.subscriptions = [];
    }
    ngOnChanges(changes) {
        if (this.rowHeight === 'fit' && this.height == null) {
            console.warn(`KtdGridComponent: The @Input() height should not be null when using rowHeight 'fit'`);
        }
        let needsCompactLayout = false;
        let needsRecalculateRenderData = false;
        // TODO: Does fist change need to be compacted by default?
        // Compact layout whenever some dependent prop changes.
        if (changes.compactType || changes.cols || changes.layout) {
            needsCompactLayout = true;
        }
        // Check if wee need to recalculate rendering data.
        if (needsCompactLayout || changes.rowHeight || changes.height || changes.gap || changes.backgroundConfig) {
            needsRecalculateRenderData = true;
        }
        // Only compact layout if lib user has provided it. Lib users that want to save/store always the same layout  as it is represented (compacted)
        // can use KtdCompactGrid utility and pre-compact the layout. This is the recommended behaviour for always having a the same layout on this component
        // and the ones that uses it.
        if (needsCompactLayout && this.compactOnPropsChange) {
            this.compactLayout();
        }
        if (needsRecalculateRenderData) {
            this.calculateRenderData();
        }
    }
    ngAfterContentInit() {
        this.initSubscriptions();
    }
    ngAfterContentChecked() {
        this.render();
    }
    resize() {
        this.calculateRenderData();
        this.render();
    }
    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }
    compactLayout() {
        this.layout = compact(this.layout, this.compactType, this.cols);
    }
    getItemsRenderData() {
        return { ...this._gridItemsRenderData };
    }
    getItemRenderData(itemId) {
        return this._gridItemsRenderData[itemId];
    }
    calculateRenderData() {
        const clientRect = this.elementRef.nativeElement.getBoundingClientRect();
        this.gridCurrentHeight = this.height ?? (this.rowHeight === 'fit' ? clientRect.height : getGridHeight(this.layout, this.rowHeight, this.gap));
        this._gridItemsRenderData = layoutToRenderItems(this.config, clientRect.width, this.gridCurrentHeight);
        // Set Background CSS variables
        this.setBackgroundCssVariables(getRowHeightInPixels(this.config, this.gridCurrentHeight));
    }
    render() {
        this.renderer.setStyle(this.elementRef.nativeElement, 'height', `${this.gridCurrentHeight}px`);
        this.updateGridItemsStyles();
    }
    setBackgroundCssVariables(rowHeight) {
        const style = this.elementRef.nativeElement.style;
        if (this._backgroundConfig) {
            // structure
            style.setProperty('--gap', this.gap + 'px');
            style.setProperty('--row-height', rowHeight + 'px');
            style.setProperty('--columns', `${this.cols}`);
            style.setProperty('--border-width', (this._backgroundConfig.borderWidth ?? defaultBackgroundConfig.borderWidth) + 'px');
            // colors
            style.setProperty('--border-color', this._backgroundConfig.borderColor ?? defaultBackgroundConfig.borderColor);
            style.setProperty('--gap-color', this._backgroundConfig.gapColor ?? defaultBackgroundConfig.gapColor);
            style.setProperty('--row-color', this._backgroundConfig.rowColor ?? defaultBackgroundConfig.rowColor);
            style.setProperty('--column-color', this._backgroundConfig.columnColor ?? defaultBackgroundConfig.columnColor);
        }
        else {
            style.removeProperty('--gap');
            style.removeProperty('--row-height');
            style.removeProperty('--columns');
            style.removeProperty('--border-width');
            style.removeProperty('--border-color');
            style.removeProperty('--gap-color');
            style.removeProperty('--row-color');
            style.removeProperty('--column-color');
        }
    }
    updateGridItemsStyles() {
        this._gridItems.forEach(item => {
            const gridItemRenderData = this._gridItemsRenderData[item.id];
            if (gridItemRenderData == null) {
                console.error(`Couldn\'t find the specified grid item for the id: ${item.id}`);
            }
            else {
                item.setStyles(parseRenderItemToPixels(gridItemRenderData));
            }
        });
    }
    setGridBackgroundVisible(visible) {
        const classList = this.elementRef.nativeElement.classList;
        visible ? classList.add('ktd-grid-background-visible') : classList.remove('ktd-grid-background-visible');
    }
    initSubscriptions() {
        this.subscriptions = [
            this._gridItems.changes.pipe(startWith(this._gridItems), switchMap((gridItems) => {
                return merge(...gridItems.map((gridItem) => gridItem.dragStart$.pipe(map((event) => ({ event, gridItem, type: 'drag' })))), ...gridItems.map((gridItem) => gridItem.resizeStart$.pipe(map((event) => ({
                    event,
                    gridItem,
                    type: 'resize'
                }))))).pipe(exhaustMap(({ event, gridItem, type }) => {
                    const multipleSelection = this.selectedItems && [...this.selectedItems];
                    // Emit drag or resize start events. Ensure that is start event is inside the zone.
                    this.ngZone.run(() => (type === 'drag' ? this.dragStarted : this.resizeStarted).emit(getDragResizeEventData(gridItem, this.layout, multipleSelection)));
                    this.setGridBackgroundVisible(this._backgroundConfig?.show === 'whenDragging' || this._backgroundConfig?.show === 'always');
                    // Perform drag sequence
                    let gridItemsSelected = [gridItem];
                    if (multipleSelection && multipleSelection.some((currItem) => currItem.id === gridItem.id)) {
                        gridItemsSelected = multipleSelection;
                    }
                    return this.performDragSequence$(gridItemsSelected, event, type).pipe(map((layout) => ({ layout, gridItem, type, multipleSelection })));
                }));
            })).subscribe(({ layout, gridItem, type, multipleSelection }) => {
                this.layout = layout;
                // Calculate new rendering data given the new layout.
                this.calculateRenderData();
                // Emit drag or resize end events.
                (type === 'drag' ? this.dragEnded : this.resizeEnded).emit(getDragResizeEventData(gridItem, layout, multipleSelection));
                // Notify that the layout has been updated.
                this.layoutUpdated.emit(layout);
                this.setGridBackgroundVisible(this._backgroundConfig?.show === 'always');
            })
        ];
    }
    /**
     * Perform a general grid drag action, from start to end. A general grid drag action basically includes creating the placeholder element and adding
     * some class animations. calcNewStateFunc needs to be provided in order to calculate the new state of the layout.
     * @param gridItem that is been dragged
     * @param pointerDownEvent event (mousedown or touchdown) where the user initiated the drag
     * @param calcNewStateFunc function that return the new layout state and the drag element position
     */
    performDragSequence$(gridItems, pointerDownEvent, type) {
        return new Observable((observer) => {
            const scrollableParent = typeof this.scrollableParent === 'string' ? this.document.getElementById(this.scrollableParent) : this.scrollableParent;
            // Retrieve grid (parent) client rect.
            const gridElemClientRect = getMutableClientRect(this.elementRef.nativeElement);
            const dragElemClientRect = {};
            const newGridItemRenderData = {};
            let draggedItemsPos = {};
            const originalLayout = structuredClone(this.layout);
            gridItems.forEach((gridItem) => {
                // Retrieve gridItem (draggedElem) client rect.
                dragElemClientRect[gridItem.id] = getMutableClientRect(gridItem.elementRef.nativeElement);
                this.renderer.addClass(gridItem.elementRef.nativeElement, 'no-transitions');
                this.renderer.addClass(gridItem.elementRef.nativeElement, 'ktd-grid-item-dragging');
                const placeholderClientRect = {
                    ...dragElemClientRect[gridItem.id],
                    left: dragElemClientRect[gridItem.id].left - gridElemClientRect.left,
                    top: dragElemClientRect[gridItem.id].top - gridElemClientRect.top
                };
                this.createPlaceholderElement(gridItem.id, placeholderClientRect, gridItem.placeholder);
            });
            let newLayout;
            // TODO (enhancement): consider move this 'side effect' observable inside the main drag loop.
            //  - Pros are that we would not repeat subscriptions and takeUntil would shut down observables at the same time.
            //  - Cons are that moving this functionality as a side effect inside the main drag loop would be confusing.
            const scrollSubscription = this.ngZone.runOutsideAngular(() => (!scrollableParent ? NEVER : this.gridService.mouseOrTouchMove$(this.document).pipe(map((event) => ({
                pointerX: ktdPointerClientX(event),
                pointerY: ktdPointerClientY(event)
            })), ktdScrollIfNearElementClientRect$(scrollableParent, { scrollStep: this.scrollSpeed }))).pipe(takeUntil(ktdPointerUp(this.document))).subscribe());
            /**
             * Main subscription, it listens for 'pointer move' and 'scroll' events and recalculates the layout on each emission
             */
            const subscription = this.ngZone.runOutsideAngular(() => merge(combineLatest([
                this.gridService.mouseOrTouchMove$(this.document),
                ...(!scrollableParent ? [of({ top: 0, left: 0 })] : [
                    ktdGetScrollTotalRelativeDifference$(scrollableParent).pipe(startWith({ top: 0, left: 0 }) // Force first emission to allow CombineLatest to emit even no scroll event has occurred
                    )
                ])
            ])).pipe(takeUntil(ktdPointerUp(this.document))).subscribe(([pointerDragEvent, scrollDifference]) => {
                pointerDragEvent.preventDefault();
                /**
                 * Set the new layout to be the layout in which the calcNewStateFunc would be executed.
                 * NOTE: using the mutated layout is the way to go by 'react-grid-layout' utils. If we don't use the previous layout,
                 * some utilities from 'react-grid-layout' would not work as expected.
                 */
                const currentLayout = newLayout || this.layout;
                newLayout = currentLayout;
                // Get the correct newStateFunc depending on if we are dragging or resizing
                if (type === 'drag' && gridItems.length > 1) {
                    if (this.multiItemAlgorithm === 'static') {
                        const { layout, draggedItemPos } = ktdGridItemsDragging(gridItems, {
                            layout: originalLayout,
                            rowHeight: this.rowHeight,
                            height: this.height,
                            cols: this.cols,
                            preventCollision: this.preventCollision,
                            gap: this.gap,
                        }, this.compactType, {
                            pointerDownEvent,
                            pointerDragEvent,
                            gridElemClientRect,
                            dragElementsClientRect: dragElemClientRect,
                            scrollDifference
                        });
                        newLayout = layout;
                        draggedItemsPos = draggedItemPos;
                    }
                    else {
                        // TODO: cloning the full layout can be expensive! We should investigate workarounds, maybe by using a ktdGridItemDragging function that does not mutate the layout
                        newLayout = structuredClone(originalLayout);
                        // Sort grid items from top-left to bottom-right
                        const gridItemsSorted = gridItems.sort((a, b) => {
                            const rectA = dragElemClientRect[a.id];
                            const rectB = dragElemClientRect[b.id];
                            // First sort by top, then by left
                            if (rectA.top !== rectB.top) {
                                return rectA.top - rectB.top;
                            }
                            return rectA.left - rectB.left;
                        });
                        // Virtually put aLL elements at the infinity bottom if compact vertical and infinity right if compact horizontal!
                        newLayout.forEach(layoutItem => {
                            // If it is a dragged item, move to infinity!! We cleanup the space for the drag
                            if (dragElemClientRect[layoutItem.id]) {
                                if (this.compactType !== 'horizontal') {
                                    layoutItem.y = Infinity;
                                }
                                if (this.compactType !== 'vertical') {
                                    layoutItem.x = Infinity;
                                }
                            }
                        });
                        newLayout = compact(newLayout, this.compactType, this.cols);
                        gridItemsSorted.forEach((gridItem) => {
                            const { layout, draggedItemPos } = ktdGridItemDragging(gridItem, {
                                layout: newLayout,
                                rowHeight: this.rowHeight,
                                height: this.height,
                                cols: this.cols,
                                preventCollision: this.preventCollision,
                                gap: this.gap,
                            }, this.compactType, {
                                pointerDownEvent,
                                pointerDragEvent,
                                gridElemClientRect,
                                dragElemClientRect: dragElemClientRect[gridItem.id],
                                scrollDifference
                            });
                            // const pre = newLayout.find(item => item.id === gridItem.id);
                            // const act = layout.find(item => item.id === gridItem.id);
                            // const orig = originalLayout.find(item => item.id === gridItem.id);
                            // console.log(`Calc dragging ${gridItem.id}`, `pre: (${pre?.x}, ${pre?.y})`, `orig: (${orig?.x}, ${orig?.y})`, `act: (${act?.x}, ${act?.y})`);
                            newLayout = layout;
                            draggedItemsPos[gridItem.id] = draggedItemPos;
                        });
                    }
                }
                else {
                    const calcNewStateFunc = type === 'drag' ? ktdGridItemDragging : ktdGridItemResizing;
                    gridItems.forEach((gridItem) => {
                        const { layout, draggedItemPos } = calcNewStateFunc(gridItem, {
                            layout: newLayout,
                            rowHeight: this.rowHeight,
                            height: this.height,
                            cols: this.cols,
                            preventCollision: this.preventCollision,
                            gap: this.gap,
                        }, this.compactType, {
                            pointerDownEvent,
                            pointerDragEvent,
                            gridElemClientRect,
                            dragElemClientRect: dragElemClientRect[gridItem.id],
                            scrollDifference
                        });
                        newLayout = layout;
                        draggedItemsPos[gridItem.id] = draggedItemPos;
                    });
                }
                this.gridCurrentHeight = this.height ?? (this.rowHeight === 'fit' ? gridElemClientRect.height : getGridHeight(newLayout, this.rowHeight, this.gap));
                this._gridItemsRenderData = layoutToRenderItems({
                    cols: this.cols,
                    rowHeight: this.rowHeight,
                    height: this.height,
                    layout: newLayout,
                    preventCollision: this.preventCollision,
                    gap: this.gap,
                }, gridElemClientRect.width, gridElemClientRect.height);
                // Modify the position of the dragged item to be the once we want (for example the mouse position or whatever)
                gridItems.forEach((gridItem) => {
                    newGridItemRenderData[gridItem.id] = { ...this._gridItemsRenderData[gridItem.id] };
                    const placeholderStyles = parseRenderItemToPixels(newGridItemRenderData[gridItem.id]);
                    // Put the real final position to the placeholder element
                    this.placeholder[gridItem.id].style.width = placeholderStyles.width;
                    this.placeholder[gridItem.id].style.height = placeholderStyles.height;
                    this.placeholder[gridItem.id].style.transform = `translateX(${placeholderStyles.left}) translateY(${placeholderStyles.top})`;
                    this._gridItemsRenderData[gridItem.id] = {
                        ...draggedItemsPos[gridItem.id],
                        id: this._gridItemsRenderData[gridItem.id].id
                    };
                });
                this.setBackgroundCssVariables(this.rowHeight === 'fit' ? ktdGetGridItemRowHeight(newLayout, gridElemClientRect.height, this.gap) : this.rowHeight);
                this.render();
                gridItems.forEach((gridItem) => {
                    // If we are performing a resize, and bounds have changed, emit event.
                    // NOTE: Only emit on resize for now. Use case for normal drag is not justified for now. Emitting on resize is, since we may want to re-render the grid item or the placeholder in order to fit the new bounds.
                    if (type === 'resize') {
                        const prevGridItem = currentLayout.find(item => item.id === gridItem.id);
                        const newGridItem = newLayout.find(item => item.id === gridItem.id);
                        // Check if item resized has changed, if so, emit resize change event
                        if (!ktdGridItemLayoutItemAreEqual(prevGridItem, newGridItem)) {
                            this.gridItemResize.emit({
                                width: newGridItemRenderData[gridItem.id].width,
                                height: newGridItemRenderData[gridItem.id].height,
                                gridItemRef: getDragResizeEventData(gridItem, newLayout).gridItemRef
                            });
                        }
                    }
                });
            }, (error) => observer.error(error), () => {
                this.ngZone.run(() => {
                    gridItems.forEach((gridItem) => {
                        // Remove drag classes
                        this.renderer.removeClass(gridItem.elementRef.nativeElement, 'no-transitions');
                        this.renderer.removeClass(gridItem.elementRef.nativeElement, 'ktd-grid-item-dragging');
                        this.addGridItemAnimatingClass(gridItem).subscribe();
                        // Consider destroying the placeholder after the animation has finished.
                        this.destroyPlaceholder(gridItem.id);
                    });
                    if (newLayout) {
                        // TODO: newLayout should already be pruned. If not, it should have type Layout, not KtdGridLayout as it is now.
                        // Prune react-grid-layout compact extra properties.
                        observer.next(newLayout.map(item => ({
                            id: item.id,
                            x: item.x,
                            y: item.y,
                            w: item.w,
                            h: item.h,
                            minW: item.minW,
                            minH: item.minH,
                            maxW: item.maxW,
                            maxH: item.maxH,
                        })));
                    }
                    else {
                        // TODO: Need we really to emit if there is no layout change but drag started and ended?
                        observer.next(this.layout);
                    }
                    observer.complete();
                });
            }));
            return () => {
                scrollSubscription.unsubscribe();
                subscription.unsubscribe();
            };
        });
    }
    /**
     * It adds the `ktd-grid-item-animating` class and removes it when the animated transition is complete.
     * This function is meant to be executed when the drag has ended.
     * @param gridItem that has been dragged
     */
    addGridItemAnimatingClass(gridItem) {
        return new Observable(observer => {
            const duration = getTransformTransitionDurationInMs(gridItem.elementRef.nativeElement);
            if (duration === 0) {
                observer.next();
                observer.complete();
                return;
            }
            this.renderer.addClass(gridItem.elementRef.nativeElement, 'ktd-grid-item-animating');
            const handler = ((event) => {
                if (!event || (event.target === gridItem.elementRef.nativeElement && event.propertyName === 'transform')) {
                    this.renderer.removeClass(gridItem.elementRef.nativeElement, 'ktd-grid-item-animating');
                    removeEventListener();
                    clearTimeout(timeout);
                    observer.next();
                    observer.complete();
                }
            });
            // If a transition is short enough, the browser might not fire the `transitionend` event.
            // Since we know how long it's supposed to take, add a timeout with a 50% buffer that'll
            // fire if the transition hasn't completed when it was supposed to.
            const timeout = setTimeout(handler, duration * 1.5);
            const removeEventListener = this.renderer.listen(gridItem.elementRef.nativeElement, 'transitionend', handler);
        });
    }
    /** Creates placeholder element */
    createPlaceholderElement(gridItemId, clientRect, gridItemPlaceholder) {
        this.placeholder[gridItemId] = this.renderer.createElement('div');
        this.placeholder[gridItemId].style.width = `${clientRect.width}px`;
        this.placeholder[gridItemId].style.height = `${clientRect.height}px`;
        this.placeholder[gridItemId].style.transform = `translateX(${clientRect.left}px) translateY(${clientRect.top}px)`;
        this.placeholder[gridItemId].classList.add('ktd-grid-item-placeholder');
        this.renderer.appendChild(this.elementRef.nativeElement, this.placeholder[gridItemId]);
        // Create and append custom placeholder if provided.
        // Important: Append it after creating & appending the container placeholder. This way we ensure parent bounds are set when creating the embeddedView.
        if (gridItemPlaceholder) {
            this.placeholderRef[gridItemId] = this.viewContainerRef.createEmbeddedView(gridItemPlaceholder.templateRef, gridItemPlaceholder.data);
            this.placeholderRef[gridItemId].rootNodes.forEach(node => this.placeholder[gridItemId].appendChild(node));
            this.placeholderRef[gridItemId].detectChanges();
        }
        else {
            this.placeholder[gridItemId].classList.add('ktd-grid-item-placeholder-default');
        }
    }
    /** Destroys the placeholder element and its ViewRef. */
    destroyPlaceholder(gridItemId) {
        this.placeholder[gridItemId]?.remove();
        this.placeholderRef[gridItemId]?.destroy();
        this.placeholder[gridItemId] = this.placeholderRef[gridItemId] = null;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridComponent, deps: [{ token: i1.KtdGridService }, { token: i0.ElementRef }, { token: i0.ViewContainerRef }, { token: i0.Renderer2 }, { token: i0.NgZone }, { token: DOCUMENT }], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "16.2.12", type: KtdGridComponent, isStandalone: true, selector: "ktd-grid", inputs: { scrollableParent: "scrollableParent", compactOnPropsChange: "compactOnPropsChange", preventCollision: "preventCollision", scrollSpeed: "scrollSpeed", compactType: "compactType", rowHeight: "rowHeight", cols: "cols", layout: "layout", gap: "gap", height: "height", multiItemAlgorithm: "multiItemAlgorithm", selectedItemsIds: "selectedItemsIds", backgroundConfig: "backgroundConfig" }, outputs: { layoutUpdated: "layoutUpdated", dragStarted: "dragStarted", resizeStarted: "resizeStarted", dragEnded: "dragEnded", resizeEnded: "resizeEnded", gridItemResize: "gridItemResize" }, providers: [
            {
                provide: GRID_ITEM_GET_RENDER_DATA_TOKEN,
                useFactory: ktdGridItemGetRenderDataFactoryFunc,
                deps: [KtdGridComponent]
            }
        ], queries: [{ propertyName: "_gridItems", predicate: KtdGridItemComponent, descendants: true }], usesOnChanges: true, ngImport: i0, template: "<ng-content></ng-content>", styles: ["ktd-grid{display:block;position:relative;width:100%}ktd-grid.ktd-grid-background:before{content:\"\";border:none;position:absolute;inset:0;z-index:0;transition:opacity .2s;opacity:0;background-image:repeating-linear-gradient(var(--border-color) 0 var(--border-width),var(--row-color) var(--border-width) calc(var(--row-height) - var(--border-width)),var(--border-color) calc(var(--row-height) - var(--border-width)) calc(var(--row-height)),var(--gap-color) calc(var(--row-height)) calc(var(--row-height) + var(--gap))),repeating-linear-gradient(90deg,var(--border-color) 0 var(--border-width),var(--column-color) var(--border-width) calc(100% - (var(--border-width) + var(--gap))),var(--border-color) calc(100% - (var(--border-width) + var(--gap))) calc(100% - var(--gap)),var(--gap-color) calc(100% - var(--gap)) 100%);background-size:calc((100% + var(--gap)) / var(--columns)) calc(var(--row-height) + var(--gap));background-position:0 0}ktd-grid.ktd-grid-background.ktd-grid-background-visible:before{opacity:1}ktd-grid ktd-grid-item.ktd-grid-item-dragging,ktd-grid ktd-grid-item.ktd-grid-item-animating{z-index:1000}ktd-grid ktd-grid-item.no-transitions{transition:none!important}ktd-grid .ktd-grid-item-placeholder{position:absolute;z-index:0;transition-property:transform;transition:all .15s ease}ktd-grid .ktd-grid-item-placeholder-default{background-color:#8b0000;opacity:.6}\n"], changeDetection: i0.ChangeDetectionStrategy.OnPush, encapsulation: i0.ViewEncapsulation.None }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridComponent, decorators: [{
            type: Component,
            args: [{ standalone: true, selector: 'ktd-grid', encapsulation: ViewEncapsulation.None, changeDetection: ChangeDetectionStrategy.OnPush, providers: [
                        {
                            provide: GRID_ITEM_GET_RENDER_DATA_TOKEN,
                            useFactory: ktdGridItemGetRenderDataFactoryFunc,
                            deps: [KtdGridComponent]
                        }
                    ], template: "<ng-content></ng-content>", styles: ["ktd-grid{display:block;position:relative;width:100%}ktd-grid.ktd-grid-background:before{content:\"\";border:none;position:absolute;inset:0;z-index:0;transition:opacity .2s;opacity:0;background-image:repeating-linear-gradient(var(--border-color) 0 var(--border-width),var(--row-color) var(--border-width) calc(var(--row-height) - var(--border-width)),var(--border-color) calc(var(--row-height) - var(--border-width)) calc(var(--row-height)),var(--gap-color) calc(var(--row-height)) calc(var(--row-height) + var(--gap))),repeating-linear-gradient(90deg,var(--border-color) 0 var(--border-width),var(--column-color) var(--border-width) calc(100% - (var(--border-width) + var(--gap))),var(--border-color) calc(100% - (var(--border-width) + var(--gap))) calc(100% - var(--gap)),var(--gap-color) calc(100% - var(--gap)) 100%);background-size:calc((100% + var(--gap)) / var(--columns)) calc(var(--row-height) + var(--gap));background-position:0 0}ktd-grid.ktd-grid-background.ktd-grid-background-visible:before{opacity:1}ktd-grid ktd-grid-item.ktd-grid-item-dragging,ktd-grid ktd-grid-item.ktd-grid-item-animating{z-index:1000}ktd-grid ktd-grid-item.no-transitions{transition:none!important}ktd-grid .ktd-grid-item-placeholder{position:absolute;z-index:0;transition-property:transform;transition:all .15s ease}ktd-grid .ktd-grid-item-placeholder-default{background-color:#8b0000;opacity:.6}\n"] }]
        }], ctorParameters: function () { return [{ type: i1.KtdGridService }, { type: i0.ElementRef }, { type: i0.ViewContainerRef }, { type: i0.Renderer2 }, { type: i0.NgZone }, { type: Document, decorators: [{
                    type: Inject,
                    args: [DOCUMENT]
                }] }]; }, propDecorators: { _gridItems: [{
                type: ContentChildren,
                args: [KtdGridItemComponent, { descendants: true }]
            }], layoutUpdated: [{
                type: Output
            }], dragStarted: [{
                type: Output
            }], resizeStarted: [{
                type: Output
            }], dragEnded: [{
                type: Output
            }], resizeEnded: [{
                type: Output
            }], gridItemResize: [{
                type: Output
            }], scrollableParent: [{
                type: Input
            }], compactOnPropsChange: [{
                type: Input
            }], preventCollision: [{
                type: Input
            }], scrollSpeed: [{
                type: Input
            }], compactType: [{
                type: Input
            }], rowHeight: [{
                type: Input
            }], cols: [{
                type: Input
            }], layout: [{
                type: Input
            }], gap: [{
                type: Input
            }], height: [{
                type: Input
            }], multiItemAlgorithm: [{
                type: Input
            }], selectedItemsIds: [{
                type: Input
            }], backgroundConfig: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JpZC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvZ3JpZC5jb21wb25lbnQudHMiLCIuLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvZ3JpZC5jb21wb25lbnQuaHRtbCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ29DLHVCQUF1QixFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQStCLFlBQVksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUN0SCxNQUFNLEVBQXlELGlCQUFpQixFQUNqSCxNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsb0JBQW9CLEVBQWUsTUFBTSw0QkFBNEIsQ0FBQztBQUMvRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFZLEVBQUUsRUFBZ0IsTUFBTSxNQUFNLENBQUM7QUFDM0YsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNsRixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsbUJBQW1CLEVBQUUsNkJBQTZCLEVBQUUsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM1SixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUNILCtCQUErQixFQUNsQyxNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUczRixPQUFPLEVBQUUsb0JBQW9CLEVBQWlCLE1BQU0scUJBQXFCLENBQUM7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QixTQUFTO2lDQUNNLElBQUksWUFDTixVQUFVLGlCQUdMLGlCQUFpQixDQUFDLElBQUksbUJBQ3BCLHVCQUF1QixDQUFDLE1BQU0sYUFDcEM7d0JBQ1A7NEJBQ0ksT0FBTyxFQUFFLCtCQUErQjs0QkFDeEMsVUFBVSxFQUFFLG1DQUFtQzs0QkFDL0MsSUFBSSxFQUFFLGtCQUFrQjt5QkFDM0I7cUJBQ0o7OzBCQTZOWSxNQUFNOzJCQUFDLFFBQVE7NENBek5nQyxVQUFVO3NCQUFyRSxlQUFlO3VCQUFDLG9CQUFvQixFQUFFLEVBQUMsV0FBVyxFQUFFLElBQUksRUFBQztnQkFHaEQsYUFBYTtzQkFBdEIsTUFBTTtnQkFHRyxXQUFXO3NCQUFwQixNQUFNO2dCQUdHLGFBQWE7c0JBQXRCLE1BQU07Z0JBR0csU0FBUztzQkFBbEIsTUFBTTtnQkFHRyxXQUFXO3NCQUFwQixNQUFNO2dCQUdHLGNBQWM7c0JBQXZCLE1BQU07Z0JBTUUsZ0JBQWdCO3NCQUF4QixLQUFLO2dCQUlGLG9CQUFvQjtzQkFEdkIsS0FBSztnQkFXRixnQkFBZ0I7c0JBRG5CLEtBQUs7Z0JBV0YsV0FBVztzQkFEZCxLQUFLO2dCQVdGLFdBQVc7c0JBRGQsS0FBSztnQkFpQkYsU0FBUztzQkFEWixLQUFLO2dCQVdGLElBQUk7c0JBRFAsS0FBSztnQkFXRixNQUFNO3NCQURULEtBQUs7Z0JBb0JGLEdBQUc7c0JBRE4sS0FBSztnQkFrQkYsTUFBTTtzQkFEVCxLQUFLO2dCQVdHLGtCQUFrQjtzQkFBMUIsS0FBSztnQkFRRixnQkFBZ0I7c0JBRG5CLEtBQUs7Z0JBeUJGLGdCQUFnQjtzQkFEbkIsS0FBSyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XHJcbiAgICBBZnRlckNvbnRlbnRDaGVja2VkLCBBZnRlckNvbnRlbnRJbml0LCBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgQ29tcG9uZW50LCBDb250ZW50Q2hpbGRyZW4sIEVsZW1lbnRSZWYsIEVtYmVkZGVkVmlld1JlZiwgRXZlbnRFbWl0dGVyLCBJbmplY3QsIElucHV0LFxyXG4gICAgTmdab25lLCBPbkNoYW5nZXMsIE9uRGVzdHJveSwgT3V0cHV0LCBRdWVyeUxpc3QsIFJlbmRlcmVyMiwgU2ltcGxlQ2hhbmdlcywgVmlld0NvbnRhaW5lclJlZiwgVmlld0VuY2Fwc3VsYXRpb25cclxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgY29lcmNlTnVtYmVyUHJvcGVydHksIE51bWJlcklucHV0IH0gZnJvbSAnLi9jb2VyY2lvbi9udW1iZXItcHJvcGVydHknO1xyXG5pbXBvcnQgeyBLdGRHcmlkSXRlbUNvbXBvbmVudCB9IGZyb20gJy4vZ3JpZC1pdGVtL2dyaWQtaXRlbS5jb21wb25lbnQnO1xyXG5pbXBvcnQgeyBjb21iaW5lTGF0ZXN0LCBtZXJnZSwgTkVWRVIsIE9ic2VydmFibGUsIE9ic2VydmVyLCBvZiwgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IGV4aGF1c3RNYXAsIG1hcCwgc3RhcnRXaXRoLCBzd2l0Y2hNYXAsIHRha2VVbnRpbCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcclxuaW1wb3J0IHsga3RkR2V0R3JpZEl0ZW1Sb3dIZWlnaHQsIGt0ZEdyaWRJdGVtRHJhZ2dpbmcsIGt0ZEdyaWRJdGVtTGF5b3V0SXRlbUFyZUVxdWFsLCBrdGRHcmlkSXRlbVJlc2l6aW5nLCBrdGRHcmlkSXRlbXNEcmFnZ2luZyB9IGZyb20gJy4vdXRpbHMvZ3JpZC51dGlscyc7XHJcbmltcG9ydCB7IGNvbXBhY3QgfSBmcm9tICcuL3V0aWxzL3JlYWN0LWdyaWQtbGF5b3V0LnV0aWxzJztcclxuaW1wb3J0IHtcclxuICAgIEdSSURfSVRFTV9HRVRfUkVOREVSX0RBVEFfVE9LRU4sIEt0ZEdyaWRCYWNrZ3JvdW5kQ2ZnLCBLdGRHcmlkQ2ZnLCBLdGRHcmlkQ29tcGFjdFR5cGUsIEt0ZEdyaWRJdGVtUmVjdCwgS3RkR3JpZEl0ZW1SZW5kZXJEYXRhLCBLdGRHcmlkTGF5b3V0LCBLdGRHcmlkTGF5b3V0SXRlbVxyXG59IGZyb20gJy4vZ3JpZC5kZWZpbml0aW9ucyc7XHJcbmltcG9ydCB7IGt0ZFBvaW50ZXJVcCwga3RkUG9pbnRlckNsaWVudFgsIGt0ZFBvaW50ZXJDbGllbnRZIH0gZnJvbSAnLi91dGlscy9wb2ludGVyLnV0aWxzJztcclxuaW1wb3J0IHsgS3RkRGljdGlvbmFyeSB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgS3RkR3JpZFNlcnZpY2UgfSBmcm9tICcuL2dyaWQuc2VydmljZSc7XHJcbmltcG9ydCB7IGdldE11dGFibGVDbGllbnRSZWN0LCBLdGRDbGllbnRSZWN0IH0gZnJvbSAnLi91dGlscy9jbGllbnQtcmVjdCc7XHJcbmltcG9ydCB7IGt0ZEdldFNjcm9sbFRvdGFsUmVsYXRpdmVEaWZmZXJlbmNlJCwga3RkU2Nyb2xsSWZOZWFyRWxlbWVudENsaWVudFJlY3QkIH0gZnJvbSAnLi91dGlscy9zY3JvbGwnO1xyXG5pbXBvcnQgeyBCb29sZWFuSW5wdXQsIGNvZXJjZUJvb2xlYW5Qcm9wZXJ0eSB9IGZyb20gJy4vY29lcmNpb24vYm9vbGVhbi1wcm9wZXJ0eSc7XHJcbmltcG9ydCB7IEt0ZEdyaWRJdGVtUGxhY2Vob2xkZXIgfSBmcm9tICcuL2RpcmVjdGl2ZXMvcGxhY2Vob2xkZXInO1xyXG5pbXBvcnQgeyBnZXRUcmFuc2Zvcm1UcmFuc2l0aW9uRHVyYXRpb25Jbk1zIH0gZnJvbSAnLi91dGlscy90cmFuc2l0aW9uLWR1cmF0aW9uJztcclxuaW1wb3J0IHsgRE9DVU1FTlQgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5cclxuaW50ZXJmYWNlIEt0ZERyYWdSZXNpemVFdmVudCB7XHJcbiAgICBsYXlvdXQ6IEt0ZEdyaWRMYXlvdXQ7XHJcbiAgICBsYXlvdXRJdGVtOiBLdGRHcmlkTGF5b3V0SXRlbTtcclxuICAgIGdyaWRJdGVtUmVmOiBLdGRHcmlkSXRlbUNvbXBvbmVudDtcclxuICAgIHNlbGVjdGVkSXRlbXM/OiB7XHJcbiAgICAgICAgbGF5b3V0SXRlbTogS3RkR3JpZExheW91dEl0ZW07XHJcbiAgICAgICAgZ3JpZEl0ZW1SZWY6IEt0ZEdyaWRJdGVtQ29tcG9uZW50O1xyXG4gICAgfVtdO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBLdGREcmFnU3RhcnQgPSBLdGREcmFnUmVzaXplRXZlbnQ7XHJcbmV4cG9ydCB0eXBlIEt0ZFJlc2l6ZVN0YXJ0ID0gS3RkRHJhZ1Jlc2l6ZUV2ZW50O1xyXG5leHBvcnQgdHlwZSBLdGREcmFnRW5kID0gS3RkRHJhZ1Jlc2l6ZUV2ZW50O1xyXG5leHBvcnQgdHlwZSBLdGRSZXNpemVFbmQgPSBLdGREcmFnUmVzaXplRXZlbnQ7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEt0ZEdyaWRJdGVtUmVzaXplRXZlbnQge1xyXG4gICAgd2lkdGg6IG51bWJlcjtcclxuICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgZ3JpZEl0ZW1SZWY6IEt0ZEdyaWRJdGVtQ29tcG9uZW50O1xyXG59XHJcblxyXG50eXBlIERyYWdBY3Rpb25UeXBlID0gJ2RyYWcnIHwgJ3Jlc2l6ZSc7XHJcblxyXG5mdW5jdGlvbiBnZXREcmFnUmVzaXplRXZlbnREYXRhKGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCwgbGF5b3V0OiBLdGRHcmlkTGF5b3V0LCBtdWx0aXBsZVNlbGVjdGlvbj86IEt0ZEdyaWRJdGVtQ29tcG9uZW50W10pOiBLdGREcmFnUmVzaXplRXZlbnQge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBsYXlvdXQsXHJcbiAgICAgICAgbGF5b3V0SXRlbTogbGF5b3V0LmZpbmQoKGl0ZW0pID0+IGl0ZW0uaWQgPT09IGdyaWRJdGVtLmlkKSEsXHJcbiAgICAgICAgZ3JpZEl0ZW1SZWY6IGdyaWRJdGVtLFxyXG4gICAgICAgIHNlbGVjdGVkSXRlbXM6IG11bHRpcGxlU2VsZWN0aW9uICYmIG11bHRpcGxlU2VsZWN0aW9uLm1hcChzZWxlY3RlZEl0ZW09PihcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbGF5b3V0SXRlbTogbGF5b3V0LmZpbmQoKGxheW91dEl0ZW06IEt0ZEdyaWRMYXlvdXRJdGVtKSA9PiBsYXlvdXRJdGVtLmlkID09PSBzZWxlY3RlZEl0ZW0uaWQpISxcclxuICAgICAgICAgICAgICAgIGdyaWRJdGVtUmVmOiBzZWxlY3RlZEl0ZW1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICApXHJcbiAgICB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDb2x1bW5XaWR0aChjb25maWc6IEt0ZEdyaWRDZmcsIHdpZHRoOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgY29uc3Qge2NvbHMsIGdhcH0gPSBjb25maWc7XHJcbiAgICBjb25zdCB3aWR0aEV4Y2x1ZGluZ0dhcCA9IHdpZHRoIC0gTWF0aC5tYXgoKGdhcCAqIChjb2xzIC0gMSkpLCAwKTtcclxuICAgIHJldHVybiAod2lkdGhFeGNsdWRpbmdHYXAgLyBjb2xzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0Um93SGVpZ2h0SW5QaXhlbHMoY29uZmlnOiBLdGRHcmlkQ2ZnLCBoZWlnaHQ6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBjb25zdCB7cm93SGVpZ2h0LCBsYXlvdXQsIGdhcH0gPSBjb25maWc7XHJcbiAgICByZXR1cm4gcm93SGVpZ2h0ID09PSAnZml0JyA/IGt0ZEdldEdyaWRJdGVtUm93SGVpZ2h0KGxheW91dCwgaGVpZ2h0LCBnYXApIDogcm93SGVpZ2h0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBsYXlvdXRUb1JlbmRlckl0ZW1zKGNvbmZpZzogS3RkR3JpZENmZywgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiBLdGREaWN0aW9uYXJ5PEt0ZEdyaWRJdGVtUmVuZGVyRGF0YTxudW1iZXI+PiB7XHJcbiAgICBjb25zdCB7bGF5b3V0LCBnYXB9ID0gY29uZmlnO1xyXG4gICAgY29uc3Qgcm93SGVpZ2h0SW5QaXhlbHMgPSBnZXRSb3dIZWlnaHRJblBpeGVscyhjb25maWcsIGhlaWdodCk7XHJcbiAgICBjb25zdCBpdGVtV2lkdGhQZXJDb2x1bW4gPSBnZXRDb2x1bW5XaWR0aChjb25maWcsIHdpZHRoKTtcclxuICAgIGNvbnN0IHJlbmRlckl0ZW1zOiBLdGREaWN0aW9uYXJ5PEt0ZEdyaWRJdGVtUmVuZGVyRGF0YTxudW1iZXI+PiA9IHt9O1xyXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGxheW91dCkge1xyXG4gICAgICAgIHJlbmRlckl0ZW1zW2l0ZW0uaWRdID0ge1xyXG4gICAgICAgICAgICBpZDogaXRlbS5pZCxcclxuICAgICAgICAgICAgdG9wOiBpdGVtLnkgKiByb3dIZWlnaHRJblBpeGVscyArIGdhcCAqIGl0ZW0ueSxcclxuICAgICAgICAgICAgbGVmdDogaXRlbS54ICogaXRlbVdpZHRoUGVyQ29sdW1uICsgZ2FwICogaXRlbS54LFxyXG4gICAgICAgICAgICB3aWR0aDogaXRlbS53ICogaXRlbVdpZHRoUGVyQ29sdW1uICsgZ2FwICogTWF0aC5tYXgoaXRlbS53IC0gMSwgMCksXHJcbiAgICAgICAgICAgIGhlaWdodDogaXRlbS5oICogcm93SGVpZ2h0SW5QaXhlbHMgKyBnYXAgKiBNYXRoLm1heChpdGVtLmggLSAxLCAwKSxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlbmRlckl0ZW1zO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRHcmlkSGVpZ2h0KGxheW91dDogS3RkR3JpZExheW91dCwgcm93SGVpZ2h0OiBudW1iZXIsIGdhcDogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIHJldHVybiBsYXlvdXQucmVkdWNlKChhY2MsIGN1cikgPT4gTWF0aC5tYXgoYWNjLCAoY3VyLnkgKyBjdXIuaCkgKiByb3dIZWlnaHQgKyBNYXRoLm1heChjdXIueSArIGN1ci5oIC0gMSwgMCkgKiBnYXApLCAwKTtcclxufVxyXG5cclxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEBrYXRvaWQvcHJlZml4LWV4cG9ydGVkLWNvZGVcclxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUmVuZGVySXRlbVRvUGl4ZWxzKHJlbmRlckl0ZW06IEt0ZEdyaWRJdGVtUmVuZGVyRGF0YTxudW1iZXI+KTogS3RkR3JpZEl0ZW1SZW5kZXJEYXRhPHN0cmluZz4ge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogcmVuZGVySXRlbS5pZCxcclxuICAgICAgICB0b3A6IGAke3JlbmRlckl0ZW0udG9wfXB4YCxcclxuICAgICAgICBsZWZ0OiBgJHtyZW5kZXJJdGVtLmxlZnR9cHhgLFxyXG4gICAgICAgIHdpZHRoOiBgJHtyZW5kZXJJdGVtLndpZHRofXB4YCxcclxuICAgICAgICBoZWlnaHQ6IGAke3JlbmRlckl0ZW0uaGVpZ2h0fXB4YFxyXG4gICAgfTtcclxufVxyXG5cclxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEBrYXRvaWQvcHJlZml4LWV4cG9ydGVkLWNvZGVcclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ3JpZEl0ZW1HZXRSZW5kZXJEYXRhRmFjdG9yeUZ1bmMoZ3JpZENtcDogS3RkR3JpZENvbXBvbmVudCkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGlkOiBzdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gcGFyc2VSZW5kZXJJdGVtVG9QaXhlbHMoZ3JpZENtcC5nZXRJdGVtUmVuZGVyRGF0YShpZCkpO1xyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGt0ZEdyaWRJdGVtR2V0UmVuZGVyRGF0YUZhY3RvcnlGdW5jKGdyaWRDbXA6IEt0ZEdyaWRDb21wb25lbnQpIHtcclxuICAgIC8vIFdvcmthcm91bmQgZXhwbGFpbmVkOiBodHRwczovL2dpdGh1Yi5jb20vbmctcGFja2Fnci9uZy1wYWNrYWdyL2lzc3Vlcy82OTYjaXNzdWVjb21tZW50LTM4NzExNDYxM1xyXG4gICAgY29uc3QgcmVzdWx0RnVuYyA9IF9fZ3JpZEl0ZW1HZXRSZW5kZXJEYXRhRmFjdG9yeUZ1bmMoZ3JpZENtcCk7XHJcbiAgICByZXR1cm4gcmVzdWx0RnVuYztcclxufVxyXG5cclxuY29uc3QgZGVmYXVsdEJhY2tncm91bmRDb25maWc6IFJlcXVpcmVkPE9taXQ8S3RkR3JpZEJhY2tncm91bmRDZmcsICdzaG93Jz4+ID0ge1xyXG4gICAgYm9yZGVyQ29sb3I6ICcjZmZhNzI2NzgnLFxyXG4gICAgZ2FwQ29sb3I6ICd0cmFuc3BhcmVudCcsXHJcbiAgICByb3dDb2xvcjogJ3RyYW5zcGFyZW50JyxcclxuICAgIGNvbHVtbkNvbG9yOiAndHJhbnNwYXJlbnQnLFxyXG4gICAgYm9yZGVyV2lkdGg6IDEsXHJcbn07XHJcblxyXG5AQ29tcG9uZW50KHtcclxuICAgIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgICBzZWxlY3RvcjogJ2t0ZC1ncmlkJyxcclxuICAgIHRlbXBsYXRlVXJsOiAnLi9ncmlkLmNvbXBvbmVudC5odG1sJyxcclxuICAgIHN0eWxlVXJsczogWycuL2dyaWQuY29tcG9uZW50LnNjc3MnXSxcclxuICAgIGVuY2Fwc3VsYXRpb246IFZpZXdFbmNhcHN1bGF0aW9uLk5vbmUsXHJcbiAgICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaCxcclxuICAgIHByb3ZpZGVyczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgcHJvdmlkZTogR1JJRF9JVEVNX0dFVF9SRU5ERVJfREFUQV9UT0tFTixcclxuICAgICAgICAgICAgdXNlRmFjdG9yeToga3RkR3JpZEl0ZW1HZXRSZW5kZXJEYXRhRmFjdG9yeUZ1bmMsXHJcbiAgICAgICAgICAgIGRlcHM6IFtLdGRHcmlkQ29tcG9uZW50XVxyXG4gICAgICAgIH1cclxuICAgIF1cclxufSlcclxuZXhwb3J0IGNsYXNzIEt0ZEdyaWRDb21wb25lbnQgaW1wbGVtZW50cyBPbkNoYW5nZXMsIEFmdGVyQ29udGVudEluaXQsIEFmdGVyQ29udGVudENoZWNrZWQsIE9uRGVzdHJveSB7XHJcbiAgICAvKiogUXVlcnkgbGlzdCBvZiBncmlkIGl0ZW1zIHRoYXQgYXJlIGJlaW5nIHJlbmRlcmVkLiAqL1xyXG4gICAgQENvbnRlbnRDaGlsZHJlbihLdGRHcmlkSXRlbUNvbXBvbmVudCwge2Rlc2NlbmRhbnRzOiB0cnVlfSkgX2dyaWRJdGVtczogUXVlcnlMaXN0PEt0ZEdyaWRJdGVtQ29tcG9uZW50PjtcclxuXHJcbiAgICAvKiogRW1pdHMgd2hlbiBsYXlvdXQgY2hhbmdlICovXHJcbiAgICBAT3V0cHV0KCkgbGF5b3V0VXBkYXRlZDogRXZlbnRFbWl0dGVyPEt0ZEdyaWRMYXlvdXQ+ID0gbmV3IEV2ZW50RW1pdHRlcjxLdGRHcmlkTGF5b3V0PigpO1xyXG5cclxuICAgIC8qKiBFbWl0cyB3aGVuIGRyYWcgc3RhcnRzICovXHJcbiAgICBAT3V0cHV0KCkgZHJhZ1N0YXJ0ZWQ6IEV2ZW50RW1pdHRlcjxLdGREcmFnU3RhcnQ+ID0gbmV3IEV2ZW50RW1pdHRlcjxLdGREcmFnU3RhcnQ+KCk7XHJcblxyXG4gICAgLyoqIEVtaXRzIHdoZW4gcmVzaXplIHN0YXJ0cyAqL1xyXG4gICAgQE91dHB1dCgpIHJlc2l6ZVN0YXJ0ZWQ6IEV2ZW50RW1pdHRlcjxLdGRSZXNpemVTdGFydD4gPSBuZXcgRXZlbnRFbWl0dGVyPEt0ZFJlc2l6ZVN0YXJ0PigpO1xyXG5cclxuICAgIC8qKiBFbWl0cyB3aGVuIGRyYWcgZW5kcyAqL1xyXG4gICAgQE91dHB1dCgpIGRyYWdFbmRlZDogRXZlbnRFbWl0dGVyPEt0ZERyYWdFbmQ+ID0gbmV3IEV2ZW50RW1pdHRlcjxLdGREcmFnRW5kPigpO1xyXG5cclxuICAgIC8qKiBFbWl0cyB3aGVuIHJlc2l6ZSBlbmRzICovXHJcbiAgICBAT3V0cHV0KCkgcmVzaXplRW5kZWQ6IEV2ZW50RW1pdHRlcjxLdGRSZXNpemVFbmQ+ID0gbmV3IEV2ZW50RW1pdHRlcjxLdGRSZXNpemVFbmQ+KCk7XHJcblxyXG4gICAgLyoqIEVtaXRzIHdoZW4gYSBncmlkIGl0ZW0gaXMgYmVpbmcgcmVzaXplZCBhbmQgaXRzIGJvdW5kcyBoYXZlIGNoYW5nZWQgKi9cclxuICAgIEBPdXRwdXQoKSBncmlkSXRlbVJlc2l6ZTogRXZlbnRFbWl0dGVyPEt0ZEdyaWRJdGVtUmVzaXplRXZlbnQ+ID0gbmV3IEV2ZW50RW1pdHRlcjxLdGRHcmlkSXRlbVJlc2l6ZUV2ZW50PigpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUGFyZW50IGVsZW1lbnQgdGhhdCBjb250YWlucyB0aGUgc2Nyb2xsLiBJZiBhbiBzdHJpbmcgaXMgcHJvdmlkZWQgaXQgd291bGQgc2VhcmNoIHRoYXQgZWxlbWVudCBieSBpZCBvbiB0aGUgZG9tLlxyXG4gICAgICogSWYgbm8gZGF0YSBwcm92aWRlZCBvciBudWxsIGF1dG9zY3JvbGwgaXMgbm90IHBlcmZvcm1lZC5cclxuICAgICAqL1xyXG4gICAgQElucHV0KCkgc2Nyb2xsYWJsZVBhcmVudDogSFRNTEVsZW1lbnQgfCBEb2N1bWVudCB8IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgIC8qKiBXaGV0aGVyIG9yIG5vdCB0byB1cGRhdGUgdGhlIGludGVybmFsIGxheW91dCB3aGVuIHNvbWUgZGVwZW5kZW50IHByb3BlcnR5IGNoYW5nZS4gKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgY29tcGFjdE9uUHJvcHNDaGFuZ2UoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9jb21wYWN0T25Qcm9wc0NoYW5nZTsgfVxyXG5cclxuICAgIHNldCBjb21wYWN0T25Qcm9wc0NoYW5nZSh2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuX2NvbXBhY3RPblByb3BzQ2hhbmdlID0gY29lcmNlQm9vbGVhblByb3BlcnR5KHZhbHVlKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9jb21wYWN0T25Qcm9wc0NoYW5nZTogYm9vbGVhbiA9IHRydWU7XHJcblxyXG4gICAgLyoqIElmIHRydWUsIGdyaWQgaXRlbXMgd29uJ3QgY2hhbmdlIHBvc2l0aW9uIHdoZW4gYmVpbmcgZHJhZ2dlZCBvdmVyLiBIYW5keSB3aGVuIHVzaW5nIG5vIGNvbXBhY3Rpb24gKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgcHJldmVudENvbGxpc2lvbigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX3ByZXZlbnRDb2xsaXNpb247IH1cclxuXHJcbiAgICBzZXQgcHJldmVudENvbGxpc2lvbih2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuX3ByZXZlbnRDb2xsaXNpb24gPSBjb2VyY2VCb29sZWFuUHJvcGVydHkodmFsdWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3ByZXZlbnRDb2xsaXNpb246IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICAvKiogTnVtYmVyIG9mIENTUyBwaXhlbHMgdGhhdCB3b3VsZCBiZSBzY3JvbGxlZCBvbiBlYWNoICd0aWNrJyB3aGVuIGF1dG8gc2Nyb2xsIGlzIHBlcmZvcm1lZC4gKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgc2Nyb2xsU3BlZWQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX3Njcm9sbFNwZWVkOyB9XHJcblxyXG4gICAgc2V0IHNjcm9sbFNwZWVkKHZhbHVlOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLl9zY3JvbGxTcGVlZCA9IGNvZXJjZU51bWJlclByb3BlcnR5KHZhbHVlLCAyKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9zY3JvbGxTcGVlZDogbnVtYmVyID0gMjtcclxuXHJcbiAgICAvKiogVHlwZSBvZiBjb21wYWN0aW9uIHRoYXQgd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSBsYXlvdXQgKHZlcnRpY2FsLCBob3Jpem9udGFsIG9yIGZyZWUpLiBEZWZhdWx0cyB0byAndmVydGljYWwnICovXHJcbiAgICBASW5wdXQoKVxyXG4gICAgZ2V0IGNvbXBhY3RUeXBlKCk6IEt0ZEdyaWRDb21wYWN0VHlwZSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhY3RUeXBlO1xyXG4gICAgfVxyXG5cclxuICAgIHNldCBjb21wYWN0VHlwZSh2YWw6IEt0ZEdyaWRDb21wYWN0VHlwZSkge1xyXG4gICAgICAgIHRoaXMuX2NvbXBhY3RUeXBlID0gdmFsO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NvbXBhY3RUeXBlOiBLdGRHcmlkQ29tcGFjdFR5cGUgPSAndmVydGljYWwnO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUm93IGhlaWdodCBhcyBudW1iZXIgb3IgYXMgJ2ZpdCcuXHJcbiAgICAgKiBJZiByb3dIZWlnaHQgaXMgYSBudW1iZXIgdmFsdWUsIGl0IG1lYW5zIHRoYXQgZWFjaCByb3cgd291bGQgaGF2ZSB0aG9zZSBjc3MgcGl4ZWxzIGluIGhlaWdodC5cclxuICAgICAqIGlmIHJvd0hlaWdodCBpcyAnZml0JywgaXQgbWVhbnMgdGhhdCByb3dzIHdpbGwgZml0IGluIHRoZSBoZWlnaHQgYXZhaWxhYmxlLiBJZiAnZml0JyB2YWx1ZSBpcyBzZXQsIGEgJ2hlaWdodCcgc2hvdWxkIGJlIGFsc28gcHJvdmlkZWQuXHJcbiAgICAgKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgcm93SGVpZ2h0KCk6IG51bWJlciB8ICdmaXQnIHsgcmV0dXJuIHRoaXMuX3Jvd0hlaWdodDsgfVxyXG5cclxuICAgIHNldCByb3dIZWlnaHQodmFsOiBudW1iZXIgfCAnZml0Jykge1xyXG4gICAgICAgIHRoaXMuX3Jvd0hlaWdodCA9IHZhbCA9PT0gJ2ZpdCcgPyB2YWwgOiBNYXRoLm1heCgxLCBNYXRoLnJvdW5kKGNvZXJjZU51bWJlclByb3BlcnR5KHZhbCkpKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9yb3dIZWlnaHQ6IG51bWJlciB8ICdmaXQnID0gMTAwO1xyXG5cclxuICAgIC8qKiBOdW1iZXIgb2YgY29sdW1ucyAgKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgY29scygpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5fY29sczsgfVxyXG5cclxuICAgIHNldCBjb2xzKHZhbDogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5fY29scyA9IE1hdGgubWF4KDEsIE1hdGgucm91bmQoY29lcmNlTnVtYmVyUHJvcGVydHkodmFsKSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NvbHM6IG51bWJlciA9IDY7XHJcblxyXG4gICAgLyoqIExheW91dCBvZiB0aGUgZ3JpZC4gQXJyYXkgb2YgYWxsIHRoZSBncmlkIGl0ZW1zIHdpdGggaXRzICdpZCcgYW5kIHBvc2l0aW9uIG9uIHRoZSBncmlkLiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBsYXlvdXQoKTogS3RkR3JpZExheW91dCB7IHJldHVybiB0aGlzLl9sYXlvdXQ7IH1cclxuXHJcbiAgICBzZXQgbGF5b3V0KGxheW91dDogS3RkR3JpZExheW91dCkge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEVuaGFuY2VtZW50OlxyXG4gICAgICAgICAqIE9ubHkgc2V0IGxheW91dCBpZiBpdCdzIHJlZmVyZW5jZSBoYXMgY2hhbmdlZCBhbmQgdXNlIGEgYm9vbGVhbiB0byB0cmFjayB3aGVuZXZlciByZWNhbGN1bGF0ZSB0aGUgbGF5b3V0IG9uIG5nT25DaGFuZ2VzLlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogV2h5OlxyXG4gICAgICAgICAqIFRoZSBub3JtYWwgdXNlIG9mIHRoaXMgbGliIGlzIGhhdmluZyB0aGUgdmFyaWFibGUgbGF5b3V0IGluIHRoZSBvdXRlciBjb21wb25lbnQgb3IgaW4gYSBzdG9yZSwgYXNzaWduaW5nIGl0IHdoZW5ldmVyIGl0IGNoYW5nZXMgYW5kXHJcbiAgICAgICAgICogYmluZGVkIGluIHRoZSBjb21wb25lbnQgd2l0aCBpdCdzIGlucHV0IFtsYXlvdXRdLiBJbiB0aGlzIHNjZW5hcmlvLCB3ZSB3b3VsZCBhbHdheXMgY2FsY3VsYXRlIG9uZSB1bm5lY2Vzc2FyeSBjaGFuZ2Ugb24gdGhlIGxheW91dCB3aGVuXHJcbiAgICAgICAgICogaXQgaXMgcmUtYmluZGVkIG9uIHRoZSBpbnB1dC5cclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLl9sYXlvdXQgPSBsYXlvdXQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfbGF5b3V0OiBLdGRHcmlkTGF5b3V0O1xyXG5cclxuICAgIC8qKiBHcmlkIGdhcCBpbiBjc3MgcGl4ZWxzICovXHJcbiAgICBASW5wdXQoKVxyXG4gICAgZ2V0IGdhcCgpOiBudW1iZXIge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nYXA7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IGdhcCh2YWw6IG51bWJlcikge1xyXG4gICAgICAgIHRoaXMuX2dhcCA9IE1hdGgubWF4KGNvZXJjZU51bWJlclByb3BlcnR5KHZhbCksIDApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2dhcDogbnVtYmVyID0gMDtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJZiBoZWlnaHQgaXMgYSBudW1iZXIsIGZpeGVzIHRoZSBoZWlnaHQgb2YgdGhlIGdyaWQgdG8gaXQsIHJlY29tbWVuZGVkIHdoZW4gcm93SGVpZ2h0ID0gJ2ZpdCcgaXMgdXNlZC5cclxuICAgICAqIElmIGhlaWdodCBpcyBudWxsLCBoZWlnaHQgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IHNldCBhY2NvcmRpbmcgdG8gaXRzIGlubmVyIGdyaWQgaXRlbXMuXHJcbiAgICAgKiBEZWZhdWx0cyB0byBudWxsLlxyXG4gICAgICogKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgaGVpZ2h0KCk6IG51bWJlciB8IG51bGwge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IGhlaWdodCh2YWw6IG51bWJlciB8IG51bGwpIHtcclxuICAgICAgICB0aGlzLl9oZWlnaHQgPSB0eXBlb2YgdmFsID09PSAnbnVtYmVyJyA/IE1hdGgubWF4KHZhbCwgMCkgOiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2hlaWdodDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgQElucHV0KCkgbXVsdGlJdGVtQWxnb3JpdGhtOiAnZGVmYXVsdCcgfCAnc3RhdGljJyA9ICdkZWZhdWx0JztcclxuXHJcbiAgICAvKipcclxuICAgICAqIE11bHRpcGxlIGl0ZW1zIGRyYWcvcmVzaXplXHJcbiAgICAgKiBBIGxpc3Qgb2Ygc2VsZWN0ZWQgaXRlbXMgdG8gbW92ZSAoZHJhZyBvciByZXNpemUpIHRvZ2V0aGVyIGFzIGEgZ3JvdXAuXHJcbiAgICAgKiBUaGUgbXVsdGktc2VsZWN0aW9uIG9mIGl0ZW1zIGlzIG1hbmFnZWQgZXh0ZXJuYWxseS4gQnkgZGVmYXVsdCwgdGhlIGxpYnJhcnkgbWFuYWdlcyBhIHNpbmdsZSBpdGVtLCBidXQgaWYgYSBzZXQgb2YgaXRlbSBJRHMgaXMgcHJvdmlkZWQsIHRoZSBzcGVjaWZpZWQgZ3JvdXAgd2lsbCBiZSBoYW5kbGVkIGFzIGEgdW5pdC5cIlxyXG4gICAgICovXHJcbiAgICBASW5wdXQoKVxyXG4gICAgZ2V0IHNlbGVjdGVkSXRlbXNJZHMoKTogc3RyaW5nW10gfCBudWxsIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fc2VsZWN0ZWRJdGVtc0lkcztcclxuICAgIH1cclxuXHJcbiAgICBzZXQgc2VsZWN0ZWRJdGVtc0lkcyh2YWw6IHN0cmluZ1tdIHwgbnVsbCkge1xyXG4gICAgICAgIHRoaXMuX3NlbGVjdGVkSXRlbXNJZHMgPSB2YWw7XHJcbiAgICAgICAgaWYodmFsKXtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW1zID0gdmFsLm1hcChcclxuICAgICAgICAgICAgICAgIChsYXlvdXRJdGVtSWQ6IHN0cmluZykgPT5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncmlkSXRlbXMuZmluZChcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCkgPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRJdGVtLmlkID09PSBsYXlvdXRJdGVtSWRcclxuICAgICAgICAgICAgICAgICAgICApIVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRJdGVtcyA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2VsZWN0ZWRJdGVtc0lkczogc3RyaW5nW10gfCBudWxsO1xyXG4gICAgc2VsZWN0ZWRJdGVtczogS3RkR3JpZEl0ZW1Db21wb25lbnRbXSB8IHVuZGVmaW5lZDtcclxuXHJcblxyXG4gICAgQElucHV0KClcclxuICAgIGdldCBiYWNrZ3JvdW5kQ29uZmlnKCk6IEt0ZEdyaWRCYWNrZ3JvdW5kQ2ZnIHwgbnVsbCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhY2tncm91bmRDb25maWc7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IGJhY2tncm91bmRDb25maWcodmFsOiBLdGRHcmlkQmFja2dyb3VuZENmZyB8IG51bGwpIHtcclxuICAgICAgICB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnID0gdmFsO1xyXG5cclxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBiYWNrZ3JvdW5kIGNvbmZpZ3VyYXRpb24sIGFkZCBtYWluIGdyaWQgYmFja2dyb3VuZCBjbGFzcy4gR3JpZCBiYWNrZ3JvdW5kIGNsYXNzIGNvbWVzIHdpdGggb3BhY2l0eSAwLlxyXG4gICAgICAgIC8vIEl0IGlzIGRvbmUgdGhpcyB3YXkgZm9yIGFkZGluZyBvcGFjaXR5IGFuaW1hdGlvbiBhbmQgdG8gZG9uJ3QgYWRkIGFueSBzdHlsZXMgd2hlbiBncmlkIGJhY2tncm91bmQgaXMgbnVsbC5cclxuICAgICAgICBjb25zdCBjbGFzc0xpc3QgPSAodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQgYXMgSFRNTERpdkVsZW1lbnQpLmNsYXNzTGlzdDtcclxuICAgICAgICB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnICE9PSBudWxsID8gY2xhc3NMaXN0LmFkZCgna3RkLWdyaWQtYmFja2dyb3VuZCcpIDogY2xhc3NMaXN0LnJlbW92ZSgna3RkLWdyaWQtYmFja2dyb3VuZCcpO1xyXG5cclxuICAgICAgICAvLyBTZXQgYmFja2dyb3VuZCB2aXNpYmlsaXR5XHJcbiAgICAgICAgdGhpcy5zZXRHcmlkQmFja2dyb3VuZFZpc2libGUodGhpcy5fYmFja2dyb3VuZENvbmZpZz8uc2hvdyA9PT0gJ2Fsd2F5cycpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2JhY2tncm91bmRDb25maWc6IEt0ZEdyaWRCYWNrZ3JvdW5kQ2ZnIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgcHJpdmF0ZSBncmlkQ3VycmVudEhlaWdodDogbnVtYmVyO1xyXG5cclxuICAgIGdldCBjb25maWcoKTogS3RkR3JpZENmZyB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgY29sczogdGhpcy5jb2xzLFxyXG4gICAgICAgICAgICByb3dIZWlnaHQ6IHRoaXMucm93SGVpZ2h0LFxyXG4gICAgICAgICAgICBoZWlnaHQ6IHRoaXMuaGVpZ2h0LFxyXG4gICAgICAgICAgICBsYXlvdXQ6IHRoaXMubGF5b3V0LFxyXG4gICAgICAgICAgICBwcmV2ZW50Q29sbGlzaW9uOiB0aGlzLnByZXZlbnRDb2xsaXNpb24sXHJcbiAgICAgICAgICAgIGdhcDogdGhpcy5nYXAsXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKiogUmVmZXJlbmNlcyB0byB0aGUgdmlld3Mgb2YgdGhlIHBsYWNlaG9sZGVyIGVsZW1lbnRzLiAqL1xyXG4gICAgcHJpdmF0ZSBwbGFjZWhvbGRlclJlZjogS3RkRGljdGlvbmFyeTxFbWJlZGRlZFZpZXdSZWY8YW55PiB8IG51bGw+PXt9O1xyXG5cclxuICAgIC8qKiBFbGVtZW50cyB0aGF0IGFyZSByZW5kZXJlZCBhcyBwbGFjZWhvbGRlciB3aGVuIGEgbGlzdCBvZiBncmlkIGl0ZW1zIGFyZSBiZWluZyBkcmFnZ2VkICovXHJcbiAgICBwcml2YXRlIHBsYWNlaG9sZGVyOiBLdGREaWN0aW9uYXJ5PEhUTUxFbGVtZW50IHwgbnVsbD49e307XHJcblxyXG4gICAgcHJpdmF0ZSBfZ3JpZEl0ZW1zUmVuZGVyRGF0YTogS3RkRGljdGlvbmFyeTxLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPj47XHJcbiAgICBwcml2YXRlIHN1YnNjcmlwdGlvbnM6IFN1YnNjcmlwdGlvbltdID0gW107XHJcblxyXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBncmlkU2VydmljZTogS3RkR3JpZFNlcnZpY2UsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIGVsZW1lbnRSZWY6IEVsZW1lbnRSZWYsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIHZpZXdDb250YWluZXJSZWY6IFZpZXdDb250YWluZXJSZWYsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIHJlbmRlcmVyOiBSZW5kZXJlcjIsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIG5nWm9uZTogTmdab25lLFxyXG4gICAgICAgICAgICAgICAgQEluamVjdChET0NVTUVOVCkgcHJpdmF0ZSBkb2N1bWVudDogRG9jdW1lbnQpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgbmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcykge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5yb3dIZWlnaHQgPT09ICdmaXQnICYmIHRoaXMuaGVpZ2h0ID09IG51bGwpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGBLdGRHcmlkQ29tcG9uZW50OiBUaGUgQElucHV0KCkgaGVpZ2h0IHNob3VsZCBub3QgYmUgbnVsbCB3aGVuIHVzaW5nIHJvd0hlaWdodCAnZml0J2ApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IG5lZWRzQ29tcGFjdExheW91dCA9IGZhbHNlO1xyXG4gICAgICAgIGxldCBuZWVkc1JlY2FsY3VsYXRlUmVuZGVyRGF0YSA9IGZhbHNlO1xyXG5cclxuICAgICAgICAvLyBUT0RPOiBEb2VzIGZpc3QgY2hhbmdlIG5lZWQgdG8gYmUgY29tcGFjdGVkIGJ5IGRlZmF1bHQ/XHJcbiAgICAgICAgLy8gQ29tcGFjdCBsYXlvdXQgd2hlbmV2ZXIgc29tZSBkZXBlbmRlbnQgcHJvcCBjaGFuZ2VzLlxyXG4gICAgICAgIGlmIChjaGFuZ2VzLmNvbXBhY3RUeXBlIHx8IGNoYW5nZXMuY29scyB8fCBjaGFuZ2VzLmxheW91dCkge1xyXG4gICAgICAgICAgICBuZWVkc0NvbXBhY3RMYXlvdXQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2VlIG5lZWQgdG8gcmVjYWxjdWxhdGUgcmVuZGVyaW5nIGRhdGEuXHJcbiAgICAgICAgaWYgKG5lZWRzQ29tcGFjdExheW91dCB8fCBjaGFuZ2VzLnJvd0hlaWdodCB8fCBjaGFuZ2VzLmhlaWdodCB8fCBjaGFuZ2VzLmdhcCB8fCBjaGFuZ2VzLmJhY2tncm91bmRDb25maWcpIHtcclxuICAgICAgICAgICAgbmVlZHNSZWNhbGN1bGF0ZVJlbmRlckRhdGEgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gT25seSBjb21wYWN0IGxheW91dCBpZiBsaWIgdXNlciBoYXMgcHJvdmlkZWQgaXQuIExpYiB1c2VycyB0aGF0IHdhbnQgdG8gc2F2ZS9zdG9yZSBhbHdheXMgdGhlIHNhbWUgbGF5b3V0ICBhcyBpdCBpcyByZXByZXNlbnRlZCAoY29tcGFjdGVkKVxyXG4gICAgICAgIC8vIGNhbiB1c2UgS3RkQ29tcGFjdEdyaWQgdXRpbGl0eSBhbmQgcHJlLWNvbXBhY3QgdGhlIGxheW91dC4gVGhpcyBpcyB0aGUgcmVjb21tZW5kZWQgYmVoYXZpb3VyIGZvciBhbHdheXMgaGF2aW5nIGEgdGhlIHNhbWUgbGF5b3V0IG9uIHRoaXMgY29tcG9uZW50XHJcbiAgICAgICAgLy8gYW5kIHRoZSBvbmVzIHRoYXQgdXNlcyBpdC5cclxuICAgICAgICBpZiAobmVlZHNDb21wYWN0TGF5b3V0ICYmIHRoaXMuY29tcGFjdE9uUHJvcHNDaGFuZ2UpIHtcclxuICAgICAgICAgICAgdGhpcy5jb21wYWN0TGF5b3V0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAobmVlZHNSZWNhbGN1bGF0ZVJlbmRlckRhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxjdWxhdGVSZW5kZXJEYXRhKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG5nQWZ0ZXJDb250ZW50SW5pdCgpIHtcclxuICAgICAgICB0aGlzLmluaXRTdWJzY3JpcHRpb25zKCk7XHJcbiAgICB9XHJcblxyXG4gICAgbmdBZnRlckNvbnRlbnRDaGVja2VkKCkge1xyXG4gICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzaXplKCkge1xyXG4gICAgICAgIHRoaXMuY2FsY3VsYXRlUmVuZGVyRGF0YSgpO1xyXG4gICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgbmdPbkRlc3Ryb3koKSB7XHJcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zLmZvckVhY2goc3ViID0+IHN1Yi51bnN1YnNjcmliZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBjb21wYWN0TGF5b3V0KCkge1xyXG4gICAgICAgIHRoaXMubGF5b3V0ID0gY29tcGFjdCh0aGlzLmxheW91dCwgdGhpcy5jb21wYWN0VHlwZSwgdGhpcy5jb2xzKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRJdGVtc1JlbmRlckRhdGEoKTogS3RkRGljdGlvbmFyeTxLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPj4ge1xyXG4gICAgICAgIHJldHVybiB7Li4udGhpcy5fZ3JpZEl0ZW1zUmVuZGVyRGF0YX07XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0SXRlbVJlbmRlckRhdGEoaXRlbUlkOiBzdHJpbmcpOiBLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbaXRlbUlkXTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxjdWxhdGVSZW5kZXJEYXRhKCkge1xyXG4gICAgICAgIGNvbnN0IGNsaWVudFJlY3QgPSAodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIHRoaXMuZ3JpZEN1cnJlbnRIZWlnaHQgPSB0aGlzLmhlaWdodCA/PyAodGhpcy5yb3dIZWlnaHQgPT09ICdmaXQnID8gY2xpZW50UmVjdC5oZWlnaHQgOiBnZXRHcmlkSGVpZ2h0KHRoaXMubGF5b3V0LCB0aGlzLnJvd0hlaWdodCwgdGhpcy5nYXApKTtcclxuICAgICAgICB0aGlzLl9ncmlkSXRlbXNSZW5kZXJEYXRhID0gbGF5b3V0VG9SZW5kZXJJdGVtcyh0aGlzLmNvbmZpZywgY2xpZW50UmVjdC53aWR0aCwgdGhpcy5ncmlkQ3VycmVudEhlaWdodCk7XHJcblxyXG4gICAgICAgIC8vIFNldCBCYWNrZ3JvdW5kIENTUyB2YXJpYWJsZXNcclxuICAgICAgICB0aGlzLnNldEJhY2tncm91bmRDc3NWYXJpYWJsZXMoZ2V0Um93SGVpZ2h0SW5QaXhlbHModGhpcy5jb25maWcsIHRoaXMuZ3JpZEN1cnJlbnRIZWlnaHQpKTtcclxuICAgIH1cclxuXHJcbiAgICByZW5kZXIoKSB7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRTdHlsZSh0aGlzLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCwgJ2hlaWdodCcsIGAke3RoaXMuZ3JpZEN1cnJlbnRIZWlnaHR9cHhgKTtcclxuICAgICAgICB0aGlzLnVwZGF0ZUdyaWRJdGVtc1N0eWxlcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc2V0QmFja2dyb3VuZENzc1ZhcmlhYmxlcyhyb3dIZWlnaHQ6IG51bWJlcikge1xyXG4gICAgICAgIGNvbnN0IHN0eWxlID0gKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50IGFzIEhUTUxEaXZFbGVtZW50KS5zdHlsZTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2JhY2tncm91bmRDb25maWcpIHtcclxuICAgICAgICAgICAgLy8gc3RydWN0dXJlXHJcbiAgICAgICAgICAgIHN0eWxlLnNldFByb3BlcnR5KCctLWdhcCcsIHRoaXMuZ2FwICsgJ3B4Jyk7XHJcbiAgICAgICAgICAgIHN0eWxlLnNldFByb3BlcnR5KCctLXJvdy1oZWlnaHQnLCByb3dIZWlnaHQgKyAncHgnKTtcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tY29sdW1ucycsIGAke3RoaXMuY29sc31gKTtcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tYm9yZGVyLXdpZHRoJywgKHRoaXMuX2JhY2tncm91bmRDb25maWcuYm9yZGVyV2lkdGggPz8gZGVmYXVsdEJhY2tncm91bmRDb25maWcuYm9yZGVyV2lkdGgpICsgJ3B4Jyk7XHJcblxyXG4gICAgICAgICAgICAvLyBjb2xvcnNcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tYm9yZGVyLWNvbG9yJywgdGhpcy5fYmFja2dyb3VuZENvbmZpZy5ib3JkZXJDb2xvciA/PyBkZWZhdWx0QmFja2dyb3VuZENvbmZpZy5ib3JkZXJDb2xvcik7XHJcbiAgICAgICAgICAgIHN0eWxlLnNldFByb3BlcnR5KCctLWdhcC1jb2xvcicsIHRoaXMuX2JhY2tncm91bmRDb25maWcuZ2FwQ29sb3IgPz8gZGVmYXVsdEJhY2tncm91bmRDb25maWcuZ2FwQ29sb3IpO1xyXG4gICAgICAgICAgICBzdHlsZS5zZXRQcm9wZXJ0eSgnLS1yb3ctY29sb3InLCB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnLnJvd0NvbG9yID8/IGRlZmF1bHRCYWNrZ3JvdW5kQ29uZmlnLnJvd0NvbG9yKTtcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tY29sdW1uLWNvbG9yJywgdGhpcy5fYmFja2dyb3VuZENvbmZpZy5jb2x1bW5Db2xvciA/PyBkZWZhdWx0QmFja2dyb3VuZENvbmZpZy5jb2x1bW5Db2xvcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tZ2FwJyk7XHJcbiAgICAgICAgICAgIHN0eWxlLnJlbW92ZVByb3BlcnR5KCctLXJvdy1oZWlnaHQnKTtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tY29sdW1ucycpO1xyXG4gICAgICAgICAgICBzdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS1ib3JkZXItd2lkdGgnKTtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tYm9yZGVyLWNvbG9yJyk7XHJcbiAgICAgICAgICAgIHN0eWxlLnJlbW92ZVByb3BlcnR5KCctLWdhcC1jb2xvcicpO1xyXG4gICAgICAgICAgICBzdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS1yb3ctY29sb3InKTtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tY29sdW1uLWNvbG9yJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdXBkYXRlR3JpZEl0ZW1zU3R5bGVzKCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ3JpZEl0ZW1zLmZvckVhY2goaXRlbSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGdyaWRJdGVtUmVuZGVyRGF0YTogS3RkR3JpZEl0ZW1SZW5kZXJEYXRhPG51bWJlcj4gfCB1bmRlZmluZWQgPSB0aGlzLl9ncmlkSXRlbXNSZW5kZXJEYXRhW2l0ZW0uaWRdO1xyXG4gICAgICAgICAgICBpZiAoZ3JpZEl0ZW1SZW5kZXJEYXRhID09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYENvdWxkblxcJ3QgZmluZCB0aGUgc3BlY2lmaWVkIGdyaWQgaXRlbSBmb3IgdGhlIGlkOiAke2l0ZW0uaWR9YCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpdGVtLnNldFN0eWxlcyhwYXJzZVJlbmRlckl0ZW1Ub1BpeGVscyhncmlkSXRlbVJlbmRlckRhdGEpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIHNldEdyaWRCYWNrZ3JvdW5kVmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKSB7XHJcbiAgICAgICAgY29uc3QgY2xhc3NMaXN0ID0gKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50IGFzIEhUTUxEaXZFbGVtZW50KS5jbGFzc0xpc3Q7XHJcbiAgICAgICAgdmlzaWJsZSA/IGNsYXNzTGlzdC5hZGQoJ2t0ZC1ncmlkLWJhY2tncm91bmQtdmlzaWJsZScpIDogY2xhc3NMaXN0LnJlbW92ZSgna3RkLWdyaWQtYmFja2dyb3VuZC12aXNpYmxlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBpbml0U3Vic2NyaXB0aW9ucygpIHtcclxuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXHJcbiAgICAgICAgICAgIHRoaXMuX2dyaWRJdGVtcy5jaGFuZ2VzLnBpcGUoXHJcbiAgICAgICAgICAgICAgICBzdGFydFdpdGgodGhpcy5fZ3JpZEl0ZW1zKSxcclxuICAgICAgICAgICAgICAgIHN3aXRjaE1hcCgoZ3JpZEl0ZW1zOiBRdWVyeUxpc3Q8S3RkR3JpZEl0ZW1Db21wb25lbnQ+KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lcmdlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5ncmlkSXRlbXMubWFwKChncmlkSXRlbSkgPT4gZ3JpZEl0ZW0uZHJhZ1N0YXJ0JC5waXBlKG1hcCgoZXZlbnQpID0+ICh7ZXZlbnQsIGdyaWRJdGVtLCB0eXBlOiAnZHJhZycgYXMgRHJhZ0FjdGlvblR5cGV9KSkpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLi4uZ3JpZEl0ZW1zLm1hcCgoZ3JpZEl0ZW0pID0+IGdyaWRJdGVtLnJlc2l6ZVN0YXJ0JC5waXBlKG1hcCgoZXZlbnQpID0+ICh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRJdGVtLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Jlc2l6ZScgYXMgRHJhZ0FjdGlvblR5cGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpKSksXHJcbiAgICAgICAgICAgICAgICAgICAgKS5waXBlKGV4aGF1c3RNYXAoKHtldmVudCwgZ3JpZEl0ZW0sIHR5cGV9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG11bHRpcGxlU2VsZWN0aW9uOiBLdGRHcmlkSXRlbUNvbXBvbmVudFtdIHwgdW5kZWZpbmVkID0gdGhpcy5zZWxlY3RlZEl0ZW1zICYmIFsuLi50aGlzLnNlbGVjdGVkSXRlbXNdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBFbWl0IGRyYWcgb3IgcmVzaXplIHN0YXJ0IGV2ZW50cy4gRW5zdXJlIHRoYXQgaXMgc3RhcnQgZXZlbnQgaXMgaW5zaWRlIHRoZSB6b25lLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5nWm9uZS5ydW4oKCkgPT4gKHR5cGUgPT09ICdkcmFnJyA/IHRoaXMuZHJhZ1N0YXJ0ZWQgOiB0aGlzLnJlc2l6ZVN0YXJ0ZWQpLmVtaXQoZ2V0RHJhZ1Jlc2l6ZUV2ZW50RGF0YShncmlkSXRlbSwgdGhpcy5sYXlvdXQsIG11bHRpcGxlU2VsZWN0aW9uKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldEdyaWRCYWNrZ3JvdW5kVmlzaWJsZSh0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnPy5zaG93ID09PSAnd2hlbkRyYWdnaW5nJyB8fCB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnPy5zaG93ID09PSAnYWx3YXlzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBlcmZvcm0gZHJhZyBzZXF1ZW5jZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZ3JpZEl0ZW1zU2VsZWN0ZWQ6IEt0ZEdyaWRJdGVtQ29tcG9uZW50W10gPSBbZ3JpZEl0ZW1dO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihtdWx0aXBsZVNlbGVjdGlvbiAmJiBtdWx0aXBsZVNlbGVjdGlvbi5zb21lKChjdXJySXRlbSk9PmN1cnJJdGVtLmlkPT09Z3JpZEl0ZW0uaWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbXNTZWxlY3RlZCA9IG11bHRpcGxlU2VsZWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGVyZm9ybURyYWdTZXF1ZW5jZSQoZ3JpZEl0ZW1zU2VsZWN0ZWQsIGV2ZW50LCB0eXBlKS5waXBlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwKChsYXlvdXQpID0+ICh7bGF5b3V0LCBncmlkSXRlbSwgdHlwZSwgbXVsdGlwbGVTZWxlY3Rpb259KSkpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICApLnN1YnNjcmliZSgoe2xheW91dCwgZ3JpZEl0ZW0sIHR5cGUsIG11bHRpcGxlU2VsZWN0aW9ufSA6IHtsYXlvdXQ6IEt0ZEdyaWRMYXlvdXQsIGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCwgdHlwZTogRHJhZ0FjdGlvblR5cGUsIG11bHRpcGxlU2VsZWN0aW9uPzogS3RkR3JpZEl0ZW1Db21wb25lbnRbXX0pID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubGF5b3V0ID0gbGF5b3V0O1xyXG4gICAgICAgICAgICAgICAgLy8gQ2FsY3VsYXRlIG5ldyByZW5kZXJpbmcgZGF0YSBnaXZlbiB0aGUgbmV3IGxheW91dC5cclxuICAgICAgICAgICAgICAgIHRoaXMuY2FsY3VsYXRlUmVuZGVyRGF0YSgpO1xyXG4gICAgICAgICAgICAgICAgLy8gRW1pdCBkcmFnIG9yIHJlc2l6ZSBlbmQgZXZlbnRzLlxyXG4gICAgICAgICAgICAgICAgKHR5cGUgPT09ICdkcmFnJyA/IHRoaXMuZHJhZ0VuZGVkIDogdGhpcy5yZXNpemVFbmRlZCkuZW1pdChnZXREcmFnUmVzaXplRXZlbnREYXRhKGdyaWRJdGVtLCBsYXlvdXQsIG11bHRpcGxlU2VsZWN0aW9uKSk7XHJcbiAgICAgICAgICAgICAgICAvLyBOb3RpZnkgdGhhdCB0aGUgbGF5b3V0IGhhcyBiZWVuIHVwZGF0ZWQuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmxheW91dFVwZGF0ZWQuZW1pdChsYXlvdXQpO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0R3JpZEJhY2tncm91bmRWaXNpYmxlKHRoaXMuX2JhY2tncm91bmRDb25maWc/LnNob3cgPT09ICdhbHdheXMnKTtcclxuICAgICAgICAgICAgfSlcclxuXHJcbiAgICAgICAgXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm0gYSBnZW5lcmFsIGdyaWQgZHJhZyBhY3Rpb24sIGZyb20gc3RhcnQgdG8gZW5kLiBBIGdlbmVyYWwgZ3JpZCBkcmFnIGFjdGlvbiBiYXNpY2FsbHkgaW5jbHVkZXMgY3JlYXRpbmcgdGhlIHBsYWNlaG9sZGVyIGVsZW1lbnQgYW5kIGFkZGluZ1xyXG4gICAgICogc29tZSBjbGFzcyBhbmltYXRpb25zLiBjYWxjTmV3U3RhdGVGdW5jIG5lZWRzIHRvIGJlIHByb3ZpZGVkIGluIG9yZGVyIHRvIGNhbGN1bGF0ZSB0aGUgbmV3IHN0YXRlIG9mIHRoZSBsYXlvdXQuXHJcbiAgICAgKiBAcGFyYW0gZ3JpZEl0ZW0gdGhhdCBpcyBiZWVuIGRyYWdnZWRcclxuICAgICAqIEBwYXJhbSBwb2ludGVyRG93bkV2ZW50IGV2ZW50IChtb3VzZWRvd24gb3IgdG91Y2hkb3duKSB3aGVyZSB0aGUgdXNlciBpbml0aWF0ZWQgdGhlIGRyYWdcclxuICAgICAqIEBwYXJhbSBjYWxjTmV3U3RhdGVGdW5jIGZ1bmN0aW9uIHRoYXQgcmV0dXJuIHRoZSBuZXcgbGF5b3V0IHN0YXRlIGFuZCB0aGUgZHJhZyBlbGVtZW50IHBvc2l0aW9uXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcGVyZm9ybURyYWdTZXF1ZW5jZSQoZ3JpZEl0ZW1zOiBLdGRHcmlkSXRlbUNvbXBvbmVudFtdLCBwb2ludGVyRG93bkV2ZW50OiBNb3VzZUV2ZW50IHwgVG91Y2hFdmVudCwgdHlwZTogRHJhZ0FjdGlvblR5cGUpOiBPYnNlcnZhYmxlPEt0ZEdyaWRMYXlvdXQ+IHtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPEt0ZEdyaWRMYXlvdXQ+KChvYnNlcnZlcjogT2JzZXJ2ZXI8S3RkR3JpZExheW91dD4pID0+IHtcclxuICAgICAgICAgICAgY29uc3Qgc2Nyb2xsYWJsZVBhcmVudCA9IHR5cGVvZiB0aGlzLnNjcm9sbGFibGVQYXJlbnQgPT09ICdzdHJpbmcnID8gdGhpcy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0aGlzLnNjcm9sbGFibGVQYXJlbnQpIDogdGhpcy5zY3JvbGxhYmxlUGFyZW50O1xyXG4gICAgICAgICAgICAvLyBSZXRyaWV2ZSBncmlkIChwYXJlbnQpIGNsaWVudCByZWN0LlxyXG4gICAgICAgICAgICBjb25zdCBncmlkRWxlbUNsaWVudFJlY3Q6IEt0ZENsaWVudFJlY3QgPSBnZXRNdXRhYmxlQ2xpZW50UmVjdCh0aGlzLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCBhcyBIVE1MRWxlbWVudCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkcmFnRWxlbUNsaWVudFJlY3Q6IEt0ZERpY3Rpb25hcnk8S3RkQ2xpZW50UmVjdD49e307XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld0dyaWRJdGVtUmVuZGVyRGF0YTogS3RkRGljdGlvbmFyeTxLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPj49e307XHJcbiAgICAgICAgICAgIGxldCBkcmFnZ2VkSXRlbXNQb3M6IEt0ZERpY3Rpb25hcnk8S3RkR3JpZEl0ZW1SZWN0Pj17fTtcclxuICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxMYXlvdXQ6IEt0ZEdyaWRMYXlvdXQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5sYXlvdXQpO1xyXG5cclxuICAgICAgICAgICAgZ3JpZEl0ZW1zLmZvckVhY2goKGdyaWRJdGVtKT0+e1xyXG4gICAgICAgICAgICAgICAgLy8gUmV0cmlldmUgZ3JpZEl0ZW0gKGRyYWdnZWRFbGVtKSBjbGllbnQgcmVjdC5cclxuICAgICAgICAgICAgICAgIGRyYWdFbGVtQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0gPSBnZXRNdXRhYmxlQ2xpZW50UmVjdChncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5hZGRDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICduby10cmFuc2l0aW9ucycpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5hZGRDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICdrdGQtZ3JpZC1pdGVtLWRyYWdnaW5nJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlckNsaWVudFJlY3Q6IEt0ZENsaWVudFJlY3QgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLi4uZHJhZ0VsZW1DbGllbnRSZWN0W2dyaWRJdGVtLmlkXSxcclxuICAgICAgICAgICAgICAgICAgICBsZWZ0OiBkcmFnRWxlbUNsaWVudFJlY3RbZ3JpZEl0ZW0uaWRdLmxlZnQgLSBncmlkRWxlbUNsaWVudFJlY3QubGVmdCxcclxuICAgICAgICAgICAgICAgICAgICB0b3A6IGRyYWdFbGVtQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0udG9wIC0gZ3JpZEVsZW1DbGllbnRSZWN0LnRvcFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVQbGFjZWhvbGRlckVsZW1lbnQoZ3JpZEl0ZW0uaWQsIHBsYWNlaG9sZGVyQ2xpZW50UmVjdCwgZ3JpZEl0ZW0ucGxhY2Vob2xkZXIpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBuZXdMYXlvdXQ6IEt0ZEdyaWRMYXlvdXRJdGVtW107XHJcblxyXG4gICAgICAgICAgICAvLyBUT0RPIChlbmhhbmNlbWVudCk6IGNvbnNpZGVyIG1vdmUgdGhpcyAnc2lkZSBlZmZlY3QnIG9ic2VydmFibGUgaW5zaWRlIHRoZSBtYWluIGRyYWcgbG9vcC5cclxuICAgICAgICAgICAgLy8gIC0gUHJvcyBhcmUgdGhhdCB3ZSB3b3VsZCBub3QgcmVwZWF0IHN1YnNjcmlwdGlvbnMgYW5kIHRha2VVbnRpbCB3b3VsZCBzaHV0IGRvd24gb2JzZXJ2YWJsZXMgYXQgdGhlIHNhbWUgdGltZS5cclxuICAgICAgICAgICAgLy8gIC0gQ29ucyBhcmUgdGhhdCBtb3ZpbmcgdGhpcyBmdW5jdGlvbmFsaXR5IGFzIGEgc2lkZSBlZmZlY3QgaW5zaWRlIHRoZSBtYWluIGRyYWcgbG9vcCB3b3VsZCBiZSBjb25mdXNpbmcuXHJcbiAgICAgICAgICAgIGNvbnN0IHNjcm9sbFN1YnNjcmlwdGlvbiA9IHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XHJcbiAgICAgICAgICAgICAgICAoIXNjcm9sbGFibGVQYXJlbnQgPyBORVZFUiA6IHRoaXMuZ3JpZFNlcnZpY2UubW91c2VPclRvdWNoTW92ZSQodGhpcy5kb2N1bWVudCkucGlwZShcclxuICAgICAgICAgICAgICAgICAgICBtYXAoKGV2ZW50KSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyWDoga3RkUG9pbnRlckNsaWVudFgoZXZlbnQpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyWToga3RkUG9pbnRlckNsaWVudFkoZXZlbnQpXHJcbiAgICAgICAgICAgICAgICAgICAgfSkpLFxyXG4gICAgICAgICAgICAgICAgICAgIGt0ZFNjcm9sbElmTmVhckVsZW1lbnRDbGllbnRSZWN0JChzY3JvbGxhYmxlUGFyZW50LCB7c2Nyb2xsU3RlcDogdGhpcy5zY3JvbGxTcGVlZH0pXHJcbiAgICAgICAgICAgICAgICApKS5waXBlKFxyXG4gICAgICAgICAgICAgICAgICAgIHRha2VVbnRpbChrdGRQb2ludGVyVXAodGhpcy5kb2N1bWVudCkpXHJcbiAgICAgICAgICAgICAgICApLnN1YnNjcmliZSgpKTtcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBNYWluIHN1YnNjcmlwdGlvbiwgaXQgbGlzdGVucyBmb3IgJ3BvaW50ZXIgbW92ZScgYW5kICdzY3JvbGwnIGV2ZW50cyBhbmQgcmVjYWxjdWxhdGVzIHRoZSBsYXlvdXQgb24gZWFjaCBlbWlzc2lvblxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgY29uc3Qgc3Vic2NyaXB0aW9uID0gdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT5cclxuICAgICAgICAgICAgICAgIG1lcmdlKFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbWJpbmVMYXRlc3QoW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdyaWRTZXJ2aWNlLm1vdXNlT3JUb3VjaE1vdmUkKHRoaXMuZG9jdW1lbnQpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi4oIXNjcm9sbGFibGVQYXJlbnQgPyBbb2Yoe3RvcDogMCwgbGVmdDogMH0pXSA6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGt0ZEdldFNjcm9sbFRvdGFsUmVsYXRpdmVEaWZmZXJlbmNlJChzY3JvbGxhYmxlUGFyZW50KS5waXBlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0V2l0aCh7dG9wOiAwLCBsZWZ0OiAwfSkgLy8gRm9yY2UgZmlyc3QgZW1pc3Npb24gdG8gYWxsb3cgQ29tYmluZUxhdGVzdCB0byBlbWl0IGV2ZW4gbm8gc2Nyb2xsIGV2ZW50IGhhcyBvY2N1cnJlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdKVxyXG4gICAgICAgICAgICAgICAgICAgIF0pXHJcbiAgICAgICAgICAgICAgICApLnBpcGUoXHJcbiAgICAgICAgICAgICAgICAgICAgdGFrZVVudGlsKGt0ZFBvaW50ZXJVcCh0aGlzLmRvY3VtZW50KSksXHJcbiAgICAgICAgICAgICAgICApLnN1YnNjcmliZSgoW3BvaW50ZXJEcmFnRXZlbnQsIHNjcm9sbERpZmZlcmVuY2VdOiBbTW91c2VFdmVudCB8IFRvdWNoRXZlbnQgfCBQb2ludGVyRXZlbnQsIHsgdG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlciB9XSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyRHJhZ0V2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICAgICAgICAgICAgICogU2V0IHRoZSBuZXcgbGF5b3V0IHRvIGJlIHRoZSBsYXlvdXQgaW4gd2hpY2ggdGhlIGNhbGNOZXdTdGF0ZUZ1bmMgd291bGQgYmUgZXhlY3V0ZWQuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAqIE5PVEU6IHVzaW5nIHRoZSBtdXRhdGVkIGxheW91dCBpcyB0aGUgd2F5IHRvIGdvIGJ5ICdyZWFjdC1ncmlkLWxheW91dCcgdXRpbHMuIElmIHdlIGRvbid0IHVzZSB0aGUgcHJldmlvdXMgbGF5b3V0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgKiBzb21lIHV0aWxpdGllcyBmcm9tICdyZWFjdC1ncmlkLWxheW91dCcgd291bGQgbm90IHdvcmsgYXMgZXhwZWN0ZWQuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50TGF5b3V0OiBLdGRHcmlkTGF5b3V0ID0gbmV3TGF5b3V0IHx8IHRoaXMubGF5b3V0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQ9Y3VycmVudExheW91dDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgY29ycmVjdCBuZXdTdGF0ZUZ1bmMgZGVwZW5kaW5nIG9uIGlmIHdlIGFyZSBkcmFnZ2luZyBvciByZXNpemluZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2RyYWcnICYmIGdyaWRJdGVtcy5sZW5ndGggPiAxKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubXVsdGlJdGVtQWxnb3JpdGhtID09PSAnc3RhdGljJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHtsYXlvdXQsIGRyYWdnZWRJdGVtUG9zfSA9IGt0ZEdyaWRJdGVtc0RyYWdnaW5nKGdyaWRJdGVtcywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXlvdXQ6IG9yaWdpbmFsTGF5b3V0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dIZWlnaHQ6IHRoaXMucm93SGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IHRoaXMuaGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xzOiB0aGlzLmNvbHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZlbnRDb2xsaXNpb246IHRoaXMucHJldmVudENvbGxpc2lvbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2FwOiB0aGlzLmdhcCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCB0aGlzLmNvbXBhY3RUeXBlLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50ZXJEb3duRXZlbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50ZXJEcmFnRXZlbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRFbGVtQ2xpZW50UmVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhZ0VsZW1lbnRzQ2xpZW50UmVjdDogZHJhZ0VsZW1DbGllbnRSZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY3JvbGxEaWZmZXJlbmNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0xheW91dCA9IGxheW91dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmFnZ2VkSXRlbXNQb3MgPSBkcmFnZ2VkSXRlbVBvcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogY2xvbmluZyB0aGUgZnVsbCBsYXlvdXQgY2FuIGJlIGV4cGVuc2l2ZSEgV2Ugc2hvdWxkIGludmVzdGlnYXRlIHdvcmthcm91bmRzLCBtYXliZSBieSB1c2luZyBhIGt0ZEdyaWRJdGVtRHJhZ2dpbmcgZnVuY3Rpb24gdGhhdCBkb2VzIG5vdCBtdXRhdGUgdGhlIGxheW91dFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQgPSBzdHJ1Y3R1cmVkQ2xvbmUob3JpZ2luYWxMYXlvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNvcnQgZ3JpZCBpdGVtcyBmcm9tIHRvcC1sZWZ0IHRvIGJvdHRvbS1yaWdodFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdyaWRJdGVtc1NvcnRlZCA9IGdyaWRJdGVtcy5zb3J0KChhLCBiKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3RBID0gZHJhZ0VsZW1DbGllbnRSZWN0W2EuaWRdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWN0QiA9IGRyYWdFbGVtQ2xpZW50UmVjdFtiLmlkXTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZpcnN0IHNvcnQgYnkgdG9wLCB0aGVuIGJ5IGxlZnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlY3RBLnRvcCAhPT0gcmVjdEIudG9wKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVjdEEudG9wIC0gcmVjdEIudG9wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZWN0QS5sZWZ0IC0gcmVjdEIubGVmdDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVmlydHVhbGx5IHB1dCBhTEwgZWxlbWVudHMgYXQgdGhlIGluZmluaXR5IGJvdHRvbSBpZiBjb21wYWN0IHZlcnRpY2FsIGFuZCBpbmZpbml0eSByaWdodCBpZiBjb21wYWN0IGhvcml6b250YWwhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3TGF5b3V0LmZvckVhY2gobGF5b3V0SXRlbSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0IGlzIGEgZHJhZ2dlZCBpdGVtLCBtb3ZlIHRvIGluZmluaXR5ISEgV2UgY2xlYW51cCB0aGUgc3BhY2UgZm9yIHRoZSBkcmFnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkcmFnRWxlbUNsaWVudFJlY3RbbGF5b3V0SXRlbS5pZF0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbXBhY3RUeXBlICE9PSAnaG9yaXpvbnRhbCcpIHsgbGF5b3V0SXRlbS55ID0gSW5maW5pdHk7IH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbXBhY3RUeXBlICE9PSAndmVydGljYWwnKSB7IGxheW91dEl0ZW0ueCA9IEluZmluaXR5OyB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQgPSBjb21wYWN0KG5ld0xheW91dCwgdGhpcy5jb21wYWN0VHlwZSwgdGhpcy5jb2xzKVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbXNTb3J0ZWQuZm9yRWFjaCgoZ3JpZEl0ZW0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qge2xheW91dCwgZHJhZ2dlZEl0ZW1Qb3N9ID0ga3RkR3JpZEl0ZW1EcmFnZ2luZyhncmlkSXRlbSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5b3V0OiBuZXdMYXlvdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dIZWlnaHQ6IHRoaXMucm93SGVpZ2h0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbHM6IHRoaXMuY29scyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZlbnRDb2xsaXNpb246IHRoaXMucHJldmVudENvbGxpc2lvbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdhcDogdGhpcy5nYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIHRoaXMuY29tcGFjdFR5cGUsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50ZXJEb3duRXZlbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyRHJhZ0V2ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JpZEVsZW1DbGllbnRSZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhZ0VsZW1DbGllbnRSZWN0OiBkcmFnRWxlbUNsaWVudFJlY3RbZ3JpZEl0ZW0uaWRdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2Nyb2xsRGlmZmVyZW5jZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc3QgcHJlID0gbmV3TGF5b3V0LmZpbmQoaXRlbSA9PiBpdGVtLmlkID09PSBncmlkSXRlbS5pZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnN0IGFjdCA9IGxheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zdCBvcmlnID0gb3JpZ2luYWxMYXlvdXQuZmluZChpdGVtID0+IGl0ZW0uaWQgPT09IGdyaWRJdGVtLmlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYENhbGMgZHJhZ2dpbmcgJHtncmlkSXRlbS5pZH1gLCBgcHJlOiAoJHtwcmU/Lnh9LCAke3ByZT8ueX0pYCwgYG9yaWc6ICgke29yaWc/Lnh9LCAke29yaWc/Lnl9KWAsIGBhY3Q6ICgke2FjdD8ueH0sICR7YWN0Py55fSlgKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld0xheW91dCA9IGxheW91dDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhZ2dlZEl0ZW1zUG9zW2dyaWRJdGVtLmlkXSA9IGRyYWdnZWRJdGVtUG9zO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjYWxjTmV3U3RhdGVGdW5jID0gdHlwZSA9PT0gJ2RyYWcnID8ga3RkR3JpZEl0ZW1EcmFnZ2luZyA6IGt0ZEdyaWRJdGVtUmVzaXppbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbXMuZm9yRWFjaCgoZ3JpZEl0ZW0pPT57XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qge2xheW91dCwgZHJhZ2dlZEl0ZW1Qb3N9ID0gY2FsY05ld1N0YXRlRnVuYyhncmlkSXRlbSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXlvdXQ6IG5ld0xheW91dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SGVpZ2h0OiB0aGlzLnJvd0hlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sczogdGhpcy5jb2xzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2ZW50Q29sbGlzaW9uOiB0aGlzLnByZXZlbnRDb2xsaXNpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdhcDogdGhpcy5nYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgdGhpcy5jb21wYWN0VHlwZSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyRG93bkV2ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyRHJhZ0V2ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmlkRWxlbUNsaWVudFJlY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyYWdFbGVtQ2xpZW50UmVjdDogZHJhZ0VsZW1DbGllbnRSZWN0W2dyaWRJdGVtLmlkXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2Nyb2xsRGlmZmVyZW5jZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQgPSBsYXlvdXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhZ2dlZEl0ZW1zUG9zW2dyaWRJdGVtLmlkXT1kcmFnZ2VkSXRlbVBvcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdyaWRDdXJyZW50SGVpZ2h0ID0gdGhpcy5oZWlnaHQgPz8gKHRoaXMucm93SGVpZ2h0ID09PSAnZml0JyA/IGdyaWRFbGVtQ2xpZW50UmVjdC5oZWlnaHQgOiBnZXRHcmlkSGVpZ2h0KG5ld0xheW91dCwgdGhpcy5yb3dIZWlnaHQsIHRoaXMuZ2FwKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ3JpZEl0ZW1zUmVuZGVyRGF0YSA9IGxheW91dFRvUmVuZGVySXRlbXMoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sczogdGhpcy5jb2xzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SGVpZ2h0OiB0aGlzLnJvd0hlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXlvdXQ6IG5ld0xheW91dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZlbnRDb2xsaXNpb246IHRoaXMucHJldmVudENvbGxpc2lvbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdhcDogdGhpcy5nYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGdyaWRFbGVtQ2xpZW50UmVjdC53aWR0aCwgZ3JpZEVsZW1DbGllbnRSZWN0LmhlaWdodCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBNb2RpZnkgdGhlIHBvc2l0aW9uIG9mIHRoZSBkcmFnZ2VkIGl0ZW0gdG8gYmUgdGhlIG9uY2Ugd2Ugd2FudCAoZm9yIGV4YW1wbGUgdGhlIG1vdXNlIHBvc2l0aW9uIG9yIHdoYXRldmVyKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbXMuZm9yRWFjaCgoZ3JpZEl0ZW0pPT57XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdHcmlkSXRlbVJlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdID0gey4uLnRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJTdHlsZXMgPSBwYXJzZVJlbmRlckl0ZW1Ub1BpeGVscyhuZXdHcmlkSXRlbVJlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQdXQgdGhlIHJlYWwgZmluYWwgcG9zaXRpb24gdG8gdGhlIHBsYWNlaG9sZGVyIGVsZW1lbnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW0uaWRdIS5zdHlsZS53aWR0aCA9IHBsYWNlaG9sZGVyU3R5bGVzLndpZHRoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbS5pZF0hLnN0eWxlLmhlaWdodCA9IHBsYWNlaG9sZGVyU3R5bGVzLmhlaWdodDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW0uaWRdIS5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWCgke3BsYWNlaG9sZGVyU3R5bGVzLmxlZnR9KSB0cmFuc2xhdGVZKCR7cGxhY2Vob2xkZXJTdHlsZXMudG9wfSlgO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLmRyYWdnZWRJdGVtc1Bvc1tncmlkSXRlbS5pZF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdLmlkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0QmFja2dyb3VuZENzc1ZhcmlhYmxlcyh0aGlzLnJvd0hlaWdodCA9PT0gJ2ZpdCcgPyBrdGRHZXRHcmlkSXRlbVJvd0hlaWdodChuZXdMYXlvdXQsIGdyaWRFbGVtQ2xpZW50UmVjdC5oZWlnaHQsIHRoaXMuZ2FwKSA6IHRoaXMucm93SGVpZ2h0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRJdGVtcy5mb3JFYWNoKChncmlkSXRlbSk9PntcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHdlIGFyZSBwZXJmb3JtaW5nIGEgcmVzaXplLCBhbmQgYm91bmRzIGhhdmUgY2hhbmdlZCwgZW1pdCBldmVudC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IE9ubHkgZW1pdCBvbiByZXNpemUgZm9yIG5vdy4gVXNlIGNhc2UgZm9yIG5vcm1hbCBkcmFnIGlzIG5vdCBqdXN0aWZpZWQgZm9yIG5vdy4gRW1pdHRpbmcgb24gcmVzaXplIGlzLCBzaW5jZSB3ZSBtYXkgd2FudCB0byByZS1yZW5kZXIgdGhlIGdyaWQgaXRlbSBvciB0aGUgcGxhY2Vob2xkZXIgaW4gb3JkZXIgdG8gZml0IHRoZSBuZXcgYm91bmRzLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdyZXNpemUnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJldkdyaWRJdGVtID0gY3VycmVudExheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpITtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdHcmlkSXRlbSA9IG5ld0xheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpITtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBpdGVtIHJlc2l6ZWQgaGFzIGNoYW5nZWQsIGlmIHNvLCBlbWl0IHJlc2l6ZSBjaGFuZ2UgZXZlbnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWt0ZEdyaWRJdGVtTGF5b3V0SXRlbUFyZUVxdWFsKHByZXZHcmlkSXRlbSwgbmV3R3JpZEl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ3JpZEl0ZW1SZXNpemUuZW1pdCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbmV3R3JpZEl0ZW1SZW5kZXJEYXRhW2dyaWRJdGVtLmlkXS53aWR0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3R3JpZEl0ZW1SZW5kZXJEYXRhW2dyaWRJdGVtLmlkXS5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbVJlZjogZ2V0RHJhZ1Jlc2l6ZUV2ZW50RGF0YShncmlkSXRlbSwgbmV3TGF5b3V0KS5ncmlkSXRlbVJlZiBhcyBLdGRHcmlkSXRlbUNvbXBvbmVudFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgKGVycm9yKSA9PiBvYnNlcnZlci5lcnJvcihlcnJvciksXHJcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5nWm9uZS5ydW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JpZEl0ZW1zLmZvckVhY2goKGdyaWRJdGVtKT0+e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBkcmFnIGNsYXNzZXNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnJlbW92ZUNsYXNzKGdyaWRJdGVtLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCwgJ25vLXRyYW5zaXRpb25zJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5yZW1vdmVDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICdrdGQtZ3JpZC1pdGVtLWRyYWdnaW5nJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkR3JpZEl0ZW1BbmltYXRpbmdDbGFzcyhncmlkSXRlbSkuc3Vic2NyaWJlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ29uc2lkZXIgZGVzdHJveWluZyB0aGUgcGxhY2Vob2xkZXIgYWZ0ZXIgdGhlIGFuaW1hdGlvbiBoYXMgZmluaXNoZWQuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95UGxhY2Vob2xkZXIoZ3JpZEl0ZW0uaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0xheW91dCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IG5ld0xheW91dCBzaG91bGQgYWxyZWFkeSBiZSBwcnVuZWQuIElmIG5vdCwgaXQgc2hvdWxkIGhhdmUgdHlwZSBMYXlvdXQsIG5vdCBLdGRHcmlkTGF5b3V0IGFzIGl0IGlzIG5vdy5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQcnVuZSByZWFjdC1ncmlkLWxheW91dCBjb21wYWN0IGV4dHJhIHByb3BlcnRpZXMuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dChuZXdMYXlvdXQubWFwKGl0ZW0gPT4gKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGl0ZW0uaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IGl0ZW0ueCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeTogaXRlbS55LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3OiBpdGVtLncsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGg6IGl0ZW0uaCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluVzogaXRlbS5taW5XLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5IOiBpdGVtLm1pbkgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heFc6IGl0ZW0ubWF4VyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4SDogaXRlbS5tYXhILFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSBhcyBLdGRHcmlkTGF5b3V0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogTmVlZCB3ZSByZWFsbHkgdG8gZW1pdCBpZiB0aGVyZSBpcyBubyBsYXlvdXQgY2hhbmdlIGJ1dCBkcmFnIHN0YXJ0ZWQgYW5kIGVuZGVkP1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmVyLm5leHQodGhpcy5sYXlvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB9KSk7XHJcblxyXG5cclxuICAgICAgICAgICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHNjcm9sbFN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xyXG4gICAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSXQgYWRkcyB0aGUgYGt0ZC1ncmlkLWl0ZW0tYW5pbWF0aW5nYCBjbGFzcyBhbmQgcmVtb3ZlcyBpdCB3aGVuIHRoZSBhbmltYXRlZCB0cmFuc2l0aW9uIGlzIGNvbXBsZXRlLlxyXG4gICAgICogVGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBleGVjdXRlZCB3aGVuIHRoZSBkcmFnIGhhcyBlbmRlZC5cclxuICAgICAqIEBwYXJhbSBncmlkSXRlbSB0aGF0IGhhcyBiZWVuIGRyYWdnZWRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBhZGRHcmlkSXRlbUFuaW1hdGluZ0NsYXNzKGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCk6IE9ic2VydmFibGU8dW5kZWZpbmVkPiB7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShvYnNlcnZlciA9PiB7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkdXJhdGlvbiA9IGdldFRyYW5zZm9ybVRyYW5zaXRpb25EdXJhdGlvbkluTXMoZ3JpZEl0ZW0uZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50KTtcclxuXHJcbiAgICAgICAgICAgIGlmIChkdXJhdGlvbiA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5hZGRDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICdrdGQtZ3JpZC1pdGVtLWFuaW1hdGluZycpO1xyXG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gKChldmVudDogVHJhbnNpdGlvbkV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50IHx8IChldmVudC50YXJnZXQgPT09IGdyaWRJdGVtLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCAmJiBldmVudC5wcm9wZXJ0eU5hbWUgPT09ICd0cmFuc2Zvcm0nKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIucmVtb3ZlQ2xhc3MoZ3JpZEl0ZW0uZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50LCAna3RkLWdyaWQtaXRlbS1hbmltYXRpbmcnKTtcclxuICAgICAgICAgICAgICAgICAgICByZW1vdmVFdmVudExpc3RlbmVyKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgICAgICAgICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KSBhcyBFdmVudExpc3RlbmVyO1xyXG5cclxuICAgICAgICAgICAgLy8gSWYgYSB0cmFuc2l0aW9uIGlzIHNob3J0IGVub3VnaCwgdGhlIGJyb3dzZXIgbWlnaHQgbm90IGZpcmUgdGhlIGB0cmFuc2l0aW9uZW5kYCBldmVudC5cclxuICAgICAgICAgICAgLy8gU2luY2Ugd2Uga25vdyBob3cgbG9uZyBpdCdzIHN1cHBvc2VkIHRvIHRha2UsIGFkZCBhIHRpbWVvdXQgd2l0aCBhIDUwJSBidWZmZXIgdGhhdCdsbFxyXG4gICAgICAgICAgICAvLyBmaXJlIGlmIHRoZSB0cmFuc2l0aW9uIGhhc24ndCBjb21wbGV0ZWQgd2hlbiBpdCB3YXMgc3VwcG9zZWQgdG8uXHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KGhhbmRsZXIsIGR1cmF0aW9uICogMS41KTtcclxuICAgICAgICAgICAgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lciA9IHRoaXMucmVuZGVyZXIubGlzdGVuKGdyaWRJdGVtLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCwgJ3RyYW5zaXRpb25lbmQnLCBoYW5kbGVyKTtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIC8qKiBDcmVhdGVzIHBsYWNlaG9sZGVyIGVsZW1lbnQgKi9cclxuICAgIHByaXZhdGUgY3JlYXRlUGxhY2Vob2xkZXJFbGVtZW50KGdyaWRJdGVtSWQ6IHN0cmluZywgY2xpZW50UmVjdDogS3RkQ2xpZW50UmVjdCwgZ3JpZEl0ZW1QbGFjZWhvbGRlcj86IEt0ZEdyaWRJdGVtUGxhY2Vob2xkZXIpIHtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdID0gdGhpcy5yZW5kZXJlci5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdIS5zdHlsZS53aWR0aCA9IGAke2NsaWVudFJlY3Qud2lkdGh9cHhgO1xyXG4gICAgICAgIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW1JZF0hLnN0eWxlLmhlaWdodCA9IGAke2NsaWVudFJlY3QuaGVpZ2h0fXB4YDtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdIS5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWCgke2NsaWVudFJlY3QubGVmdH1weCkgdHJhbnNsYXRlWSgke2NsaWVudFJlY3QudG9wfXB4KWA7XHJcbiAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSEuY2xhc3NMaXN0LmFkZCgna3RkLWdyaWQtaXRlbS1wbGFjZWhvbGRlcicpO1xyXG4gICAgICAgIHRoaXMucmVuZGVyZXIuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW1JZF0pO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgYW5kIGFwcGVuZCBjdXN0b20gcGxhY2Vob2xkZXIgaWYgcHJvdmlkZWQuXHJcbiAgICAgICAgLy8gSW1wb3J0YW50OiBBcHBlbmQgaXQgYWZ0ZXIgY3JlYXRpbmcgJiBhcHBlbmRpbmcgdGhlIGNvbnRhaW5lciBwbGFjZWhvbGRlci4gVGhpcyB3YXkgd2UgZW5zdXJlIHBhcmVudCBib3VuZHMgYXJlIHNldCB3aGVuIGNyZWF0aW5nIHRoZSBlbWJlZGRlZFZpZXcuXHJcbiAgICAgICAgaWYgKGdyaWRJdGVtUGxhY2Vob2xkZXIpIHtcclxuICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlclJlZltncmlkSXRlbUlkXSA9IHRoaXMudmlld0NvbnRhaW5lclJlZi5jcmVhdGVFbWJlZGRlZFZpZXcoXHJcbiAgICAgICAgICAgICAgICBncmlkSXRlbVBsYWNlaG9sZGVyLnRlbXBsYXRlUmVmLFxyXG4gICAgICAgICAgICAgICAgZ3JpZEl0ZW1QbGFjZWhvbGRlci5kYXRhXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIHRoaXMucGxhY2Vob2xkZXJSZWZbZ3JpZEl0ZW1JZF0hLnJvb3ROb2Rlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSEuYXBwZW5kQ2hpbGQobm9kZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnBsYWNlaG9sZGVyUmVmW2dyaWRJdGVtSWRdIS5kZXRlY3RDaGFuZ2VzKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSEuY2xhc3NMaXN0LmFkZCgna3RkLWdyaWQtaXRlbS1wbGFjZWhvbGRlci1kZWZhdWx0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKiBEZXN0cm95cyB0aGUgcGxhY2Vob2xkZXIgZWxlbWVudCBhbmQgaXRzIFZpZXdSZWYuICovXHJcbiAgICBwcml2YXRlIGRlc3Ryb3lQbGFjZWhvbGRlcihncmlkSXRlbUlkOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdPy5yZW1vdmUoKTtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyUmVmW2dyaWRJdGVtSWRdPy5kZXN0cm95KCk7XHJcbiAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSA9IHRoaXMucGxhY2Vob2xkZXJSZWZbZ3JpZEl0ZW1JZF0gPSBudWxsITtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgbmdBY2NlcHRJbnB1dFR5cGVfY29sczogTnVtYmVySW5wdXQ7XHJcbiAgICBzdGF0aWMgbmdBY2NlcHRJbnB1dFR5cGVfcm93SGVpZ2h0OiBOdW1iZXJJbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9zY3JvbGxTcGVlZDogTnVtYmVySW5wdXQ7XHJcbiAgICBzdGF0aWMgbmdBY2NlcHRJbnB1dFR5cGVfY29tcGFjdE9uUHJvcHNDaGFuZ2U6IEJvb2xlYW5JbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9wcmV2ZW50Q29sbGlzaW9uOiBCb29sZWFuSW5wdXQ7XHJcbn1cclxuXHJcbiIsIjxuZy1jb250ZW50PjwvbmctY29udGVudD4iXX0=