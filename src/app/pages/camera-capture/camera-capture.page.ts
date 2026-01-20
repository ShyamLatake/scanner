import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ChangeDetectorRef,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  ToastController,
  LoadingController,
  AlertController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonButton,
  ViewWillLeave,
} from "@ionic/angular/standalone";
import { addIcons } from "ionicons";

import {
  cameraOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  checkmarkCircle,
  personCircleOutline,
  arrowUpOutline,
  arrowDownOutline,
  arrowForwardOutline,
  arrowBackOutline,
  stopCircleOutline,
  personOutline,
  peopleOutline,
  warningOutline,
  ellipsisVertical,
  shieldCheckmark,
  bulb,
  arrowForward,
  lockClosed,
  scanCircleOutline,
  informationCircle,
  informationCircleOutline,
  alertCircleOutline,
  camera,
} from "ionicons/icons";
import { CameraService } from "../../services/camera.service";
import {
  FaceDetectionService,
  FaceDetectionResult,
} from "../../services/face-detection.service";
import {
  EnrollmentService,
  EnrollmentSession,
  FrameUploadResult,
} from "../../services/enrollment.service";

// Pose progress state machine
interface PoseProgress {
  FRONT: boolean;
  LEFT: boolean;
  RIGHT: boolean;
  UP: boolean;
  DOWN: boolean;
}

