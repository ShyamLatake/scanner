import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ChildRecord } from '../models/child-record.interface';

@Injectable({
  providedIn: 'root'
})
export class RecordService {
  constructor(private apiService: ApiService) {}

  createRecord(record: Omit<ChildRecord, 'createdAt' | 'updatedAt'>): Observable<ChildRecord> {
    return this.apiService.post<ChildRecord>('/records', record);
  }

  getRecords(): Observable<ChildRecord[]> {
    return this.apiService.get<ChildRecord[]>('/records');
  }

  getRecordById(id: string): Observable<ChildRecord> {
    return this.apiService.get<ChildRecord>(`/records/${id}`);
  }

  getRecordByChildId(childId: string): Observable<ChildRecord> {
    return this.apiService.get<ChildRecord>(`/records/child/${childId}`);
  }
}
