import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonButton, IonIcon, IonButtons } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refresh, videocam, trash } from 'ionicons/icons';
import { StorageService } from '../../services/storage.service';
import { MediaItem } from '../../models/child-record.interface';

@Component({
  selector: 'app-media-preview',
  templateUrl: './media-preview.component.html',
  styleUrls: ['./media-preview.component.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonButton, IonIcon, IonButtons],
})
export class MediaPreviewComponent implements OnInit {
  recordId: string = '';
  media: MediaItem[] = [];

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService
  ) {
    addIcons({ refresh, videocam, trash });
  }

  ngOnInit() {
    this.recordId = this.route.snapshot.paramMap.get('id') || '';
    this.loadMedia();
  }

  loadMedia() {
    this.storageService.media$.subscribe(allMedia => {
      this.media = allMedia.filter(m => m.recordId === this.recordId);
    });
  }

  removeMedia(index: number) {
    const allMedia = this.storageService.getMedia();
    const recordMedia = allMedia.filter(m => m.recordId === this.recordId);
    const globalIndex = allMedia.indexOf(recordMedia[index]);
    if (globalIndex !== -1) {
      this.storageService.removeMedia(globalIndex);
    }
  }
}
