import { Component, OnInit } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginPage implements OnInit {

  ngOnInit(): void {
    window.close();
  }

}
