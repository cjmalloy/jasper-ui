import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Config } from "../model/config";

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  config = new Config();

  constructor(
    public http: HttpClient,
  ) { }

  load() {
    this.http.get('/assets/config.json')
    .subscribe((result: any) => {
      this.config.api = result['api'];
    });
  }
}
