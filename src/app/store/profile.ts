import { inject, Injectable } from '@angular/core';
import { Profile, ProfilePageArgs } from '../model/profile';
import { ProfileService } from '../service/api/profile.service';
import { PageStore } from '../util/page-store';

@Injectable({
  providedIn: 'root'
})
export class ProfileStore extends PageStore<ProfilePageArgs, Profile> {
  private profiles = inject(ProfileService);

  protected load(args: ProfilePageArgs) {
    return this.profiles.page(args);
  }
}
