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
                // Get the correct newStateFunc depending on if we are dragging or resizing
                if (type === 'drag' && gridItems.length > 1) {
                    // TODO: cloning the full layout can be expensive! We should investigate workarounds, maybe by using a ktdGridItemDragging function that does not mutate the layout
                    newLayout = structuredClone(originalLayout);
                    const { layout, draggedItemPos } = ktdGridItemsDragging(gridItems, {
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
                        dragElementsClientRect: dragElemClientRect,
                        scrollDifference
                    });
                    newLayout = layout;
                    draggedItemsPos = draggedItemPos;
                }
                else {
                    const calcNewStateFunc = type === 'drag' ? ktdGridItemDragging : ktdGridItemResizing;
                    newLayout = currentLayout;
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
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "16.2.12", type: KtdGridComponent, isStandalone: true, selector: "ktd-grid", inputs: { scrollableParent: "scrollableParent", compactOnPropsChange: "compactOnPropsChange", preventCollision: "preventCollision", scrollSpeed: "scrollSpeed", compactType: "compactType", rowHeight: "rowHeight", cols: "cols", layout: "layout", gap: "gap", height: "height", selectedItemsIds: "selectedItemsIds", backgroundConfig: "backgroundConfig" }, outputs: { layoutUpdated: "layoutUpdated", dragStarted: "dragStarted", resizeStarted: "resizeStarted", dragEnded: "dragEnded", resizeEnded: "resizeEnded", gridItemResize: "gridItemResize" }, providers: [
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
            }], selectedItemsIds: [{
                type: Input
            }], backgroundConfig: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JpZC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvZ3JpZC5jb21wb25lbnQudHMiLCIuLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvZ3JpZC5jb21wb25lbnQuaHRtbCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ29DLHVCQUF1QixFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQStCLFlBQVksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUN0SCxNQUFNLEVBQXlELGlCQUFpQixFQUNqSCxNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsb0JBQW9CLEVBQWUsTUFBTSw0QkFBNEIsQ0FBQztBQUMvRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFZLEVBQUUsRUFBZ0IsTUFBTSxNQUFNLENBQUM7QUFDM0YsT0FBTyxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNsRixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsbUJBQW1CLEVBQUUsNkJBQTZCLEVBQUUsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM1SixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUNILCtCQUErQixFQUNsQyxNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUczRixPQUFPLEVBQUUsb0JBQW9CLEVBQWlCLE1BQU0scUJBQXFCLENBQUM7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R0FBRztzQkFETixLQUFLO2dCQWtCRixNQUFNO3NCQURULEtBQUs7Z0JBaUJGLGdCQUFnQjtzQkFEbkIsS0FBSztnQkF5QkYsZ0JBQWdCO3NCQURuQixLQUFLIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcclxuICAgIEFmdGVyQ29udGVudENoZWNrZWQsIEFmdGVyQ29udGVudEluaXQsIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBDb21wb25lbnQsIENvbnRlbnRDaGlsZHJlbiwgRWxlbWVudFJlZiwgRW1iZWRkZWRWaWV3UmVmLCBFdmVudEVtaXR0ZXIsIEluamVjdCwgSW5wdXQsXHJcbiAgICBOZ1pvbmUsIE9uQ2hhbmdlcywgT25EZXN0cm95LCBPdXRwdXQsIFF1ZXJ5TGlzdCwgUmVuZGVyZXIyLCBTaW1wbGVDaGFuZ2VzLCBWaWV3Q29udGFpbmVyUmVmLCBWaWV3RW5jYXBzdWxhdGlvblxyXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBjb2VyY2VOdW1iZXJQcm9wZXJ0eSwgTnVtYmVySW5wdXQgfSBmcm9tICcuL2NvZXJjaW9uL251bWJlci1wcm9wZXJ0eSc7XHJcbmltcG9ydCB7IEt0ZEdyaWRJdGVtQ29tcG9uZW50IH0gZnJvbSAnLi9ncmlkLWl0ZW0vZ3JpZC1pdGVtLmNvbXBvbmVudCc7XHJcbmltcG9ydCB7IGNvbWJpbmVMYXRlc3QsIG1lcmdlLCBORVZFUiwgT2JzZXJ2YWJsZSwgT2JzZXJ2ZXIsIG9mLCBTdWJzY3JpcHRpb24gfSBmcm9tICdyeGpzJztcclxuaW1wb3J0IHsgZXhoYXVzdE1hcCwgbWFwLCBzdGFydFdpdGgsIHN3aXRjaE1hcCwgdGFrZVVudGlsIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xyXG5pbXBvcnQgeyBrdGRHZXRHcmlkSXRlbVJvd0hlaWdodCwga3RkR3JpZEl0ZW1EcmFnZ2luZywga3RkR3JpZEl0ZW1MYXlvdXRJdGVtQXJlRXF1YWwsIGt0ZEdyaWRJdGVtUmVzaXppbmcsIGt0ZEdyaWRJdGVtc0RyYWdnaW5nIH0gZnJvbSAnLi91dGlscy9ncmlkLnV0aWxzJztcclxuaW1wb3J0IHsgY29tcGFjdCB9IGZyb20gJy4vdXRpbHMvcmVhY3QtZ3JpZC1sYXlvdXQudXRpbHMnO1xyXG5pbXBvcnQge1xyXG4gICAgR1JJRF9JVEVNX0dFVF9SRU5ERVJfREFUQV9UT0tFTiwgS3RkR3JpZEJhY2tncm91bmRDZmcsIEt0ZEdyaWRDZmcsIEt0ZEdyaWRDb21wYWN0VHlwZSwgS3RkR3JpZEl0ZW1SZWN0LCBLdGRHcmlkSXRlbVJlbmRlckRhdGEsIEt0ZEdyaWRMYXlvdXQsIEt0ZEdyaWRMYXlvdXRJdGVtXHJcbn0gZnJvbSAnLi9ncmlkLmRlZmluaXRpb25zJztcclxuaW1wb3J0IHsga3RkUG9pbnRlclVwLCBrdGRQb2ludGVyQ2xpZW50WCwga3RkUG9pbnRlckNsaWVudFkgfSBmcm9tICcuL3V0aWxzL3BvaW50ZXIudXRpbHMnO1xyXG5pbXBvcnQgeyBLdGREaWN0aW9uYXJ5IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBLdGRHcmlkU2VydmljZSB9IGZyb20gJy4vZ3JpZC5zZXJ2aWNlJztcclxuaW1wb3J0IHsgZ2V0TXV0YWJsZUNsaWVudFJlY3QsIEt0ZENsaWVudFJlY3QgfSBmcm9tICcuL3V0aWxzL2NsaWVudC1yZWN0JztcclxuaW1wb3J0IHsga3RkR2V0U2Nyb2xsVG90YWxSZWxhdGl2ZURpZmZlcmVuY2UkLCBrdGRTY3JvbGxJZk5lYXJFbGVtZW50Q2xpZW50UmVjdCQgfSBmcm9tICcuL3V0aWxzL3Njcm9sbCc7XHJcbmltcG9ydCB7IEJvb2xlYW5JbnB1dCwgY29lcmNlQm9vbGVhblByb3BlcnR5IH0gZnJvbSAnLi9jb2VyY2lvbi9ib29sZWFuLXByb3BlcnR5JztcclxuaW1wb3J0IHsgS3RkR3JpZEl0ZW1QbGFjZWhvbGRlciB9IGZyb20gJy4vZGlyZWN0aXZlcy9wbGFjZWhvbGRlcic7XHJcbmltcG9ydCB7IGdldFRyYW5zZm9ybVRyYW5zaXRpb25EdXJhdGlvbkluTXMgfSBmcm9tICcuL3V0aWxzL3RyYW5zaXRpb24tZHVyYXRpb24nO1xyXG5pbXBvcnQgeyBET0NVTUVOVCB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XHJcblxyXG5pbnRlcmZhY2UgS3RkRHJhZ1Jlc2l6ZUV2ZW50IHtcclxuICAgIGxheW91dDogS3RkR3JpZExheW91dDtcclxuICAgIGxheW91dEl0ZW06IEt0ZEdyaWRMYXlvdXRJdGVtO1xyXG4gICAgZ3JpZEl0ZW1SZWY6IEt0ZEdyaWRJdGVtQ29tcG9uZW50O1xyXG4gICAgc2VsZWN0ZWRJdGVtcz86IHtcclxuICAgICAgICBsYXlvdXRJdGVtOiBLdGRHcmlkTGF5b3V0SXRlbTtcclxuICAgICAgICBncmlkSXRlbVJlZjogS3RkR3JpZEl0ZW1Db21wb25lbnQ7XHJcbiAgICB9W107XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIEt0ZERyYWdTdGFydCA9IEt0ZERyYWdSZXNpemVFdmVudDtcclxuZXhwb3J0IHR5cGUgS3RkUmVzaXplU3RhcnQgPSBLdGREcmFnUmVzaXplRXZlbnQ7XHJcbmV4cG9ydCB0eXBlIEt0ZERyYWdFbmQgPSBLdGREcmFnUmVzaXplRXZlbnQ7XHJcbmV4cG9ydCB0eXBlIEt0ZFJlc2l6ZUVuZCA9IEt0ZERyYWdSZXNpemVFdmVudDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgS3RkR3JpZEl0ZW1SZXNpemVFdmVudCB7XHJcbiAgICB3aWR0aDogbnVtYmVyO1xyXG4gICAgaGVpZ2h0OiBudW1iZXI7XHJcbiAgICBncmlkSXRlbVJlZjogS3RkR3JpZEl0ZW1Db21wb25lbnQ7XHJcbn1cclxuXHJcbnR5cGUgRHJhZ0FjdGlvblR5cGUgPSAnZHJhZycgfCAncmVzaXplJztcclxuXHJcbmZ1bmN0aW9uIGdldERyYWdSZXNpemVFdmVudERhdGEoZ3JpZEl0ZW06IEt0ZEdyaWRJdGVtQ29tcG9uZW50LCBsYXlvdXQ6IEt0ZEdyaWRMYXlvdXQsIG11bHRpcGxlU2VsZWN0aW9uPzogS3RkR3JpZEl0ZW1Db21wb25lbnRbXSk6IEt0ZERyYWdSZXNpemVFdmVudCB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGxheW91dCxcclxuICAgICAgICBsYXlvdXRJdGVtOiBsYXlvdXQuZmluZCgoaXRlbSkgPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpISxcclxuICAgICAgICBncmlkSXRlbVJlZjogZ3JpZEl0ZW0sXHJcbiAgICAgICAgc2VsZWN0ZWRJdGVtczogbXVsdGlwbGVTZWxlY3Rpb24gJiYgbXVsdGlwbGVTZWxlY3Rpb24ubWFwKHNlbGVjdGVkSXRlbT0+KFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBsYXlvdXRJdGVtOiBsYXlvdXQuZmluZCgobGF5b3V0SXRlbTogS3RkR3JpZExheW91dEl0ZW0pID0+IGxheW91dEl0ZW0uaWQgPT09IHNlbGVjdGVkSXRlbS5pZCkhLFxyXG4gICAgICAgICAgICAgICAgZ3JpZEl0ZW1SZWY6IHNlbGVjdGVkSXRlbVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIClcclxuICAgIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENvbHVtbldpZHRoKGNvbmZpZzogS3RkR3JpZENmZywgd2lkdGg6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBjb25zdCB7Y29scywgZ2FwfSA9IGNvbmZpZztcclxuICAgIGNvbnN0IHdpZHRoRXhjbHVkaW5nR2FwID0gd2lkdGggLSBNYXRoLm1heCgoZ2FwICogKGNvbHMgLSAxKSksIDApO1xyXG4gICAgcmV0dXJuICh3aWR0aEV4Y2x1ZGluZ0dhcCAvIGNvbHMpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRSb3dIZWlnaHRJblBpeGVscyhjb25maWc6IEt0ZEdyaWRDZmcsIGhlaWdodDogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IHtyb3dIZWlnaHQsIGxheW91dCwgZ2FwfSA9IGNvbmZpZztcclxuICAgIHJldHVybiByb3dIZWlnaHQgPT09ICdmaXQnID8ga3RkR2V0R3JpZEl0ZW1Sb3dIZWlnaHQobGF5b3V0LCBoZWlnaHQsIGdhcCkgOiByb3dIZWlnaHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGxheW91dFRvUmVuZGVySXRlbXMoY29uZmlnOiBLdGRHcmlkQ2ZnLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IEt0ZERpY3Rpb25hcnk8S3RkR3JpZEl0ZW1SZW5kZXJEYXRhPG51bWJlcj4+IHtcclxuICAgIGNvbnN0IHtsYXlvdXQsIGdhcH0gPSBjb25maWc7XHJcbiAgICBjb25zdCByb3dIZWlnaHRJblBpeGVscyA9IGdldFJvd0hlaWdodEluUGl4ZWxzKGNvbmZpZywgaGVpZ2h0KTtcclxuICAgIGNvbnN0IGl0ZW1XaWR0aFBlckNvbHVtbiA9IGdldENvbHVtbldpZHRoKGNvbmZpZywgd2lkdGgpO1xyXG4gICAgY29uc3QgcmVuZGVySXRlbXM6IEt0ZERpY3Rpb25hcnk8S3RkR3JpZEl0ZW1SZW5kZXJEYXRhPG51bWJlcj4+ID0ge307XHJcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgbGF5b3V0KSB7XHJcbiAgICAgICAgcmVuZGVySXRlbXNbaXRlbS5pZF0gPSB7XHJcbiAgICAgICAgICAgIGlkOiBpdGVtLmlkLFxyXG4gICAgICAgICAgICB0b3A6IGl0ZW0ueSAqIHJvd0hlaWdodEluUGl4ZWxzICsgZ2FwICogaXRlbS55LFxyXG4gICAgICAgICAgICBsZWZ0OiBpdGVtLnggKiBpdGVtV2lkdGhQZXJDb2x1bW4gKyBnYXAgKiBpdGVtLngsXHJcbiAgICAgICAgICAgIHdpZHRoOiBpdGVtLncgKiBpdGVtV2lkdGhQZXJDb2x1bW4gKyBnYXAgKiBNYXRoLm1heChpdGVtLncgLSAxLCAwKSxcclxuICAgICAgICAgICAgaGVpZ2h0OiBpdGVtLmggKiByb3dIZWlnaHRJblBpeGVscyArIGdhcCAqIE1hdGgubWF4KGl0ZW0uaCAtIDEsIDApLFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVuZGVySXRlbXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEdyaWRIZWlnaHQobGF5b3V0OiBLdGRHcmlkTGF5b3V0LCByb3dIZWlnaHQ6IG51bWJlciwgZ2FwOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIGxheW91dC5yZWR1Y2UoKGFjYywgY3VyKSA9PiBNYXRoLm1heChhY2MsIChjdXIueSArIGN1ci5oKSAqIHJvd0hlaWdodCArIE1hdGgubWF4KGN1ci55ICsgY3VyLmggLSAxLCAwKSAqIGdhcCksIDApO1xyXG59XHJcblxyXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQGthdG9pZC9wcmVmaXgtZXhwb3J0ZWQtY29kZVxyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VSZW5kZXJJdGVtVG9QaXhlbHMocmVuZGVySXRlbTogS3RkR3JpZEl0ZW1SZW5kZXJEYXRhPG51bWJlcj4pOiBLdGRHcmlkSXRlbVJlbmRlckRhdGE8c3RyaW5nPiB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiByZW5kZXJJdGVtLmlkLFxyXG4gICAgICAgIHRvcDogYCR7cmVuZGVySXRlbS50b3B9cHhgLFxyXG4gICAgICAgIGxlZnQ6IGAke3JlbmRlckl0ZW0ubGVmdH1weGAsXHJcbiAgICAgICAgd2lkdGg6IGAke3JlbmRlckl0ZW0ud2lkdGh9cHhgLFxyXG4gICAgICAgIGhlaWdodDogYCR7cmVuZGVySXRlbS5oZWlnaHR9cHhgXHJcbiAgICB9O1xyXG59XHJcblxyXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQGthdG9pZC9wcmVmaXgtZXhwb3J0ZWQtY29kZVxyXG5leHBvcnQgZnVuY3Rpb24gX19ncmlkSXRlbUdldFJlbmRlckRhdGFGYWN0b3J5RnVuYyhncmlkQ21wOiBLdGRHcmlkQ29tcG9uZW50KSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oaWQ6IHN0cmluZykge1xyXG4gICAgICAgIHJldHVybiBwYXJzZVJlbmRlckl0ZW1Ub1BpeGVscyhncmlkQ21wLmdldEl0ZW1SZW5kZXJEYXRhKGlkKSk7XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24ga3RkR3JpZEl0ZW1HZXRSZW5kZXJEYXRhRmFjdG9yeUZ1bmMoZ3JpZENtcDogS3RkR3JpZENvbXBvbmVudCkge1xyXG4gICAgLy8gV29ya2Fyb3VuZCBleHBsYWluZWQ6IGh0dHBzOi8vZ2l0aHViLmNvbS9uZy1wYWNrYWdyL25nLXBhY2thZ3IvaXNzdWVzLzY5NiNpc3N1ZWNvbW1lbnQtMzg3MTE0NjEzXHJcbiAgICBjb25zdCByZXN1bHRGdW5jID0gX19ncmlkSXRlbUdldFJlbmRlckRhdGFGYWN0b3J5RnVuYyhncmlkQ21wKTtcclxuICAgIHJldHVybiByZXN1bHRGdW5jO1xyXG59XHJcblxyXG5jb25zdCBkZWZhdWx0QmFja2dyb3VuZENvbmZpZzogUmVxdWlyZWQ8T21pdDxLdGRHcmlkQmFja2dyb3VuZENmZywgJ3Nob3cnPj4gPSB7XHJcbiAgICBib3JkZXJDb2xvcjogJyNmZmE3MjY3OCcsXHJcbiAgICBnYXBDb2xvcjogJ3RyYW5zcGFyZW50JyxcclxuICAgIHJvd0NvbG9yOiAndHJhbnNwYXJlbnQnLFxyXG4gICAgY29sdW1uQ29sb3I6ICd0cmFuc3BhcmVudCcsXHJcbiAgICBib3JkZXJXaWR0aDogMSxcclxufTtcclxuXHJcbkBDb21wb25lbnQoe1xyXG4gICAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICAgIHNlbGVjdG9yOiAna3RkLWdyaWQnLFxyXG4gICAgdGVtcGxhdGVVcmw6ICcuL2dyaWQuY29tcG9uZW50Lmh0bWwnLFxyXG4gICAgc3R5bGVVcmxzOiBbJy4vZ3JpZC5jb21wb25lbnQuc2NzcyddLFxyXG4gICAgZW5jYXBzdWxhdGlvbjogVmlld0VuY2Fwc3VsYXRpb24uTm9uZSxcclxuICAgIGNoYW5nZURldGVjdGlvbjogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuT25QdXNoLFxyXG4gICAgcHJvdmlkZXJzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwcm92aWRlOiBHUklEX0lURU1fR0VUX1JFTkRFUl9EQVRBX1RPS0VOLFxyXG4gICAgICAgICAgICB1c2VGYWN0b3J5OiBrdGRHcmlkSXRlbUdldFJlbmRlckRhdGFGYWN0b3J5RnVuYyxcclxuICAgICAgICAgICAgZGVwczogW0t0ZEdyaWRDb21wb25lbnRdXHJcbiAgICAgICAgfVxyXG4gICAgXVxyXG59KVxyXG5leHBvcnQgY2xhc3MgS3RkR3JpZENvbXBvbmVudCBpbXBsZW1lbnRzIE9uQ2hhbmdlcywgQWZ0ZXJDb250ZW50SW5pdCwgQWZ0ZXJDb250ZW50Q2hlY2tlZCwgT25EZXN0cm95IHtcclxuICAgIC8qKiBRdWVyeSBsaXN0IG9mIGdyaWQgaXRlbXMgdGhhdCBhcmUgYmVpbmcgcmVuZGVyZWQuICovXHJcbiAgICBAQ29udGVudENoaWxkcmVuKEt0ZEdyaWRJdGVtQ29tcG9uZW50LCB7ZGVzY2VuZGFudHM6IHRydWV9KSBfZ3JpZEl0ZW1zOiBRdWVyeUxpc3Q8S3RkR3JpZEl0ZW1Db21wb25lbnQ+O1xyXG5cclxuICAgIC8qKiBFbWl0cyB3aGVuIGxheW91dCBjaGFuZ2UgKi9cclxuICAgIEBPdXRwdXQoKSBsYXlvdXRVcGRhdGVkOiBFdmVudEVtaXR0ZXI8S3RkR3JpZExheW91dD4gPSBuZXcgRXZlbnRFbWl0dGVyPEt0ZEdyaWRMYXlvdXQ+KCk7XHJcblxyXG4gICAgLyoqIEVtaXRzIHdoZW4gZHJhZyBzdGFydHMgKi9cclxuICAgIEBPdXRwdXQoKSBkcmFnU3RhcnRlZDogRXZlbnRFbWl0dGVyPEt0ZERyYWdTdGFydD4gPSBuZXcgRXZlbnRFbWl0dGVyPEt0ZERyYWdTdGFydD4oKTtcclxuXHJcbiAgICAvKiogRW1pdHMgd2hlbiByZXNpemUgc3RhcnRzICovXHJcbiAgICBAT3V0cHV0KCkgcmVzaXplU3RhcnRlZDogRXZlbnRFbWl0dGVyPEt0ZFJlc2l6ZVN0YXJ0PiA9IG5ldyBFdmVudEVtaXR0ZXI8S3RkUmVzaXplU3RhcnQ+KCk7XHJcblxyXG4gICAgLyoqIEVtaXRzIHdoZW4gZHJhZyBlbmRzICovXHJcbiAgICBAT3V0cHV0KCkgZHJhZ0VuZGVkOiBFdmVudEVtaXR0ZXI8S3RkRHJhZ0VuZD4gPSBuZXcgRXZlbnRFbWl0dGVyPEt0ZERyYWdFbmQ+KCk7XHJcblxyXG4gICAgLyoqIEVtaXRzIHdoZW4gcmVzaXplIGVuZHMgKi9cclxuICAgIEBPdXRwdXQoKSByZXNpemVFbmRlZDogRXZlbnRFbWl0dGVyPEt0ZFJlc2l6ZUVuZD4gPSBuZXcgRXZlbnRFbWl0dGVyPEt0ZFJlc2l6ZUVuZD4oKTtcclxuXHJcbiAgICAvKiogRW1pdHMgd2hlbiBhIGdyaWQgaXRlbSBpcyBiZWluZyByZXNpemVkIGFuZCBpdHMgYm91bmRzIGhhdmUgY2hhbmdlZCAqL1xyXG4gICAgQE91dHB1dCgpIGdyaWRJdGVtUmVzaXplOiBFdmVudEVtaXR0ZXI8S3RkR3JpZEl0ZW1SZXNpemVFdmVudD4gPSBuZXcgRXZlbnRFbWl0dGVyPEt0ZEdyaWRJdGVtUmVzaXplRXZlbnQ+KCk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQYXJlbnQgZWxlbWVudCB0aGF0IGNvbnRhaW5zIHRoZSBzY3JvbGwuIElmIGFuIHN0cmluZyBpcyBwcm92aWRlZCBpdCB3b3VsZCBzZWFyY2ggdGhhdCBlbGVtZW50IGJ5IGlkIG9uIHRoZSBkb20uXHJcbiAgICAgKiBJZiBubyBkYXRhIHByb3ZpZGVkIG9yIG51bGwgYXV0b3Njcm9sbCBpcyBub3QgcGVyZm9ybWVkLlxyXG4gICAgICovXHJcbiAgICBASW5wdXQoKSBzY3JvbGxhYmxlUGFyZW50OiBIVE1MRWxlbWVudCB8IERvY3VtZW50IHwgc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgLyoqIFdoZXRoZXIgb3Igbm90IHRvIHVwZGF0ZSB0aGUgaW50ZXJuYWwgbGF5b3V0IHdoZW4gc29tZSBkZXBlbmRlbnQgcHJvcGVydHkgY2hhbmdlLiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBjb21wYWN0T25Qcm9wc0NoYW5nZSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2NvbXBhY3RPblByb3BzQ2hhbmdlOyB9XHJcblxyXG4gICAgc2V0IGNvbXBhY3RPblByb3BzQ2hhbmdlKHZhbHVlOiBib29sZWFuKSB7XHJcbiAgICAgICAgdGhpcy5fY29tcGFjdE9uUHJvcHNDaGFuZ2UgPSBjb2VyY2VCb29sZWFuUHJvcGVydHkodmFsdWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2NvbXBhY3RPblByb3BzQ2hhbmdlOiBib29sZWFuID0gdHJ1ZTtcclxuXHJcbiAgICAvKiogSWYgdHJ1ZSwgZ3JpZCBpdGVtcyB3b24ndCBjaGFuZ2UgcG9zaXRpb24gd2hlbiBiZWluZyBkcmFnZ2VkIG92ZXIuIEhhbmR5IHdoZW4gdXNpbmcgbm8gY29tcGFjdGlvbiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBwcmV2ZW50Q29sbGlzaW9uKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fcHJldmVudENvbGxpc2lvbjsgfVxyXG5cclxuICAgIHNldCBwcmV2ZW50Q29sbGlzaW9uKHZhbHVlOiBib29sZWFuKSB7XHJcbiAgICAgICAgdGhpcy5fcHJldmVudENvbGxpc2lvbiA9IGNvZXJjZUJvb2xlYW5Qcm9wZXJ0eSh2YWx1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfcHJldmVudENvbGxpc2lvbjogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIC8qKiBOdW1iZXIgb2YgQ1NTIHBpeGVscyB0aGF0IHdvdWxkIGJlIHNjcm9sbGVkIG9uIGVhY2ggJ3RpY2snIHdoZW4gYXV0byBzY3JvbGwgaXMgcGVyZm9ybWVkLiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBzY3JvbGxTcGVlZCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5fc2Nyb2xsU3BlZWQ7IH1cclxuXHJcbiAgICBzZXQgc2Nyb2xsU3BlZWQodmFsdWU6IG51bWJlcikge1xyXG4gICAgICAgIHRoaXMuX3Njcm9sbFNwZWVkID0gY29lcmNlTnVtYmVyUHJvcGVydHkodmFsdWUsIDIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Njcm9sbFNwZWVkOiBudW1iZXIgPSAyO1xyXG5cclxuICAgIC8qKiBUeXBlIG9mIGNvbXBhY3Rpb24gdGhhdCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIGxheW91dCAodmVydGljYWwsIGhvcml6b250YWwgb3IgZnJlZSkuIERlZmF1bHRzIHRvICd2ZXJ0aWNhbCcgKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgY29tcGFjdFR5cGUoKTogS3RkR3JpZENvbXBhY3RUeXBlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fY29tcGFjdFR5cGU7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IGNvbXBhY3RUeXBlKHZhbDogS3RkR3JpZENvbXBhY3RUeXBlKSB7XHJcbiAgICAgICAgdGhpcy5fY29tcGFjdFR5cGUgPSB2YWw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY29tcGFjdFR5cGU6IEt0ZEdyaWRDb21wYWN0VHlwZSA9ICd2ZXJ0aWNhbCc7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSb3cgaGVpZ2h0IGFzIG51bWJlciBvciBhcyAnZml0Jy5cclxuICAgICAqIElmIHJvd0hlaWdodCBpcyBhIG51bWJlciB2YWx1ZSwgaXQgbWVhbnMgdGhhdCBlYWNoIHJvdyB3b3VsZCBoYXZlIHRob3NlIGNzcyBwaXhlbHMgaW4gaGVpZ2h0LlxyXG4gICAgICogaWYgcm93SGVpZ2h0IGlzICdmaXQnLCBpdCBtZWFucyB0aGF0IHJvd3Mgd2lsbCBmaXQgaW4gdGhlIGhlaWdodCBhdmFpbGFibGUuIElmICdmaXQnIHZhbHVlIGlzIHNldCwgYSAnaGVpZ2h0JyBzaG91bGQgYmUgYWxzbyBwcm92aWRlZC5cclxuICAgICAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCByb3dIZWlnaHQoKTogbnVtYmVyIHwgJ2ZpdCcgeyByZXR1cm4gdGhpcy5fcm93SGVpZ2h0OyB9XHJcblxyXG4gICAgc2V0IHJvd0hlaWdodCh2YWw6IG51bWJlciB8ICdmaXQnKSB7XHJcbiAgICAgICAgdGhpcy5fcm93SGVpZ2h0ID0gdmFsID09PSAnZml0JyA/IHZhbCA6IE1hdGgubWF4KDEsIE1hdGgucm91bmQoY29lcmNlTnVtYmVyUHJvcGVydHkodmFsKSkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX3Jvd0hlaWdodDogbnVtYmVyIHwgJ2ZpdCcgPSAxMDA7XHJcblxyXG4gICAgLyoqIE51bWJlciBvZiBjb2x1bW5zICAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBjb2xzKCk6IG51bWJlciB7IHJldHVybiB0aGlzLl9jb2xzOyB9XHJcblxyXG4gICAgc2V0IGNvbHModmFsOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLl9jb2xzID0gTWF0aC5tYXgoMSwgTWF0aC5yb3VuZChjb2VyY2VOdW1iZXJQcm9wZXJ0eSh2YWwpKSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfY29sczogbnVtYmVyID0gNjtcclxuXHJcbiAgICAvKiogTGF5b3V0IG9mIHRoZSBncmlkLiBBcnJheSBvZiBhbGwgdGhlIGdyaWQgaXRlbXMgd2l0aCBpdHMgJ2lkJyBhbmQgcG9zaXRpb24gb24gdGhlIGdyaWQuICovXHJcbiAgICBASW5wdXQoKVxyXG4gICAgZ2V0IGxheW91dCgpOiBLdGRHcmlkTGF5b3V0IHsgcmV0dXJuIHRoaXMuX2xheW91dDsgfVxyXG5cclxuICAgIHNldCBsYXlvdXQobGF5b3V0OiBLdGRHcmlkTGF5b3V0KSB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRW5oYW5jZW1lbnQ6XHJcbiAgICAgICAgICogT25seSBzZXQgbGF5b3V0IGlmIGl0J3MgcmVmZXJlbmNlIGhhcyBjaGFuZ2VkIGFuZCB1c2UgYSBib29sZWFuIHRvIHRyYWNrIHdoZW5ldmVyIHJlY2FsY3VsYXRlIHRoZSBsYXlvdXQgb24gbmdPbkNoYW5nZXMuXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBXaHk6XHJcbiAgICAgICAgICogVGhlIG5vcm1hbCB1c2Ugb2YgdGhpcyBsaWIgaXMgaGF2aW5nIHRoZSB2YXJpYWJsZSBsYXlvdXQgaW4gdGhlIG91dGVyIGNvbXBvbmVudCBvciBpbiBhIHN0b3JlLCBhc3NpZ25pbmcgaXQgd2hlbmV2ZXIgaXQgY2hhbmdlcyBhbmRcclxuICAgICAgICAgKiBiaW5kZWQgaW4gdGhlIGNvbXBvbmVudCB3aXRoIGl0J3MgaW5wdXQgW2xheW91dF0uIEluIHRoaXMgc2NlbmFyaW8sIHdlIHdvdWxkIGFsd2F5cyBjYWxjdWxhdGUgb25lIHVubmVjZXNzYXJ5IGNoYW5nZSBvbiB0aGUgbGF5b3V0IHdoZW5cclxuICAgICAgICAgKiBpdCBpcyByZS1iaW5kZWQgb24gdGhlIGlucHV0LlxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuX2xheW91dCA9IGxheW91dDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9sYXlvdXQ6IEt0ZEdyaWRMYXlvdXQ7XHJcblxyXG4gICAgLyoqIEdyaWQgZ2FwIGluIGNzcyBwaXhlbHMgKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgZ2FwKCk6IG51bWJlciB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dhcDtcclxuICAgIH1cclxuXHJcbiAgICBzZXQgZ2FwKHZhbDogbnVtYmVyKSB7XHJcbiAgICAgICAgdGhpcy5fZ2FwID0gTWF0aC5tYXgoY29lcmNlTnVtYmVyUHJvcGVydHkodmFsKSwgMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfZ2FwOiBudW1iZXIgPSAwO1xyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIElmIGhlaWdodCBpcyBhIG51bWJlciwgZml4ZXMgdGhlIGhlaWdodCBvZiB0aGUgZ3JpZCB0byBpdCwgcmVjb21tZW5kZWQgd2hlbiByb3dIZWlnaHQgPSAnZml0JyBpcyB1c2VkLlxyXG4gICAgICogSWYgaGVpZ2h0IGlzIG51bGwsIGhlaWdodCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgc2V0IGFjY29yZGluZyB0byBpdHMgaW5uZXIgZ3JpZCBpdGVtcy5cclxuICAgICAqIERlZmF1bHRzIHRvIG51bGwuXHJcbiAgICAgKiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBoZWlnaHQoKTogbnVtYmVyIHwgbnVsbCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hlaWdodDtcclxuICAgIH1cclxuXHJcbiAgICBzZXQgaGVpZ2h0KHZhbDogbnVtYmVyIHwgbnVsbCkge1xyXG4gICAgICAgIHRoaXMuX2hlaWdodCA9IHR5cGVvZiB2YWwgPT09ICdudW1iZXInID8gTWF0aC5tYXgodmFsLCAwKSA6IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfaGVpZ2h0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE11bHRpcGxlIGl0ZW1zIGRyYWcvcmVzaXplXHJcbiAgICAgKiBBIGxpc3Qgb2Ygc2VsZWN0ZWQgaXRlbXMgdG8gbW92ZSAoZHJhZyBvciByZXNpemUpIHRvZ2V0aGVyIGFzIGEgZ3JvdXAuXHJcbiAgICAgKiBUaGUgbXVsdGktc2VsZWN0aW9uIG9mIGl0ZW1zIGlzIG1hbmFnZWQgZXh0ZXJuYWxseS4gQnkgZGVmYXVsdCwgdGhlIGxpYnJhcnkgbWFuYWdlcyBhIHNpbmdsZSBpdGVtLCBidXQgaWYgYSBzZXQgb2YgaXRlbSBJRHMgaXMgcHJvdmlkZWQsIHRoZSBzcGVjaWZpZWQgZ3JvdXAgd2lsbCBiZSBoYW5kbGVkIGFzIGEgdW5pdC5cIlxyXG4gICAgICovXHJcbiAgICBASW5wdXQoKVxyXG4gICAgZ2V0IHNlbGVjdGVkSXRlbXNJZHMoKTogc3RyaW5nW10gfCBudWxsIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fc2VsZWN0ZWRJdGVtc0lkcztcclxuICAgIH1cclxuXHJcbiAgICBzZXQgc2VsZWN0ZWRJdGVtc0lkcyh2YWw6IHN0cmluZ1tdIHwgbnVsbCkge1xyXG4gICAgICAgIHRoaXMuX3NlbGVjdGVkSXRlbXNJZHMgPSB2YWw7XHJcbiAgICAgICAgaWYodmFsKXtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW1zID0gdmFsLm1hcChcclxuICAgICAgICAgICAgICAgIChsYXlvdXRJdGVtSWQ6IHN0cmluZykgPT5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncmlkSXRlbXMuZmluZChcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCkgPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRJdGVtLmlkID09PSBsYXlvdXRJdGVtSWRcclxuICAgICAgICAgICAgICAgICAgICApIVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRJdGVtcyA9IHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfc2VsZWN0ZWRJdGVtc0lkczogc3RyaW5nW10gfCBudWxsO1xyXG4gICAgc2VsZWN0ZWRJdGVtczogS3RkR3JpZEl0ZW1Db21wb25lbnRbXSB8IHVuZGVmaW5lZDtcclxuXHJcblxyXG4gICAgQElucHV0KClcclxuICAgIGdldCBiYWNrZ3JvdW5kQ29uZmlnKCk6IEt0ZEdyaWRCYWNrZ3JvdW5kQ2ZnIHwgbnVsbCB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhY2tncm91bmRDb25maWc7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IGJhY2tncm91bmRDb25maWcodmFsOiBLdGRHcmlkQmFja2dyb3VuZENmZyB8IG51bGwpIHtcclxuICAgICAgICB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnID0gdmFsO1xyXG5cclxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBiYWNrZ3JvdW5kIGNvbmZpZ3VyYXRpb24sIGFkZCBtYWluIGdyaWQgYmFja2dyb3VuZCBjbGFzcy4gR3JpZCBiYWNrZ3JvdW5kIGNsYXNzIGNvbWVzIHdpdGggb3BhY2l0eSAwLlxyXG4gICAgICAgIC8vIEl0IGlzIGRvbmUgdGhpcyB3YXkgZm9yIGFkZGluZyBvcGFjaXR5IGFuaW1hdGlvbiBhbmQgdG8gZG9uJ3QgYWRkIGFueSBzdHlsZXMgd2hlbiBncmlkIGJhY2tncm91bmQgaXMgbnVsbC5cclxuICAgICAgICBjb25zdCBjbGFzc0xpc3QgPSAodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQgYXMgSFRNTERpdkVsZW1lbnQpLmNsYXNzTGlzdDtcclxuICAgICAgICB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnICE9PSBudWxsID8gY2xhc3NMaXN0LmFkZCgna3RkLWdyaWQtYmFja2dyb3VuZCcpIDogY2xhc3NMaXN0LnJlbW92ZSgna3RkLWdyaWQtYmFja2dyb3VuZCcpO1xyXG5cclxuICAgICAgICAvLyBTZXQgYmFja2dyb3VuZCB2aXNpYmlsaXR5XHJcbiAgICAgICAgdGhpcy5zZXRHcmlkQmFja2dyb3VuZFZpc2libGUodGhpcy5fYmFja2dyb3VuZENvbmZpZz8uc2hvdyA9PT0gJ2Fsd2F5cycpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2JhY2tncm91bmRDb25maWc6IEt0ZEdyaWRCYWNrZ3JvdW5kQ2ZnIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgcHJpdmF0ZSBncmlkQ3VycmVudEhlaWdodDogbnVtYmVyO1xyXG5cclxuICAgIGdldCBjb25maWcoKTogS3RkR3JpZENmZyB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgY29sczogdGhpcy5jb2xzLFxyXG4gICAgICAgICAgICByb3dIZWlnaHQ6IHRoaXMucm93SGVpZ2h0LFxyXG4gICAgICAgICAgICBoZWlnaHQ6IHRoaXMuaGVpZ2h0LFxyXG4gICAgICAgICAgICBsYXlvdXQ6IHRoaXMubGF5b3V0LFxyXG4gICAgICAgICAgICBwcmV2ZW50Q29sbGlzaW9uOiB0aGlzLnByZXZlbnRDb2xsaXNpb24sXHJcbiAgICAgICAgICAgIGdhcDogdGhpcy5nYXAsXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKiogUmVmZXJlbmNlcyB0byB0aGUgdmlld3Mgb2YgdGhlIHBsYWNlaG9sZGVyIGVsZW1lbnRzLiAqL1xyXG4gICAgcHJpdmF0ZSBwbGFjZWhvbGRlclJlZjogS3RkRGljdGlvbmFyeTxFbWJlZGRlZFZpZXdSZWY8YW55PiB8IG51bGw+PXt9O1xyXG5cclxuICAgIC8qKiBFbGVtZW50cyB0aGF0IGFyZSByZW5kZXJlZCBhcyBwbGFjZWhvbGRlciB3aGVuIGEgbGlzdCBvZiBncmlkIGl0ZW1zIGFyZSBiZWluZyBkcmFnZ2VkICovXHJcbiAgICBwcml2YXRlIHBsYWNlaG9sZGVyOiBLdGREaWN0aW9uYXJ5PEhUTUxFbGVtZW50IHwgbnVsbD49e307XHJcblxyXG4gICAgcHJpdmF0ZSBfZ3JpZEl0ZW1zUmVuZGVyRGF0YTogS3RkRGljdGlvbmFyeTxLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPj47XHJcbiAgICBwcml2YXRlIHN1YnNjcmlwdGlvbnM6IFN1YnNjcmlwdGlvbltdID0gW107XHJcblxyXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBncmlkU2VydmljZTogS3RkR3JpZFNlcnZpY2UsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIGVsZW1lbnRSZWY6IEVsZW1lbnRSZWYsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIHZpZXdDb250YWluZXJSZWY6IFZpZXdDb250YWluZXJSZWYsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIHJlbmRlcmVyOiBSZW5kZXJlcjIsXHJcbiAgICAgICAgICAgICAgICBwcml2YXRlIG5nWm9uZTogTmdab25lLFxyXG4gICAgICAgICAgICAgICAgQEluamVjdChET0NVTUVOVCkgcHJpdmF0ZSBkb2N1bWVudDogRG9jdW1lbnQpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgbmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcykge1xyXG5cclxuICAgICAgICBpZiAodGhpcy5yb3dIZWlnaHQgPT09ICdmaXQnICYmIHRoaXMuaGVpZ2h0ID09IG51bGwpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGBLdGRHcmlkQ29tcG9uZW50OiBUaGUgQElucHV0KCkgaGVpZ2h0IHNob3VsZCBub3QgYmUgbnVsbCB3aGVuIHVzaW5nIHJvd0hlaWdodCAnZml0J2ApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IG5lZWRzQ29tcGFjdExheW91dCA9IGZhbHNlO1xyXG4gICAgICAgIGxldCBuZWVkc1JlY2FsY3VsYXRlUmVuZGVyRGF0YSA9IGZhbHNlO1xyXG5cclxuICAgICAgICAvLyBUT0RPOiBEb2VzIGZpc3QgY2hhbmdlIG5lZWQgdG8gYmUgY29tcGFjdGVkIGJ5IGRlZmF1bHQ/XHJcbiAgICAgICAgLy8gQ29tcGFjdCBsYXlvdXQgd2hlbmV2ZXIgc29tZSBkZXBlbmRlbnQgcHJvcCBjaGFuZ2VzLlxyXG4gICAgICAgIGlmIChjaGFuZ2VzLmNvbXBhY3RUeXBlIHx8IGNoYW5nZXMuY29scyB8fCBjaGFuZ2VzLmxheW91dCkge1xyXG4gICAgICAgICAgICBuZWVkc0NvbXBhY3RMYXlvdXQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2VlIG5lZWQgdG8gcmVjYWxjdWxhdGUgcmVuZGVyaW5nIGRhdGEuXHJcbiAgICAgICAgaWYgKG5lZWRzQ29tcGFjdExheW91dCB8fCBjaGFuZ2VzLnJvd0hlaWdodCB8fCBjaGFuZ2VzLmhlaWdodCB8fCBjaGFuZ2VzLmdhcCB8fCBjaGFuZ2VzLmJhY2tncm91bmRDb25maWcpIHtcclxuICAgICAgICAgICAgbmVlZHNSZWNhbGN1bGF0ZVJlbmRlckRhdGEgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gT25seSBjb21wYWN0IGxheW91dCBpZiBsaWIgdXNlciBoYXMgcHJvdmlkZWQgaXQuIExpYiB1c2VycyB0aGF0IHdhbnQgdG8gc2F2ZS9zdG9yZSBhbHdheXMgdGhlIHNhbWUgbGF5b3V0ICBhcyBpdCBpcyByZXByZXNlbnRlZCAoY29tcGFjdGVkKVxyXG4gICAgICAgIC8vIGNhbiB1c2UgS3RkQ29tcGFjdEdyaWQgdXRpbGl0eSBhbmQgcHJlLWNvbXBhY3QgdGhlIGxheW91dC4gVGhpcyBpcyB0aGUgcmVjb21tZW5kZWQgYmVoYXZpb3VyIGZvciBhbHdheXMgaGF2aW5nIGEgdGhlIHNhbWUgbGF5b3V0IG9uIHRoaXMgY29tcG9uZW50XHJcbiAgICAgICAgLy8gYW5kIHRoZSBvbmVzIHRoYXQgdXNlcyBpdC5cclxuICAgICAgICBpZiAobmVlZHNDb21wYWN0TGF5b3V0ICYmIHRoaXMuY29tcGFjdE9uUHJvcHNDaGFuZ2UpIHtcclxuICAgICAgICAgICAgdGhpcy5jb21wYWN0TGF5b3V0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAobmVlZHNSZWNhbGN1bGF0ZVJlbmRlckRhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5jYWxjdWxhdGVSZW5kZXJEYXRhKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG5nQWZ0ZXJDb250ZW50SW5pdCgpIHtcclxuICAgICAgICB0aGlzLmluaXRTdWJzY3JpcHRpb25zKCk7XHJcbiAgICB9XHJcblxyXG4gICAgbmdBZnRlckNvbnRlbnRDaGVja2VkKCkge1xyXG4gICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVzaXplKCkge1xyXG4gICAgICAgIHRoaXMuY2FsY3VsYXRlUmVuZGVyRGF0YSgpO1xyXG4gICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgbmdPbkRlc3Ryb3koKSB7XHJcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zLmZvckVhY2goc3ViID0+IHN1Yi51bnN1YnNjcmliZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBjb21wYWN0TGF5b3V0KCkge1xyXG4gICAgICAgIHRoaXMubGF5b3V0ID0gY29tcGFjdCh0aGlzLmxheW91dCwgdGhpcy5jb21wYWN0VHlwZSwgdGhpcy5jb2xzKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRJdGVtc1JlbmRlckRhdGEoKTogS3RkRGljdGlvbmFyeTxLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPj4ge1xyXG4gICAgICAgIHJldHVybiB7Li4udGhpcy5fZ3JpZEl0ZW1zUmVuZGVyRGF0YX07XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0SXRlbVJlbmRlckRhdGEoaXRlbUlkOiBzdHJpbmcpOiBLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbaXRlbUlkXTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxjdWxhdGVSZW5kZXJEYXRhKCkge1xyXG4gICAgICAgIGNvbnN0IGNsaWVudFJlY3QgPSAodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIHRoaXMuZ3JpZEN1cnJlbnRIZWlnaHQgPSB0aGlzLmhlaWdodCA/PyAodGhpcy5yb3dIZWlnaHQgPT09ICdmaXQnID8gY2xpZW50UmVjdC5oZWlnaHQgOiBnZXRHcmlkSGVpZ2h0KHRoaXMubGF5b3V0LCB0aGlzLnJvd0hlaWdodCwgdGhpcy5nYXApKTtcclxuICAgICAgICB0aGlzLl9ncmlkSXRlbXNSZW5kZXJEYXRhID0gbGF5b3V0VG9SZW5kZXJJdGVtcyh0aGlzLmNvbmZpZywgY2xpZW50UmVjdC53aWR0aCwgdGhpcy5ncmlkQ3VycmVudEhlaWdodCk7XHJcblxyXG4gICAgICAgIC8vIFNldCBCYWNrZ3JvdW5kIENTUyB2YXJpYWJsZXNcclxuICAgICAgICB0aGlzLnNldEJhY2tncm91bmRDc3NWYXJpYWJsZXMoZ2V0Um93SGVpZ2h0SW5QaXhlbHModGhpcy5jb25maWcsIHRoaXMuZ3JpZEN1cnJlbnRIZWlnaHQpKTtcclxuICAgIH1cclxuXHJcbiAgICByZW5kZXIoKSB7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRTdHlsZSh0aGlzLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCwgJ2hlaWdodCcsIGAke3RoaXMuZ3JpZEN1cnJlbnRIZWlnaHR9cHhgKTtcclxuICAgICAgICB0aGlzLnVwZGF0ZUdyaWRJdGVtc1N0eWxlcygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc2V0QmFja2dyb3VuZENzc1ZhcmlhYmxlcyhyb3dIZWlnaHQ6IG51bWJlcikge1xyXG4gICAgICAgIGNvbnN0IHN0eWxlID0gKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50IGFzIEhUTUxEaXZFbGVtZW50KS5zdHlsZTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuX2JhY2tncm91bmRDb25maWcpIHtcclxuICAgICAgICAgICAgLy8gc3RydWN0dXJlXHJcbiAgICAgICAgICAgIHN0eWxlLnNldFByb3BlcnR5KCctLWdhcCcsIHRoaXMuZ2FwICsgJ3B4Jyk7XHJcbiAgICAgICAgICAgIHN0eWxlLnNldFByb3BlcnR5KCctLXJvdy1oZWlnaHQnLCByb3dIZWlnaHQgKyAncHgnKTtcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tY29sdW1ucycsIGAke3RoaXMuY29sc31gKTtcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tYm9yZGVyLXdpZHRoJywgKHRoaXMuX2JhY2tncm91bmRDb25maWcuYm9yZGVyV2lkdGggPz8gZGVmYXVsdEJhY2tncm91bmRDb25maWcuYm9yZGVyV2lkdGgpICsgJ3B4Jyk7XHJcblxyXG4gICAgICAgICAgICAvLyBjb2xvcnNcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tYm9yZGVyLWNvbG9yJywgdGhpcy5fYmFja2dyb3VuZENvbmZpZy5ib3JkZXJDb2xvciA/PyBkZWZhdWx0QmFja2dyb3VuZENvbmZpZy5ib3JkZXJDb2xvcik7XHJcbiAgICAgICAgICAgIHN0eWxlLnNldFByb3BlcnR5KCctLWdhcC1jb2xvcicsIHRoaXMuX2JhY2tncm91bmRDb25maWcuZ2FwQ29sb3IgPz8gZGVmYXVsdEJhY2tncm91bmRDb25maWcuZ2FwQ29sb3IpO1xyXG4gICAgICAgICAgICBzdHlsZS5zZXRQcm9wZXJ0eSgnLS1yb3ctY29sb3InLCB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnLnJvd0NvbG9yID8/IGRlZmF1bHRCYWNrZ3JvdW5kQ29uZmlnLnJvd0NvbG9yKTtcclxuICAgICAgICAgICAgc3R5bGUuc2V0UHJvcGVydHkoJy0tY29sdW1uLWNvbG9yJywgdGhpcy5fYmFja2dyb3VuZENvbmZpZy5jb2x1bW5Db2xvciA/PyBkZWZhdWx0QmFja2dyb3VuZENvbmZpZy5jb2x1bW5Db2xvcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tZ2FwJyk7XHJcbiAgICAgICAgICAgIHN0eWxlLnJlbW92ZVByb3BlcnR5KCctLXJvdy1oZWlnaHQnKTtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tY29sdW1ucycpO1xyXG4gICAgICAgICAgICBzdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS1ib3JkZXItd2lkdGgnKTtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tYm9yZGVyLWNvbG9yJyk7XHJcbiAgICAgICAgICAgIHN0eWxlLnJlbW92ZVByb3BlcnR5KCctLWdhcC1jb2xvcicpO1xyXG4gICAgICAgICAgICBzdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS1yb3ctY29sb3InKTtcclxuICAgICAgICAgICAgc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tY29sdW1uLWNvbG9yJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdXBkYXRlR3JpZEl0ZW1zU3R5bGVzKCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ3JpZEl0ZW1zLmZvckVhY2goaXRlbSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGdyaWRJdGVtUmVuZGVyRGF0YTogS3RkR3JpZEl0ZW1SZW5kZXJEYXRhPG51bWJlcj4gfCB1bmRlZmluZWQgPSB0aGlzLl9ncmlkSXRlbXNSZW5kZXJEYXRhW2l0ZW0uaWRdO1xyXG4gICAgICAgICAgICBpZiAoZ3JpZEl0ZW1SZW5kZXJEYXRhID09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYENvdWxkblxcJ3QgZmluZCB0aGUgc3BlY2lmaWVkIGdyaWQgaXRlbSBmb3IgdGhlIGlkOiAke2l0ZW0uaWR9YCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpdGVtLnNldFN0eWxlcyhwYXJzZVJlbmRlckl0ZW1Ub1BpeGVscyhncmlkSXRlbVJlbmRlckRhdGEpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICBwcml2YXRlIHNldEdyaWRCYWNrZ3JvdW5kVmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKSB7XHJcbiAgICAgICAgY29uc3QgY2xhc3NMaXN0ID0gKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50IGFzIEhUTUxEaXZFbGVtZW50KS5jbGFzc0xpc3Q7XHJcbiAgICAgICAgdmlzaWJsZSA/IGNsYXNzTGlzdC5hZGQoJ2t0ZC1ncmlkLWJhY2tncm91bmQtdmlzaWJsZScpIDogY2xhc3NMaXN0LnJlbW92ZSgna3RkLWdyaWQtYmFja2dyb3VuZC12aXNpYmxlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBpbml0U3Vic2NyaXB0aW9ucygpIHtcclxuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXHJcbiAgICAgICAgICAgIHRoaXMuX2dyaWRJdGVtcy5jaGFuZ2VzLnBpcGUoXHJcbiAgICAgICAgICAgICAgICBzdGFydFdpdGgodGhpcy5fZ3JpZEl0ZW1zKSxcclxuICAgICAgICAgICAgICAgIHN3aXRjaE1hcCgoZ3JpZEl0ZW1zOiBRdWVyeUxpc3Q8S3RkR3JpZEl0ZW1Db21wb25lbnQ+KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lcmdlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5ncmlkSXRlbXMubWFwKChncmlkSXRlbSkgPT4gZ3JpZEl0ZW0uZHJhZ1N0YXJ0JC5waXBlKG1hcCgoZXZlbnQpID0+ICh7ZXZlbnQsIGdyaWRJdGVtLCB0eXBlOiAnZHJhZycgYXMgRHJhZ0FjdGlvblR5cGV9KSkpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLi4uZ3JpZEl0ZW1zLm1hcCgoZ3JpZEl0ZW0pID0+IGdyaWRJdGVtLnJlc2l6ZVN0YXJ0JC5waXBlKG1hcCgoZXZlbnQpID0+ICh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRJdGVtLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Jlc2l6ZScgYXMgRHJhZ0FjdGlvblR5cGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpKSksXHJcbiAgICAgICAgICAgICAgICAgICAgKS5waXBlKGV4aGF1c3RNYXAoKHtldmVudCwgZ3JpZEl0ZW0sIHR5cGV9KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG11bHRpcGxlU2VsZWN0aW9uOiBLdGRHcmlkSXRlbUNvbXBvbmVudFtdIHwgdW5kZWZpbmVkID0gdGhpcy5zZWxlY3RlZEl0ZW1zICYmIFsuLi50aGlzLnNlbGVjdGVkSXRlbXNdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBFbWl0IGRyYWcgb3IgcmVzaXplIHN0YXJ0IGV2ZW50cy4gRW5zdXJlIHRoYXQgaXMgc3RhcnQgZXZlbnQgaXMgaW5zaWRlIHRoZSB6b25lLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5nWm9uZS5ydW4oKCkgPT4gKHR5cGUgPT09ICdkcmFnJyA/IHRoaXMuZHJhZ1N0YXJ0ZWQgOiB0aGlzLnJlc2l6ZVN0YXJ0ZWQpLmVtaXQoZ2V0RHJhZ1Jlc2l6ZUV2ZW50RGF0YShncmlkSXRlbSwgdGhpcy5sYXlvdXQsIG11bHRpcGxlU2VsZWN0aW9uKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldEdyaWRCYWNrZ3JvdW5kVmlzaWJsZSh0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnPy5zaG93ID09PSAnd2hlbkRyYWdnaW5nJyB8fCB0aGlzLl9iYWNrZ3JvdW5kQ29uZmlnPy5zaG93ID09PSAnYWx3YXlzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBlcmZvcm0gZHJhZyBzZXF1ZW5jZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZ3JpZEl0ZW1zU2VsZWN0ZWQ6IEt0ZEdyaWRJdGVtQ29tcG9uZW50W10gPSBbZ3JpZEl0ZW1dO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihtdWx0aXBsZVNlbGVjdGlvbiAmJiBtdWx0aXBsZVNlbGVjdGlvbi5zb21lKChjdXJySXRlbSk9PmN1cnJJdGVtLmlkPT09Z3JpZEl0ZW0uaWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbXNTZWxlY3RlZCA9IG11bHRpcGxlU2VsZWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGVyZm9ybURyYWdTZXF1ZW5jZSQoZ3JpZEl0ZW1zU2VsZWN0ZWQsIGV2ZW50LCB0eXBlKS5waXBlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFwKChsYXlvdXQpID0+ICh7bGF5b3V0LCBncmlkSXRlbSwgdHlwZSwgbXVsdGlwbGVTZWxlY3Rpb259KSkpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICApLnN1YnNjcmliZSgoe2xheW91dCwgZ3JpZEl0ZW0sIHR5cGUsIG11bHRpcGxlU2VsZWN0aW9ufSA6IHtsYXlvdXQ6IEt0ZEdyaWRMYXlvdXQsIGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCwgdHlwZTogRHJhZ0FjdGlvblR5cGUsIG11bHRpcGxlU2VsZWN0aW9uPzogS3RkR3JpZEl0ZW1Db21wb25lbnRbXX0pID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubGF5b3V0ID0gbGF5b3V0O1xyXG4gICAgICAgICAgICAgICAgLy8gQ2FsY3VsYXRlIG5ldyByZW5kZXJpbmcgZGF0YSBnaXZlbiB0aGUgbmV3IGxheW91dC5cclxuICAgICAgICAgICAgICAgIHRoaXMuY2FsY3VsYXRlUmVuZGVyRGF0YSgpO1xyXG4gICAgICAgICAgICAgICAgLy8gRW1pdCBkcmFnIG9yIHJlc2l6ZSBlbmQgZXZlbnRzLlxyXG4gICAgICAgICAgICAgICAgKHR5cGUgPT09ICdkcmFnJyA/IHRoaXMuZHJhZ0VuZGVkIDogdGhpcy5yZXNpemVFbmRlZCkuZW1pdChnZXREcmFnUmVzaXplRXZlbnREYXRhKGdyaWRJdGVtLCBsYXlvdXQsIG11bHRpcGxlU2VsZWN0aW9uKSk7XHJcbiAgICAgICAgICAgICAgICAvLyBOb3RpZnkgdGhhdCB0aGUgbGF5b3V0IGhhcyBiZWVuIHVwZGF0ZWQuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmxheW91dFVwZGF0ZWQuZW1pdChsYXlvdXQpO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0R3JpZEJhY2tncm91bmRWaXNpYmxlKHRoaXMuX2JhY2tncm91bmRDb25maWc/LnNob3cgPT09ICdhbHdheXMnKTtcclxuICAgICAgICAgICAgfSlcclxuXHJcbiAgICAgICAgXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm0gYSBnZW5lcmFsIGdyaWQgZHJhZyBhY3Rpb24sIGZyb20gc3RhcnQgdG8gZW5kLiBBIGdlbmVyYWwgZ3JpZCBkcmFnIGFjdGlvbiBiYXNpY2FsbHkgaW5jbHVkZXMgY3JlYXRpbmcgdGhlIHBsYWNlaG9sZGVyIGVsZW1lbnQgYW5kIGFkZGluZ1xyXG4gICAgICogc29tZSBjbGFzcyBhbmltYXRpb25zLiBjYWxjTmV3U3RhdGVGdW5jIG5lZWRzIHRvIGJlIHByb3ZpZGVkIGluIG9yZGVyIHRvIGNhbGN1bGF0ZSB0aGUgbmV3IHN0YXRlIG9mIHRoZSBsYXlvdXQuXHJcbiAgICAgKiBAcGFyYW0gZ3JpZEl0ZW0gdGhhdCBpcyBiZWVuIGRyYWdnZWRcclxuICAgICAqIEBwYXJhbSBwb2ludGVyRG93bkV2ZW50IGV2ZW50IChtb3VzZWRvd24gb3IgdG91Y2hkb3duKSB3aGVyZSB0aGUgdXNlciBpbml0aWF0ZWQgdGhlIGRyYWdcclxuICAgICAqIEBwYXJhbSBjYWxjTmV3U3RhdGVGdW5jIGZ1bmN0aW9uIHRoYXQgcmV0dXJuIHRoZSBuZXcgbGF5b3V0IHN0YXRlIGFuZCB0aGUgZHJhZyBlbGVtZW50IHBvc2l0aW9uXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcGVyZm9ybURyYWdTZXF1ZW5jZSQoZ3JpZEl0ZW1zOiBLdGRHcmlkSXRlbUNvbXBvbmVudFtdLCBwb2ludGVyRG93bkV2ZW50OiBNb3VzZUV2ZW50IHwgVG91Y2hFdmVudCwgdHlwZTogRHJhZ0FjdGlvblR5cGUpOiBPYnNlcnZhYmxlPEt0ZEdyaWRMYXlvdXQ+IHtcclxuXHJcbiAgICAgICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPEt0ZEdyaWRMYXlvdXQ+KChvYnNlcnZlcjogT2JzZXJ2ZXI8S3RkR3JpZExheW91dD4pID0+IHtcclxuICAgICAgICAgICAgY29uc3Qgc2Nyb2xsYWJsZVBhcmVudCA9IHR5cGVvZiB0aGlzLnNjcm9sbGFibGVQYXJlbnQgPT09ICdzdHJpbmcnID8gdGhpcy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0aGlzLnNjcm9sbGFibGVQYXJlbnQpIDogdGhpcy5zY3JvbGxhYmxlUGFyZW50O1xyXG4gICAgICAgICAgICAvLyBSZXRyaWV2ZSBncmlkIChwYXJlbnQpIGNsaWVudCByZWN0LlxyXG4gICAgICAgICAgICBjb25zdCBncmlkRWxlbUNsaWVudFJlY3Q6IEt0ZENsaWVudFJlY3QgPSBnZXRNdXRhYmxlQ2xpZW50UmVjdCh0aGlzLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCBhcyBIVE1MRWxlbWVudCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkcmFnRWxlbUNsaWVudFJlY3Q6IEt0ZERpY3Rpb25hcnk8S3RkQ2xpZW50UmVjdD49e307XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld0dyaWRJdGVtUmVuZGVyRGF0YTogS3RkRGljdGlvbmFyeTxLdGRHcmlkSXRlbVJlbmRlckRhdGE8bnVtYmVyPj49e307XHJcbiAgICAgICAgICAgIGxldCBkcmFnZ2VkSXRlbXNQb3M6IEt0ZERpY3Rpb25hcnk8S3RkR3JpZEl0ZW1SZWN0Pj17fTtcclxuICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxMYXlvdXQ6IEt0ZEdyaWRMYXlvdXQgPSBzdHJ1Y3R1cmVkQ2xvbmUodGhpcy5sYXlvdXQpO1xyXG5cclxuICAgICAgICAgICAgZ3JpZEl0ZW1zLmZvckVhY2goKGdyaWRJdGVtKT0+e1xyXG4gICAgICAgICAgICAgICAgLy8gUmV0cmlldmUgZ3JpZEl0ZW0gKGRyYWdnZWRFbGVtKSBjbGllbnQgcmVjdC5cclxuICAgICAgICAgICAgICAgIGRyYWdFbGVtQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0gPSBnZXRNdXRhYmxlQ2xpZW50UmVjdChncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5hZGRDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICduby10cmFuc2l0aW9ucycpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5hZGRDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICdrdGQtZ3JpZC1pdGVtLWRyYWdnaW5nJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlckNsaWVudFJlY3Q6IEt0ZENsaWVudFJlY3QgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLi4uZHJhZ0VsZW1DbGllbnRSZWN0W2dyaWRJdGVtLmlkXSxcclxuICAgICAgICAgICAgICAgICAgICBsZWZ0OiBkcmFnRWxlbUNsaWVudFJlY3RbZ3JpZEl0ZW0uaWRdLmxlZnQgLSBncmlkRWxlbUNsaWVudFJlY3QubGVmdCxcclxuICAgICAgICAgICAgICAgICAgICB0b3A6IGRyYWdFbGVtQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0udG9wIC0gZ3JpZEVsZW1DbGllbnRSZWN0LnRvcFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVQbGFjZWhvbGRlckVsZW1lbnQoZ3JpZEl0ZW0uaWQsIHBsYWNlaG9sZGVyQ2xpZW50UmVjdCwgZ3JpZEl0ZW0ucGxhY2Vob2xkZXIpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCBuZXdMYXlvdXQ6IEt0ZEdyaWRMYXlvdXRJdGVtW107XHJcblxyXG4gICAgICAgICAgICAvLyBUT0RPIChlbmhhbmNlbWVudCk6IGNvbnNpZGVyIG1vdmUgdGhpcyAnc2lkZSBlZmZlY3QnIG9ic2VydmFibGUgaW5zaWRlIHRoZSBtYWluIGRyYWcgbG9vcC5cclxuICAgICAgICAgICAgLy8gIC0gUHJvcyBhcmUgdGhhdCB3ZSB3b3VsZCBub3QgcmVwZWF0IHN1YnNjcmlwdGlvbnMgYW5kIHRha2VVbnRpbCB3b3VsZCBzaHV0IGRvd24gb2JzZXJ2YWJsZXMgYXQgdGhlIHNhbWUgdGltZS5cclxuICAgICAgICAgICAgLy8gIC0gQ29ucyBhcmUgdGhhdCBtb3ZpbmcgdGhpcyBmdW5jdGlvbmFsaXR5IGFzIGEgc2lkZSBlZmZlY3QgaW5zaWRlIHRoZSBtYWluIGRyYWcgbG9vcCB3b3VsZCBiZSBjb25mdXNpbmcuXHJcbiAgICAgICAgICAgIGNvbnN0IHNjcm9sbFN1YnNjcmlwdGlvbiA9IHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XHJcbiAgICAgICAgICAgICAgICAoIXNjcm9sbGFibGVQYXJlbnQgPyBORVZFUiA6IHRoaXMuZ3JpZFNlcnZpY2UubW91c2VPclRvdWNoTW92ZSQodGhpcy5kb2N1bWVudCkucGlwZShcclxuICAgICAgICAgICAgICAgICAgICBtYXAoKGV2ZW50KSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyWDoga3RkUG9pbnRlckNsaWVudFgoZXZlbnQpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyWToga3RkUG9pbnRlckNsaWVudFkoZXZlbnQpXHJcbiAgICAgICAgICAgICAgICAgICAgfSkpLFxyXG4gICAgICAgICAgICAgICAgICAgIGt0ZFNjcm9sbElmTmVhckVsZW1lbnRDbGllbnRSZWN0JChzY3JvbGxhYmxlUGFyZW50LCB7c2Nyb2xsU3RlcDogdGhpcy5zY3JvbGxTcGVlZH0pXHJcbiAgICAgICAgICAgICAgICApKS5waXBlKFxyXG4gICAgICAgICAgICAgICAgICAgIHRha2VVbnRpbChrdGRQb2ludGVyVXAodGhpcy5kb2N1bWVudCkpXHJcbiAgICAgICAgICAgICAgICApLnN1YnNjcmliZSgpKTtcclxuXHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBNYWluIHN1YnNjcmlwdGlvbiwgaXQgbGlzdGVucyBmb3IgJ3BvaW50ZXIgbW92ZScgYW5kICdzY3JvbGwnIGV2ZW50cyBhbmQgcmVjYWxjdWxhdGVzIHRoZSBsYXlvdXQgb24gZWFjaCBlbWlzc2lvblxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgY29uc3Qgc3Vic2NyaXB0aW9uID0gdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT5cclxuICAgICAgICAgICAgICAgIG1lcmdlKFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbWJpbmVMYXRlc3QoW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdyaWRTZXJ2aWNlLm1vdXNlT3JUb3VjaE1vdmUkKHRoaXMuZG9jdW1lbnQpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi4oIXNjcm9sbGFibGVQYXJlbnQgPyBbb2Yoe3RvcDogMCwgbGVmdDogMH0pXSA6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGt0ZEdldFNjcm9sbFRvdGFsUmVsYXRpdmVEaWZmZXJlbmNlJChzY3JvbGxhYmxlUGFyZW50KS5waXBlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0V2l0aCh7dG9wOiAwLCBsZWZ0OiAwfSkgLy8gRm9yY2UgZmlyc3QgZW1pc3Npb24gdG8gYWxsb3cgQ29tYmluZUxhdGVzdCB0byBlbWl0IGV2ZW4gbm8gc2Nyb2xsIGV2ZW50IGhhcyBvY2N1cnJlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdKVxyXG4gICAgICAgICAgICAgICAgICAgIF0pXHJcbiAgICAgICAgICAgICAgICApLnBpcGUoXHJcbiAgICAgICAgICAgICAgICAgICAgdGFrZVVudGlsKGt0ZFBvaW50ZXJVcCh0aGlzLmRvY3VtZW50KSksXHJcbiAgICAgICAgICAgICAgICApLnN1YnNjcmliZSgoW3BvaW50ZXJEcmFnRXZlbnQsIHNjcm9sbERpZmZlcmVuY2VdOiBbTW91c2VFdmVudCB8IFRvdWNoRXZlbnQgfCBQb2ludGVyRXZlbnQsIHsgdG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlciB9XSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyRHJhZ0V2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgKiBTZXQgdGhlIG5ldyBsYXlvdXQgdG8gYmUgdGhlIGxheW91dCBpbiB3aGljaCB0aGUgY2FsY05ld1N0YXRlRnVuYyB3b3VsZCBiZSBleGVjdXRlZC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICogTk9URTogdXNpbmcgdGhlIG11dGF0ZWQgbGF5b3V0IGlzIHRoZSB3YXkgdG8gZ28gYnkgJ3JlYWN0LWdyaWQtbGF5b3V0JyB1dGlscy4gSWYgd2UgZG9uJ3QgdXNlIHRoZSBwcmV2aW91cyBsYXlvdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAqIHNvbWUgdXRpbGl0aWVzIGZyb20gJ3JlYWN0LWdyaWQtbGF5b3V0JyB3b3VsZCBub3Qgd29yayBhcyBleHBlY3RlZC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRMYXlvdXQ6IEt0ZEdyaWRMYXlvdXQgPSBuZXdMYXlvdXQgfHwgdGhpcy5sYXlvdXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEdldCB0aGUgY29ycmVjdCBuZXdTdGF0ZUZ1bmMgZGVwZW5kaW5nIG9uIGlmIHdlIGFyZSBkcmFnZ2luZyBvciByZXNpemluZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2RyYWcnICYmIGdyaWRJdGVtcy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBjbG9uaW5nIHRoZSBmdWxsIGxheW91dCBjYW4gYmUgZXhwZW5zaXZlISBXZSBzaG91bGQgaW52ZXN0aWdhdGUgd29ya2Fyb3VuZHMsIG1heWJlIGJ5IHVzaW5nIGEga3RkR3JpZEl0ZW1EcmFnZ2luZyBmdW5jdGlvbiB0aGF0IGRvZXMgbm90IG11dGF0ZSB0aGUgbGF5b3V0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQ9c3RydWN0dXJlZENsb25lKG9yaWdpbmFsTGF5b3V0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHtsYXlvdXQsIGRyYWdnZWRJdGVtUG9zfSA9IGt0ZEdyaWRJdGVtc0RyYWdnaW5nKGdyaWRJdGVtcywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheW91dDogbmV3TGF5b3V0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd0hlaWdodDogdGhpcy5yb3dIZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmhlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xzOiB0aGlzLmNvbHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmVudENvbGxpc2lvbjogdGhpcy5wcmV2ZW50Q29sbGlzaW9uLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdhcDogdGhpcy5nYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCB0aGlzLmNvbXBhY3RUeXBlLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRlckRvd25FdmVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb2ludGVyRHJhZ0V2ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRFbGVtQ2xpZW50UmVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmFnRWxlbWVudHNDbGllbnRSZWN0OiBkcmFnRWxlbUNsaWVudFJlY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2Nyb2xsRGlmZmVyZW5jZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQgPSBsYXlvdXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmFnZ2VkSXRlbXNQb3MgPSBkcmFnZ2VkSXRlbVBvcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjYWxjTmV3U3RhdGVGdW5jID0gdHlwZSA9PT0gJ2RyYWcnID8ga3RkR3JpZEl0ZW1EcmFnZ2luZyA6IGt0ZEdyaWRJdGVtUmVzaXppbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQgPSBjdXJyZW50TGF5b3V0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JpZEl0ZW1zLmZvckVhY2goKGdyaWRJdGVtKT0+e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHtsYXlvdXQsIGRyYWdnZWRJdGVtUG9zfSA9IGNhbGNOZXdTdGF0ZUZ1bmMoZ3JpZEl0ZW0sIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5b3V0OiBuZXdMYXlvdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd0hlaWdodDogdGhpcy5yb3dIZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbHM6IHRoaXMuY29scyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmVudENvbGxpc2lvbjogdGhpcy5wcmV2ZW50Q29sbGlzaW9uLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnYXA6IHRoaXMuZ2FwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIHRoaXMuY29tcGFjdFR5cGUsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRlckRvd25FdmVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRlckRyYWdFdmVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JpZEVsZW1DbGllbnRSZWN0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmFnRWxlbUNsaWVudFJlY3Q6IGRyYWdFbGVtQ2xpZW50UmVjdFtncmlkSXRlbS5pZF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjcm9sbERpZmZlcmVuY2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMYXlvdXQgPSBsYXlvdXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJhZ2dlZEl0ZW1zUG9zW2dyaWRJdGVtLmlkXT1kcmFnZ2VkSXRlbVBvcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdyaWRDdXJyZW50SGVpZ2h0ID0gdGhpcy5oZWlnaHQgPz8gKHRoaXMucm93SGVpZ2h0ID09PSAnZml0JyA/IGdyaWRFbGVtQ2xpZW50UmVjdC5oZWlnaHQgOiBnZXRHcmlkSGVpZ2h0KG5ld0xheW91dCwgdGhpcy5yb3dIZWlnaHQsIHRoaXMuZ2FwKSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ3JpZEl0ZW1zUmVuZGVyRGF0YSA9IGxheW91dFRvUmVuZGVySXRlbXMoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sczogdGhpcy5jb2xzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SGVpZ2h0OiB0aGlzLnJvd0hlaWdodCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXlvdXQ6IG5ld0xheW91dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZlbnRDb2xsaXNpb246IHRoaXMucHJldmVudENvbGxpc2lvbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdhcDogdGhpcy5nYXAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGdyaWRFbGVtQ2xpZW50UmVjdC53aWR0aCwgZ3JpZEVsZW1DbGllbnRSZWN0LmhlaWdodCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBNb2RpZnkgdGhlIHBvc2l0aW9uIG9mIHRoZSBkcmFnZ2VkIGl0ZW0gdG8gYmUgdGhlIG9uY2Ugd2Ugd2FudCAoZm9yIGV4YW1wbGUgdGhlIG1vdXNlIHBvc2l0aW9uIG9yIHdoYXRldmVyKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbXMuZm9yRWFjaCgoZ3JpZEl0ZW0pPT57XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdHcmlkSXRlbVJlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdID0gey4uLnRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJTdHlsZXMgPSBwYXJzZVJlbmRlckl0ZW1Ub1BpeGVscyhuZXdHcmlkSXRlbVJlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQdXQgdGhlIHJlYWwgZmluYWwgcG9zaXRpb24gdG8gdGhlIHBsYWNlaG9sZGVyIGVsZW1lbnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW0uaWRdIS5zdHlsZS53aWR0aCA9IHBsYWNlaG9sZGVyU3R5bGVzLndpZHRoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbS5pZF0hLnN0eWxlLmhlaWdodCA9IHBsYWNlaG9sZGVyU3R5bGVzLmhlaWdodDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW0uaWRdIS5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWCgke3BsYWNlaG9sZGVyU3R5bGVzLmxlZnR9KSB0cmFuc2xhdGVZKCR7cGxhY2Vob2xkZXJTdHlsZXMudG9wfSlgO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLmRyYWdnZWRJdGVtc1Bvc1tncmlkSXRlbS5pZF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuX2dyaWRJdGVtc1JlbmRlckRhdGFbZ3JpZEl0ZW0uaWRdLmlkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0QmFja2dyb3VuZENzc1ZhcmlhYmxlcyh0aGlzLnJvd0hlaWdodCA9PT0gJ2ZpdCcgPyBrdGRHZXRHcmlkSXRlbVJvd0hlaWdodChuZXdMYXlvdXQsIGdyaWRFbGVtQ2xpZW50UmVjdC5oZWlnaHQsIHRoaXMuZ2FwKSA6IHRoaXMucm93SGVpZ2h0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyaWRJdGVtcy5mb3JFYWNoKChncmlkSXRlbSk9PntcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHdlIGFyZSBwZXJmb3JtaW5nIGEgcmVzaXplLCBhbmQgYm91bmRzIGhhdmUgY2hhbmdlZCwgZW1pdCBldmVudC5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IE9ubHkgZW1pdCBvbiByZXNpemUgZm9yIG5vdy4gVXNlIGNhc2UgZm9yIG5vcm1hbCBkcmFnIGlzIG5vdCBqdXN0aWZpZWQgZm9yIG5vdy4gRW1pdHRpbmcgb24gcmVzaXplIGlzLCBzaW5jZSB3ZSBtYXkgd2FudCB0byByZS1yZW5kZXIgdGhlIGdyaWQgaXRlbSBvciB0aGUgcGxhY2Vob2xkZXIgaW4gb3JkZXIgdG8gZml0IHRoZSBuZXcgYm91bmRzLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdyZXNpemUnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJldkdyaWRJdGVtID0gY3VycmVudExheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpITtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdHcmlkSXRlbSA9IG5ld0xheW91dC5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZ3JpZEl0ZW0uaWQpITtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBpdGVtIHJlc2l6ZWQgaGFzIGNoYW5nZWQsIGlmIHNvLCBlbWl0IHJlc2l6ZSBjaGFuZ2UgZXZlbnRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWt0ZEdyaWRJdGVtTGF5b3V0SXRlbUFyZUVxdWFsKHByZXZHcmlkSXRlbSwgbmV3R3JpZEl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ3JpZEl0ZW1SZXNpemUuZW1pdCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogbmV3R3JpZEl0ZW1SZW5kZXJEYXRhW2dyaWRJdGVtLmlkXS53aWR0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogbmV3R3JpZEl0ZW1SZW5kZXJEYXRhW2dyaWRJdGVtLmlkXS5oZWlnaHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmlkSXRlbVJlZjogZ2V0RHJhZ1Jlc2l6ZUV2ZW50RGF0YShncmlkSXRlbSwgbmV3TGF5b3V0KS5ncmlkSXRlbVJlZiBhcyBLdGRHcmlkSXRlbUNvbXBvbmVudFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgKGVycm9yKSA9PiBvYnNlcnZlci5lcnJvcihlcnJvciksXHJcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5nWm9uZS5ydW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JpZEl0ZW1zLmZvckVhY2goKGdyaWRJdGVtKT0+e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBkcmFnIGNsYXNzZXNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnJlbW92ZUNsYXNzKGdyaWRJdGVtLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCwgJ25vLXRyYW5zaXRpb25zJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5yZW1vdmVDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICdrdGQtZ3JpZC1pdGVtLWRyYWdnaW5nJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkR3JpZEl0ZW1BbmltYXRpbmdDbGFzcyhncmlkSXRlbSkuc3Vic2NyaWJlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ29uc2lkZXIgZGVzdHJveWluZyB0aGUgcGxhY2Vob2xkZXIgYWZ0ZXIgdGhlIGFuaW1hdGlvbiBoYXMgZmluaXNoZWQuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95UGxhY2Vob2xkZXIoZ3JpZEl0ZW0uaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0xheW91dCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IG5ld0xheW91dCBzaG91bGQgYWxyZWFkeSBiZSBwcnVuZWQuIElmIG5vdCwgaXQgc2hvdWxkIGhhdmUgdHlwZSBMYXlvdXQsIG5vdCBLdGRHcmlkTGF5b3V0IGFzIGl0IGlzIG5vdy5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQcnVuZSByZWFjdC1ncmlkLWxheW91dCBjb21wYWN0IGV4dHJhIHByb3BlcnRpZXMuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dChuZXdMYXlvdXQubWFwKGl0ZW0gPT4gKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGl0ZW0uaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHg6IGl0ZW0ueCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeTogaXRlbS55LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3OiBpdGVtLncsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGg6IGl0ZW0uaCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluVzogaXRlbS5taW5XLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5IOiBpdGVtLm1pbkgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heFc6IGl0ZW0ubWF4VyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4SDogaXRlbS5tYXhILFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKSBhcyBLdGRHcmlkTGF5b3V0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogTmVlZCB3ZSByZWFsbHkgdG8gZW1pdCBpZiB0aGVyZSBpcyBubyBsYXlvdXQgY2hhbmdlIGJ1dCBkcmFnIHN0YXJ0ZWQgYW5kIGVuZGVkP1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmVyLm5leHQodGhpcy5sYXlvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB9KSk7XHJcblxyXG5cclxuICAgICAgICAgICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHNjcm9sbFN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xyXG4gICAgICAgICAgICAgICAgc3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSXQgYWRkcyB0aGUgYGt0ZC1ncmlkLWl0ZW0tYW5pbWF0aW5nYCBjbGFzcyBhbmQgcmVtb3ZlcyBpdCB3aGVuIHRoZSBhbmltYXRlZCB0cmFuc2l0aW9uIGlzIGNvbXBsZXRlLlxyXG4gICAgICogVGhpcyBmdW5jdGlvbiBpcyBtZWFudCB0byBiZSBleGVjdXRlZCB3aGVuIHRoZSBkcmFnIGhhcyBlbmRlZC5cclxuICAgICAqIEBwYXJhbSBncmlkSXRlbSB0aGF0IGhhcyBiZWVuIGRyYWdnZWRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBhZGRHcmlkSXRlbUFuaW1hdGluZ0NsYXNzKGdyaWRJdGVtOiBLdGRHcmlkSXRlbUNvbXBvbmVudCk6IE9ic2VydmFibGU8dW5kZWZpbmVkPiB7XHJcblxyXG4gICAgICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShvYnNlcnZlciA9PiB7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkdXJhdGlvbiA9IGdldFRyYW5zZm9ybVRyYW5zaXRpb25EdXJhdGlvbkluTXMoZ3JpZEl0ZW0uZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50KTtcclxuXHJcbiAgICAgICAgICAgIGlmIChkdXJhdGlvbiA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xyXG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5hZGRDbGFzcyhncmlkSXRlbS5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICdrdGQtZ3JpZC1pdGVtLWFuaW1hdGluZycpO1xyXG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gKChldmVudDogVHJhbnNpdGlvbkV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWV2ZW50IHx8IChldmVudC50YXJnZXQgPT09IGdyaWRJdGVtLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCAmJiBldmVudC5wcm9wZXJ0eU5hbWUgPT09ICd0cmFuc2Zvcm0nKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyZXIucmVtb3ZlQ2xhc3MoZ3JpZEl0ZW0uZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50LCAna3RkLWdyaWQtaXRlbS1hbmltYXRpbmcnKTtcclxuICAgICAgICAgICAgICAgICAgICByZW1vdmVFdmVudExpc3RlbmVyKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgICAgICAgICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KSBhcyBFdmVudExpc3RlbmVyO1xyXG5cclxuICAgICAgICAgICAgLy8gSWYgYSB0cmFuc2l0aW9uIGlzIHNob3J0IGVub3VnaCwgdGhlIGJyb3dzZXIgbWlnaHQgbm90IGZpcmUgdGhlIGB0cmFuc2l0aW9uZW5kYCBldmVudC5cclxuICAgICAgICAgICAgLy8gU2luY2Ugd2Uga25vdyBob3cgbG9uZyBpdCdzIHN1cHBvc2VkIHRvIHRha2UsIGFkZCBhIHRpbWVvdXQgd2l0aCBhIDUwJSBidWZmZXIgdGhhdCdsbFxyXG4gICAgICAgICAgICAvLyBmaXJlIGlmIHRoZSB0cmFuc2l0aW9uIGhhc24ndCBjb21wbGV0ZWQgd2hlbiBpdCB3YXMgc3VwcG9zZWQgdG8uXHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KGhhbmRsZXIsIGR1cmF0aW9uICogMS41KTtcclxuICAgICAgICAgICAgY29uc3QgcmVtb3ZlRXZlbnRMaXN0ZW5lciA9IHRoaXMucmVuZGVyZXIubGlzdGVuKGdyaWRJdGVtLmVsZW1lbnRSZWYubmF0aXZlRWxlbWVudCwgJ3RyYW5zaXRpb25lbmQnLCBoYW5kbGVyKTtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIC8qKiBDcmVhdGVzIHBsYWNlaG9sZGVyIGVsZW1lbnQgKi9cclxuICAgIHByaXZhdGUgY3JlYXRlUGxhY2Vob2xkZXJFbGVtZW50KGdyaWRJdGVtSWQ6IHN0cmluZywgY2xpZW50UmVjdDogS3RkQ2xpZW50UmVjdCwgZ3JpZEl0ZW1QbGFjZWhvbGRlcj86IEt0ZEdyaWRJdGVtUGxhY2Vob2xkZXIpIHtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdID0gdGhpcy5yZW5kZXJlci5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdIS5zdHlsZS53aWR0aCA9IGAke2NsaWVudFJlY3Qud2lkdGh9cHhgO1xyXG4gICAgICAgIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW1JZF0hLnN0eWxlLmhlaWdodCA9IGAke2NsaWVudFJlY3QuaGVpZ2h0fXB4YDtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdIS5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWCgke2NsaWVudFJlY3QubGVmdH1weCkgdHJhbnNsYXRlWSgke2NsaWVudFJlY3QudG9wfXB4KWA7XHJcbiAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSEuY2xhc3NMaXN0LmFkZCgna3RkLWdyaWQtaXRlbS1wbGFjZWhvbGRlcicpO1xyXG4gICAgICAgIHRoaXMucmVuZGVyZXIuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsIHRoaXMucGxhY2Vob2xkZXJbZ3JpZEl0ZW1JZF0pO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgYW5kIGFwcGVuZCBjdXN0b20gcGxhY2Vob2xkZXIgaWYgcHJvdmlkZWQuXHJcbiAgICAgICAgLy8gSW1wb3J0YW50OiBBcHBlbmQgaXQgYWZ0ZXIgY3JlYXRpbmcgJiBhcHBlbmRpbmcgdGhlIGNvbnRhaW5lciBwbGFjZWhvbGRlci4gVGhpcyB3YXkgd2UgZW5zdXJlIHBhcmVudCBib3VuZHMgYXJlIHNldCB3aGVuIGNyZWF0aW5nIHRoZSBlbWJlZGRlZFZpZXcuXHJcbiAgICAgICAgaWYgKGdyaWRJdGVtUGxhY2Vob2xkZXIpIHtcclxuICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlclJlZltncmlkSXRlbUlkXSA9IHRoaXMudmlld0NvbnRhaW5lclJlZi5jcmVhdGVFbWJlZGRlZFZpZXcoXHJcbiAgICAgICAgICAgICAgICBncmlkSXRlbVBsYWNlaG9sZGVyLnRlbXBsYXRlUmVmLFxyXG4gICAgICAgICAgICAgICAgZ3JpZEl0ZW1QbGFjZWhvbGRlci5kYXRhXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIHRoaXMucGxhY2Vob2xkZXJSZWZbZ3JpZEl0ZW1JZF0hLnJvb3ROb2Rlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSEuYXBwZW5kQ2hpbGQobm9kZSkpO1xyXG4gICAgICAgICAgICB0aGlzLnBsYWNlaG9sZGVyUmVmW2dyaWRJdGVtSWRdIS5kZXRlY3RDaGFuZ2VzKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSEuY2xhc3NMaXN0LmFkZCgna3RkLWdyaWQtaXRlbS1wbGFjZWhvbGRlci1kZWZhdWx0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKiBEZXN0cm95cyB0aGUgcGxhY2Vob2xkZXIgZWxlbWVudCBhbmQgaXRzIFZpZXdSZWYuICovXHJcbiAgICBwcml2YXRlIGRlc3Ryb3lQbGFjZWhvbGRlcihncmlkSXRlbUlkOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyW2dyaWRJdGVtSWRdPy5yZW1vdmUoKTtcclxuICAgICAgICB0aGlzLnBsYWNlaG9sZGVyUmVmW2dyaWRJdGVtSWRdPy5kZXN0cm95KCk7XHJcbiAgICAgICAgdGhpcy5wbGFjZWhvbGRlcltncmlkSXRlbUlkXSA9IHRoaXMucGxhY2Vob2xkZXJSZWZbZ3JpZEl0ZW1JZF0gPSBudWxsITtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgbmdBY2NlcHRJbnB1dFR5cGVfY29sczogTnVtYmVySW5wdXQ7XHJcbiAgICBzdGF0aWMgbmdBY2NlcHRJbnB1dFR5cGVfcm93SGVpZ2h0OiBOdW1iZXJJbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9zY3JvbGxTcGVlZDogTnVtYmVySW5wdXQ7XHJcbiAgICBzdGF0aWMgbmdBY2NlcHRJbnB1dFR5cGVfY29tcGFjdE9uUHJvcHNDaGFuZ2U6IEJvb2xlYW5JbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9wcmV2ZW50Q29sbGlzaW9uOiBCb29sZWFuSW5wdXQ7XHJcbn1cclxuXHJcbiIsIjxuZy1jb250ZW50PjwvbmctY29udGVudD4iXX0=