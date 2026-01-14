export interface ChildRecord {
  id?: string;
  child_id: string;
  name: string;
  class_id: string;
  school_id: string;
  digital_ocean_info?: {
    bucket?: string;
    region?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface MediaItem {
  id?: string;
  type: "photo" | "video";
  file: File | string; // File object or base64 string
  thumbnail?: string;
  recordId: string;
}

export interface UploadProgress {
  total: number;
  uploaded: number;
  percentage: number;
}
