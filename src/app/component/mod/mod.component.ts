import { Component, forwardRef, input, ChangeDetectionStrategy } from '@angular/core';
import { Mod } from '../../model/tag';
import { ExtComponent } from '../ext/ext.component';
import { PluginComponent } from '../plugin/plugin.component';
import { RefComponent } from '../ref/ref.component';
import { TemplateComponent } from '../template/template.component';
import { UserComponent } from '../user/user.component';

@Component({
  selector: 'app-mod',
  templateUrl: './mod.component.html',
  styleUrl: './mod.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => RefComponent),
    forwardRef(() => ExtComponent),
    UserComponent,
    PluginComponent,
    TemplateComponent,
  ],
})
export class ModComponent {
  readonly mod = input<Mod | undefined>();
}
