import { Directive, InjectionToken, Input } from '@angular/core';
import * as i0 from "@angular/core";
/**
 * Injection token that can be used to reference instances of `KtdGridItemPlaceholder`. It serves as
 * alternative token to the actual `KtdGridItemPlaceholder` class which could cause unnecessary
 * retention of the class and its directive metadata.
 */
export const KTD_GRID_ITEM_PLACEHOLDER = new InjectionToken('KtdGridItemPlaceholder');
/** Directive that can be used to create a custom placeholder for a KtdGridItem instance. */
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export class KtdGridItemPlaceholder {
    constructor(templateRef) {
        this.templateRef = templateRef;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridItemPlaceholder, deps: [{ token: i0.TemplateRef }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "16.2.12", type: KtdGridItemPlaceholder, isStandalone: true, selector: "ng-template[ktdGridItemPlaceholder]", inputs: { data: "data" }, host: { classAttribute: "ktd-grid-item-placeholder-content" }, providers: [{ provide: KTD_GRID_ITEM_PLACEHOLDER, useExisting: KtdGridItemPlaceholder }], ngImport: i0 }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridItemPlaceholder, decorators: [{
            type: Directive,
            args: [{
                    standalone: true,
                    selector: 'ng-template[ktdGridItemPlaceholder]',
                    // eslint-disable-next-line @angular-eslint/no-host-metadata-property
                    host: {
                        class: 'ktd-grid-item-placeholder-content'
                    },
                    providers: [{ provide: KTD_GRID_ITEM_PLACEHOLDER, useExisting: KtdGridItemPlaceholder }],
                }]
        }], ctorParameters: function () { return [{ type: i0.TemplateRef }]; }, propDecorators: { data: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhY2Vob2xkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvZGlyZWN0aXZlcy9wbGFjZWhvbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQWUsTUFBTSxlQUFlLENBQUM7O0FBRTlFOzs7O0dBSUc7QUFDSCxNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLGNBQWMsQ0FBeUIsd0JBQXdCLENBQUMsQ0FBQztBQUU5Ryw0RkFBNEY7QUFVNUYsa0VBQWtFO0FBQ2xFLE1BQU0sT0FBTyxzQkFBc0I7SUFHL0IsWUFBbUIsV0FBMkI7UUFBM0IsZ0JBQVcsR0FBWCxXQUFXLENBQWdCO0lBQUcsQ0FBQzsrR0FIekMsc0JBQXNCO21HQUF0QixzQkFBc0IsMktBSHBCLENBQUMsRUFBQyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsV0FBVyxFQUFFLHNCQUFzQixFQUFDLENBQUM7OzRGQUc3RSxzQkFBc0I7a0JBVmxDLFNBQVM7bUJBQUM7b0JBQ1AsVUFBVSxFQUFFLElBQUk7b0JBQ2hCLFFBQVEsRUFBRSxxQ0FBcUM7b0JBQy9DLHFFQUFxRTtvQkFDckUsSUFBSSxFQUFFO3dCQUNGLEtBQUssRUFBRSxtQ0FBbUM7cUJBQzdDO29CQUNELFNBQVMsRUFBRSxDQUFDLEVBQUMsT0FBTyxFQUFFLHlCQUF5QixFQUFFLFdBQVcsd0JBQXdCLEVBQUMsQ0FBQztpQkFDekY7a0dBSVksSUFBSTtzQkFBWixLQUFLIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGlyZWN0aXZlLCBJbmplY3Rpb25Ub2tlbiwgSW5wdXQsIFRlbXBsYXRlUmVmIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcblxyXG4vKipcclxuICogSW5qZWN0aW9uIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVmZXJlbmNlIGluc3RhbmNlcyBvZiBgS3RkR3JpZEl0ZW1QbGFjZWhvbGRlcmAuIEl0IHNlcnZlcyBhc1xyXG4gKiBhbHRlcm5hdGl2ZSB0b2tlbiB0byB0aGUgYWN0dWFsIGBLdGRHcmlkSXRlbVBsYWNlaG9sZGVyYCBjbGFzcyB3aGljaCBjb3VsZCBjYXVzZSB1bm5lY2Vzc2FyeVxyXG4gKiByZXRlbnRpb24gb2YgdGhlIGNsYXNzIGFuZCBpdHMgZGlyZWN0aXZlIG1ldGFkYXRhLlxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IEtURF9HUklEX0lURU1fUExBQ0VIT0xERVIgPSBuZXcgSW5qZWN0aW9uVG9rZW48S3RkR3JpZEl0ZW1QbGFjZWhvbGRlcj4oJ0t0ZEdyaWRJdGVtUGxhY2Vob2xkZXInKTtcclxuXHJcbi8qKiBEaXJlY3RpdmUgdGhhdCBjYW4gYmUgdXNlZCB0byBjcmVhdGUgYSBjdXN0b20gcGxhY2Vob2xkZXIgZm9yIGEgS3RkR3JpZEl0ZW0gaW5zdGFuY2UuICovXHJcbkBEaXJlY3RpdmUoe1xyXG4gICAgc3RhbmRhbG9uZTogdHJ1ZSxcclxuICAgIHNlbGVjdG9yOiAnbmctdGVtcGxhdGVba3RkR3JpZEl0ZW1QbGFjZWhvbGRlcl0nLFxyXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEBhbmd1bGFyLWVzbGludC9uby1ob3N0LW1ldGFkYXRhLXByb3BlcnR5XHJcbiAgICBob3N0OiB7XHJcbiAgICAgICAgY2xhc3M6ICdrdGQtZ3JpZC1pdGVtLXBsYWNlaG9sZGVyLWNvbnRlbnQnXHJcbiAgICB9LFxyXG4gICAgcHJvdmlkZXJzOiBbe3Byb3ZpZGU6IEtURF9HUklEX0lURU1fUExBQ0VIT0xERVIsIHVzZUV4aXN0aW5nOiBLdGRHcmlkSXRlbVBsYWNlaG9sZGVyfV0sXHJcbn0pXHJcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAYW5ndWxhci1lc2xpbnQvZGlyZWN0aXZlLWNsYXNzLXN1ZmZpeFxyXG5leHBvcnQgY2xhc3MgS3RkR3JpZEl0ZW1QbGFjZWhvbGRlcjxUID0gYW55PiB7XHJcbiAgICAvKiogQ29udGV4dCBkYXRhIHRvIGJlIGFkZGVkIHRvIHRoZSBwbGFjZWhvbGRlciB0ZW1wbGF0ZSBpbnN0YW5jZS4gKi9cclxuICAgIEBJbnB1dCgpIGRhdGE6IFQ7XHJcbiAgICBjb25zdHJ1Y3RvcihwdWJsaWMgdGVtcGxhdGVSZWY6IFRlbXBsYXRlUmVmPFQ+KSB7fVxyXG59XHJcbiJdfQ==