import { Directive, InjectionToken, } from '@angular/core';
import * as i0 from "@angular/core";
/**
 * Injection token that can be used to reference instances of `KtdGridResizeHandle`. It serves as
 * alternative token to the actual `KtdGridResizeHandle` class which could cause unnecessary
 * retention of the class and its directive metadata.
 */
export const KTD_GRID_RESIZE_HANDLE = new InjectionToken('KtdGridResizeHandle');
/** Handle that can be used to drag a KtdGridItem instance. */
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export class KtdGridResizeHandle {
    constructor(element) {
        this.element = element;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridResizeHandle, deps: [{ token: i0.ElementRef }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "16.2.12", type: KtdGridResizeHandle, isStandalone: true, selector: "[ktdGridResizeHandle]", host: { classAttribute: "ktd-grid-resize-handle" }, providers: [{ provide: KTD_GRID_RESIZE_HANDLE, useExisting: KtdGridResizeHandle }], ngImport: i0 }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridResizeHandle, decorators: [{
            type: Directive,
            args: [{
                    standalone: true,
                    selector: '[ktdGridResizeHandle]',
                    // eslint-disable-next-line @angular-eslint/no-host-metadata-property
                    host: {
                        class: 'ktd-grid-resize-handle'
                    },
                    providers: [{ provide: KTD_GRID_RESIZE_HANDLE, useExisting: KtdGridResizeHandle }],
                }]
        }], ctorParameters: function () { return [{ type: i0.ElementRef }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzaXplLWhhbmRsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL2FuZ3VsYXItZ3JpZC1sYXlvdXQvc3JjL2xpYi9kaXJlY3RpdmVzL3Jlc2l6ZS1oYW5kbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBYyxjQUFjLEdBQUcsTUFBTSxlQUFlLENBQUM7O0FBR3ZFOzs7O0dBSUc7QUFDSCxNQUFNLENBQUMsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLGNBQWMsQ0FBc0IscUJBQXFCLENBQUMsQ0FBQztBQUVyRyw4REFBOEQ7QUFVOUQsa0VBQWtFO0FBQ2xFLE1BQU0sT0FBTyxtQkFBbUI7SUFFNUIsWUFDVyxPQUFnQztRQUFoQyxZQUFPLEdBQVAsT0FBTyxDQUF5QjtJQUMzQyxDQUFDOytHQUpRLG1CQUFtQjttR0FBbkIsbUJBQW1CLHdIQUhqQixDQUFDLEVBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBQyxDQUFDOzs0RkFHdkUsbUJBQW1CO2tCQVYvQixTQUFTO21CQUFDO29CQUNQLFVBQVUsRUFBRSxJQUFJO29CQUNoQixRQUFRLEVBQUUsdUJBQXVCO29CQUNqQyxxRUFBcUU7b0JBQ3JFLElBQUksRUFBRTt3QkFDRixLQUFLLEVBQUUsd0JBQXdCO3FCQUNsQztvQkFDRCxTQUFTLEVBQUUsQ0FBQyxFQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxXQUFXLHFCQUFxQixFQUFDLENBQUM7aUJBQ25GIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGlyZWN0aXZlLCBFbGVtZW50UmVmLCBJbmplY3Rpb25Ub2tlbiwgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcclxuXHJcblxyXG4vKipcclxuICogSW5qZWN0aW9uIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVmZXJlbmNlIGluc3RhbmNlcyBvZiBgS3RkR3JpZFJlc2l6ZUhhbmRsZWAuIEl0IHNlcnZlcyBhc1xyXG4gKiBhbHRlcm5hdGl2ZSB0b2tlbiB0byB0aGUgYWN0dWFsIGBLdGRHcmlkUmVzaXplSGFuZGxlYCBjbGFzcyB3aGljaCBjb3VsZCBjYXVzZSB1bm5lY2Vzc2FyeVxyXG4gKiByZXRlbnRpb24gb2YgdGhlIGNsYXNzIGFuZCBpdHMgZGlyZWN0aXZlIG1ldGFkYXRhLlxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IEtURF9HUklEX1JFU0laRV9IQU5ETEUgPSBuZXcgSW5qZWN0aW9uVG9rZW48S3RkR3JpZFJlc2l6ZUhhbmRsZT4oJ0t0ZEdyaWRSZXNpemVIYW5kbGUnKTtcclxuXHJcbi8qKiBIYW5kbGUgdGhhdCBjYW4gYmUgdXNlZCB0byBkcmFnIGEgS3RkR3JpZEl0ZW0gaW5zdGFuY2UuICovXHJcbkBEaXJlY3RpdmUoe1xyXG4gICAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICAgIHNlbGVjdG9yOiAnW2t0ZEdyaWRSZXNpemVIYW5kbGVdJyxcclxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAYW5ndWxhci1lc2xpbnQvbm8taG9zdC1tZXRhZGF0YS1wcm9wZXJ0eVxyXG4gICAgaG9zdDoge1xyXG4gICAgICAgIGNsYXNzOiAna3RkLWdyaWQtcmVzaXplLWhhbmRsZSdcclxuICAgIH0sXHJcbiAgICBwcm92aWRlcnM6IFt7cHJvdmlkZTogS1REX0dSSURfUkVTSVpFX0hBTkRMRSwgdXNlRXhpc3Rpbmc6IEt0ZEdyaWRSZXNpemVIYW5kbGV9XSxcclxufSlcclxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEBhbmd1bGFyLWVzbGludC9kaXJlY3RpdmUtY2xhc3Mtc3VmZml4XHJcbmV4cG9ydCBjbGFzcyBLdGRHcmlkUmVzaXplSGFuZGxlIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihcclxuICAgICAgICBwdWJsaWMgZWxlbWVudDogRWxlbWVudFJlZjxIVE1MRWxlbWVudD4pIHtcclxuICAgIH1cclxufVxyXG4iXX0=