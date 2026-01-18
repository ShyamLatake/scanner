import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  constructor(
    private http: HttpClient,
    private networkService: NetworkService
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('API Error:', error);
    
    // Get user-friendly error message
    const userMessage = this.networkService.getErrorMessage(error);
    
    // Log detailed error for debugging
    console.error('Detailed error:', {
      message: userMessage,
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      originalError: error.error
    });
    
    return throwError(() => ({
      ...error,
      message: userMessage,
      isNetworkError: this.networkService.isNetworkError(error),
      isServerError: this.networkService.isServerError(error),
      isClientError: this.networkService.isClientError(error)
    }));
  };

  // Generic GET request with retry logic
  get<T>(endpoint: string, retries: number = 2): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(this.DEFAULT_TIMEOUT),
      retry({
        count: retries,
        delay: (error, retryCount) => {
          // Only retry on network or server errors
          if (this.networkService.isNetworkError(error) || this.networkService.isServerError(error)) {
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Max 10s delay
            return new Promise(resolve => setTimeout(resolve, delay));
          }
          throw error;
        }
      }),
      catchError(this.handleError)
    );
  }

  // Generic POST request with retry logic
  post<T>(endpoint: string, data: any, retries: number = 2): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, data, { 
      headers: this.getHeaders() 
    }).pipe(
      timeout(this.DEFAULT_TIMEOUT),
      retry({
        count: retries,
        delay: (error, retryCount) => {
          // Only retry on network or server errors, not client errors
          if (this.networkService.isNetworkError(error) || this.networkService.isServerError(error)) {
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
            return new Promise(resolve => setTimeout(resolve, delay));
          }
          throw error;
        }
      }),
      catchError(this.handleError)
    );
  }

  // File upload with progress tracking (no retry for uploads)
  uploadFiles(endpoint: string, formData: FormData): Observable<HttpEvent<any>> {
    return this.http.post(`${this.baseUrl}${endpoint}`, formData, {
      reportProgress: true,
      observe: 'events',
      timeout: 60000 // 60 seconds for file uploads
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Check API health
  checkHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl.replace('/api', '')}/health`, {
      timeout: 5000 // 5 seconds for health check
    }).pipe(
      catchError(this.handleError)
    );
  }
}
