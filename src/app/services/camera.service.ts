import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private video!: HTMLVideoElement;
  private canvas!: HTMLCanvasElement;
  private stream?: MediaStream;

  constructor() {
    this.canvas = document.createElement('canvas');
  }

  /**
   * Check camera permissions
   */
  async checkCameraPermissions(): Promise<{ granted: boolean, message: string }> {
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('Checking Capacitor camera permissions...');
        
        try {
          const permissions = await Camera.checkPermissions();
          console.log('Capacitor camera permissions:', permissions);
          
          if (permissions.camera === 'granted') {
            return { granted: true, message: 'Camera permission granted' };
          } else if (permissions.camera === 'denied') {
            return { 
              granted: false, 
              message: 'Camera permission denied. Please enable camera access in device settings.' 
            };
          } else {
            console.log('Requesting camera permissions...');
            const requestResult = await Camera.requestPermissions();
            console.log('Permission request result:', requestResult);
            
            if (requestResult.camera === 'granted') {
              return { granted: true, message: 'Camera permission granted' };
            } else {
              return { 
                granted: false, 
                message: 'Camera permission denied. Please enable camera access in device settings.' 
              };
            }
          }
        } catch (error: any) {
          console.error('Capacitor camera permission error:', error);
          return { 
            granted: false, 
            message: `Camera permission error: ${error.message || 'Unknown error'}` 
          };
        }
      } else {
        // Web platform
        console.log('Checking web camera permissions...');
        return await this.checkWebCameraPermissions();
      }
    } catch (error: any) {
      console.error('Unexpected error checking camera permissions:', error);
      return { 
        granted: false, 
        message: 'Unable to check camera permissions. Please try again.'
      };
    }
  }

  /**
   * Web camera permissions
   */
  private async checkWebCameraPermissions(): Promise<{ granted: boolean, message: string }> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          granted: false,
          message: 'Camera API not supported in this browser. Please use Chrome, Firefox, or Safari.'
        };
      }

      console.log('Attempting to request web camera permission...');
      
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user', // Front camera
            width: { ideal: 720 },
            height: { ideal: 480 }
          } 
        });
        
        console.log('✓ Web camera permission granted successfully');
        
        // Stop the test stream immediately
        testStream.getTracks().forEach(track => track.stop());
        
        return { granted: true, message: 'Camera permission granted' };
        
      } catch (error: any) {
        console.error('Web camera permission error:', error);
        
        if (error.name === 'NotAllowedError') {
          return { 
            granted: false, 
            message: 'Camera permission denied. Please click "Allow" when prompted and refresh the page.'
          };
        } else if (error.name === 'NotFoundError') {
          return { 
            granted: false, 
            message: 'No camera found. Please connect a camera and try again.'
          };
        } else if (error.name === 'NotReadableError') {
          return { 
            granted: false, 
            message: 'Camera is already in use by another application.'
          };
        } else if (error.name === 'SecurityError') {
          return { 
            granted: false, 
            message: 'Camera access blocked. Please ensure you are using HTTPS or localhost.'
          };
        } else {
          return { 
            granted: false, 
            message: `Camera error: ${error.message || 'Unknown error'}`
          };
        }
      }
    } catch (error: any) {
      console.error('Unexpected error checking web camera permissions:', error);
      return { 
        granted: false, 
        message: 'Unable to check camera permissions. Please try refreshing the page.'
      };
    }
  }

  /**
   * Start camera with front-facing preference and mobile optimization
   */
  async startCamera(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    
    try {
      console.log('Starting front camera with mobile optimization...');
      
      // Mobile-optimized constraints (~720p) with front camera
      const constraints = {
        video: {
          facingMode: 'user', // Front camera
          width: { ideal: 720, min: 480, max: 1280 },
          height: { ideal: 480, min: 320, max: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false // No audio needed
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('Camera access granted, setting up video stream...');
      
      video.srcObject = this.stream;
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded, starting playback...');
          video.play()
            .then(() => {
              console.log('✓ Front camera started successfully');
              console.log(`Resolution: ${video.videoWidth}x${video.videoHeight}`);
              resolve(void 0);
            })
            .catch(reject);
        };
        
        video.onerror = (error) => {
          console.error('Video element error:', error);
          reject(new Error('Video playback failed'));
        };
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Camera initialization timeout'));
        }, 10000);
      });

    } catch (error: any) {
      console.error('Camera access error:', error);
      
      let userMessage = 'Failed to access camera';
      
      if (error.name === 'NotAllowedError') {
        userMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        userMessage = 'No front camera found. Please ensure your device has a front-facing camera.';
      } else if (error.name === 'NotReadableError') {
        userMessage = 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        userMessage = 'Camera does not support the required settings.';
      } else if (error.name === 'SecurityError') {
        userMessage = 'Camera access blocked due to security restrictions.';
      } else if (error.message) {
        userMessage = error.message;
      }
      
      throw new Error(userMessage);
    }
  }

  /**
   * Stop camera and clean up resources
   */
  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = undefined;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  /**
   * Capture still frame from video stream
   */
  captureFrame(): string {
    if (!this.video) {
      throw new Error('Video not initialized');
    }

    // Set canvas size to match video
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    
    const ctx = this.canvas.getContext('2d')!;
    ctx.drawImage(this.video, 0, 0);
    
    // Return as base64 JPEG with high quality
    return this.canvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * Get current video element
   */
  getVideo(): HTMLVideoElement | null {
    return this.video || null;
  }

  /**
   * Check if camera is active
   */
  isActive(): boolean {
    return !!this.stream && this.stream.active;
  }
}