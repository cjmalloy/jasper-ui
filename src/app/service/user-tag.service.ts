import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Store } from '../store/store';
import { LocalStore } from '../store/local';
import { hasPrefix } from '../util/tag';

@Injectable({
  providedIn: 'root'
})
export class UserTagService {
  private selectedTagSubject = new BehaviorSubject<string>('');
  public selectedTag$ = this.selectedTagSubject.asObservable();

  constructor(
    private store: Store,
    private local: LocalStore,
  ) {
    // Initialize with saved tag from localStorage
    const savedTag = this.local.selectedUserTag;
    if (savedTag && this.isValidSubTag(savedTag)) {
      this.selectedTagSubject.next(savedTag);
    }
  }

  /**
   * Get the current user tag to use in the User-Tag header
   */
  get currentUserTag(): string {
    const selected = this.selectedTagSubject.value;
    if (selected && this.isValidSubTag(selected)) {
      return selected;
    }
    // Fall back to the authenticated user tag
    return this.store.account.tag || '';
  }

  /**
   * Set the selected user tag and save to localStorage
   */
  setSelectedTag(tag: string) {
    if (this.isValidSubTag(tag)) {
      this.selectedTagSubject.next(tag);
      this.local.selectedUserTag = tag;
    } else {
      throw new Error('Invalid sub tag: ' + tag);
    }
  }

  /**
   * Clear the selected tag (fall back to authenticated user tag)
   */
  clearSelectedTag() {
    this.selectedTagSubject.next('');
    this.local.selectedUserTag = '';
  }

  /**
   * Check if a tag is a valid sub tag of the authenticated user
   */
  isValidSubTag(tag: string): boolean {
    if (!tag) return false;
    if (!this.store.account.signedIn) return false;
    
    const userTag = this.store.account.tag;
    if (!userTag) return false;

    // The tag must be the same as user tag or a sub tag of it
    return tag === userTag || hasPrefix(tag, userTag);
  }

  /**
   * Get all possible sub tags for the current user
   */
  getPossibleSubTags(): string[] {
    if (!this.store.account.signedIn) return [];
    
    const baseTag = this.store.account.tag;
    if (!baseTag) return [];

    // Start with the base tag itself
    const subTags = [baseTag];
    
    // Add some common sub tag patterns that users might want to use
    const commonSuffixes = ['admin', 'work', 'personal', 'bot', 'test', 'backup', 'support'];
    for (const suffix of commonSuffixes) {
      subTags.push(`${baseTag}/${suffix}`);
    }

    return subTags;
  }

  /**
   * Create a custom sub tag
   */
  createCustomSubTag(suffix: string): string {
    if (!this.store.account.signedIn) return '';
    
    const baseTag = this.store.account.tag;
    if (!baseTag) return '';
    
    // Clean the suffix - remove any invalid characters
    const cleanSuffix = suffix.replace(/[^a-z0-9.-]/gi, '').toLowerCase();
    if (!cleanSuffix) return '';
    
    return `${baseTag}/${cleanSuffix}`;
  }
}