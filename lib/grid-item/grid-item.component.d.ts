import { AfterContentInit, ElementRef, NgZone, OnDestroy, OnInit, QueryList, Renderer2 } from '@angular/core';
import { Observable } from 'rxjs';
import { BooleanInput } from '../coercion/boolean-property';
import { NumberInput } from '../coercion/number-property';
import { KtdGridDragHandle } from '../directives/drag-handle';
import { KtdGridItemPlaceholder } from '../directives/placeholder';
import { KtdGridResizeHandle } from '../directives/resize-handle';
import { KtdGridItemRenderDataTokenType } from '../grid.definitions';
import { KtdGridService } from '../grid.service';
import * as i0 from "@angular/core";
export declare class KtdGridItemComponent implements OnInit, OnDestroy, AfterContentInit {
    elementRef: ElementRef;
    private gridService;
    private renderer;
    private ngZone;
    private document;
    private getItemRenderData;
    /** Elements that can be used to drag the grid item. */
    _dragHandles: QueryList<KtdGridDragHandle>;
    _resizeHandles: QueryList<KtdGridResizeHandle>;
    resizeElem: ElementRef;
    /** Template ref for placeholder */
    placeholder: KtdGridItemPlaceholder;
    /** Min and max size input properties. Any of these would 'override' the min/max values specified in the layout. */
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    /** CSS transition style. Note that for more performance is preferable only make transition on transform property. */
    transition: string;
    /** Dynamically apply `touch-action` to the host element based on draggable */
    get touchAction(): string;
    dragStart$: Observable<MouseEvent | TouchEvent>;
    resizeStart$: Observable<MouseEvent | TouchEvent>;
    /** Id of the grid item. This property is strictly compulsory. */
    get id(): string;
    set id(val: string);
    private _id;
    /** Minimum amount of pixels that the user should move before it starts the drag sequence. */
    get dragStartThreshold(): number;
    set dragStartThreshold(val: number);
    private _dragStartThreshold;
    /** Whether the item is draggable or not. Defaults to true. Does not affect manual dragging using the startDragManually method. */
    get draggable(): boolean;
    set draggable(val: boolean);
    private _draggable;
    private _draggable$;
    private _manualDragEvents$;
    /** Whether the item is resizable or not. Defaults to true. */
    get resizable(): boolean;
    set resizable(val: boolean);
    private _resizable;
    private _resizable$;
    private dragStartSubject;
    private resizeStartSubject;
    private subscriptions;
    constructor(elementRef: ElementRef, gridService: KtdGridService, renderer: Renderer2, ngZone: NgZone, document: Document, getItemRenderData: KtdGridItemRenderDataTokenType);
    ngOnInit(): void;
    ngAfterContentInit(): void;
    ngOnDestroy(): void;
    /**
     * To manually start dragging, route the desired pointer events to this method.
     * Dragging initiated by this method will work regardless of the value of the draggable Input.
     * It is the caller's responsibility to call this method with only the events that are desired to cause a drag.
     * For example, if you only want left clicks to cause a drag, it is your responsibility to filter out other mouse button events.
     * @param startEvent The pointer event that should initiate the drag.
     */
    startDragManually(startEvent: MouseEvent | TouchEvent): void;
    setStyles({ top, left, width, height }: {
        top: string;
        left: string;
        width?: string;
        height?: string;
    }): void;
    private _dragStart$;
    private _resizeStart$;
    static ngAcceptInputType_minW: NumberInput;
    static ngAcceptInputType_minH: NumberInput;
    static ngAcceptInputType_maxW: NumberInput;
    static ngAcceptInputType_maxH: NumberInput;
    static ngAcceptInputType_draggable: BooleanInput;
    static ngAcceptInputType_resizable: BooleanInput;
    static ngAcceptInputType_dragStartThreshold: NumberInput;
    static ɵfac: i0.ɵɵFactoryDeclaration<KtdGridItemComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<KtdGridItemComponent, "ktd-grid-item", never, { "minW": { "alias": "minW"; "required": false; }; "minH": { "alias": "minH"; "required": false; }; "maxW": { "alias": "maxW"; "required": false; }; "maxH": { "alias": "maxH"; "required": false; }; "transition": { "alias": "transition"; "required": false; }; "id": { "alias": "id"; "required": false; }; "dragStartThreshold": { "alias": "dragStartThreshold"; "required": false; }; "draggable": { "alias": "draggable"; "required": false; }; "resizable": { "alias": "resizable"; "required": false; }; }, {}, ["placeholder", "_dragHandles", "_resizeHandles"], ["*"], true, never>;
}
