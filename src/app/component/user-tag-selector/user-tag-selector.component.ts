import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { UserTagService } from '../../service/user-tag.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-user-tag-selector',
  templateUrl: './user-tag-selector.component.html',
  styleUrls: ['./user-tag-selector.component.scss']
})
export class UserTagSelectorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  selectedTag = '';
  possibleTags: string[] = [];
  customSuffix = '';
  showCustomInput = false;

  constructor(
    public store: Store,
    private userTagService: UserTagService,
  ) {}

  ngOnInit() {
    // Subscribe to the selected tag
    this.userTagService.selectedTag$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(tag => {
      this.selectedTag = tag;
    });

    // Get possible sub tags
    this.updatePossibleTags();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updatePossibleTags() {
    this.possibleTags = this.userTagService.getPossibleSubTags();
  }

  onTagChange(event: any) {
    const selectedValue = event.target.value;
    if (selectedValue === 'custom') {
      this.showCustomInput = true;
    } else if (selectedValue) {
      this.userTagService.setSelectedTag(selectedValue);
      this.showCustomInput = false;
    } else {
      this.userTagService.clearSelectedTag();
      this.showCustomInput = false;
    }
  }

  onCustomSubmit() {
    if (this.customSuffix.trim()) {
      const customTag = this.userTagService.createCustomSubTag(this.customSuffix.trim());
      if (customTag) {
        try {
          this.userTagService.setSelectedTag(customTag);
          this.customSuffix = '';
          this.showCustomInput = false;
          this.updatePossibleTags();
        } catch (error) {
          alert('Invalid sub tag: ' + error);
        }
      }
    }
  }

  cancelCustom() {
    this.customSuffix = '';
    this.showCustomInput = false;
  }

  get currentUserTag(): string {
    return this.userTagService.currentUserTag;
  }
}