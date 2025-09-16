import { Component, OnDestroy, OnInit } from '@angular/core';
import { AccountService } from '../../service/account.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-user-tag-selector',
  templateUrl: './user-tag-selector.component.html',
  styleUrls: ['./user-tag-selector.component.scss']
})
export class UserTagSelectorComponent implements OnInit, OnDestroy {
  
  selectedTag = '';
  possibleTags: string[] = [];
  customSuffix = '';
  showCustomInput = false;
  autocompleteOptions: string[] = [];

  constructor(
    public store: Store,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    // Initialize selected tag
    this.selectedTag = this.store.account.selectedUserTag;
    
    // Get possible sub tags
    this.updatePossibleTags();
    
    // Setup autocomplete options (this would ideally come from backend)
    this.setupAutocomplete();
  }

  ngOnDestroy() {
    // Nothing to clean up since we're not using observables
  }

  setupAutocomplete() {
    // This would ideally fetch existing sub tags from backend
    // For now, just include the predefined ones
    this.autocompleteOptions = this.store.account.getPossibleSubTags();
  }

  updatePossibleTags() {
    this.possibleTags = this.store.account.getPossibleSubTags();
  }

  onTagChange(event: any) {
    const selectedValue = event.target.value;
    if (selectedValue === 'custom') {
      this.showCustomInput = true;
    } else if (selectedValue) {
      try {
        this.accountService.setSelectedUserTag(selectedValue);
        this.selectedTag = selectedValue;
        this.showCustomInput = false;
      } catch (error: any) {
        alert('Invalid sub tag: ' + error.message);
      }
    } else {
      this.accountService.clearSelectedUserTag();
      this.selectedTag = '';
      this.showCustomInput = false;
    }
  }

  onCustomSubmit() {
    if (this.customSuffix.trim()) {
      const customTag = this.store.account.createCustomSubTag(this.customSuffix.trim());
      if (customTag) {
        try {
          this.accountService.setSelectedUserTag(customTag);
          this.selectedTag = customTag;
          this.customSuffix = '';
          this.showCustomInput = false;
          this.updatePossibleTags();
          this.setupAutocomplete();
        } catch (error: any) {
          alert('Invalid sub tag: ' + error.message);
        }
      }
    }
  }

  cancelCustom() {
    this.customSuffix = '';
    this.showCustomInput = false;
  }

  get currentUserTag(): string {
    return this.store.account.currentUserTag;
  }

  filterAutocomplete(value: string): string[] {
    if (!value) return this.autocompleteOptions;
    return this.autocompleteOptions.filter(option => 
      option.toLowerCase().includes(value.toLowerCase())
    );
  }
}