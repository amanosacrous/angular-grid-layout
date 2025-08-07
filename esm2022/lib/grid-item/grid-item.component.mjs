import { ChangeDetectionStrategy, Component, ContentChild, ContentChildren, ElementRef, HostBinding, Inject, Input, ViewChild } from '@angular/core';
import { BehaviorSubject, NEVER, Subject, iif, merge } from 'rxjs';
import { exhaustMap, filter, map, startWith, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { coerceBooleanProperty } from '../coercion/boolean-property';
import { coerceNumberProperty } from '../coercion/number-property';
import { KTD_GRID_DRAG_HANDLE } from '../directives/drag-handle';
import { KTD_GRID_ITEM_PLACEHOLDER } from '../directives/placeholder';
import { KTD_GRID_RESIZE_HANDLE } from '../directives/resize-handle';
import { GRID_ITEM_GET_RENDER_DATA_TOKEN } from '../grid.definitions';
import { ktdOutsideZone } from '../utils/operators';
import { ktdIsMouseEventOrMousePointerEvent, ktdPointerClient, ktdPointerDown, ktdPointerUp } from '../utils/pointer.utils';
import { DOCUMENT } from '@angular/common';
import * as i0 from "@angular/core";
import * as i1 from "../grid.service";
export class KtdGridItemComponent {
    /** Dynamically apply `touch-action` to the host element based on draggable */
    get touchAction() {
        return this._draggable ? 'none' : 'auto';
    }
    /** Id of the grid item. This property is strictly compulsory. */
    get id() {
        return this._id;
    }
    set id(val) {
        this._id = val;
    }
    /** Minimum amount of pixels that the user should move before it starts the drag sequence. */
    get dragStartThreshold() { return this._dragStartThreshold; }
    set dragStartThreshold(val) {
        this._dragStartThreshold = coerceNumberProperty(val);
    }
    /** Whether the item is draggable or not. Defaults to true. Does not affect manual dragging using the startDragManually method. */
    get draggable() {
        return this._draggable;
    }
    set draggable(val) {
        this._draggable = coerceBooleanProperty(val);
        this._draggable$.next(this._draggable);
    }
    /** Whether the item is resizable or not. Defaults to true. */
    get resizable() {
        return this._resizable;
    }
    set resizable(val) {
        this._resizable = coerceBooleanProperty(val);
        this._resizable$.next(this._resizable);
    }
    constructor(elementRef, gridService, renderer, ngZone, document, getItemRenderData) {
        this.elementRef = elementRef;
        this.gridService = gridService;
        this.renderer = renderer;
        this.ngZone = ngZone;
        this.document = document;
        this.getItemRenderData = getItemRenderData;
        /** CSS transition style. Note that for more performance is preferable only make transition on transform property. */
        this.transition = 'transform 500ms ease, width 500ms ease, height 500ms ease';
        this._dragStartThreshold = 0;
        this._draggable = true;
        this._draggable$ = new BehaviorSubject(this._draggable);
        this._manualDragEvents$ = new Subject();
        this._resizable = true;
        this._resizable$ = new BehaviorSubject(this._resizable);
        this.dragStartSubject = new Subject();
        this.resizeStartSubject = new Subject();
        this.subscriptions = [];
        this.dragStart$ = this.dragStartSubject.asObservable();
        this.resizeStart$ = this.resizeStartSubject.asObservable();
    }
    ngOnInit() {
        const gridItemRenderData = this.getItemRenderData(this.id);
        this.setStyles(gridItemRenderData);
    }
    ngAfterContentInit() {
        this.subscriptions.push(this._dragStart$().subscribe(this.dragStartSubject), this._resizeStart$().subscribe(this.resizeStartSubject));
    }
    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }
    /**
     * To manually start dragging, route the desired pointer events to this method.
     * Dragging initiated by this method will work regardless of the value of the draggable Input.
     * It is the caller's responsibility to call this method with only the events that are desired to cause a drag.
     * For example, if you only want left clicks to cause a drag, it is your responsibility to filter out other mouse button events.
     * @param startEvent The pointer event that should initiate the drag.
     */
    startDragManually(startEvent) {
        this._manualDragEvents$.next(startEvent);
    }
    setStyles({ top, left, width, height }) {
        // transform is 6x times faster than top/left
        this.renderer.setStyle(this.elementRef.nativeElement, 'transform', `translateX(${left}) translateY(${top})`);
        this.renderer.setStyle(this.elementRef.nativeElement, 'display', `block`);
        this.renderer.setStyle(this.elementRef.nativeElement, 'transition', this.transition);
        if (width != null) {
            this.renderer.setStyle(this.elementRef.nativeElement, 'width', width);
        }
        if (height != null) {
            this.renderer.setStyle(this.elementRef.nativeElement, 'height', height);
        }
    }
    _dragStart$() {
        return merge(this._manualDragEvents$, this._draggable$.pipe(switchMap((draggable) => {
            if (!draggable) {
                return NEVER;
            }
            return this._dragHandles.changes.pipe(startWith(this._dragHandles), switchMap((dragHandles) => {
                return iif(() => dragHandles.length > 0, merge(...dragHandles.toArray().map(dragHandle => ktdPointerDown(dragHandle.element.nativeElement))), ktdPointerDown(this.elementRef.nativeElement));
            }));
        }))).pipe(exhaustMap(startEvent => {
            // If the event started from an element with the native HTML drag&drop, it'll interfere
            // with our own dragging (e.g. `img` tags do it by default). Prevent the default action
            // to stop it from happening. Note that preventing on `dragstart` also seems to work, but
            // it's flaky and it fails if the user drags it away quickly. Also note that we only want
            // to do this for `mousedown` and `pointerdown` since doing the same for `touchstart` will
            // stop any `click` events from firing on touch devices.
            if (ktdIsMouseEventOrMousePointerEvent(startEvent)) {
                startEvent.preventDefault();
            }
            const startPointer = ktdPointerClient(startEvent);
            return this.gridService.mouseOrTouchMove$(this.document).pipe(takeUntil(ktdPointerUp(this.document)), ktdOutsideZone(this.ngZone), filter((moveEvent) => {
                moveEvent.preventDefault();
                const movePointer = ktdPointerClient(moveEvent);
                const distanceX = Math.abs(startPointer.clientX - movePointer.clientX);
                const distanceY = Math.abs(startPointer.clientY - movePointer.clientY);
                // When this conditions returns true mean that we are over threshold.
                return distanceX + distanceY >= this.dragStartThreshold;
            }), take(1), 
            // Return the original start event
            map(() => startEvent));
        }));
    }
    _resizeStart$() {
        return this._resizable$.pipe(switchMap((resizable) => {
            if (!resizable) {
                // Side effect to hide the resizeElem if resize is disabled.
                this.renderer.setStyle(this.resizeElem.nativeElement, 'display', 'none');
                return NEVER;
            }
            else {
                return this._resizeHandles.changes.pipe(startWith(this._resizeHandles), switchMap((resizeHandles) => {
                    if (resizeHandles.length > 0) {
                        // Side effect to hide the resizeElem if there are resize handles.
                        this.renderer.setStyle(this.resizeElem.nativeElement, 'display', 'none');
                        return merge(...resizeHandles.toArray().map(resizeHandle => ktdPointerDown(resizeHandle.element.nativeElement)));
                    }
                    else {
                        this.renderer.setStyle(this.resizeElem.nativeElement, 'display', 'block');
                        return ktdPointerDown(this.resizeElem.nativeElement);
                    }
                }), tap((startEvent) => {
                    if (ktdIsMouseEventOrMousePointerEvent(startEvent)) {
                        startEvent.preventDefault();
                    }
                }));
            }
        }));
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridItemComponent, deps: [{ token: i0.ElementRef }, { token: i1.KtdGridService }, { token: i0.Renderer2 }, { token: i0.NgZone }, { token: DOCUMENT }, { token: GRID_ITEM_GET_RENDER_DATA_TOKEN }], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "16.2.12", type: KtdGridItemComponent, isStandalone: true, selector: "ktd-grid-item", inputs: { minW: "minW", minH: "minH", maxW: "maxW", maxH: "maxH", transition: "transition", id: "id", dragStartThreshold: "dragStartThreshold", draggable: "draggable", resizable: "resizable" }, host: { properties: { "style.touch-action": "this.touchAction" } }, queries: [{ propertyName: "placeholder", first: true, predicate: KTD_GRID_ITEM_PLACEHOLDER, descendants: true }, { propertyName: "_dragHandles", predicate: KTD_GRID_DRAG_HANDLE, descendants: true }, { propertyName: "_resizeHandles", predicate: KTD_GRID_RESIZE_HANDLE, descendants: true }], viewQueries: [{ propertyName: "resizeElem", first: true, predicate: ["resizeElem"], descendants: true, read: ElementRef, static: true }], ngImport: i0, template: "<ng-content></ng-content>\r\n<div #resizeElem class=\"grid-item-resize-icon\"></div>", styles: [":host{display:none;position:absolute;z-index:1;overflow:hidden}:host div{position:absolute;-webkit-user-select:none;user-select:none;z-index:10}:host div.grid-item-resize-icon{cursor:se-resize;width:20px;height:20px;bottom:0;right:0;color:inherit}:host div.grid-item-resize-icon:after{content:\"\";position:absolute;right:3px;bottom:3px;width:5px;height:5px;border-right:2px solid;border-bottom:2px solid}.display-none{display:none!important}\n"], changeDetection: i0.ChangeDetectionStrategy.OnPush }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridItemComponent, decorators: [{
            type: Component,
            args: [{ standalone: true, selector: 'ktd-grid-item', changeDetection: ChangeDetectionStrategy.OnPush, template: "<ng-content></ng-content>\r\n<div #resizeElem class=\"grid-item-resize-icon\"></div>", styles: [":host{display:none;position:absolute;z-index:1;overflow:hidden}:host div{position:absolute;-webkit-user-select:none;user-select:none;z-index:10}:host div.grid-item-resize-icon{cursor:se-resize;width:20px;height:20px;bottom:0;right:0;color:inherit}:host div.grid-item-resize-icon:after{content:\"\";position:absolute;right:3px;bottom:3px;width:5px;height:5px;border-right:2px solid;border-bottom:2px solid}.display-none{display:none!important}\n"] }]
        }], ctorParameters: function () { return [{ type: i0.ElementRef }, { type: i1.KtdGridService }, { type: i0.Renderer2 }, { type: i0.NgZone }, { type: Document, decorators: [{
                    type: Inject,
                    args: [DOCUMENT]
                }] }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [GRID_ITEM_GET_RENDER_DATA_TOKEN]
                }] }]; }, propDecorators: { _dragHandles: [{
                type: ContentChildren,
                args: [KTD_GRID_DRAG_HANDLE, { descendants: true }]
            }], _resizeHandles: [{
                type: ContentChildren,
                args: [KTD_GRID_RESIZE_HANDLE, { descendants: true }]
            }], resizeElem: [{
                type: ViewChild,
                args: ['resizeElem', { static: true, read: ElementRef }]
            }], placeholder: [{
                type: ContentChild,
                args: [KTD_GRID_ITEM_PLACEHOLDER]
            }], minW: [{
                type: Input
            }], minH: [{
                type: Input
            }], maxW: [{
                type: Input
            }], maxH: [{
                type: Input
            }], transition: [{
                type: Input
            }], touchAction: [{
                type: HostBinding,
                args: ['style.touch-action']
            }], id: [{
                type: Input
            }], dragStartThreshold: [{
                type: Input
            }], draggable: [{
                type: Input
            }], resizable: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JpZC1pdGVtLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL2FuZ3VsYXItZ3JpZC1sYXlvdXQvc3JjL2xpYi9ncmlkLWl0ZW0vZ3JpZC1pdGVtLmNvbXBvbmVudC50cyIsIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL2FuZ3VsYXItZ3JpZC1sYXlvdXQvc3JjL2xpYi9ncmlkLWl0ZW0vZ3JpZC1pdGVtLmNvbXBvbmVudC5odG1sIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFDZSx1QkFBdUIsRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQ3JHLFNBQVMsRUFDbEMsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQWMsT0FBTyxFQUFnQixHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQzdGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDckcsT0FBTyxFQUFnQixxQkFBcUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ25GLE9BQU8sRUFBZSxvQkFBb0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2hGLE9BQU8sRUFBRSxvQkFBb0IsRUFBcUIsTUFBTSwyQkFBMkIsQ0FBQztBQUNwRixPQUFPLEVBQUUseUJBQXlCLEVBQTBCLE1BQU0sMkJBQTJCLENBQUM7QUFDOUYsT0FBTyxFQUFFLHNCQUFzQixFQUF1QixNQUFNLDZCQUE2QixDQUFDO0FBQzFGLE9BQU8sRUFBRSwrQkFBK0IsRUFBa0MsTUFBTSxxQkFBcUIsQ0FBQztBQUV0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sb0JB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TDtRQUNMLENBQUMsQ0FBQyxDQUNMLENBQUM7SUFDTixDQUFDOytHQW5OUSxvQkFBb0IseUhBd0ZULFFBQVEsYUFDUiwrQkFBK0I7bUdBekYxQyxvQkFBb0Isd1hBT2YseUJBQXlCLGtFQUx0QixvQkFBb0Isb0VBQ3BCLHNCQUFzQixxSUFDTyxVQUFVLDJDQzVCNUQsc0ZBQ3FEOzs0RkR1QnhDLG9CQUFvQjtrQkFQaEMsU0FBUztpQ0FDTSxJQUFJLFlBQ04sZUFBZSxtQkFHUix1QkFBdUIsQ0FBQyxNQUFNOzswQkEwRmxDLE1BQU07MkJBQUMsUUFBUTs7MEJBQ2YsTUFBTTsyQkFBQywrQkFBK0I7NENBdkZTLFlBQVk7c0JBQXZFLGVBQWU7dUJBQUMsb0JBQW9CLEVBQUUsRUFBQyxXQUFXLEVBQUUsSUFBSSxFQUFDO2dCQUNJLGNBQWM7c0JBQTNFLGVBQWU7dUJBQUMsc0JBQXNCLEVBQUUsRUFBQyxXQUFXLEVBQUUsSUFBSSxFQUFDO2dCQUNELFVBQVU7c0JBQXBFLFNBQVM7dUJBQUMsWUFBWSxFQUFFLEVBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFDO2dCQUdoQixXQUFXO3NCQUFuRCxZQUFZO3VCQUFDLHlCQUF5QjtnQkFHOUIsSUFBSTtzQkFBWixLQUFLO2dCQUNHLElBQUk7c0JBQVosS0FBSztnQkFDRyxJQUFJO3NCQUFaLEtBQUs7Z0JBQ0csSUFBSTtzQkFBWixLQUFLO2dCQUdHLFVBQVU7c0JBQWxCLEtBQUs7Z0JBR2lDLFdBQVc7c0JBQWpELFdBQVc7dUJBQUMsb0JBQW9CO2dCQVM3QixFQUFFO3NCQURMLEtBQUs7Z0JBYUYsa0JBQWtCO3NCQURyQixLQUFLO2dCQVlGLFNBQVM7c0JBRFosS0FBSztnQkFpQkYsU0FBUztzQkFEWixLQUFLIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcclxuICAgIEFmdGVyQ29udGVudEluaXQsIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBDb21wb25lbnQsIENvbnRlbnRDaGlsZCwgQ29udGVudENoaWxkcmVuLCBFbGVtZW50UmVmLCBIb3N0QmluZGluZywgSW5qZWN0LCBJbnB1dCwgTmdab25lLCBPbkRlc3Ryb3ksIE9uSW5pdCxcclxuICAgIFF1ZXJ5TGlzdCwgUmVuZGVyZXIyLCBWaWV3Q2hpbGRcclxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0LCBORVZFUiwgT2JzZXJ2YWJsZSwgU3ViamVjdCwgU3Vic2NyaXB0aW9uLCBpaWYsIG1lcmdlIH0gZnJvbSAncnhqcyc7XHJcbmltcG9ydCB7IGV4aGF1c3RNYXAsIGZpbHRlciwgbWFwLCBzdGFydFdpdGgsIHN3aXRjaE1hcCwgdGFrZSwgdGFrZVVudGlsLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IEJvb2xlYW5JbnB1dCwgY29lcmNlQm9vbGVhblByb3BlcnR5IH0gZnJvbSAnLi4vY29lcmNpb24vYm9vbGVhbi1wcm9wZXJ0eSc7XHJcbmltcG9ydCB7IE51bWJlcklucHV0LCBjb2VyY2VOdW1iZXJQcm9wZXJ0eSB9IGZyb20gJy4uL2NvZXJjaW9uL251bWJlci1wcm9wZXJ0eSc7XHJcbmltcG9ydCB7IEtURF9HUklEX0RSQUdfSEFORExFLCBLdGRHcmlkRHJhZ0hhbmRsZSB9IGZyb20gJy4uL2RpcmVjdGl2ZXMvZHJhZy1oYW5kbGUnO1xyXG5pbXBvcnQgeyBLVERfR1JJRF9JVEVNX1BMQUNFSE9MREVSLCBLdGRHcmlkSXRlbVBsYWNlaG9sZGVyIH0gZnJvbSAnLi4vZGlyZWN0aXZlcy9wbGFjZWhvbGRlcic7XHJcbmltcG9ydCB7IEtURF9HUklEX1JFU0laRV9IQU5ETEUsIEt0ZEdyaWRSZXNpemVIYW5kbGUgfSBmcm9tICcuLi9kaXJlY3RpdmVzL3Jlc2l6ZS1oYW5kbGUnO1xyXG5pbXBvcnQgeyBHUklEX0lURU1fR0VUX1JFTkRFUl9EQVRBX1RPS0VOLCBLdGRHcmlkSXRlbVJlbmRlckRhdGFUb2tlblR5cGUgfSBmcm9tICcuLi9ncmlkLmRlZmluaXRpb25zJztcclxuaW1wb3J0IHsgS3RkR3JpZFNlcnZpY2UgfSBmcm9tICcuLi9ncmlkLnNlcnZpY2UnO1xyXG5pbXBvcnQgeyBrdGRPdXRzaWRlWm9uZSB9IGZyb20gJy4uL3V0aWxzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IGt0ZElzTW91c2VFdmVudE9yTW91c2VQb2ludGVyRXZlbnQsIGt0ZFBvaW50ZXJDbGllbnQsIGt0ZFBvaW50ZXJEb3duLCBrdGRQb2ludGVyVXAgfSBmcm9tICcuLi91dGlscy9wb2ludGVyLnV0aWxzJztcclxuaW1wb3J0IHsgRE9DVU1FTlQgfSBmcm9tICdAYW5ndWxhci9jb21tb24nO1xyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgICBzdGFuZGFsb25lOiB0cnVlLFxyXG4gICAgc2VsZWN0b3I6ICdrdGQtZ3JpZC1pdGVtJyxcclxuICAgIHRlbXBsYXRlVXJsOiAnLi9ncmlkLWl0ZW0uY29tcG9uZW50Lmh0bWwnLFxyXG4gICAgc3R5bGVVcmxzOiBbJy4vZ3JpZC1pdGVtLmNvbXBvbmVudC5zY3NzJ10sXHJcbiAgICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaFxyXG59KVxyXG5leHBvcnQgY2xhc3MgS3RkR3JpZEl0ZW1Db21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uRGVzdHJveSwgQWZ0ZXJDb250ZW50SW5pdCB7XHJcbiAgICAvKiogRWxlbWVudHMgdGhhdCBjYW4gYmUgdXNlZCB0byBkcmFnIHRoZSBncmlkIGl0ZW0uICovXHJcbiAgICBAQ29udGVudENoaWxkcmVuKEtURF9HUklEX0RSQUdfSEFORExFLCB7ZGVzY2VuZGFudHM6IHRydWV9KSBfZHJhZ0hhbmRsZXM6IFF1ZXJ5TGlzdDxLdGRHcmlkRHJhZ0hhbmRsZT47XHJcbiAgICBAQ29udGVudENoaWxkcmVuKEtURF9HUklEX1JFU0laRV9IQU5ETEUsIHtkZXNjZW5kYW50czogdHJ1ZX0pIF9yZXNpemVIYW5kbGVzOiBRdWVyeUxpc3Q8S3RkR3JpZFJlc2l6ZUhhbmRsZT47XHJcbiAgICBAVmlld0NoaWxkKCdyZXNpemVFbGVtJywge3N0YXRpYzogdHJ1ZSwgcmVhZDogRWxlbWVudFJlZn0pIHJlc2l6ZUVsZW06IEVsZW1lbnRSZWY7XHJcblxyXG4gICAgLyoqIFRlbXBsYXRlIHJlZiBmb3IgcGxhY2Vob2xkZXIgKi9cclxuICAgIEBDb250ZW50Q2hpbGQoS1REX0dSSURfSVRFTV9QTEFDRUhPTERFUikgcGxhY2Vob2xkZXI6IEt0ZEdyaWRJdGVtUGxhY2Vob2xkZXI7XHJcblxyXG4gICAgLyoqIE1pbiBhbmQgbWF4IHNpemUgaW5wdXQgcHJvcGVydGllcy4gQW55IG9mIHRoZXNlIHdvdWxkICdvdmVycmlkZScgdGhlIG1pbi9tYXggdmFsdWVzIHNwZWNpZmllZCBpbiB0aGUgbGF5b3V0LiAqL1xyXG4gICAgQElucHV0KCkgbWluVz86IG51bWJlcjtcclxuICAgIEBJbnB1dCgpIG1pbkg/OiBudW1iZXI7XHJcbiAgICBASW5wdXQoKSBtYXhXPzogbnVtYmVyO1xyXG4gICAgQElucHV0KCkgbWF4SD86IG51bWJlcjtcclxuXHJcbiAgICAvKiogQ1NTIHRyYW5zaXRpb24gc3R5bGUuIE5vdGUgdGhhdCBmb3IgbW9yZSBwZXJmb3JtYW5jZSBpcyBwcmVmZXJhYmxlIG9ubHkgbWFrZSB0cmFuc2l0aW9uIG9uIHRyYW5zZm9ybSBwcm9wZXJ0eS4gKi9cclxuICAgIEBJbnB1dCgpIHRyYW5zaXRpb246IHN0cmluZyA9ICd0cmFuc2Zvcm0gNTAwbXMgZWFzZSwgd2lkdGggNTAwbXMgZWFzZSwgaGVpZ2h0IDUwMG1zIGVhc2UnO1xyXG5cclxuICAgIC8qKiBEeW5hbWljYWxseSBhcHBseSBgdG91Y2gtYWN0aW9uYCB0byB0aGUgaG9zdCBlbGVtZW50IGJhc2VkIG9uIGRyYWdnYWJsZSAqL1xyXG4gICAgQEhvc3RCaW5kaW5nKCdzdHlsZS50b3VjaC1hY3Rpb24nKSBnZXQgdG91Y2hBY3Rpb24oKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZHJhZ2dhYmxlID8gJ25vbmUnIDogJ2F1dG8nO1xyXG4gICAgfVxyXG5cclxuICAgIGRyYWdTdGFydCQ6IE9ic2VydmFibGU8TW91c2VFdmVudCB8IFRvdWNoRXZlbnQ+O1xyXG4gICAgcmVzaXplU3RhcnQkOiBPYnNlcnZhYmxlPE1vdXNlRXZlbnQgfCBUb3VjaEV2ZW50PjtcclxuXHJcbiAgICAvKiogSWQgb2YgdGhlIGdyaWQgaXRlbS4gVGhpcyBwcm9wZXJ0eSBpcyBzdHJpY3RseSBjb21wdWxzb3J5LiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBpZCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9pZDtcclxuICAgIH1cclxuXHJcbiAgICBzZXQgaWQodmFsOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLl9pZCA9IHZhbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9pZDogc3RyaW5nO1xyXG5cclxuICAgIC8qKiBNaW5pbXVtIGFtb3VudCBvZiBwaXhlbHMgdGhhdCB0aGUgdXNlciBzaG91bGQgbW92ZSBiZWZvcmUgaXQgc3RhcnRzIHRoZSBkcmFnIHNlcXVlbmNlLiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBkcmFnU3RhcnRUaHJlc2hvbGQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX2RyYWdTdGFydFRocmVzaG9sZDsgfVxyXG5cclxuICAgIHNldCBkcmFnU3RhcnRUaHJlc2hvbGQodmFsOiBudW1iZXIpIHtcclxuICAgICAgICB0aGlzLl9kcmFnU3RhcnRUaHJlc2hvbGQgPSBjb2VyY2VOdW1iZXJQcm9wZXJ0eSh2YWwpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2RyYWdTdGFydFRocmVzaG9sZDogbnVtYmVyID0gMDtcclxuXHJcblxyXG4gICAgLyoqIFdoZXRoZXIgdGhlIGl0ZW0gaXMgZHJhZ2dhYmxlIG9yIG5vdC4gRGVmYXVsdHMgdG8gdHJ1ZS4gRG9lcyBub3QgYWZmZWN0IG1hbnVhbCBkcmFnZ2luZyB1c2luZyB0aGUgc3RhcnREcmFnTWFudWFsbHkgbWV0aG9kLiAqL1xyXG4gICAgQElucHV0KClcclxuICAgIGdldCBkcmFnZ2FibGUoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RyYWdnYWJsZTtcclxuICAgIH1cclxuXHJcbiAgICBzZXQgZHJhZ2dhYmxlKHZhbDogYm9vbGVhbikge1xyXG4gICAgICAgIHRoaXMuX2RyYWdnYWJsZSA9IGNvZXJjZUJvb2xlYW5Qcm9wZXJ0eSh2YWwpO1xyXG4gICAgICAgIHRoaXMuX2RyYWdnYWJsZSQubmV4dCh0aGlzLl9kcmFnZ2FibGUpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2RyYWdnYWJsZTogYm9vbGVhbiA9IHRydWU7XHJcbiAgICBwcml2YXRlIF9kcmFnZ2FibGUkOiBCZWhhdmlvclN1YmplY3Q8Ym9vbGVhbj4gPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+KHRoaXMuX2RyYWdnYWJsZSk7XHJcblxyXG4gICAgcHJpdmF0ZSBfbWFudWFsRHJhZ0V2ZW50cyQ6IFN1YmplY3Q8TW91c2VFdmVudCB8IFRvdWNoRXZlbnQ+ID0gbmV3IFN1YmplY3Q8TW91c2VFdmVudCB8IFRvdWNoRXZlbnQ+KCk7XHJcblxyXG4gICAgLyoqIFdoZXRoZXIgdGhlIGl0ZW0gaXMgcmVzaXphYmxlIG9yIG5vdC4gRGVmYXVsdHMgdG8gdHJ1ZS4gKi9cclxuICAgIEBJbnB1dCgpXHJcbiAgICBnZXQgcmVzaXphYmxlKCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9yZXNpemFibGU7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IHJlc2l6YWJsZSh2YWw6IGJvb2xlYW4pIHtcclxuICAgICAgICB0aGlzLl9yZXNpemFibGUgPSBjb2VyY2VCb29sZWFuUHJvcGVydHkodmFsKTtcclxuICAgICAgICB0aGlzLl9yZXNpemFibGUkLm5leHQodGhpcy5fcmVzaXphYmxlKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIF9yZXNpemFibGU6IGJvb2xlYW4gPSB0cnVlO1xyXG4gICAgcHJpdmF0ZSBfcmVzaXphYmxlJDogQmVoYXZpb3JTdWJqZWN0PGJvb2xlYW4+ID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPih0aGlzLl9yZXNpemFibGUpO1xyXG5cclxuICAgIHByaXZhdGUgZHJhZ1N0YXJ0U3ViamVjdDogU3ViamVjdDxNb3VzZUV2ZW50IHwgVG91Y2hFdmVudD4gPSBuZXcgU3ViamVjdDxNb3VzZUV2ZW50IHwgVG91Y2hFdmVudD4oKTtcclxuICAgIHByaXZhdGUgcmVzaXplU3RhcnRTdWJqZWN0OiBTdWJqZWN0PE1vdXNlRXZlbnQgfCBUb3VjaEV2ZW50PiA9IG5ldyBTdWJqZWN0PE1vdXNlRXZlbnQgfCBUb3VjaEV2ZW50PigpO1xyXG5cclxuICAgIHByaXZhdGUgc3Vic2NyaXB0aW9uczogU3Vic2NyaXB0aW9uW10gPSBbXTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihwdWJsaWMgZWxlbWVudFJlZjogRWxlbWVudFJlZixcclxuICAgICAgICAgICAgICAgIHByaXZhdGUgZ3JpZFNlcnZpY2U6IEt0ZEdyaWRTZXJ2aWNlLFxyXG4gICAgICAgICAgICAgICAgcHJpdmF0ZSByZW5kZXJlcjogUmVuZGVyZXIyLFxyXG4gICAgICAgICAgICAgICAgcHJpdmF0ZSBuZ1pvbmU6IE5nWm9uZSxcclxuICAgICAgICAgICAgICAgIEBJbmplY3QoRE9DVU1FTlQpIHByaXZhdGUgZG9jdW1lbnQ6IERvY3VtZW50LFxyXG4gICAgICAgICAgICAgICAgQEluamVjdChHUklEX0lURU1fR0VUX1JFTkRFUl9EQVRBX1RPS0VOKSBwcml2YXRlIGdldEl0ZW1SZW5kZXJEYXRhOiBLdGRHcmlkSXRlbVJlbmRlckRhdGFUb2tlblR5cGUpIHtcclxuICAgICAgICB0aGlzLmRyYWdTdGFydCQgPSB0aGlzLmRyYWdTdGFydFN1YmplY3QuYXNPYnNlcnZhYmxlKCk7XHJcbiAgICAgICAgdGhpcy5yZXNpemVTdGFydCQgPSB0aGlzLnJlc2l6ZVN0YXJ0U3ViamVjdC5hc09ic2VydmFibGUoKTtcclxuICAgIH1cclxuXHJcbiAgICBuZ09uSW5pdCgpIHtcclxuICAgICAgICBjb25zdCBncmlkSXRlbVJlbmRlckRhdGEgPSB0aGlzLmdldEl0ZW1SZW5kZXJEYXRhKHRoaXMuaWQpITtcclxuICAgICAgICB0aGlzLnNldFN0eWxlcyhncmlkSXRlbVJlbmRlckRhdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIG5nQWZ0ZXJDb250ZW50SW5pdCgpIHtcclxuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvbnMucHVzaChcclxuICAgICAgICAgICAgdGhpcy5fZHJhZ1N0YXJ0JCgpLnN1YnNjcmliZSh0aGlzLmRyYWdTdGFydFN1YmplY3QpLFxyXG4gICAgICAgICAgICB0aGlzLl9yZXNpemVTdGFydCQoKS5zdWJzY3JpYmUodGhpcy5yZXNpemVTdGFydFN1YmplY3QpLFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgbmdPbkRlc3Ryb3koKSB7XHJcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zLmZvckVhY2goc3ViID0+IHN1Yi51bnN1YnNjcmliZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRvIG1hbnVhbGx5IHN0YXJ0IGRyYWdnaW5nLCByb3V0ZSB0aGUgZGVzaXJlZCBwb2ludGVyIGV2ZW50cyB0byB0aGlzIG1ldGhvZC5cclxuICAgICAqIERyYWdnaW5nIGluaXRpYXRlZCBieSB0aGlzIG1ldGhvZCB3aWxsIHdvcmsgcmVnYXJkbGVzcyBvZiB0aGUgdmFsdWUgb2YgdGhlIGRyYWdnYWJsZSBJbnB1dC5cclxuICAgICAqIEl0IGlzIHRoZSBjYWxsZXIncyByZXNwb25zaWJpbGl0eSB0byBjYWxsIHRoaXMgbWV0aG9kIHdpdGggb25seSB0aGUgZXZlbnRzIHRoYXQgYXJlIGRlc2lyZWQgdG8gY2F1c2UgYSBkcmFnLlxyXG4gICAgICogRm9yIGV4YW1wbGUsIGlmIHlvdSBvbmx5IHdhbnQgbGVmdCBjbGlja3MgdG8gY2F1c2UgYSBkcmFnLCBpdCBpcyB5b3VyIHJlc3BvbnNpYmlsaXR5IHRvIGZpbHRlciBvdXQgb3RoZXIgbW91c2UgYnV0dG9uIGV2ZW50cy5cclxuICAgICAqIEBwYXJhbSBzdGFydEV2ZW50IFRoZSBwb2ludGVyIGV2ZW50IHRoYXQgc2hvdWxkIGluaXRpYXRlIHRoZSBkcmFnLlxyXG4gICAgICovXHJcbiAgICBzdGFydERyYWdNYW51YWxseShzdGFydEV2ZW50OiBNb3VzZUV2ZW50IHwgVG91Y2hFdmVudCkge1xyXG4gICAgICAgIHRoaXMuX21hbnVhbERyYWdFdmVudHMkLm5leHQoc3RhcnRFdmVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0U3R5bGVzKHt0b3AsIGxlZnQsIHdpZHRoLCBoZWlnaHR9OiB7IHRvcDogc3RyaW5nLCBsZWZ0OiBzdHJpbmcsIHdpZHRoPzogc3RyaW5nLCBoZWlnaHQ/OiBzdHJpbmcgfSkge1xyXG4gICAgICAgIC8vIHRyYW5zZm9ybSBpcyA2eCB0aW1lcyBmYXN0ZXIgdGhhbiB0b3AvbGVmdFxyXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2V0U3R5bGUodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICd0cmFuc2Zvcm0nLCBgdHJhbnNsYXRlWCgke2xlZnR9KSB0cmFuc2xhdGVZKCR7dG9wfSlgKTtcclxuICAgICAgICB0aGlzLnJlbmRlcmVyLnNldFN0eWxlKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50LCAnZGlzcGxheScsIGBibG9ja2ApO1xyXG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2V0U3R5bGUodGhpcy5lbGVtZW50UmVmLm5hdGl2ZUVsZW1lbnQsICd0cmFuc2l0aW9uJywgdGhpcy50cmFuc2l0aW9uKTtcclxuICAgICAgICBpZiAod2lkdGggIT0gbnVsbCkgeyB0aGlzLnJlbmRlcmVyLnNldFN0eWxlKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50LCAnd2lkdGgnLCB3aWR0aCk7IH1cclxuICAgICAgICBpZiAoaGVpZ2h0ICE9IG51bGwpIHt0aGlzLnJlbmRlcmVyLnNldFN0eWxlKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50LCAnaGVpZ2h0JywgaGVpZ2h0KTsgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgX2RyYWdTdGFydCQoKTogT2JzZXJ2YWJsZTxNb3VzZUV2ZW50IHwgVG91Y2hFdmVudD4ge1xyXG4gICAgICAgIHJldHVybiBtZXJnZShcclxuICAgICAgICAgICAgdGhpcy5fbWFudWFsRHJhZ0V2ZW50cyQsXHJcbiAgICAgICAgICAgIHRoaXMuX2RyYWdnYWJsZSQucGlwZShcclxuICAgICAgICAgICAgICAgIHN3aXRjaE1hcCgoZHJhZ2dhYmxlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmFnZ2FibGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE5FVkVSO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZHJhZ0hhbmRsZXMuY2hhbmdlcy5waXBlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydFdpdGgodGhpcy5fZHJhZ0hhbmRsZXMpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hNYXAoKGRyYWdIYW5kbGVzOiBRdWVyeUxpc3Q8S3RkR3JpZERyYWdIYW5kbGU+KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaWlmKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgpID0+IGRyYWdIYW5kbGVzLmxlbmd0aCA+IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVyZ2UoLi4uZHJhZ0hhbmRsZXMudG9BcnJheSgpLm1hcChkcmFnSGFuZGxlID0+IGt0ZFBvaW50ZXJEb3duKGRyYWdIYW5kbGUuZWxlbWVudC5uYXRpdmVFbGVtZW50KSkpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGt0ZFBvaW50ZXJEb3duKHRoaXMuZWxlbWVudFJlZi5uYXRpdmVFbGVtZW50KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgKS5waXBlKFxyXG4gICAgICAgICAgICBleGhhdXN0TWFwKHN0YXJ0RXZlbnQgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIGV2ZW50IHN0YXJ0ZWQgZnJvbSBhbiBlbGVtZW50IHdpdGggdGhlIG5hdGl2ZSBIVE1MIGRyYWcmZHJvcCwgaXQnbGwgaW50ZXJmZXJlXHJcbiAgICAgICAgICAgICAgICAvLyB3aXRoIG91ciBvd24gZHJhZ2dpbmcgKGUuZy4gYGltZ2AgdGFncyBkbyBpdCBieSBkZWZhdWx0KS4gUHJldmVudCB0aGUgZGVmYXVsdCBhY3Rpb25cclxuICAgICAgICAgICAgICAgIC8vIHRvIHN0b3AgaXQgZnJvbSBoYXBwZW5pbmcuIE5vdGUgdGhhdCBwcmV2ZW50aW5nIG9uIGBkcmFnc3RhcnRgIGFsc28gc2VlbXMgdG8gd29yaywgYnV0XHJcbiAgICAgICAgICAgICAgICAvLyBpdCdzIGZsYWt5IGFuZCBpdCBmYWlscyBpZiB0aGUgdXNlciBkcmFncyBpdCBhd2F5IHF1aWNrbHkuIEFsc28gbm90ZSB0aGF0IHdlIG9ubHkgd2FudFxyXG4gICAgICAgICAgICAgICAgLy8gdG8gZG8gdGhpcyBmb3IgYG1vdXNlZG93bmAgYW5kIGBwb2ludGVyZG93bmAgc2luY2UgZG9pbmcgdGhlIHNhbWUgZm9yIGB0b3VjaHN0YXJ0YCB3aWxsXHJcbiAgICAgICAgICAgICAgICAvLyBzdG9wIGFueSBgY2xpY2tgIGV2ZW50cyBmcm9tIGZpcmluZyBvbiB0b3VjaCBkZXZpY2VzLlxyXG4gICAgICAgICAgICAgICAgaWYgKGt0ZElzTW91c2VFdmVudE9yTW91c2VQb2ludGVyRXZlbnQoc3RhcnRFdmVudCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBzdGFydEV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRQb2ludGVyID0ga3RkUG9pbnRlckNsaWVudChzdGFydEV2ZW50KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdyaWRTZXJ2aWNlLm1vdXNlT3JUb3VjaE1vdmUkKHRoaXMuZG9jdW1lbnQpLnBpcGUoXHJcbiAgICAgICAgICAgICAgICAgICAgdGFrZVVudGlsKGt0ZFBvaW50ZXJVcCh0aGlzLmRvY3VtZW50KSksXHJcbiAgICAgICAgICAgICAgICAgICAga3RkT3V0c2lkZVpvbmUodGhpcy5uZ1pvbmUpLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcigobW92ZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdmVFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtb3ZlUG9pbnRlciA9IGt0ZFBvaW50ZXJDbGllbnQobW92ZUV2ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzdGFuY2VYID0gTWF0aC5hYnMoc3RhcnRQb2ludGVyLmNsaWVudFggLSBtb3ZlUG9pbnRlci5jbGllbnRYKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzdGFuY2VZID0gTWF0aC5hYnMoc3RhcnRQb2ludGVyLmNsaWVudFkgLSBtb3ZlUG9pbnRlci5jbGllbnRZKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2hlbiB0aGlzIGNvbmRpdGlvbnMgcmV0dXJucyB0cnVlIG1lYW4gdGhhdCB3ZSBhcmUgb3ZlciB0aHJlc2hvbGQuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkaXN0YW5jZVggKyBkaXN0YW5jZVkgPj0gdGhpcy5kcmFnU3RhcnRUaHJlc2hvbGQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICAgICAgdGFrZSgxKSxcclxuICAgICAgICAgICAgICAgICAgICAvLyBSZXR1cm4gdGhlIG9yaWdpbmFsIHN0YXJ0IGV2ZW50XHJcbiAgICAgICAgICAgICAgICAgICAgbWFwKCgpID0+IHN0YXJ0RXZlbnQpXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfcmVzaXplU3RhcnQkKCk6IE9ic2VydmFibGU8TW91c2VFdmVudCB8IFRvdWNoRXZlbnQ+IHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fcmVzaXphYmxlJC5waXBlKFxyXG4gICAgICAgICAgICBzd2l0Y2hNYXAoKHJlc2l6YWJsZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyZXNpemFibGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBTaWRlIGVmZmVjdCB0byBoaWRlIHRoZSByZXNpemVFbGVtIGlmIHJlc2l6ZSBpcyBkaXNhYmxlZC5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnNldFN0eWxlKHRoaXMucmVzaXplRWxlbS5uYXRpdmVFbGVtZW50LCAnZGlzcGxheScsICdub25lJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE5FVkVSO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVzaXplSGFuZGxlcy5jaGFuZ2VzLnBpcGUoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0V2l0aCh0aGlzLl9yZXNpemVIYW5kbGVzKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoTWFwKChyZXNpemVIYW5kbGVzOiBRdWVyeUxpc3Q8S3RkR3JpZFJlc2l6ZUhhbmRsZT4pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNpemVIYW5kbGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTaWRlIGVmZmVjdCB0byBoaWRlIHRoZSByZXNpemVFbGVtIGlmIHRoZXJlIGFyZSByZXNpemUgaGFuZGxlcy5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcmVyLnNldFN0eWxlKHRoaXMucmVzaXplRWxlbS5uYXRpdmVFbGVtZW50LCAnZGlzcGxheScsICdub25lJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lcmdlKC4uLnJlc2l6ZUhhbmRsZXMudG9BcnJheSgpLm1hcChyZXNpemVIYW5kbGUgPT4ga3RkUG9pbnRlckRvd24ocmVzaXplSGFuZGxlLmVsZW1lbnQubmF0aXZlRWxlbWVudCkpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJlci5zZXRTdHlsZSh0aGlzLnJlc2l6ZUVsZW0ubmF0aXZlRWxlbWVudCwgJ2Rpc3BsYXknLCAnYmxvY2snKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ga3RkUG9pbnRlckRvd24odGhpcy5yZXNpemVFbGVtLm5hdGl2ZUVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGFwKChzdGFydEV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa3RkSXNNb3VzZUV2ZW50T3JNb3VzZVBvaW50ZXJFdmVudChzdGFydEV2ZW50KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0RXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9taW5XOiBOdW1iZXJJbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9taW5IOiBOdW1iZXJJbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9tYXhXOiBOdW1iZXJJbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9tYXhIOiBOdW1iZXJJbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9kcmFnZ2FibGU6IEJvb2xlYW5JbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9yZXNpemFibGU6IEJvb2xlYW5JbnB1dDtcclxuICAgIHN0YXRpYyBuZ0FjY2VwdElucHV0VHlwZV9kcmFnU3RhcnRUaHJlc2hvbGQ6IE51bWJlcklucHV0O1xyXG5cclxufVxyXG4iLCI8bmctY29udGVudD48L25nLWNvbnRlbnQ+XHJcbjxkaXYgI3Jlc2l6ZUVsZW0gY2xhc3M9XCJncmlkLWl0ZW0tcmVzaXplLWljb25cIj48L2Rpdj4iXX0=