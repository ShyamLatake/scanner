import { Injectable } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import {
  FaceDetection,
  PerformanceMode,
  LandmarkMode,
  ClassificationMode,
  Face,
  Rect,
} from "@capacitor-mlkit/face-detection";

// Helper to calculate width/height from ML Kit Rect (which uses left/right/top/bottom)
interface NormalizedBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  faceDetected: boolean;
  faceCount: number;
  faceConfidence: number;
  faceInFrame: boolean;
  poseBucket: string | null;
  yaw: number;
  pitch: number;
  quality: number;
}

@Injectable({
  providedIn: "root",
})
export class FaceDetectionService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private frameCounter = 0;

  // Detection thresholds
  private readonly MIN_FACE_CONFIDENCE = 0.5;
  private readonly MIN_FACE_SIZE = 0.08; // 8% of frame area

  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
  }

  /**
   * Check if ML Kit is available (native platform)
   */
  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Load models - No-op for ML Kit (models are bundled natively)
   */
  async loadModels(): Promise<void> {
    // ML Kit models are bundled with the native SDK
    // No loading required
    console.log("✅ ML Kit Face Detection ready (native SDK)");
    return Promise.resolve();
  }

  /**
   * Check if models are loaded - Always true for ML Kit
   */
  isReady(): boolean {
    return this.isNativePlatform();
  }

  /**
   * Analyze video frame for face detection and pose estimation
   * Captures frame from video and processes with ML Kit
   */
  async analyzeFrame(video: HTMLVideoElement): Promise<FaceDetectionResult> {
    // Check platform
    if (!this.isNativePlatform()) {
      console.warn("ML Kit is only available on native platforms");
      return this.createEmptyResult();
    }

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return this.createEmptyResult();
    }

    try {
      // Capture frame and save to file
      const filePath = await this.captureFrameToFile(video);

      // Process with ML Kit
      const result = await FaceDetection.processImage({
        path: filePath,
        performanceMode: PerformanceMode.Fast,
        landmarkMode: LandmarkMode.All,
        classificationMode: ClassificationMode.All,
        minFaceSize: 0.15,
        enableTracking: false,
      });

      // Clean up the temporary file
      try {
        await Filesystem.deleteFile({
          path: "face_frame.jpg",
          directory: Directory.Cache,
        });
      } catch (e) {
        // Ignore cleanup errors
      }

      const faces = result.faces;

      // No faces detected
      if (!faces || faces.length === 0) {
        return {
          faceDetected: false,
          faceCount: 0,
          faceConfidence: 0,
          faceInFrame: false,
          poseBucket: null,
          yaw: 0,
          pitch: 0,
          quality: 0,
        };
      }

      // Multiple faces detected
      if (faces.length > 1) {
        return {
          faceDetected: true,
          faceCount: faces.length,
          faceConfidence: this.calculateConfidence(faces[0]),
          faceInFrame: true,
          poseBucket: null,
          yaw: 0,
          pitch: 0,
          quality: 0,
        };
      }

      // Single face detected
      const face = faces[0];
      const bounds = this.normalizeBounds(face.bounds);

      // Check face size
      const faceArea = bounds.width * bounds.height;
      const frameArea = video.videoWidth * video.videoHeight;
      const sizeRatio = faceArea / frameArea;

      if (sizeRatio < this.MIN_FACE_SIZE) {
        return {
          faceDetected: true,
          faceCount: 1,
          faceConfidence: this.calculateConfidence(face),
          faceInFrame: false,
          poseBucket: null,
          yaw: 0,
          pitch: 0,
          quality: this.calculateConfidence(face) * 0.5,
        };
      }

      // Check if face is within frame
      const faceInFrame = this.checkFaceInFrame(
        bounds,
        video.videoWidth,
        video.videoHeight,
      );

      // Get head pose angles from ML Kit
      const yaw = face.headEulerAngleY ?? 0;
      const pitch = face.headEulerAngleX ?? 0;

      // Calculate quality score
      const quality = this.calculateQuality(
        face,
        video.videoWidth,
        video.videoHeight,
      );

      // Classify pose bucket
      const poseBucket = this.classifyPose(yaw, pitch);

      return {
        faceDetected: true,
        faceCount: 1,
        faceConfidence: this.calculateConfidence(face),
        faceInFrame,
        poseBucket,
        yaw,
        pitch,
        quality,
      };
    } catch (error) {
      console.error("Error in face detection:", error);
      return this.createEmptyResult();
    }
  }

  /**
   * Capture video frame and save to a temporary file
   * Returns the native file path for ML Kit
   */
  private async captureFrameToFile(video: HTMLVideoElement): Promise<string> {
    if (!this.ctx) {
      this.ctx = this.canvas.getContext("2d");
    }

    // Set canvas size to match video
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;

    // Draw video frame to canvas
    this.ctx?.drawImage(video, 0, 0);

    // Get base64 data (without the data URL prefix)
    const dataUrl = this.canvas.toDataURL("image/jpeg", 0.8);
    const base64Data = dataUrl.split(",")[1];

    // Save to cache directory
    const fileName = "face_frame.jpg";
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    // Return the native file URI
    return result.uri;
  }

  /**
   * Calculate confidence score from ML Kit face
   */
  private calculateConfidence(face: Face): number {
    // ML Kit doesn't provide a direct confidence score
    // We use smiling and eye open probabilities as proxy
    let confidence = 0.8; // Base confidence

    if (face.smilingProbability !== undefined) {
      // Adjust based on classification availability
      confidence = Math.max(confidence, 0.9);
    }

    return confidence;
  }

  /**
   * Normalize ML Kit Rect (left/top/right/bottom) to width/height format
   */
  private normalizeBounds(rect: Rect): NormalizedBounds {
    return {
      left: rect.left,
      top: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
    };
  }

  /**
   * Check if face is within frame boundaries with margin
   */
  private checkFaceInFrame(
    bounds: NormalizedBounds,
    frameWidth: number,
    frameHeight: number,
  ): boolean {
    const margin = Math.min(frameWidth, frameHeight) * 0.05; // 5% margin

    return (
      bounds.left >= margin &&
      bounds.top >= margin &&
      bounds.left + bounds.width <= frameWidth - margin &&
      bounds.top + bounds.height <= frameHeight - margin
    );
  }

  /**
   * Calculate comprehensive quality score
   */
  private calculateQuality(
    face: Face,
    frameWidth: number,
    frameHeight: number,
  ): number {
    const bounds = this.normalizeBounds(face.bounds);

    // Confidence score
    const confidenceScore = this.calculateConfidence(face);

    // Face size score (optimal: 15-30% of frame)
    const faceArea = bounds.width * bounds.height;
    const frameArea = frameWidth * frameHeight;
    const sizeRatio = faceArea / frameArea;

    let sizeScore = 0;
    if (sizeRatio >= 0.08 && sizeRatio <= 0.4) {
      const optimal = 0.175;
      sizeScore = 1 - Math.min(1, Math.abs(sizeRatio - optimal) / optimal);
    }

    // Center position score
    const faceCenterX = bounds.left + bounds.width / 2;
    const faceCenterY = bounds.top + bounds.height / 2;
    const idealCenterX = frameWidth / 2;
    const idealCenterY = frameHeight / 2;

    const offsetX = Math.abs(faceCenterX - idealCenterX) / (frameWidth / 2);
    const offsetY = Math.abs(faceCenterY - idealCenterY) / (frameHeight / 2);
    const positionScore = 1 - Math.min(1, (offsetX + offsetY) / 2);

    // Eyes open score (if available)
    let eyesScore = 1;
    if (
      face.leftEyeOpenProbability !== undefined &&
      face.rightEyeOpenProbability !== undefined
    ) {
      eyesScore =
        (face.leftEyeOpenProbability + face.rightEyeOpenProbability) / 2;
    }

    // Combined quality score
    const quality =
      confidenceScore * 0.3 +
      sizeScore * 0.3 +
      positionScore * 0.2 +
      eyesScore * 0.2;

    return Math.min(1, Math.max(0, quality));
  }

  /**
   * Classify pose into required buckets based on yaw and pitch
   */
  private classifyPose(yaw: number, pitch: number): string | null {
    // FRONT pose (center) - most restrictive
    if (yaw >= -10 && yaw <= 10 && pitch >= -8 && pitch <= 8) {
      return "FRONT";
    }

    // LEFT pose (face turned to their left, appears right on camera)
    if (yaw >= -35 && yaw <= -12 && pitch >= -15 && pitch <= 15) {
      return "LEFT";
    }

    // RIGHT pose (face turned to their right, appears left on camera)
    if (yaw >= 12 && yaw <= 35 && pitch >= -15 && pitch <= 15) {
      return "RIGHT";
    }

    // UP pose (looking up)
    if (pitch <= -10 && pitch >= -30 && yaw >= -20 && yaw <= 20) {
      return "UP";
    }

    // DOWN pose (looking down)
    if (pitch >= 10 && pitch <= 30 && yaw >= -20 && yaw <= 20) {
      return "DOWN";
    }

    return null; // Outside valid ranges
  }

  /**
   * Create empty result for invalid states
   */
  private createEmptyResult(): FaceDetectionResult {
    return {
      faceDetected: false,
      faceCount: 0,
      faceConfidence: 0,
      faceInFrame: false,
      poseBucket: null,
      yaw: 0,
      pitch: 0,
      quality: 0,
    };
  }
}
