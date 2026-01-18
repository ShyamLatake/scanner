import { Injectable } from '@angular/core';

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
  providedIn: 'root'
})
export class FaceDetectionService {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  
  // Detection thresholds
  private readonly MIN_FACE_CONFIDENCE = 0.9;
  private readonly MIN_FACE_SIZE_RATIO = 0.08; // 8% of frame
  private readonly MAX_FACE_SIZE_RATIO = 0.4;  // 40% of frame
  private readonly FACE_MARGIN_RATIO = 0.1;    // 10% margin from edges

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Analyze video frame for face detection and pose estimation
   */
  async analyzeFrame(video: HTMLVideoElement): Promise<FaceDetectionResult> {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return this.createEmptyResult();
    }

    try {
      // Setup canvas with mobile-optimized resolution (~720p)
      this.setupCanvas(video);
      this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

      // Get image data for analysis
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      // Detect faces with confidence scoring
      const faceDetectionResult = this.detectFaces(imageData);
      
      // Validate detection meets requirements
      if (!this.isValidDetection(faceDetectionResult)) {
        return {
          faceDetected: false,
          faceCount: faceDetectionResult.faces.length,
          faceConfidence: faceDetectionResult.maxConfidence,
          faceInFrame: faceDetectionResult.faces.length > 0,
          poseBucket: null,
          yaw: 0,
          pitch: 0,
          quality: 0
        };
      }

      const primaryFace = faceDetectionResult.faces[0];
      
      // Calculate pose using facial landmarks approximation
      const { yaw, pitch } = this.estimateHeadPose(primaryFace, imageData);
      
      // Calculate quality score
      const quality = this.calculateQuality(primaryFace, imageData);
      
      // Get pose bucket
      const poseBucket = this.classifyPose(yaw, pitch);

      return {
        faceDetected: true,
        faceCount: 1,
        faceConfidence: primaryFace.confidence,
        faceInFrame: this.isFaceInFrame(primaryFace, imageData),
        poseBucket,
        yaw,
        pitch,
        quality
      };

    } catch (error) {
      console.error('Error in face detection:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * Setup canvas with mobile-optimized resolution
   */
  private setupCanvas(video: HTMLVideoElement) {
    // Target ~720p resolution for mobile optimization
    const targetWidth = 720;
    const aspectRatio = video.videoHeight / video.videoWidth;
    const targetHeight = Math.round(targetWidth * aspectRatio);
    
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
  }

  /**
   * Detect faces using simplified computer vision techniques
   */
  private detectFaces(imageData: ImageData): {
    faces: Array<{
      x: number, y: number, width: number, height: number,
      confidence: number, features: any
    }>,
    maxConfidence: number
  } {
    const { width, height } = imageData;
    const faces: any[] = [];
    
    // Multi-scale face detection
    const scales = [1.0, 0.85, 0.7];
    
    for (const scale of scales) {
      const detectedFaces = this.detectFacesAtScale(imageData, scale);
      faces.push(...detectedFaces);
    }
    
    // Remove overlapping faces (non-maximum suppression)
    const filteredFaces = this.nonMaximumSuppression(faces);
    
    // Calculate confidence scores
    const facesWithConfidence = filteredFaces.map(face => ({
      ...face,
      confidence: this.calculateFaceConfidence(face, imageData)
    }));
    
    // Filter and sort by confidence
    const validFaces = facesWithConfidence
      .filter(face => face.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence);
    
    const maxConfidence = validFaces.length > 0 ? validFaces[0].confidence : 0;
    
    return {
      faces: validFaces,
      maxConfidence
    };
  }

  /**
   * Detect faces at specific scale using Haar-like features
   */
  private detectFacesAtScale(imageData: ImageData, scale: number): any[] {
    const { width, height, data } = imageData;
    const faces: any[] = [];
    
    const minSize = Math.round(Math.min(width, height) * 0.1 * scale);
    const maxSize = Math.round(Math.min(width, height) * 0.4 * scale);
    
    for (let size = minSize; size <= maxSize; size += Math.round(size * 0.2)) {
      for (let y = 0; y <= height - size; y += Math.round(size * 0.1)) {
        for (let x = 0; x <= width - size; x += Math.round(size * 0.1)) {
          const faceScore = this.evaluateFaceRegion(data, width, height, x, y, size, size);
          
          if (faceScore > 0.6) {
            faces.push({
              x, y, width: size, height: size,
              score: faceScore,
              features: this.extractFacialLandmarks(data, width, height, x, y, size, size)
            });
          }
        }
      }
    }
    
    return faces;
  }

  /**
   * Evaluate if a region contains a face using Haar-like features
   */
  private evaluateFaceRegion(
    data: Uint8ClampedArray, 
    imgWidth: number, 
    imgHeight: number,
    x: number, y: number, w: number, h: number
  ): number {
    let score = 0;
    
    // Eye region (upper third, darker than cheeks)
    score += this.evaluateEyeRegion(data, imgWidth, x, y, w, h) * 0.4;
    
    // Nose region (center, specific brightness pattern)
    score += this.evaluateNoseRegion(data, imgWidth, x, y, w, h) * 0.2;
    
    // Mouth region (lower third, darker line)
    score += this.evaluateMouthRegion(data, imgWidth, x, y, w, h) * 0.2;
    
    // Overall skin tone consistency
    score += this.evaluateSkinTone(data, imgWidth, x, y, w, h) * 0.2;
    
    return Math.min(1, score);
  }

  /**
   * Evaluate eye region characteristics
   */
  private evaluateEyeRegion(
    data: Uint8ClampedArray, 
    imgWidth: number,
    x: number, y: number, w: number, h: number
  ): number {
    const eyeY = y + Math.round(h * 0.25);
    const eyeHeight = Math.round(h * 0.2);
    
    let darkPixels = 0;
    let totalPixels = 0;
    
    for (let ey = eyeY; ey < eyeY + eyeHeight; ey++) {
      for (let ex = x + Math.round(w * 0.2); ex < x + Math.round(w * 0.8); ex++) {
        const i = (ey * imgWidth + ex) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        
        if (brightness < 100) darkPixels++;
        totalPixels++;
      }
    }
    
    const darkRatio = darkPixels / totalPixels;
    return darkRatio > 0.3 ? 1 : darkRatio / 0.3;
  }

  /**
   * Evaluate nose region characteristics
   */
  private evaluateNoseRegion(
    data: Uint8ClampedArray, 
    imgWidth: number,
    x: number, y: number, w: number, h: number
  ): number {
    const noseX = x + Math.round(w * 0.4);
    const noseY = y + Math.round(h * 0.4);
    const noseW = Math.round(w * 0.2);
    const noseH = Math.round(h * 0.3);
    
    let avgBrightness = 0;
    let pixelCount = 0;
    
    for (let ny = noseY; ny < noseY + noseH; ny++) {
      for (let nx = noseX; nx < noseX + noseW; nx++) {
        const i = (ny * imgWidth + nx) * 4;
        avgBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
        pixelCount++;
      }
    }
    
    avgBrightness /= pixelCount;
    return avgBrightness > 80 && avgBrightness < 200 ? 1 : 0.5;
  }

  /**
   * Evaluate mouth region characteristics
   */
  private evaluateMouthRegion(
    data: Uint8ClampedArray, 
    imgWidth: number,
    x: number, y: number, w: number, h: number
  ): number {
    const mouthY = y + Math.round(h * 0.65);
    const mouthHeight = Math.round(h * 0.15);
    
    let darkPixels = 0;
    let totalPixels = 0;
    
    for (let my = mouthY; my < mouthY + mouthHeight; my++) {
      for (let mx = x + Math.round(w * 0.3); mx < x + Math.round(w * 0.7); mx++) {
        const i = (my * imgWidth + mx) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        
        if (brightness < 120) darkPixels++;
        totalPixels++;
      }
    }
    
    const darkRatio = darkPixels / totalPixels;
    return darkRatio > 0.2 ? 1 : darkRatio / 0.2;
  }

  /**
   * Evaluate skin tone consistency
   */
  private evaluateSkinTone(
    data: Uint8ClampedArray, 
    imgWidth: number,
    x: number, y: number, w: number, h: number
  ): number {
    let skinPixels = 0;
    let totalPixels = 0;
    
    for (let sy = y; sy < y + h; sy += 3) {
      for (let sx = x; sx < x + w; sx += 3) {
        const i = (sy * imgWidth + sx) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (this.isSkinColor(r, g, b)) skinPixels++;
        totalPixels++;
      }
    }
    
    const skinRatio = skinPixels / totalPixels;
    return skinRatio > 0.4 ? 1 : skinRatio / 0.4;
  }

  /**
   * Enhanced skin color detection
   */
  private isSkinColor(r: number, g: number, b: number): boolean {
    const conditions = [
      // Light skin
      (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15),
      // Medium skin
      (r > 80 && g > 50 && b > 30 && r >= g && g >= b),
      // Dark skin
      (r > 50 && g > 30 && b > 15 && r >= g && g >= b && (r - b) > 10)
    ];
    
    return conditions.some(condition => condition);
  }

  /**
   * Extract facial landmarks for pose estimation
   */
  private extractFacialLandmarks(
    data: Uint8ClampedArray, 
    imgWidth: number, imgHeight: number,
    x: number, y: number, w: number, h: number
  ): any {
    return {
      leftEye: { x: x + w * 0.3, y: y + h * 0.35 },
      rightEye: { x: x + w * 0.7, y: y + h * 0.35 },
      nose: { x: x + w * 0.5, y: y + h * 0.5 },
      mouth: { x: x + w * 0.5, y: y + h * 0.7 }
    };
  }

  /**
   * Non-maximum suppression to remove overlapping faces
   */
  private nonMaximumSuppression(faces: any[], overlapThreshold: number = 0.3): any[] {
    if (faces.length === 0) return [];
    
    faces.sort((a, b) => b.score - a.score);
    
    const keep: any[] = [];
    
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      let shouldKeep = true;
      
      for (const keptFace of keep) {
        const overlap = this.calculateOverlap(face, keptFace);
        if (overlap > overlapThreshold) {
          shouldKeep = false;
          break;
        }
      }
      
      if (shouldKeep) {
        keep.push(face);
      }
    }
    
    return keep;
  }

  /**
   * Calculate overlap between two rectangles
   */
  private calculateOverlap(rect1: any, rect2: any): number {
    const x1 = Math.max(rect1.x, rect2.x);
    const y1 = Math.max(rect1.y, rect2.y);
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = rect1.width * rect1.height;
    const area2 = rect2.width * rect2.height;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }

  /**
   * Calculate face confidence score
   */
  private calculateFaceConfidence(face: any, imageData: ImageData): number {
    const { width, height } = imageData;
    
    // Size score
    const faceArea = face.width * face.height;
    const frameArea = width * height;
    const sizeRatio = faceArea / frameArea;
    
    let sizeScore = 0;
    if (sizeRatio >= this.MIN_FACE_SIZE_RATIO && sizeRatio <= this.MAX_FACE_SIZE_RATIO) {
      const optimalRatio = 0.15;
      sizeScore = 1 - Math.abs(sizeRatio - optimalRatio) / optimalRatio;
    }
    
    // Position score
    const faceCenterX = face.x + face.width / 2;
    const faceCenterY = face.y + face.height / 2;
    const frameCenterX = width / 2;
    const frameCenterY = height / 2;
    
    const offsetX = Math.abs(faceCenterX - frameCenterX) / frameCenterX;
    const offsetY = Math.abs(faceCenterY - frameCenterY) / frameCenterY;
    const positionScore = 1 - Math.min(1, (offsetX + offsetY) / 2);
    
    return (face.score * 0.4) + (sizeScore * 0.3) + (positionScore * 0.3);
  }

  /**
   * Validate detection meets strict requirements
   */
  private isValidDetection(result: any): boolean {
    // Exactly one face
    if (result.faces.length !== 1) return false;
    
    // High confidence
    if (result.maxConfidence < this.MIN_FACE_CONFIDENCE) return false;
    
    return true;
  }

  /**
   * Check if face is fully within frame boundaries
   */
  private isFaceInFrame(face: any, imageData: { width: number, height: number }): boolean {
    const margin = Math.min(imageData.width, imageData.height) * this.FACE_MARGIN_RATIO;
    
    return (
      face.x >= margin &&
      face.y >= margin &&
      face.x + face.width <= imageData.width - margin &&
      face.y + face.height <= imageData.height - margin
    );
  }

  /**
   * Estimate head pose using facial landmarks (2D approximation)
   */
  private estimateHeadPose(face: any, imageData: ImageData): { yaw: number, pitch: number } {
    const features = face.features;
    
    // Calculate yaw from eye positions
    const eyeDistance = features.rightEye.x - features.leftEye.x;
    const expectedEyeDistance = face.width * 0.4;
    
    // Face center offset for yaw
    const faceCenterX = face.x + face.width / 2;
    const frameCenterX = imageData.width / 2;
    const horizontalOffset = (faceCenterX - frameCenterX) / (imageData.width / 2);
    
    let yaw = horizontalOffset * 45; // Base yaw from position
    
    // Adjust based on eye distance (perspective effect)
    const eyeDistanceRatio = eyeDistance / expectedEyeDistance;
    if (eyeDistanceRatio < 0.8) {
      yaw += (yaw > 0 ? 15 : -15); // Face turning away
    }
    
    // Calculate pitch from facial feature positions
    const eyeToNoseDistance = features.nose.y - features.leftEye.y;
    const noseToMouthDistance = features.mouth.y - features.nose.y;
    
    const faceCenterY = face.y + face.height / 2;
    const frameCenterY = imageData.height / 2;
    const verticalOffset = (faceCenterY - frameCenterY) / (imageData.height / 2);
    
    let pitch = verticalOffset * 30; // Base pitch from position
    
    // Adjust based on facial proportions
    const expectedRatio = 0.6;
    const actualRatio = eyeToNoseDistance / (eyeToNoseDistance + noseToMouthDistance);
    
    if (actualRatio > expectedRatio + 0.1) {
      pitch -= 10; // Looking up
    } else if (actualRatio < expectedRatio - 0.1) {
      pitch += 10; // Looking down
    }
    
    return {
      yaw: Math.max(-45, Math.min(45, yaw)),
      pitch: Math.max(-30, Math.min(30, pitch))
    };
  }

  /**
   * Calculate comprehensive quality score
   */
  private calculateQuality(face: any, imageData: ImageData): number {
    const { width, height } = imageData;
    
    // Size quality
    const faceArea = face.width * face.height;
    const frameArea = width * height;
    const sizeRatio = faceArea / frameArea;
    
    let sizeQuality = 0;
    if (sizeRatio >= this.MIN_FACE_SIZE_RATIO && sizeRatio <= this.MAX_FACE_SIZE_RATIO) {
      const optimalRatio = 0.15;
      sizeQuality = 1 - Math.abs(sizeRatio - optimalRatio) / optimalRatio;
    }
    
    // Position quality
    const faceCenterX = face.x + face.width / 2;
    const faceCenterY = face.y + face.height / 2;
    const frameCenterX = width / 2;
    const frameCenterY = height / 2;
    
    const offsetX = Math.abs(faceCenterX - frameCenterX) / frameCenterX;
    const offsetY = Math.abs(faceCenterY - frameCenterY) / frameCenterY;
    const positionQuality = 1 - Math.min(1, (offsetX + offsetY) / 2);
    
    // Sharpness quality
    const sharpnessQuality = this.calculateSharpness(face, imageData);
    
    // Lighting quality
    const lightingQuality = this.calculateLightingQuality(face, imageData);
    
    return (
      sizeQuality * 0.3 +
      positionQuality * 0.25 +
      sharpnessQuality * 0.25 +
      lightingQuality * 0.2
    );
  }

  /**
   * Calculate image sharpness in face region
   */
  private calculateSharpness(face: any, imageData: ImageData): number {
    const { data, width } = imageData;
    let edgeStrength = 0;
    let pixelCount = 0;
    
    for (let y = face.y + 1; y < face.y + face.height - 1; y += 2) {
      for (let x = face.x + 1; x < face.x + face.width - 1; x += 2) {
        const i = (y * width + x) * 4;
        const center = data[i];
        const top = data[((y - 1) * width + x) * 4];
        const bottom = data[((y + 1) * width + x) * 4];
        const left = data[(y * width + (x - 1)) * 4];
        const right = data[(y * width + (x + 1)) * 4];
        
        const laplacian = Math.abs(4 * center - top - bottom - left - right);
        edgeStrength += laplacian;
        pixelCount++;
      }
    }
    
    const avgEdgeStrength = edgeStrength / pixelCount;
    return Math.min(1, avgEdgeStrength / 50);
  }

  /**
   * Calculate lighting quality
   */
  private calculateLightingQuality(face: any, imageData: ImageData): number {
    const { data, width } = imageData;
    const brightnesses: number[] = [];
    
    for (let y = face.y; y < face.y + face.height; y += 4) {
      for (let x = face.x; x < face.x + face.width; x += 4) {
        const i = (y * width + x) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        brightnesses.push(brightness);
      }
    }
    
    if (brightnesses.length === 0) return 0;
    
    const mean = brightnesses.reduce((sum, b) => sum + b, 0) / brightnesses.length;
    const variance = brightnesses.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / brightnesses.length;
    const stdDev = Math.sqrt(variance);
    
    const evenness = 1 - Math.min(1, stdDev / 50);
    const brightness = mean > 80 && mean < 180 ? 1 : 0.5;
    
    return (evenness * 0.7) + (brightness * 0.3);
  }

  /**
   * Classify pose into required buckets
   */
  private classifyPose(yaw: number, pitch: number): string | null {
    // FRONT pose (center) - most restrictive
    if (yaw >= -8 && yaw <= 8 && pitch >= -6 && pitch <= 6) return 'FRONT';
    
    // LEFT pose
    if (yaw >= -35 && yaw <= -12 && pitch >= -15 && pitch <= 15) return 'LEFT';
    
    // RIGHT pose  
    if (yaw >= 12 && yaw <= 35 && pitch >= -15 && pitch <= 15) return 'RIGHT';
    
    // UP pose
    if (pitch >= -30 && pitch <= -8 && yaw >= -20 && yaw <= 20) return 'UP';
    
    // DOWN pose
    if (pitch >= 8 && pitch <= 25 && yaw >= -20 && yaw <= 20) return 'DOWN';
    
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
      quality: 0
    };
  }
}