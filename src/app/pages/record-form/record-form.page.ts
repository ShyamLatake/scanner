import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import {
  ToastController,
  LoadingController,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonButtons,
  IonBackButton,
  IonText,
} from "@ionic/angular/standalone";
import { RecordService } from "../../services/record.service";

@Component({
  selector: "app-record-form",
  templateUrl: "record-form.page.html",
  styleUrls: ["record-form.page.scss"],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonButtons,
    IonBackButton,
    IonText,
  ],
})
export class RecordFormPage implements OnInit {
  recordForm: FormGroup;
  submitted = false;

  constructor(
    private recordService: RecordService,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private formBuilder: FormBuilder
  ) {
    this.recordForm = this.formBuilder.group({
      child_id: ["", [Validators.required, Validators.minLength(1)]],
      name: ["", [Validators.required, Validators.minLength(2)]],
      class_id: ["", [Validators.required, Validators.minLength(1)]],
      school_id: ["", [Validators.required, Validators.minLength(1)]],
    });
  }

  ngOnInit() {}

  get f() {
    return this.recordForm.controls;
  }

  async onSubmit() {
    this.submitted = true;

    if (this.recordForm.invalid) {
      await this.presentToast(
        "Please fill in all required fields correctly",
        "danger"
      );
      return;
    }

    const loading = await this.loadingController.create({
      message: "Creating record...",
      spinner: "crescent",
    });
    await loading.present();

    this.recordService.createRecord(this.recordForm.value).subscribe({
      next: async (createdRecord) => {
        await loading.dismiss();
        await this.presentToast("Record created successfully!", "success");
        this.recordForm.reset();
        this.submitted = false;
        this.router.navigate(["/record-list"]);
      },
      error: async (error) => {
        await loading.dismiss();
        console.error("Error creating record:", error);
        const errorMessage = this.getErrorMessage(error);
        await this.presentToast(errorMessage, "danger");
      },
    });
  }

  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.status === 0) {
      return "Network error. Please check your connection.";
    }
    if (error?.status === 400) {
      return "Invalid data. Please check all fields.";
    }
    if (error?.status === 409) {
      return "Record with this child ID already exists.";
    }
    if (error?.status >= 500) {
      return "Server error. Please try again later.";
    }
    return "Failed to create record. Please try again.";
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
}
