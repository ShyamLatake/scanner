import { Injectable } from "@angular/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export interface CameraPhoto {
  filepath: string;
  webviewPath?: string;
  base64?: string;
  format: string;
  type: "photo" | "video";
}

@Injectable({
  providedIn: "root",
})
export class CameraService {
  constructor() {}

  async takePhoto(
    source: "camera" | "library" = "camera"
  ): Promise<CameraPhoto> {
    const image = await Camera.getPhoto({
      quality: 95, // High quality for face detection
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
      width: 1920,
      height: 1920,
    });

    return {
      filepath: "",
      webviewPath: `data:image/${image.format};base64,${image.base64String}`,
      base64: image.base64String,
      format: image.format,
      type: "photo",
    };
  }

  async takeVideo(
    source: "camera" | "library" = "camera"
  ): Promise<CameraPhoto> {
    // Note: Capacitor Camera plugin's getPhoto() only supports images
    // For video recording, you may need to use @capacitor-community/camera-preview
    // or implement native video recording. For now, this will use the photo picker
    // which allows selecting videos from the gallery on some platforms.
    const video = await Camera.getPhoto({
      quality: 95,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
    } as any); // Type assertion needed as video support varies by platform

    return {
      filepath: video.path || "",
      webviewPath: video.webPath,
      format: "video",
      type: "video",
    };
  }
}
