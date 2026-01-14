import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MediaItem } from '../models/child-record.interface';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private capturedMedia: MediaItem[] = [];
  private mediaSubject = new BehaviorSubject<MediaItem[]>([]);
  public media$: Observable<MediaItem[]> = this.mediaSubject.asObservable();

  constructor() {}

  addMedia(media: MediaItem): void {
    this.capturedMedia.push(media);
    this.mediaSubject.next([...this.capturedMedia]);
  }

  removeMedia(index: number): void {
    this.capturedMedia.splice(index, 1);
    this.mediaSubject.next([...this.capturedMedia]);
  }

  clearMedia(): void {
    this.capturedMedia = [];
    this.mediaSubject.next([]);
  }

  getMedia(): MediaItem[] {
    return [...this.capturedMedia];
  }

  setMediaForRecord(recordId: string): void {
    this.capturedMedia.forEach(media => {
      media.recordId = recordId;
    });
  }
}
