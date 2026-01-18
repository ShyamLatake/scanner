import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public isOnline$ = this.isOnlineSubject.asObservable();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnlineSubject.next(true);
    });

    window.addEventListener('offline', () => {
      this.isOnlineSubject.next(false);
    });
  }

  get isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  /**
   * Retry function with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = baseDelay * Math.pow(2, attempt);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is network-related
   */
  isNetworkError(error: any): boolean {
    return (
      !this.isOnline ||
      error.status === 0 ||
      error.code === 'NETWORK_ERROR' ||
      error.message?.includes('Network Error') ||
      error.name === 'NetworkError'
    );
  }

  /**
   * Check if error is server-related (5xx)
   */
  isServerError(error: any): boolean {
    return error.status >= 500 && error.status < 600;
  }

  /**
   * Check if error is client-related (4xx)
   */
  isClientError(error: any): boolean {
    return error.status >= 400 && error.status < 500;
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error: any): string {
    if (!this.isOnline) {
      return 'No internet connection. Please check your network.';
    }

    if (this.isNetworkError(error)) {
      return 'Network error. Please check your connection.';
    }

    if (this.isServerError(error)) {
      return 'Server error. Please try again later.';
    }

    if (error.status === 404) {
      return 'Service not found. Please contact support.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'Authentication error. Please restart the app.';
    }

    if (error.status === 429) {
      return 'Too many requests. Please wait a moment.';
    }

    return error.message || 'An unexpected error occurred.';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}