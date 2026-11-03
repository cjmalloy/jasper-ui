import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { RefSort } from '../model/ref';
import { andQueries, fixClientQuery } from '../util/tag';
import { columnAmount, columnTag, ValueUnit } from '../util/value-filter';
import { RefService } from './api/ref.service';

@Injectable({
  providedIn: 'root',
})
export class ValueFilterService {
  private refs = inject(RefService);

  /**
   * Smallest and largest values of a sort column within a query, or undefined if unknown.
   * The query should not include the page filters, so changing filters doesn't move the range.
   * Not cached, so reopening a filter picks up new Refs.
   */
  extent(column: string, unit: ValueUnit, query = ''): Observable<(number | undefined)[]> {
    const edge = (dir: 'ASC' | 'DESC') => this.refs.page({
      query: fixClientQuery(andQueries([columnTag(column), query])),
      sort: [`${column},${dir}` as RefSort],
      size: 1,
    }).pipe(map(page => page.content[0] && columnAmount(page.content[0], column, unit)));
    return forkJoin([edge('ASC'), edge('DESC')]).pipe(
      catchError(() => of([undefined, undefined])),
    );
  }
}
