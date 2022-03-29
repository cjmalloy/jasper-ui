import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  api = '//localhost:8081';

  constructor(
    public http: HttpClient,
  ) { }

  load() {
    this.http.get('/assets/config.json')
    .subscribe((result: any) => {
      this.api = result['api'];
    });
  }
}
