import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { debounce, defer } from 'lodash-es';
import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AccountService } from '../../service/account.service';
import { EditorService } from '../../service/editor.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-user-tag-selector',
  templateUrl: './user-tag-selector.component.html',
  styleUrls: ['./user-tag-selector.component.scss']
})
export class UserTagSelectorComponent implements OnInit, OnDestroy {
  
  listId = 'user-tag-list-' + uuid();
  preview = '';
  editing = false;
  autocomplete: { value: string, label: string }[] = [];
  
  private showedError = false;
  private searching?: Subscription;

  constructor(
    public store: Store,
    private accountService: AccountService,
    private editor: EditorService,
    private configs: ConfigService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // Initialize preview with current tag
    const currentTag = this.store.account.currentUserTag;
    if (currentTag) {
      this.getPreview(currentTag);
    }
    
    // Setup initial autocomplete options
    this.setupAutocomplete();
  }

  ngOnDestroy() {
    this.searching?.unsubscribe();
  }

  setupAutocomplete() {
    // Get predefined sub tags as autocomplete options
    const possibleTags = this.store.account.getPossibleSubTags();
    this.autocomplete = possibleTags.map(tag => ({
      value: tag,
      label: tag === this.store.account.originalRoles?.tag || tag === this.store.account.tag ? 
        'Default (' + tag + ')' : tag
    }));
  }

  get currentValue(): string {
    return this.store.account.selectedUserTag || this.store.account.originalRoles?.tag || this.store.account.tag || '';
  }

  getPreview(value: string) {
    if (!value) {
      this.preview = '';
      return;
    }
    
    // For the default tag, show "Default"
    if (value === this.store.account.originalRoles?.tag || value === this.store.account.tag) {
      this.preview = 'Default (' + value + ')';
    } else {
      // For sub tags, just show the tag
      this.preview = value;
    }
    this.cd.detectChanges();
  }

  edit(input: HTMLInputElement) {
    this.editing = true;
    this.preview = '';
    input.focus();
  }

  clickPreview(input: HTMLInputElement) {
    if (this.store.hotkey) {
      window.open(this.configs.base + 'tag/' + input.value);
    } else {
      this.edit(input);
    }
  }

  blur(input: HTMLInputElement) {
    this.editing = false;
    const value = input.value.trim();
    
    if (value) {
      try {
        if (value === this.store.account.originalRoles?.tag || value === this.store.account.tag) {
          // If they enter the original tag, clear selection to use default
          this.accountService.clearSelectedUserTag();
        } else {
          // Set the selected tag
          this.accountService.setSelectedUserTag(value);
        }
        this.getPreview(this.currentValue);
      } catch (error: any) {
        // Invalid tag, show error
        input.setCustomValidity('Invalid user sub tag: ' + error.message);
        input.reportValidity();
        // Reset to current value
        defer(() => {
          input.value = this.currentValue;
          this.getPreview(this.currentValue);
        });
      }
    } else {
      // Empty value means use default
      this.accountService.clearSelectedUserTag();
      this.getPreview(this.currentValue);
    }
  }

  search = debounce((value: string) => {
    // Get base autocomplete options
    this.setupAutocomplete();
    
    // Filter based on input
    if (value) {
      this.autocomplete = this.autocomplete.filter(option => 
        option.value.toLowerCase().includes(value.toLowerCase()) ||
        option.label.toLowerCase().includes(value.toLowerCase())
      );
    }
    
    // Add common suffix suggestions if they're typing a sub tag
    const baseTag = this.store.account.originalRoles?.tag || this.store.account.tag;
    if (baseTag && value.startsWith(baseTag + '/')) {
      const suffix = value.substring(baseTag.length + 1);
      const commonSuffixes = ['admin', 'work', 'personal', 'bot', 'test', 'backup', 'support'];
      
      for (const commonSuffix of commonSuffixes) {
        if (commonSuffix.startsWith(suffix)) {
          const suggestedTag = baseTag + '/' + commonSuffix;
          if (!this.autocomplete.find(opt => opt.value === suggestedTag)) {
            this.autocomplete.push({
              value: suggestedTag,
              label: suggestedTag
            });
          }
        }
      }
    }
    
    this.cd.detectChanges();
  }, 300);

  get currentUserTag(): string {
    return this.store.account.currentUserTag;
  }
}