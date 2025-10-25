import { Component, OnInit } from '@angular/core';
import { LoadingComponent } from '../../component/loading/loading.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [LoadingComponent]
})
export class LoginPage implements OnInit {

  ngOnInit(): void {
    window.close();
  }

}
