import { Observable } from 'rxjs';
export declare function ktdIsMobileOrTablet(): boolean;
export declare function ktdIsMouseEvent(event: any): event is MouseEvent;
export declare function ktdIsTouchEvent(event: any): event is TouchEvent;
export declare function ktdPointerClientX(event: MouseEvent | TouchEvent): number;
export declare function ktdPointerClientY(event: MouseEvent | TouchEvent): number;
export declare function ktdPointerClient(event: MouseEvent | TouchEvent): {
    clientX: number;
    clientY: number;
};
export declare function ktdIsMouseEventOrMousePointerEvent(event: MouseEvent | TouchEvent | PointerEvent): boolean;
/** Returns true if browser supports pointer events */
export declare function ktdSupportsPointerEvents(): boolean;
export declare function ktdTouchEnd(element: any, touchNumber?: number): Observable<TouchEvent>;
/**
 * Emits when a 'pointerdown' event occurs (only for the primary pointer and mousePrimaryButton/touch). Fallbacks to 'mousemove' or a 'touchmove' if pointer events are not supported.
 * @param element, html element where to listen the events.
 */
export declare function ktdPointerDown(element: any): Observable<MouseEvent | TouchEvent | PointerEvent>;
/**
 * Emits when a 'pointermove' event occurs (only for the primary pointer and mousePrimaryButton/touch). Fallbacks to 'mousemove' or a 'touchmove' if pointer events are not supported.
 * @param element, html element where to listen the events.
 */
export declare function ktdPointerMove(element: any): Observable<MouseEvent | TouchEvent | PointerEvent>;
/**
 * Emits when a 'pointerup' event occurs (only for the primary pointer and mousePrimaryButton/touch). Fallbacks to 'mousemove' or a 'touchmove' if pointer events are not supported.
 * @param element, html element where to listen the events.
 */
export declare function ktdPointerUp(element: any): Observable<MouseEvent | TouchEvent | PointerEvent>;
