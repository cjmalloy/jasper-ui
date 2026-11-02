import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, shareReplay } from 'rxjs';
import { RefSort } from '../model/ref';
import { andQueries, fixClientQuery } from '../util/tag';
import { columnAmount, columnTag, ValueUnit } from '../util/value-filter';
import { RefService } from './api/ref.service';

@Injectable({
  providedIn: 'root',
})
export class ValueFilterService {
  private refs = inject(RefService);

  private extents = new Map<string, Observable<(number | undefined)[]>>();

  /**
   * Smallest and largest values of a sort column within a query, or undefined if unknown.
   * The query should not include the page filters, so changing filters doesn't move the range.
   */
  extent(column: string, unit: ValueUnit, query = '') {
    if (query === '*') query = '';
    const key = column + ' ' + unit + ' ' + query;
    if (!this.extents.has(key)) {
      const edge = (dir: 'ASC' | 'DESC') => this.refs.page({
        query: fixClientQuery(andQueries([columnTag(column), query])),
        sort: [`${column},${dir}` as RefSort],
        size: 1,
      }).pipe(map(page => page.content[0] && columnAmount(page.content[0], column, unit)));
      this.extents.set(key, forkJoin([edge('ASC'), edge('DESC')]).pipe(
        catchError(() => of([undefined, undefined])),
        shareReplay(1),
      ));
    }
    return this.extents.get(key)!;
  }
}
