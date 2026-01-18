import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
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
  camera
} from 'ionicons/icons';
import { CameraService } from '../../services/camera.service';
import { FaceDetectionService, FaceDetectionResult } from '../../services/face-detection.service';

// Pose progress state machine
interface PoseProgress {
  FRONT: boolean;
  LEFT: boolean;
  RIGHT: boolean;
  UP: boolean;
  DOWN: boolean;
}

@Component({
  selector: 'app-camera-capture',
  templateUrl: 'camera-capture.page.html',
  styleUrls: ['camera-capture.page.scss'],
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
export class CameraCapturePage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;

  // Route parameters
  childId: string = '';

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
    DOWN: false
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
    quality: 0
  };

  // UI state
  statusMessage: string = 'Ready to start face capture';
  errorMessage: string = '';

  // Capture control - make public for template access
  readonly MIN_FACE_CONFIDENCE = 0.9;
  readonly MIN_QUALITY_THRESHOLD = 0.85;
  private readonly CAPTURE_COOLDOWN = 2000; // 2 seconds between captures per pose
  private lastCaptureTime: { [key: string]: number } = {};
  private analysisInterval?: any;
  private capturedImages: { [key: string]: string } = {}; // Store captured images

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cameraService: CameraService,
    private faceDetectionService: FaceDetectionService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef
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
      alertCircleOutline
    });
  }

  ngOnInit() {
    // Get childId from route
    const routeChildId = this.route.snapshot.paramMap.get('id');
    if (routeChildId) {
      this.childId = routeChildId;
    }

    console.log('✓ Camera capture initialized for child:', this.childId);
  }

  ngAfterViewInit() {
    // Mark view as initialized
    this.viewInitialized = true;
    this.cdr.detectChanges();
    
    console.log('✓ View initialized, video element available:', !!this.videoElement?.nativeElement);
  }

  ngOnDestroy() {
    this.stopCapture();
  }

  /**
   * Start face capture session
   */
  async startCapture() {
    if (!this.viewInitialized) {
      await this.presentToast('Camera interface not ready. Please wait a moment and try again.', 'warning');
      return;
    }

    // Wait for video element to be available
    const videoAvailable = await this.waitForVideoElement();
    if (!videoAvailable) {
      await this.presentToast('Video element not available. Please try restarting the app.', 'danger');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    
    const loading = await this.loadingController.create({
      message: 'Starting camera...',
    });
    await loading.present();

    try {
      // Check camera permissions
      const permissionCheck = await this.cameraService.checkCameraPermissions();
      
      if (!permissionCheck.granted) {
        throw new Error(permissionCheck.message);
      }

      console.log('Camera permissions OK, starting camera...');
      
      const video = this.videoElement.nativeElement;
      await this.cameraService.startCamera(video);
      
      console.log('Camera started successfully');
      
      this.active = true;
      this.statusMessage = 'Position your face in the circle and look straight ahead';
      
      // Start face detection analysis loop
      this.startAnalysisLoop();

      await loading.dismiss();
      this.isLoading = false;
      this.cdr.detectChanges();
      
      await this.presentToast('Camera started successfully', 'success');
    } catch (error: any) {
      console.error('Error starting camera:', error);
      await loading.dismiss();
      this.isLoading = false;
      this.errorMessage = error.message || 'Failed to start camera';
      this.cdr.detectChanges();
      await this.presentToast(this.errorMessage, 'danger');
    }
  }

  /**
   * Stop capture and clean up
   */
  async stopCapture() {
    if (!this.active) return;

    const alert = await this.alertController.create({
      header: 'Stop Capture',
      message: 'Are you sure you want to stop? Progress will be lost.',
      buttons: [
        {
          text: 'Continue',
          role: 'cancel',
        },
        {
          text: 'Stop',
          role: 'destructive',
          handler: async () => {
            await this.resetCapture();
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Reset capture state
   */
  private async resetCapture() {
    this.active = false;
    this.cameraService.stopCamera();
    this.stopAnalysisLoop();
    
    this.poseProgress = {
      FRONT: false,
      LEFT: false,
      RIGHT: false,
      UP: false,
      DOWN: false
    };
    this.statusMessage = 'Capture stopped';
    this.lastCaptureTime = {};
    this.capturedImages = {};
    
    this.cdr.detectChanges();
    
    await this.presentToast('Capture stopped', 'warning');
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

          // Check if capture is complete
          if (this.isCaptureComplete()) {
            this.onCaptureComplete();
          }

          this.cdr.detectChanges();
        }, 0);

      } catch (error) {
        console.error('Error in analysis loop:', error);
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
    if (!this.currentDetection.faceDetected || this.currentDetection.faceCount === 0) {
      this.statusMessage = 'Position your face in the circular guide';
      return;
    }

    // Single face detected - check quality factors
    if (this.currentDetection.faceCount === 1) {
      // Check face confidence
      if (this.currentDetection.faceConfidence < this.MIN_FACE_CONFIDENCE) {
        const confidencePercent = Math.round(this.currentDetection.faceConfidence * 100);
        this.statusMessage = `Face clarity: ${confidencePercent}%. Move closer and ensure good lighting.`;
        return;
      }

      // Check if face is fully in frame
      if (!this.currentDetection.faceInFrame) {
        this.statusMessage = 'Keep your entire face within the circular guide';
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
        this.statusMessage = 'Adjust your head position to match a pose direction';
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

    this.statusMessage = 'Position your face in the guide and follow the prompts';
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
    if (!this.currentDetection.faceDetected || this.currentDetection.faceConfidence < this.MIN_FACE_CONFIDENCE) return false;
    
    // Face must be fully in frame
    if (!this.currentDetection.faceInFrame) return false;
    
    // Quality must meet threshold
    if (this.currentDetection.quality < this.MIN_QUALITY_THRESHOLD) return false;
    
    // Pose must not already be captured
    if (this.poseProgress[bucket as keyof PoseProgress]) return false;

    // Check cooldown to prevent rapid captures
    const now = Date.now();
    const lastCapture = this.lastCaptureTime[bucket] || 0;
    if (now - lastCapture < this.CAPTURE_COOLDOWN) return false;

    return true;
  }

  /**
   * Capture frame for current pose
   */
  private async capturePoseFrame() {
    const bucket = this.currentDetection.poseBucket!;
    
    try {
      // Capture still frame
      const frameData = this.cameraService.captureFrame();
      
      // Store captured image
      this.capturedImages[bucket] = frameData;
      
      // Mark pose as captured
      this.poseProgress[bucket as keyof PoseProgress] = true;
      this.lastCaptureTime[bucket] = Date.now();
      
      const qualityPercent = Math.round(this.currentDetection.quality * 100);
      await this.presentToast(`${bucket} pose captured! Quality: ${qualityPercent}%`, 'success');
      
      console.log(`✓ Captured ${bucket} pose with quality ${qualityPercent}%`);
      
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Error capturing pose frame:', error);
      this.statusMessage = 'Capture error. Please try again.';
      this.cdr.detectChanges();
    }
  }

  /**
   * Check if capture is complete
   */
  private isCaptureComplete(): boolean {
    return Object.values(this.poseProgress).every(Boolean);
  }

  /**
   * Handle capture completion
   */
  private async onCaptureComplete() {
    this.active = false;
    this.cameraService.stopCamera();
    this.stopAnalysisLoop();
    
    this.statusMessage = 'Face capture complete!';
    this.cdr.detectChanges();
    
    await this.presentToast('All poses captured successfully!', 'success');
    
    console.log('✓ Face capture completed for child:', this.childId);
    console.log('Captured poses:', Object.keys(this.capturedImages));
    
    // Navigate back after a short delay
    setTimeout(() => {
      this.router.navigate(['/home']);
    }, 2000);
  }

  /**
   * Get pose icon name
   */
  getPoseIcon(pose: string): string {
    const icons: { [key: string]: string } = {
      FRONT: 'person-circle-outline',
      LEFT: 'arrow-back-outline',
      RIGHT: 'arrow-forward-outline',
      UP: 'arrow-up-outline',
      DOWN: 'arrow-down-outline'
    };
    return icons[pose] || 'person-circle-outline';
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
  private async presentToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Wait for video element to be available
   */
  private async waitForVideoElement(maxAttempts: number = 10): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      if (this.videoElement && this.videoElement.nativeElement) {
        console.log(`Video element found after ${i + 1} attempts`);
        return true;
      }
      console.log(`Waiting for video element, attempt ${i + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.error('Video element not found after maximum attempts');
    return false;
  }
}