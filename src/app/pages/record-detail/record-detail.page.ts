import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import {
  LoadingController,
  ToastController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonButton,
  IonButtons,
  IonBackButton,
  IonIcon,
} from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { cameraOutline } from "ionicons/icons";
import { RecordService } from "../../services/record.service";
import { ChildRecord } from "../../models/child-record.interface";

@Component({
  selector: "app-record-detail",
  templateUrl: "record-detail.page.html",
  styleUrls: ["record-detail.page.scss"],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonButton,
    IonButtons,
    IonBackButton,
    IonIcon,
  ],
})
export class RecordDetailPage implements OnInit {
  record: ChildRecord | null = null;
  recordId: string = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recordService: RecordService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    addIcons({ cameraOutline });
  }

  ngOnInit() {
    this.recordId = this.route.snapshot.paramMap.get("id") || "";
    this.loadRecord();
  }

  async loadRecord() {
    if (!this.recordId) {
      await this.presentToast("Invalid record ID", "danger");
      this.router.navigate(["/record-list"]);
      return;
    }

    const loading = await this.loadingController.create({
      message: "Loading record...",
    });
    await loading.present();

    this.recordService.getRecordById(this.recordId).subscribe({
      next: (record) => {
        this.record = record;
        loading.dismiss();
      },
      error: async (error) => {
        console.error("Error loading record:", error);
        await loading.dismiss();
        await this.presentToast("Failed to load record", "danger");
        this.router.navigate(["/record-list"]);
      },
    });
  }

  navigateToCamera() {
    if (this.record?.id) {
      this.router.navigate(["/camera-capture", this.record.id]);
    } else if (this.recordId) {
      this.router.navigate(["/camera-capture", this.recordId]);
    }
  }

  private async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: "top",
      buttons: [
        {
          text: "OK",
          role: "cancel",
        },
      ],
    });
    await toast.present();
  }

  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.status === 0) {
      return "Network error. Please check your connection.";
    }
    if (error?.status === 404) {
      return "Record not found.";
    }
    if (error?.status >= 500) {
      return "Server error. Please try again later.";
    }
    return "Failed to load record. Please try again.";
  }
}
