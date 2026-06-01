import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Injectable, CallHandler, NestInterceptor, ExecutionContext } from '@nestjs/common';

import deepResolvePromises from './deep-resolver';

@Injectable()
export class ResolvePromisesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(mergeMap((data) => deepResolvePromises(data)));
  }
}
