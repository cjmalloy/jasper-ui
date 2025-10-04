import { 
  ChangeDetectionStrategy,
  Component, Input } from '@angular/core';
import { Mod } from '../../model/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-mod',
  templateUrl: './mod.component.html',
  styleUrl: './mod.component.scss',
  standalone: false,
})
export class ModComponent {
  @Input() mod?: Mod;
}
