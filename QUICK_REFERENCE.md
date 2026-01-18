# Quick Reference - Presigned URL Upload

## API Endpoints

### 1. Generate Presigned URLs
```
POST /api/children/:childId/media/generate-urls
```

**Request:**
```json
{
  "photos": [{ "filename": "photo.jpg", "contentType": "image/jpeg" }],
  "videos": [{ "filename": "video.mp4", "contentType": "video/mp4" }]
}
```

**Response:**
```json
{
  "success": true,
  "childId": "123",
  "photos": [{ "uploadUrl": "...", "fileKey": "...", ... }],
  "videos": [{ "uploadUrl": "...", "fileKey": "...", ... }]
}
```

### 2. Upload to Digital Ocean
```
PUT {uploadUrl}
Headers:
  Content-Type: {contentType}
  x-amz-acl: public-read
Body: File blob
```

### 3. Confirm Upload
```
POST /api/children/:childId/media/confirm-upload
```

**Request:**
```json
{
  "photos": [{ "fileKey": "...", "originalName": "...", "contentType": "...", "fileSize": 123 }],
  "videos": [{ "fileKey": "...", "originalName": "...", "contentType": "...", "fileSize": 456 }]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Upload confirmed and records saved",
  "childId": "123",
  "photoCount": 1,
  "videoCount": 1
}
```

## Frontend Usage

```typescript
// Step 1: Generate URLs
const urlResponse = await this.mediaService
  .generateUploadUrls(childId, photoRequests, videoRequests)
  .toPromise();

// Step 2: Upload files
await this.mediaService
  .uploadToPresignedUrl(urlInfo.uploadUrl, blob, contentType)
  .toPromise();

// Step 3: Confirm
const confirmResponse = await this.mediaService
  .confirmUpload(childId, { photos: uploadedPhotos, videos: uploadedVideos })
  .toPromise();
```

## Testing

```bash
# Test presigned URL generation
cd backend
node test-presigned-url.js

# Start backend
cd backend
npm start

# Start frontend (in another terminal)
npm start
```

## Environment Variables

```env
DO_SPACES_KEY=your_access_key
DO_SPACES_SECRET=your_secret_key
DO_SPACES_BUCKET=child-records
DO_SPACES_REGION=nyc3
```

## Database Tables

- `sam4_child_photos` - Photo records
- `sam4_child_videos` - Video records
- Both have foreign key to `bmc6_assessment_childs` with CASCADE delete

## Key Files

**Backend:**
- `backend/config/digitalocean.js` - Presigned URL generation
- `backend/controllers/media.controller.js` - Endpoints
- `backend/routes/media.routes.js` - Routes

**Frontend:**
- `src/app/services/media.service.ts` - Service methods
- `src/app/pages/camera-capture/camera-capture.page.ts` - Upload logic

## Documentation

- `PRESIGNED_URL_UPLOAD_GUIDE.md` - Comprehensive guide
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
- `backend/API_DOCUMENTATION.md` - API reference
