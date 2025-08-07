import { Inject, Injectable } from '@angular/core';
import { ktdNormalizePassiveListenerOptions } from './utils/passive-listeners';
import { fromEvent, iif, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ktdIsMobileOrTablet, ktdSupportsPointerEvents } from './utils/pointer.utils';
import { DOCUMENT } from '@angular/common';
import * as i0 from "@angular/core";
/** Event options that can be used to bind an active, capturing event. */
const activeCapturingEventOptions = ktdNormalizePassiveListenerOptions({
    passive: false,
    capture: true
});
export class KtdGridService {
    constructor(ngZone, document) {
        this.ngZone = ngZone;
        this.document = document;
        this.touchMoveSubject = new Subject();
        this.touchMove$ = this.touchMoveSubject.asObservable();
        this.registerTouchMoveSubscription();
    }
    ngOnDestroy() {
        this.touchMoveSubscription.unsubscribe();
    }
    mouseOrTouchMove$(element) {
        if (!ktdSupportsPointerEvents()) {
            return iif(() => ktdIsMobileOrTablet(), this.touchMove$, fromEvent(element, 'mousemove', activeCapturingEventOptions) // TODO: Fix rxjs typings, boolean should be a good param too.
            );
        }
        return fromEvent(element, 'pointermove', activeCapturingEventOptions);
    }
    registerTouchMoveSubscription() {
        // The `touchmove` event gets bound once, ahead of time, because WebKit
        // won't preventDefault on a dynamically-added `touchmove` listener.
        // See https://bugs.webkit.org/show_bug.cgi?id=184250.
        this.touchMoveSubscription = this.ngZone.runOutsideAngular(() => 
        // The event handler has to be explicitly active,
        // because newer browsers make it passive by default.
        fromEvent(this.document, 'touchmove', activeCapturingEventOptions) // TODO: Fix rxjs typings, boolean should be a good param too.
            .pipe(filter((touchEvent) => touchEvent.touches.length === 1))
            .subscribe((touchEvent) => this.touchMoveSubject.next(touchEvent)));
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridService, deps: [{ token: i0.NgZone }, { token: DOCUMENT }], target: i0.ɵɵFactoryTarget.Injectable }); }
    static { this.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridService, providedIn: 'root' }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.2.12", ngImport: i0, type: KtdGridService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: function () { return [{ type: i0.NgZone }, { type: Document, decorators: [{
                    type: Inject,
                    args: [DOCUMENT]
                }] }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JpZC5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvYW5ndWxhci1ncmlkLWxheW91dC9zcmMvbGliL2dyaWQuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBcUIsTUFBTSxlQUFlLENBQUM7QUFDdEUsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDL0UsT0FBTyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQWMsT0FBTyxFQUFnQixNQUFNLE1BQU0sQ0FBQztBQUN6RSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDeEMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLHdCQUF3QixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDdEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDOztBQUUzQyx5RUFBeUU7QUFDekUsTUFBTSwyQkFBMkIsR0FBRyxrQ0FBa0MsQ0FBQztJQUNuRSxPQUFPLEVBQUUsS0FBSztJQUNkLE9BQU8sRUFBRSxJQUFJO0NBQ2hCLENBQUMsQ0FBQztBQUdILE1BQU0sT0FBTyxjQUFjO0lBTXZCLFlBQW9CLE1BQWMsRUFBNEIsUUFBa0I7UUFBNUQsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUE0QixhQUFRLEdBQVIsUUFBUSxDQUFVO1FBSHhFLHFCQUFnQixHQUF3QixJQUFJLE9BQU8sRUFBYyxDQUFDO1FBSXRFLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3ZELElBQUksQ0FBQyw2QkFBNkIsRUFBRSxDQUFDO0lBQ3pDLENBQUM7SUFFRCxXQUFXO1FBQ1AsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQzdDLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxPQUFPO1FBQ3JCLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxFQUFFO1lBQzdCLE9BQU8sR0FBRyxDQUNOLEdBQUcsRUFBRSxDQUFDLG1CQUFtQixFQUFFLEVBQzNCLElBQUksQ0FBQyxVQUFVLEVBQ2YsU0FBUyxDQUFhLE9BQU8sRUFBRSxXQUFXLEVBQUUsMkJBQXNELENBQUMsQ0FBQyw4REFBOEQ7YUFDckssQ0FBQztTQUNMO1FBRUQsT0FBTyxTQUFTLENBQWEsT0FBTyxFQUFFLGFBQWEsRUFBRSwyQkFBc0QsQ0FBQyxDQUFDO0lBQ2pILENBQUM7SUFFTyw2QkFBNkI7UUFDakMsdUVBQXVFO1FBQ3ZFLG9FQUFvRTtRQUNwRSxzREFBc0Q7UUFDdEQsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFO1FBQzVELGlEQUFpRDtRQUNqRCxxREFBcUQ7UUFDckQsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLDJCQUFzRCxDQUFDLENBQUMsOERBQThEO2FBQ3ZKLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxVQUFzQixFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQzthQUN6RSxTQUFTLENBQUMsQ0FBQyxVQUFzQixFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQ3JGLENBQUM7SUFDTixDQUFDOytHQXRDUSxjQUFjLHdDQU1xQixRQUFRO21IQU4zQyxjQUFjLGNBREYsTUFBTTs7NEZBQ2xCLGNBQWM7a0JBRDFCLFVBQVU7bUJBQUMsRUFBQyxVQUFVLEVBQUUsTUFBTSxFQUFDOzswQkFPUyxNQUFNOzJCQUFDLFFBQVEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3QsIEluamVjdGFibGUsIE5nWm9uZSwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XHJcbmltcG9ydCB7IGt0ZE5vcm1hbGl6ZVBhc3NpdmVMaXN0ZW5lck9wdGlvbnMgfSBmcm9tICcuL3V0aWxzL3Bhc3NpdmUtbGlzdGVuZXJzJztcclxuaW1wb3J0IHsgZnJvbUV2ZW50LCBpaWYsIE9ic2VydmFibGUsIFN1YmplY3QsIFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xyXG5pbXBvcnQgeyBmaWx0ZXIgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XHJcbmltcG9ydCB7IGt0ZElzTW9iaWxlT3JUYWJsZXQsIGt0ZFN1cHBvcnRzUG9pbnRlckV2ZW50cyB9IGZyb20gJy4vdXRpbHMvcG9pbnRlci51dGlscyc7XHJcbmltcG9ydCB7IERPQ1VNRU5UIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcclxuXHJcbi8qKiBFdmVudCBvcHRpb25zIHRoYXQgY2FuIGJlIHVzZWQgdG8gYmluZCBhbiBhY3RpdmUsIGNhcHR1cmluZyBldmVudC4gKi9cclxuY29uc3QgYWN0aXZlQ2FwdHVyaW5nRXZlbnRPcHRpb25zID0ga3RkTm9ybWFsaXplUGFzc2l2ZUxpc3RlbmVyT3B0aW9ucyh7XHJcbiAgICBwYXNzaXZlOiBmYWxzZSxcclxuICAgIGNhcHR1cmU6IHRydWVcclxufSk7XHJcblxyXG5ASW5qZWN0YWJsZSh7cHJvdmlkZWRJbjogJ3Jvb3QnfSlcclxuZXhwb3J0IGNsYXNzIEt0ZEdyaWRTZXJ2aWNlIGltcGxlbWVudHMgT25EZXN0cm95IHtcclxuXHJcbiAgICB0b3VjaE1vdmUkOiBPYnNlcnZhYmxlPFRvdWNoRXZlbnQ+O1xyXG4gICAgcHJpdmF0ZSB0b3VjaE1vdmVTdWJqZWN0OiBTdWJqZWN0PFRvdWNoRXZlbnQ+ID0gbmV3IFN1YmplY3Q8VG91Y2hFdmVudD4oKTtcclxuICAgIHByaXZhdGUgdG91Y2hNb3ZlU3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb247XHJcblxyXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBuZ1pvbmU6IE5nWm9uZSwgQEluamVjdChET0NVTUVOVCkgcHJpdmF0ZSBkb2N1bWVudDogRG9jdW1lbnQpIHtcclxuICAgICAgICB0aGlzLnRvdWNoTW92ZSQgPSB0aGlzLnRvdWNoTW92ZVN1YmplY3QuYXNPYnNlcnZhYmxlKCk7XHJcbiAgICAgICAgdGhpcy5yZWdpc3RlclRvdWNoTW92ZVN1YnNjcmlwdGlvbigpO1xyXG4gICAgfVxyXG5cclxuICAgIG5nT25EZXN0cm95KCkge1xyXG4gICAgICAgIHRoaXMudG91Y2hNb3ZlU3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgbW91c2VPclRvdWNoTW92ZSQoZWxlbWVudCk6IE9ic2VydmFibGU8TW91c2VFdmVudCB8IFRvdWNoRXZlbnQ+IHtcclxuICAgICAgICBpZiAoIWt0ZFN1cHBvcnRzUG9pbnRlckV2ZW50cygpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpaWYoXHJcbiAgICAgICAgICAgICAgICAoKSA9PiBrdGRJc01vYmlsZU9yVGFibGV0KCksXHJcbiAgICAgICAgICAgICAgICB0aGlzLnRvdWNoTW92ZSQsXHJcbiAgICAgICAgICAgICAgICBmcm9tRXZlbnQ8TW91c2VFdmVudD4oZWxlbWVudCwgJ21vdXNlbW92ZScsIGFjdGl2ZUNhcHR1cmluZ0V2ZW50T3B0aW9ucyBhcyBBZGRFdmVudExpc3RlbmVyT3B0aW9ucykgLy8gVE9ETzogRml4IHJ4anMgdHlwaW5ncywgYm9vbGVhbiBzaG91bGQgYmUgYSBnb29kIHBhcmFtIHRvby5cclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBmcm9tRXZlbnQ8TW91c2VFdmVudD4oZWxlbWVudCwgJ3BvaW50ZXJtb3ZlJywgYWN0aXZlQ2FwdHVyaW5nRXZlbnRPcHRpb25zIGFzIEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHJlZ2lzdGVyVG91Y2hNb3ZlU3Vic2NyaXB0aW9uKCkge1xyXG4gICAgICAgIC8vIFRoZSBgdG91Y2htb3ZlYCBldmVudCBnZXRzIGJvdW5kIG9uY2UsIGFoZWFkIG9mIHRpbWUsIGJlY2F1c2UgV2ViS2l0XHJcbiAgICAgICAgLy8gd29uJ3QgcHJldmVudERlZmF1bHQgb24gYSBkeW5hbWljYWxseS1hZGRlZCBgdG91Y2htb3ZlYCBsaXN0ZW5lci5cclxuICAgICAgICAvLyBTZWUgaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE4NDI1MC5cclxuICAgICAgICB0aGlzLnRvdWNoTW92ZVN1YnNjcmlwdGlvbiA9IHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XHJcbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBoYW5kbGVyIGhhcyB0byBiZSBleHBsaWNpdGx5IGFjdGl2ZSxcclxuICAgICAgICAgICAgLy8gYmVjYXVzZSBuZXdlciBicm93c2VycyBtYWtlIGl0IHBhc3NpdmUgYnkgZGVmYXVsdC5cclxuICAgICAgICAgICAgZnJvbUV2ZW50KHRoaXMuZG9jdW1lbnQsICd0b3VjaG1vdmUnLCBhY3RpdmVDYXB0dXJpbmdFdmVudE9wdGlvbnMgYXMgQWRkRXZlbnRMaXN0ZW5lck9wdGlvbnMpIC8vIFRPRE86IEZpeCByeGpzIHR5cGluZ3MsIGJvb2xlYW4gc2hvdWxkIGJlIGEgZ29vZCBwYXJhbSB0b28uXHJcbiAgICAgICAgICAgICAgICAucGlwZShmaWx0ZXIoKHRvdWNoRXZlbnQ6IFRvdWNoRXZlbnQpID0+IHRvdWNoRXZlbnQudG91Y2hlcy5sZW5ndGggPT09IDEpKVxyXG4gICAgICAgICAgICAgICAgLnN1YnNjcmliZSgodG91Y2hFdmVudDogVG91Y2hFdmVudCkgPT4gdGhpcy50b3VjaE1vdmVTdWJqZWN0Lm5leHQodG91Y2hFdmVudCkpXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufVxyXG4iXX0=