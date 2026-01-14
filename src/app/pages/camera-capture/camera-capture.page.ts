import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import {
  ToastController,
  LoadingController,
  AlertController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonText,
  IonItem,
  IonLabel,
  IonThumbnail,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonProgressBar,
  IonButtons,
  IonBackButton,
} from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import {
  cameraOutline,
  videocamOutline,
  trash,
  eyeOutline,
  cloudUploadOutline,
  videocam,
} from "ionicons/icons";
import { CameraService } from "../../services/camera.service";
import { StorageService } from "../../services/storage.service";
import { ApiService } from "../../services/api.service";
import { MediaItem } from "../../models/child-record.interface";
import { HttpEventType } from "@angular/common/http";

@Component({
  selector: "app-camera-capture",
  templateUrl: "camera-capture.page.html",
  styleUrls: ["camera-capture.page.scss"],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonText,
    IonItem,
    IonLabel,
    IonThumbnail,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonProgressBar,
    IonButtons,
    IonBackButton,
  ],
})
export class CameraCapturePage implements OnInit {
  recordId: string = "";
  capturedMedia: MediaItem[] = [];
  uploadProgress = 0;
  isUploading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cameraService: CameraService,
    private storageService: StorageService,
    private apiService: ApiService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {
    addIcons({
      cameraOutline,
      videocamOutline,
      trash,
      eyeOutline,
      cloudUploadOutline,
      videocam,
    });
  }

  ngOnInit() {
    this.recordId = this.route.snapshot.paramMap.get("id") || "";
    this.storageService.setMediaForRecord(this.recordId);
    this.loadCapturedMedia();
  }

  ionViewWillLeave() {
    // Clear media when leaving page if not uploaded
    // User can decide to keep or clear
  }

  loadCapturedMedia() {
    this.storageService.media$.subscribe((media) => {
      this.capturedMedia = media.filter((m) => m.recordId === this.recordId);
    });
  }

  async takePhoto() {
    try {
      const photo = await this.cameraService.takePhoto("camera");
      const mediaItem: MediaItem = {
        type: "photo",
        file: photo.base64 || photo.webviewPath || "",
        thumbnail: photo.webviewPath,
        recordId: this.recordId,
      };
      this.storageService.addMedia(mediaItem);
      await this.presentToast("Photo captured!", "success");
    } catch (error) {
      console.error("Error taking photo:", error);
      await this.presentToast("Failed to capture photo", "danger");
    }
  }

  async takeVideo() {
    try {
      const video = await this.cameraService.takeVideo("camera");
      const mediaItem: MediaItem = {
        type: "video",
        file: video.webviewPath || video.filepath || "",
        thumbnail: video.webviewPath,
        recordId: this.recordId,
      };
      this.storageService.addMedia(mediaItem);
      await this.presentToast("Video captured!", "success");
    } catch (error) {
      console.error("Error taking video:", error);
      await this.presentToast("Failed to capture video", "danger");
    }
  }

  removeMedia(index: number) {
    // Find the actual index in storage service
    const mediaIndex = this.capturedMedia.findIndex((_, i) => i === index);
    if (mediaIndex !== -1) {
      // Get all media and find the one to remove
      const allMedia = this.storageService.getMedia();
      const recordMedia = allMedia.filter((m) => m.recordId === this.recordId);
      const globalIndex = allMedia.indexOf(recordMedia[mediaIndex]);
      if (globalIndex !== -1) {
        this.storageService.removeMedia(globalIndex);
      }
    }
  }

  async uploadMedia() {
    if (this.capturedMedia.length === 0) {
      await this.presentToast("No media to upload", "warning");
      return;
    }

    const alert = await this.alertController.create({
      header: "Upload Media",
      message: `Upload ${this.capturedMedia.length} item(s)?`,
      buttons: [
        {
          text: "Cancel",
          role: "cancel",
        },
        {
          text: "Upload",
          handler: () => {
            this.performUpload();
          },
        },
      ],
    });

    await alert.present();
  }

  async performUpload() {
    this.isUploading = true;
    this.uploadProgress = 0;

    const loading = await this.loadingController.create({
      message: "Uploading media...",
    });
    await loading.present();

    try {
      const formData = new FormData();

      // Convert base64 images and video URIs to blobs and add to formData
      for (let i = 0; i < this.capturedMedia.length; i++) {
        const media = this.capturedMedia[i];
        if (media.type === "photo" && typeof media.file === "string") {
          // Convert base64 data URI to blob
          const response = await fetch(media.file);
          const blob = await response.blob();
          formData.append("photos", blob, `photo_${i}.jpg`);
        } else if (media.type === "video" && typeof media.file === "string") {
          // For video, fetch the file from the URI and convert to blob
          try {
            const response = await fetch(media.file);
            const blob = await response.blob();
            formData.append("videos", blob, `video_${i}.mp4`);
          } catch (error) {
            console.error("Error fetching video file:", error);
            // Fallback: append the URI as a string (backend should handle this)
            formData.append("videoUris", media.file);
          }
        }
      }

      formData.append("recordId", this.recordId);

      this.apiService
        .uploadFiles(`/records/${this.recordId}/media`, formData)
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              this.uploadProgress = Math.round(
                (100 * event.loaded) / event.total
              );
              loading.message = `Uploading... ${this.uploadProgress}%`;
            } else if (event.type === HttpEventType.Response) {
              this.uploadProgress = 100;
              loading.dismiss();
              this.isUploading = false;
              this.presentToast("Media uploaded successfully!", "success");
              this.storageService.clearMedia();
              this.router.navigate(["/record-detail", this.recordId]);
            }
          },
          error: async (error) => {
            console.error("Upload error:", error);
            await loading.dismiss();
            this.isUploading = false;
            await this.presentToast("Failed to upload media", "danger");
          },
        });
    } catch (error) {
      console.error("Error preparing upload:", error);
      await loading.dismiss();
      this.isUploading = false;
      await this.presentToast("Failed to prepare media for upload", "danger");
    }
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: "top",
    });
    await toast.present();
  }

  navigateToPreview() {
    this.router.navigate(["/media-preview", this.recordId]);
  }
}
