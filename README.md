# Ionic Child Record Scanner

Ionic Angular application for creating child records and capturing photos/videos for face detection training.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Android Studio (for Android build)
- Ionic CLI: `npm install -g @ionic/cli`

## Installation

```bash
npm install
```

## Running the App

### Development (Web Browser)
```bash
ionic serve
```

### Development (Android)
```bash
ionic build
npx cap sync
npx cap open android
```

## Building Android APK

1. Build the app:
```bash
ionic build
npx cap sync
```

2. Open in Android Studio:
```bash
npx cap open android
```

3. In Android Studio:
   - Go to `Build` > `Generate Signed Bundle / APK`
   - Select `APK`
   - Create/Select keystore
   - Build the APK

4. APK Location:
   - Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Release: `android/app/build/outputs/apk/release/app-release.apk`

## Configuration

Update API URL in `src/environments/environment.ts`:
```typescript
apiUrl: 'https://your-api-url.com/api'
```

## Data Structure

### Child Record
- `child_id` / `roll_number`: Unique identifier
- `name`: Full name of the child
- `class_id`: Class identifier
- `school_id`: School identifier
- `digital_ocean_info`: Digital Ocean storage information

### Media Files
- Photos: Multiple photos per child
- Videos: Multiple videos per child

## API Endpoints

### 1. Create Child Record
**POST** `/api/records`

**Request:**
```json
{
  "child_id": "CH001",
  "name": "John Doe",
  "class_id": "CLASS_5A",
  "school_id": "SCH_001",
  "digital_ocean_info": {
    "bucket": "child-records",
    "region": "nyc3"
  }
}
```

**Response:**
```json
{
  "id": "123",
  "child_id": "CH001",
  "name": "John Doe",
  "class_id": "CLASS_5A",
  "school_id": "SCH_001",
  "digital_ocean_info": {
    "bucket": "child-records",
    "region": "nyc3"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 2. Get All Records
**GET** `/api/records`

**Response:**
```json
[
  {
    "id": "123",
    "child_id": "CH001",
    "name": "John Doe",
    "class_id": "CLASS_5A",
    "school_id": "SCH_001",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### 3. Get Record by ID
**GET** `/api/records/:id`

**Response:**
```json
{
  "id": "123",
  "child_id": "CH001",
  "name": "John Doe",
  "class_id": "CLASS_5A",
  "school_id": "SCH_001",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### 4. Upload Media
**POST** `/api/records/:id/media`

**Request:** (multipart/form-data)
- `photos`: Array of image files
- `videos`: Array of video files
- `recordId`: Record ID

**Response:**
```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "uploadedFiles": {
    "photos": ["photo1.jpg", "photo2.jpg"],
    "videos": ["video1.mp4"]
  },
  "digitalOceanUrls": {
    "photos": ["https://storage.digitalocean.com/.../photo1.jpg"],
    "videos": ["https://storage.digitalocean.com/.../video1.mp4"]
  }
}
```

## Android Permissions

Required permissions in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

## Notes

- Update the record model structure to match the API (currently uses firstName/lastName, needs to be updated to match the data structure above)
- Digital Ocean storage URLs should be returned in the media upload response
- Ensure backend handles multipart/form-data for media uploads