@Component({
  selector: "app-camera-capture",
  templateUrl: "camera-capture.page.html",
  styleUrls: ["camera-capture.page.scss"],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonButtons,
    IonBackButton,
    IonButton,
  ],
})
export class CameraCapturePage
  implements OnInit, OnDestroy, AfterViewInit, ViewWillLeave
{
  @ViewChild("videoElement", { static: false })
  videoElement!: ElementRef<HTMLVideoElement>;

  // Route parameters
  childId: string = "";

  // Enrollment session state
  enrollmentSession: EnrollmentSession | null = null;
  sessionId: string = "";

  // Camera state
  active: boolean = false;
  viewInitialized: boolean = false;
  isLoading: boolean = false;

  // Pose progress state machine
  poseProgress: PoseProgress = {
    FRONT: false,
    LEFT: false,
    RIGHT: false,
    UP: false,
    DOWN: false,
  };

  // Current detection result
  currentDetection: FaceDetectionResult = {
    faceDetected: false,
    faceCount: 0,
    faceConfidence: 0,
    faceInFrame: false,
    poseBucket: null,
    yaw: 0,
    pitch: 0,
    quality: 0,
  };

  // UI state
  statusMessage: string = "Ready to start face capture";
  errorMessage: string = "";

  // Capture control - make public for template access
  readonly MIN_FACE_CONFIDENCE = 0.9;
  readonly MIN_QUALITY_THRESHOLD = 0.85;
  private readonly CAPTURE_COOLDOWN = 2000; // 2 seconds between captures per pose
  private lastCaptureTime: { [key: string]: number } = {};
  private analysisInterval?: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cameraService: CameraService,
    private faceDetectionService: FaceDetectionService,
    private enrollmentService: EnrollmentService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef,
  ) {
    addIcons({
      cameraOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      checkmarkCircle,
      personCircleOutline,
      arrowUpOutline,
      arrowDownOutline,
      arrowForwardOutline,
      arrowBackOutline,
      stopCircleOutline,
      personOutline,
      peopleOutline,
      warningOutline,
      ellipsisVertical,
      shieldCheckmark,
      bulb,
      arrowForward,
      camera,
      lockClosed,
      scanCircleOutline,
      informationCircle,
      informationCircleOutline,
      alertCircleOutline,
    });
  }

  async ngOnInit() {
    // Get childId from route
    const routeChildId = this.route.snapshot.paramMap.get("id");
    if (routeChildId) {
      this.childId = routeChildId;
    }

    console.log("✓ Camera capture initialized for child:", this.childId);

    // Check if ML Kit is available (native platform only)
    if (this.faceDetectionService.isReady()) {
      console.log("✅ ML Kit Face Detection ready");
    } else {
      console.warn("⚠️ ML Kit not available - running on web platform");
    }
  }

  ngAfterViewInit() {
    // Mark view as initialized
    this.viewInitialized = true;
    this.cdr.detectChanges();

    console.log(
      "✓ View initialized, video element available:",
      !!this.videoElement?.nativeElement,
    );
  }

  ngOnDestroy() {
    console.log("🧹 Component destroying, cleaning up resources");
    this.cleanupCapture();
  }

  ionViewWillLeave() {
    console.log("🔙 User navigating away, cleaning up capture");
    this.cleanupCapture();
  }

  /**
   * Clean up capture resources when component is destroyed
   */
  private async cleanupCapture() {
    // Stop camera and analysis
    if (this.active) {
      this.active = false;
      this.cameraService.stopCamera();
      this.stopAnalysisLoop();
    }

    // Cancel enrollment session if exists
    if (this.sessionId) {
      try {
        await this.enrollmentService
          .cancelEnrollment(this.sessionId)
          .toPromise();
        console.log("✓ Enrollment session cancelled on navigation back");
      } catch (error) {
        console.error("Error cancelling enrollment session on cleanup:", error);
      }
    }

    // Reset state
    this.sessionId = "";
    this.enrollmentSession = null;
    this.poseProgress = {
      FRONT: false,
      LEFT: false,
      RIGHT: false,
      UP: false,
      DOWN: false,
    };
    this.lastCaptureTime = {};
  }

  /**
   * PHASE 1: Start face capture session with backend integration
   */
  async startCapture() {
    if (!this.viewInitialized) {
      await this.presentToast(
        "Camera interface not ready. Please wait a moment and try again.",
        "warning",
      );
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    const loading = await this.loadingController.create({
      message: "Initializing enrollment...",
    });
    await loading.present();

    try {
      // PHASE 1 & 2: Initialize enrollment session with backend
      console.log("🚀 PHASE 1: Initializing enrollment session");

      const initResponse = await this.enrollmentService
        .initializeEnrollment({
          childId: this.childId,
          name: `Child ${this.childId}`,
        })
        .toPromise();

      if (!initResponse?.success) {
        throw new Error("Failed to initialize enrollment session");
      }

      this.sessionId = initResponse.sessionId;
      console.log("✓ PHASE 2: Enrollment session created:", this.sessionId);

      // Update loading message
      loading.message = "Starting camera...";

      // Wait for video element to be available
      const videoAvailable = await this.waitForVideoElement();
      if (!videoAvailable) {
        throw new Error(
          "Video element not available. Please try restarting the app.",
        );
      }

      // Check camera permissions
      const permissionCheck = await this.cameraService.checkCameraPermissions();

      if (!permissionCheck.granted) {
        throw new Error(permissionCheck.message);
      }

      console.log("📷 PHASE 3: Starting camera");

      const video = this.videoElement.nativeElement;
      await this.cameraService.startCamera(video);

      console.log("✓ Camera started successfully");

      this.active = true;
      this.statusMessage =
        "Position your face in the circle and look straight ahead";

      // PHASE 3: Start face detection analysis loop
      this.startAnalysisLoop();

      await loading.dismiss();
      this.isLoading = false;
      this.cdr.detectChanges();

      await this.presentToast(
        "Enrollment session started successfully",
        "success",
      );
    } catch (error: any) {
      console.error("❌ Error starting enrollment:", error);
      await loading.dismiss();
      this.isLoading = false;
      this.errorMessage = error.message || "Failed to start enrollment";
      this.cdr.detectChanges();
      await this.presentToast(this.errorMessage, "danger");
    }
  }

  /**
   * Stop capture and clean up
   */
  async stopCapture() {
    if (!this.active) return;

    const alert = await this.alertController.create({
      header: "Stop Capture",
      message: "Are you sure you want to stop? Progress will be lost.",
      buttons: [
        {
          text: "Continue",
          role: "cancel",
        },
        {
          text: "Stop",
          role: "destructive",
          handler: async () => {
            await this.resetCapture();
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Reset capture state and cancel enrollment session
   */
  private async resetCapture() {
    this.active = false;
    this.cameraService.stopCamera();
    this.stopAnalysisLoop();

    // Cancel enrollment session if exists
    if (this.sessionId) {
      try {
        await this.enrollmentService
          .cancelEnrollment(this.sessionId)
          .toPromise();
        console.log("✓ Enrollment session cancelled");
      } catch (error) {
        console.error("Error cancelling enrollment session:", error);
      }
    }

    this.poseProgress = {
      FRONT: false,
      LEFT: false,
      RIGHT: false,
      UP: false,
      DOWN: false,
    };
    this.statusMessage = "Enrollment cancelled";
    this.lastCaptureTime = {};
    this.sessionId = "";
    this.enrollmentSession = null;

    this.cdr.detectChanges();

    await this.presentToast("Enrollment cancelled", "warning");
  }

  /**
   * Start face detection analysis loop
   */
  private startAnalysisLoop() {
    if (!this.active) return;

    this.analysisInterval = setInterval(async () => {
      if (!this.active) return;

      try {
        const video = this.cameraService.getVideo();
        if (!video) return;

        // Analyze current frame
        const detection = await this.faceDetectionService.analyzeFrame(video);

        // Update detection result asynchronously to avoid change detection issues
        setTimeout(() => {
          if (!this.active) return;

          this.currentDetection = detection;
          this.updateStatusMessage();

          // Check if we should capture this pose
          if (this.shouldCapturePose()) {
            this.capturePoseFrame();
          }

          this.cdr.detectChanges();
        }, 0);
      } catch (error) {
        console.error("Error in analysis loop:", error);
      }
    }, 100); // 10 FPS analysis
  }

  /**
   * Stop analysis loop
   */
  private stopAnalysisLoop() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
  }

  /**
   * Update status message based on detection result
   */
  private updateStatusMessage() {
    // Check for multiple faces
    if (this.currentDetection.faceCount > 1) {
      this.statusMessage = `${this.currentDetection.faceCount} faces detected. Please ensure only one person is in the camera view.`;
      return;
    }

    // Check for no face
    if (
      !this.currentDetection.faceDetected ||
      this.currentDetection.faceCount === 0
    ) {
      this.statusMessage = "Position your face in the circular guide";
      return;
    }

    // Single face detected - check quality factors
    if (this.currentDetection.faceCount === 1) {
      // Check face confidence
      if (this.currentDetection.faceConfidence < this.MIN_FACE_CONFIDENCE) {
        const confidencePercent = Math.round(
          this.currentDetection.faceConfidence * 100,
        );
        this.statusMessage = `Face clarity: ${confidencePercent}%. Move closer and ensure good lighting.`;
        return;
      }

      // Check if face is fully in frame
      if (!this.currentDetection.faceInFrame) {
        this.statusMessage = "Keep your entire face within the circular guide";
        return;
      }

      // Check quality threshold
      if (this.currentDetection.quality < this.MIN_QUALITY_THRESHOLD) {
        const qualityPercent = Math.round(this.currentDetection.quality * 100);
        this.statusMessage = `Image quality: ${qualityPercent}%. Improve lighting and focus.`;
        return;
      }

      // Check if pose bucket is detected
      if (!this.currentDetection.poseBucket) {
        this.statusMessage =
          "Adjust your head position to match a pose direction";
        return;
      }

      const bucket = this.currentDetection.poseBucket;

      // Check if pose already captured
      if (this.poseProgress[bucket as keyof PoseProgress]) {
        this.statusMessage = `✓ ${bucket} pose completed. Try another direction.`;
        return;
      }

      // Ready to capture
      const qualityPercent = Math.round(this.currentDetection.quality * 100);
      this.statusMessage = `Perfect! Hold steady for ${bucket} pose (${qualityPercent}% quality)`;
      return;
    }

    this.statusMessage =
      "Position your face in the guide and follow the prompts";
  }

  /**
   * Check if we should capture the current pose
   */
  shouldCapturePose(): boolean {
    const bucket = this.currentDetection.poseBucket;

    // Must have exactly one face
    if (this.currentDetection.faceCount !== 1) return false;

    // Must have valid bucket
    if (!bucket) return false;

    // Face must be detected with high confidence
    if (
      !this.currentDetection.faceDetected ||
      this.currentDetection.faceConfidence < this.MIN_FACE_CONFIDENCE
    )
      return false;

    // Face must be fully in frame
    if (!this.currentDetection.faceInFrame) return false;

    // Quality must meet threshold
    if (this.currentDetection.quality < this.MIN_QUALITY_THRESHOLD)
      return false;

    // Pose must not already be captured
    if (this.poseProgress[bucket as keyof PoseProgress]) return false;

    // Check cooldown to prevent rapid captures
    const now = Date.now();
    const lastCapture = this.lastCaptureTime[bucket] || 0;
    if (now - lastCapture < this.CAPTURE_COOLDOWN) return false;

    return true;
  }

  /**
   * PHASE 4 & 5: Capture frame for current pose and upload to backend
   */
  private async capturePoseFrame() {
    const bucket = this.currentDetection.poseBucket!;

    try {
      console.log(`📸 PHASE 4: Capturing ${bucket} pose frame`);

      // Capture still frame
      const frameData = this.cameraService.captureFrame();

      // Temporarily disable capture for this pose to prevent duplicates
      this.lastCaptureTime[bucket] = Date.now();

      console.log(`📤 PHASE 5: Uploading ${bucket} frame to backend`);

      // Upload to backend
      const uploadResult = await this.enrollmentService
        .uploadFrame({
          sessionId: this.sessionId,
          childId: this.childId,
          pose: bucket,
          quality: this.currentDetection.quality,
          image: frameData,
        })
        .toPromise();

      if (!uploadResult?.success) {
        throw new Error(uploadResult?.message || "Upload failed");
      }

      if (!uploadResult.accepted) {
        // Frame was rejected by backend
        console.log(`❌ ${bucket} frame rejected:`, uploadResult.message);
        await this.presentToast(uploadResult.message, "warning");
        return;
      }

      console.log(`✅ PHASE 6-8: ${bucket} pose processed successfully`);

      // PHASE 9: Mark pose as captured
      this.poseProgress[bucket as keyof PoseProgress] = true;

      const qualityPercent = Math.round(
        (uploadResult.quality || this.currentDetection.quality) * 100,
      );
      await this.presentToast(
        `${bucket} pose captured! Quality: ${qualityPercent}%`,
        "success",
      );

      console.log(
        `✓ ${bucket} pose completed. Progress: ${uploadResult.progress}%`,
      );

      // PHASE 10 & 11: Check if enrollment is complete
      if (uploadResult.completed) {
        console.log("🎉 PHASE 11: All poses captured, completing enrollment");
        await this.onEnrollmentComplete();
      }

      this.cdr.detectChanges();
    } catch (error: any) {
      console.error(`❌ Error capturing ${bucket} pose:`, error);
      this.statusMessage = `Upload failed for ${bucket} pose. Please try again.`;
      await this.presentToast(
        error.message || "Capture failed. Please try again.",
        "danger",
      );
      this.cdr.detectChanges();
    }
  }

  /**
   * PHASE 11 & 12: Handle enrollment completion
   */
  private async onEnrollmentComplete() {
    this.active = false;
    this.cameraService.stopCamera();
    this.stopAnalysisLoop();

    this.statusMessage = "Enrollment completed successfully!";
    this.cdr.detectChanges();

    try {
      // Notify backend of completion
      if (this.sessionId) {
        await this.enrollmentService
          .completeEnrollment(this.sessionId)
          .toPromise();
        console.log("✅ PHASE 12: Backend notified of completion");
      }
    } catch (error) {
      console.error("Error notifying backend of completion:", error);
      // Don't fail the whole process if backend notification fails
    }

    await this.presentToast(
      "All poses captured successfully! Enrollment complete.",
      "success",
    );

    console.log("🎉 Face enrollment completed for child:", this.childId);
    console.log(
      "Captured poses:",
      Object.keys(this.poseProgress).filter(
        (key) => this.poseProgress[key as keyof PoseProgress],
      ),
    );

    // Navigate back after a short delay
    setTimeout(() => {
      this.router.navigate(["/home"]);
    }, 2000);
  }

  /**
   * Check if capture is complete (updated to use backend progress)
   */
  private isCaptureComplete(): boolean {
    return Object.values(this.poseProgress).every(Boolean);
  }

  /**
   * Get pose icon name
   */
  getPoseIcon(pose: string): string {
    const icons: { [key: string]: string } = {
      FRONT: "person-circle-outline",
      LEFT: "arrow-back-outline",
      RIGHT: "arrow-forward-outline",
      UP: "arrow-up-outline",
      DOWN: "arrow-down-outline",
    };
    return icons[pose] || "person-circle-outline";
  }

  /**
   * Get completion percentage
   */
  get completionPercentage(): number {
    const completed = Object.values(this.poseProgress).filter(Boolean).length;
    return (completed / 5) * 100;
  }

  /**
   * Present toast message
   */
  private async presentToast(
    message: string,
    color: "success" | "warning" | "danger" = "success",
  ) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: "bottom",
    });
    await toast.present();
  }

  /**
   * Wait for video element to be available
   */
  private async waitForVideoElement(
    maxAttempts: number = 10,
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      if (this.videoElement && this.videoElement.nativeElement) {
        console.log(`Video element found after ${i + 1} attempts`);
        return true;
      }
      console.log(`Waiting for video element, attempt ${i + 1}/${maxAttempts}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    console.error("Video element not found after maximum attempts");
    return false;
  }
}
