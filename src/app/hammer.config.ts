import { Injectable } from '@angular/core';
import { HammerGestureConfig } from '@angular/platform-browser';

@Injectable()
export class HammerConfig extends HammerGestureConfig {
  override options = {
    touchAction: 'auto',
  };
}
