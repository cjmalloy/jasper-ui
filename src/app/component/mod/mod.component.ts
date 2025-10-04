import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Mod } from '../../model/tag';

@Component({
  selector: 'app-mod',
  templateUrl: './mod.component.html',
  styleUrl: './mod.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModComponent {
  @Input() mod?: Mod;
}
