import { Component, OnInit } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginPage implements OnInit {

  constructor() { }

  ngOnInit(): void {
    window.close();
  }

}
