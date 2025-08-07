import { NgModule } from '@angular/core';
import { KtdGridComponent } from './grid.component';
import { KtdGridItemComponent } from './grid-item/grid-item.component';
import { KtdGridDragHandle } from './directives/drag-handle';
import { KtdGridResizeHandle } from './directives/resize-handle';
import { KtdGridService } from './grid.service';
import { KtdGridItemPlaceholder } from '../public-api';
import * as i0 from "@angular/core";
/**
 * @deprecated Use `KtdGridComponent` instead.
 */
export class KtdGridModule {
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule }); }
    static { this.ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "16.2.12", ngImport: i0, type: KtdGridModule, imports: [KtdGridComponent,
            KtdGridItemComponent,
            KtdGridDragHandle,
            KtdGridResizeHandle,
            KtdGridItemPlaceholder], exports: [KtdGridComponent,
            KtdGridItemComponent,
            KtdGridDragHandle,
            KtdGridResizeHandle,
            KtdGridItemPlaceholder] }); }
    static { this.ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridModule, providers: [
            KtdGridService
        ] }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridModule, decorators: [{
            type: NgModule,
            args: [{
                    imports: [
                        KtdGridComponent,
                        KtdGridItemComponent,
                        KtdGridDragHandle,
                        KtdGridResizeHandle,
                        KtdGridItemPlaceholder
                    ],
                    exports: [
                        KtdGridComponent,
                        KtdGridItemComponent,
                        KtdGridDragHandle,
                        KtdGridResizeHandle,
                        KtdGridItemPlaceholder
                    ],
                    providers: [
                        KtdGridService
                    ]
                }]
        }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JpZC5tb2R1bGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9hbmd1bGFyLWdyaWQtbGF5b3V0L3NyYy9saWIvZ3JpZC5tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN6QyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNwRCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDaEQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sZUFBZSxDQUFDOztBQXFCdkQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sYUFBYTsrR0FBYixhQUFhO2dIQUFiLGFBQWEsWUFwQmxCLGdCQUFnQjtZQUNoQixvQkFBb0I7WUFDcEIsaUJBQWlCO1lBQ2pCLG1CQUFtQjtZQUNuQixzQkFBc0IsYUFHdEIsZ0JBQWdCO1lBQ2hCLG9CQUFvQjtZQUNwQixpQkFBaUI7WUFDakIsbUJBQW1CO1lBQ25CLHNCQUFzQjtnSEFTakIsYUFBYSxhQVBYO1lBQ1AsY0FBYztTQUNqQjs7NEZBS1EsYUFBYTtrQkF0QnpCLFFBQVE7bUJBQUM7b0JBQ04sT0FBTyxFQUFFO3dCQUNMLGdCQUFnQjt3QkFDaEIsb0JBQW9CO3dCQUNwQixpQkFBaUI7d0JBQ2pCLG1CQUFtQjt3QkFDbkIsc0JBQXNCO3FCQUN6QjtvQkFDRCxPQUFPLEVBQUU7d0JBQ0wsZ0JBQWdCO3dCQUNoQixvQkFBb0I7d0JBQ3BCLGlCQUFpQjt3QkFDakIsbUJBQW1CO3dCQUNuQixzQkFBc0I7cUJBQ3pCO29CQUNELFNBQVMsRUFBRTt3QkFDUCxjQUFjO3FCQUNqQjtpQkFDSiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5nTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IEt0ZEdyaWRDb21wb25lbnQgfSBmcm9tICcuL2dyaWQuY29tcG9uZW50JztcclxuaW1wb3J0IHsgS3RkR3JpZEl0ZW1Db21wb25lbnQgfSBmcm9tICcuL2dyaWQtaXRlbS9ncmlkLWl0ZW0uY29tcG9uZW50JztcclxuaW1wb3J0IHsgS3RkR3JpZERyYWdIYW5kbGUgfSBmcm9tICcuL2RpcmVjdGl2ZXMvZHJhZy1oYW5kbGUnO1xyXG5pbXBvcnQgeyBLdGRHcmlkUmVzaXplSGFuZGxlIH0gZnJvbSAnLi9kaXJlY3RpdmVzL3Jlc2l6ZS1oYW5kbGUnO1xyXG5pbXBvcnQgeyBLdGRHcmlkU2VydmljZSB9IGZyb20gJy4vZ3JpZC5zZXJ2aWNlJztcclxuaW1wb3J0IHsgS3RkR3JpZEl0ZW1QbGFjZWhvbGRlciB9IGZyb20gJy4uL3B1YmxpYy1hcGknO1xyXG5cclxuQE5nTW9kdWxlKHtcclxuICAgIGltcG9ydHM6IFtcclxuICAgICAgICBLdGRHcmlkQ29tcG9uZW50LFxyXG4gICAgICAgIEt0ZEdyaWRJdGVtQ29tcG9uZW50LFxyXG4gICAgICAgIEt0ZEdyaWREcmFnSGFuZGxlLFxyXG4gICAgICAgIEt0ZEdyaWRSZXNpemVIYW5kbGUsXHJcbiAgICAgICAgS3RkR3JpZEl0ZW1QbGFjZWhvbGRlclxyXG4gICAgXSxcclxuICAgIGV4cG9ydHM6IFtcclxuICAgICAgICBLdGRHcmlkQ29tcG9uZW50LFxyXG4gICAgICAgIEt0ZEdyaWRJdGVtQ29tcG9uZW50LFxyXG4gICAgICAgIEt0ZEdyaWREcmFnSGFuZGxlLFxyXG4gICAgICAgIEt0ZEdyaWRSZXNpemVIYW5kbGUsXHJcbiAgICAgICAgS3RkR3JpZEl0ZW1QbGFjZWhvbGRlclxyXG4gICAgXSxcclxuICAgIHByb3ZpZGVyczogW1xyXG4gICAgICAgIEt0ZEdyaWRTZXJ2aWNlXHJcbiAgICBdXHJcbn0pXHJcbi8qKlxyXG4gKiBAZGVwcmVjYXRlZCBVc2UgYEt0ZEdyaWRDb21wb25lbnRgIGluc3RlYWQuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgS3RkR3JpZE1vZHVsZSB7fVxyXG4iXX0=