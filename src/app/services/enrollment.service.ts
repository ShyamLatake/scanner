import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";
import { environment } from "../../environments/environment";

export interface EnrollmentSession {
  sessionId: string;
  childId: string;
  requiredPoses: string[];
  status: "active" | "completed" | "cancelled" | "expired";
  progress: number;
  capturedPoses: string[];
}

export interface FrameUploadResult {
  success: boolean;
  accepted: boolean;
  pose: string;
  progress: number;
  completed: boolean;
  quality?: number;
  message: string;
}

export interface InitEnrollmentRequest {
  childId: string;
  name?: string;
}

export interface InitEnrollmentResponse {
  success: boolean;
  sessionId: string;
  message: string;
}

export interface FrameUploadRequest {
  sessionId: string;
  childId: string;
  pose: string;
  quality: number;
  image: string; // Base64 encoded image
}

@Injectable({
  providedIn: "root",
})
export class EnrollmentService {
  private readonly API_BASE_URL = environment.apiUrl || "http://localhost:3000";
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  constructor(private http: HttpClient) {}

  /**
   * PHASE 1 & 2: Initialize enrollment session
   */
  initializeEnrollment(
    request: InitEnrollmentRequest,
  ): Observable<InitEnrollmentResponse> {
    const url = `${this.API_BASE_URL}/start-enrollment`;

    const headers = new HttpHeaders({
      "Content-Type": "application/json",
    });

    console.log("🚀 Initializing enrollment session:", request);

    return this.http
      .post<InitEnrollmentResponse>(url, request, { headers })
      .pipe(timeout(this.REQUEST_TIMEOUT), catchError(this.handleError));
  }

  /**
   * PHASE 5 & 6: Upload captured frame
   */
  uploadFrame(request: FrameUploadRequest): Observable<FrameUploadResult> {
    const url = `${this.API_BASE_URL}/enroll-frame`;

    const formData = new FormData();

    // Convert base64 to blob
    const base64Data = request.image.replace(/^data:image\/[a-z]+;base64,/, "");
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/jpeg" });

    formData.append(
      "image",
      blob,
      `${request.pose.toLowerCase()}_${Date.now()}.jpg`,
    );
    formData.append("sessionId", request.sessionId);
    formData.append("poseBucket", request.pose);
    formData.append("quality", request.quality.toString());

    console.log(`📤 Uploading ${request.pose} frame:`, {
      sessionId: request.sessionId,
      pose: request.pose,
      quality: request.quality,
      imageSize: blob.size,
    });

    return this.http
      .post<FrameUploadResult>(url, formData)
      .pipe(timeout(this.REQUEST_TIMEOUT), catchError(this.handleError));
  }

  /**
   * Get enrollment session status
   */
  getEnrollmentStatus(sessionId: string): Observable<EnrollmentSession> {
    const url = `${this.API_BASE_URL}/enrollment-status/${sessionId}`;

    return this.http
      .get<EnrollmentSession>(url)
      .pipe(timeout(this.REQUEST_TIMEOUT), catchError(this.handleError));
  }

  /**
   * PHASE 11: Complete enrollment session
   */
  completeEnrollment(
    sessionId: string,
  ): Observable<{ success: boolean; message: string }> {
    const url = `${this.API_BASE_URL}/complete`;

    const headers = new HttpHeaders({
      "Content-Type": "application/json",
    });

    const body = { sessionId };

    console.log("✅ Completing enrollment session:", sessionId);

    return this.http
      .post<{ success: boolean; message: string }>(url, body, { headers })
      .pipe(timeout(this.REQUEST_TIMEOUT), catchError(this.handleError));
  }

  /**
   * Cancel enrollment session
   */
  cancelEnrollment(
    sessionId: string,
  ): Observable<{ success: boolean; message: string }> {
    const url = `${this.API_BASE_URL}/cancel-enrollment`;

    const headers = new HttpHeaders({
      "Content-Type": "application/json",
    });

    const body = { sessionId };

    console.log("❌ Cancelling enrollment session:", sessionId);

    return this.http
      .post<{ success: boolean; message: string }>(url, body, { headers })
      .pipe(timeout(this.REQUEST_TIMEOUT), catchError(this.handleError));
  }

  /**
   * Get child embeddings
   */
  getChildEmbeddings(childId: string): Observable<any> {
    const url = `${this.API_BASE_URL}/child/${childId}/embeddings`;

    return this.http
      .get(url)
      .pipe(timeout(this.REQUEST_TIMEOUT), catchError(this.handleError));
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    console.error("❌ Enrollment service error:", error);

    let errorMessage = "An unexpected error occurred";

    if (error.name === "TimeoutError") {
      errorMessage =
        "Request timed out. Please check your connection and try again.";
    } else if (error.status === 0) {
      errorMessage =
        "Unable to connect to server. Please check your internet connection.";
    } else if (error.status >= 400 && error.status < 500) {
      errorMessage =
        error.error?.message || error.message || "Client error occurred";
    } else if (error.status >= 500) {
      errorMessage = "Server error occurred. Please try again later.";
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  };
}
