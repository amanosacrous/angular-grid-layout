import { Directive, InjectionToken } from '@angular/core';
import * as i0 from "@angular/core";
/**
 * Injection token that can be used to reference instances of `KtdGridDragHandle`. It serves as
 * alternative token to the actual `KtdGridDragHandle` class which could cause unnecessary
 * retention of the class and its directive metadata.
 */
export const KTD_GRID_DRAG_HANDLE = new InjectionToken('KtdGridDragHandle');
/** Handle that can be used to drag a KtdGridItem instance. */
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export class KtdGridDragHandle {
    constructor(element) {
        this.element = element;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridDragHandle, deps: [{ token: i0.ElementRef }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "16.2.12", type: KtdGridDragHandle, isStandalone: true, selector: "[ktdGridDragHandle]", host: { classAttribute: "ktd-grid-drag-handle" }, providers: [{ provide: KTD_GRID_DRAG_HANDLE, useExisting: KtdGridDragHandle }], ngImport: i0 }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridDragHandle, decorators: [{
            type: Directive,
            args: [{
                    standalone: true,
                    selector: '[ktdGridDragHandle]',
                    // eslint-disable-next-line @angular-eslint/no-host-metadata-property
                    host: {
                        class: 'ktd-grid-drag-handle'
                    },
                    providers: [{ provide: KTD_GRID_DRAG_HANDLE, useExisting: KtdGridDragHandle }],
                }]
        }], ctorParameters: function () { return [{ type: i0.ElementRef }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHJhZy1oYW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvZGlyZWN0aXZlcy9kcmFnLWhhbmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFjLGNBQWMsRUFBRSxNQUFNLGVBQWUsQ0FBQzs7QUFFdEU7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxNQUFNLG9CQUFvQixHQUFHLElBQUksY0FBYyxDQUFvQixtQkFBbUIsQ0FBQyxDQUFDO0FBRS9GLDhEQUE4RDtBQVU5RCxrRUFBa0U7QUFDbEUsTUFBTSxPQUFPLGlCQUFpQjtJQUMxQixZQUNXLE9BQWdDO1FBQWhDLFlBQU8sR0FBUCxPQUFPLENBQXlCO0lBQzNDLENBQUM7K0dBSFEsaUJBQWlCO21HQUFqQixpQkFBaUIsb0hBSGYsQ0FBQyxFQUFDLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUMsQ0FBQzs7NEZBR25FLGlCQUFpQjtrQkFWN0IsU0FBUzttQkFBQztvQkFDUCxVQUFVLEVBQUUsSUFBSTtvQkFDaEIsUUFBUSxFQUFFLHFCQUFxQjtvQkFDL0IscUVBQXFFO29CQUNyRSxJQUFJLEVBQUU7d0JBQ0YsS0FBSyxFQUFFLHNCQUFzQjtxQkFDaEM7b0JBQ0QsU0FBUyxFQUFFLENBQUMsRUFBQyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsV0FBVyxtQkFBbUIsRUFBQyxDQUFDO2lCQUMvRSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERpcmVjdGl2ZSwgRWxlbWVudFJlZiwgSW5qZWN0aW9uVG9rZW4gfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuXHJcbi8qKlxyXG4gKiBJbmplY3Rpb24gdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB0byByZWZlcmVuY2UgaW5zdGFuY2VzIG9mIGBLdGRHcmlkRHJhZ0hhbmRsZWAuIEl0IHNlcnZlcyBhc1xyXG4gKiBhbHRlcm5hdGl2ZSB0b2tlbiB0byB0aGUgYWN0dWFsIGBLdGRHcmlkRHJhZ0hhbmRsZWAgY2xhc3Mgd2hpY2ggY291bGQgY2F1c2UgdW5uZWNlc3NhcnlcclxuICogcmV0ZW50aW9uIG9mIHRoZSBjbGFzcyBhbmQgaXRzIGRpcmVjdGl2ZSBtZXRhZGF0YS5cclxuICovXHJcbmV4cG9ydCBjb25zdCBLVERfR1JJRF9EUkFHX0hBTkRMRSA9IG5ldyBJbmplY3Rpb25Ub2tlbjxLdGRHcmlkRHJhZ0hhbmRsZT4oJ0t0ZEdyaWREcmFnSGFuZGxlJyk7XHJcblxyXG4vKiogSGFuZGxlIHRoYXQgY2FuIGJlIHVzZWQgdG8gZHJhZyBhIEt0ZEdyaWRJdGVtIGluc3RhbmNlLiAqL1xyXG5ARGlyZWN0aXZlKHtcclxuICAgIHN0YW5kYWxvbmU6IHRydWUsXHJcbiAgICBzZWxlY3RvcjogJ1trdGRHcmlkRHJhZ0hhbmRsZV0nLFxyXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEBhbmd1bGFyLWVzbGludC9uby1ob3N0LW1ldGFkYXRhLXByb3BlcnR5XHJcbiAgICBob3N0OiB7XHJcbiAgICAgICAgY2xhc3M6ICdrdGQtZ3JpZC1kcmFnLWhhbmRsZSdcclxuICAgIH0sXHJcbiAgICBwcm92aWRlcnM6IFt7cHJvdmlkZTogS1REX0dSSURfRFJBR19IQU5ETEUsIHVzZUV4aXN0aW5nOiBLdGRHcmlkRHJhZ0hhbmRsZX1dLFxyXG59KVxyXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQGFuZ3VsYXItZXNsaW50L2RpcmVjdGl2ZS1jbGFzcy1zdWZmaXhcclxuZXhwb3J0IGNsYXNzIEt0ZEdyaWREcmFnSGFuZGxlIHtcclxuICAgIGNvbnN0cnVjdG9yKFxyXG4gICAgICAgIHB1YmxpYyBlbGVtZW50OiBFbGVtZW50UmVmPEhUTUxFbGVtZW50Pikge1xyXG4gICAgfVxyXG59XHJcbiJdfQ==