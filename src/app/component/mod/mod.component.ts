import { Component, Input } from '@angular/core';
import { Mod } from '../../model/tag';
import { RefComponent } from '../ref/ref.component';
import { ExtComponent } from '../ext/ext.component';
import { UserComponent } from '../user/user.component';
import { PluginComponent } from '../plugin/plugin.component';
import { TemplateComponent } from '../template/template.component';

@Component({
    selector: 'app-mod',
    templateUrl: './mod.component.html',
    styleUrl: './mod.component.scss',
    imports: [
        RefComponent,
        ExtComponent,
        UserComponent,
        PluginComponent,
        TemplateComponent,
    ],
})
export class ModComponent {
  @Input() mod?: Mod;
}
