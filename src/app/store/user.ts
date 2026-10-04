import { Injectable, inject } from '@angular/core';
import { User } from '../model/user';
import { TagPageArgs } from '../model/tag';
import { UserService } from '../service/api/user.service';
import { PageStore } from '../util/page-store';

@Injectable({
  providedIn: 'root'
})
export class UserStore extends PageStore<TagPageArgs, User> {
  private users = inject(UserService);

  protected load(args: TagPageArgs) {
    return this.users.page(args);
  }
}
