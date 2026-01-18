import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardSubtitle, 
  IonButton, 
  IonIcon,
  IonSearchbar,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  listOutline, 
  personCircleOutline,
  searchOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { ChildService, Child } from '../../services/child.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardSubtitle, 
    IonButton, 
    IonIcon,
    IonSearchbar,
    IonSpinner,
    IonRefresher,
    IonRefresherContent
  ],
})
export class HomePage implements OnInit {
  children: Child[] = [];
  filteredChildren: Child[] = [];
  isLoading = false;
  searchTerm = '';
  totalChildren = 0;

  constructor(
    private router: Router,
    private childService: ChildService,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ 
      listOutline, 
      personCircleOutline,
      searchOutline,
      chevronForwardOutline
    });
  }

  ngOnInit() {
    this.loadChildren();
  }

  async loadChildren(event?: any) {
    if (!event) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }

    this.childService.getChildren({ limit: 10 }).subscribe({
      next: (response) => {
        this.children = response.children;
        this.filteredChildren = response.children;
        this.totalChildren = response.total;
        this.isLoading = false;
        console.log('Children loaded successfully:', this.children);
        
        // Force change detection
        this.cdr.detectChanges();
        
        if (event) {
          event.target.complete();
        }
      },
      error: async (error) => {
        console.error('Error loading children:', error);
        
        this.isLoading = false;
        this.cdr.detectChanges();
        
        if (event) {
          event.target.complete();
        }
        
        // Show error message
        let errorMsg = 'Failed to load children records';
        if (error?.status === 0) {
          errorMsg = 'Cannot connect to server. Check your internet connection.';
        } else if (error?.status === 404) {
          errorMsg = 'API endpoint not found';
        } else if (error?.status >= 500) {
          errorMsg = 'Server error. Please try again later.';
        } else if (error?.message) {
          errorMsg = error.message;
        }
        
        await this.presentToast(errorMsg, 'danger');
      }
    });
  }

  handleSearch(event: any) {
    const query = event.target.value.toLowerCase();
    this.searchTerm = query;

    if (!query.trim()) {
      this.filteredChildren = this.children;
      return;
    }

    this.filteredChildren = this.children.filter(child => {
      return (
        child.child_name.toLowerCase().includes(query) ||
        (child.child_last_name && child.child_last_name.toLowerCase().includes(query)) ||
        (child.student_ref_Id && child.student_ref_Id.toLowerCase().includes(query)) ||
        (child.standard && child.standard.toLowerCase().includes(query)) ||
        (child.division && child.division.toLowerCase().includes(query))
      );
    });
  }

  getFullName(child: Child): string {
    return this.childService.getFullName(child);
  }

  getAge(child: Child): number {
    return this.childService.getAge(child);
  }

  navigateToChild(child: Child) {
    this.router.navigate(['/camera-capture', child.id]);
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
