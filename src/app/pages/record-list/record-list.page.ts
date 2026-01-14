import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoadingController, ToastController, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonButtons, IonIcon, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, chevronForwardOutline } from 'ionicons/icons';
import { RecordService } from '../../services/record.service';
import { ChildRecord } from '../../models/child-record.interface';

@Component({
  selector: 'app-record-list',
  templateUrl: 'record-list.page.html',
  styleUrls: ['record-list.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButton, IonButtons, IonIcon, IonRefresher, IonRefresherContent, IonSpinner],
})
export class RecordListPage implements OnInit {
  records: ChildRecord[] = [];
  isLoading = false;

  constructor(
    private recordService: RecordService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    addIcons({ add, chevronForwardOutline });
  }

  ngOnInit() {
    this.loadRecords();
  }

  ionViewWillEnter() {
    this.loadRecords();
  }

  async loadRecords() {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Loading records...'
    });
    await loading.present();

    this.recordService.getRecords().subscribe({
      next: (records) => {
        this.records = records;
        this.isLoading = false;
        loading.dismiss();
      },
      error: async (error) => {
        console.error('Error loading records:', error);
        this.isLoading = false;
        await loading.dismiss();
        const toast = await this.toastController.create({
          message: 'Failed to load records',
          duration: 2000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }

  navigateToRecordDetail(record: ChildRecord) {
    const recordId = record.id || record.child_id;
    if (recordId) {
      this.router.navigate(['/record-detail', recordId]);
    }
  }

  navigateToCreateRecord() {
    this.router.navigate(['/record-form']);
  }

  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.status === 0) {
      return 'Network error. Please check your connection.';
    }
    if (error?.status >= 500) {
      return 'Server error. Please try again later.';
    }
    return 'Failed to load records. Please try again.';
  }
}
