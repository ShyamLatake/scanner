# Ionic Child Record Scanner

Ionic Angular app for creating child records and capturing photos/videos for face detection training.

## Configuration

Backend API URL - Update src/environments/environment.ts:

```typescript
export const environment = {
  production: false,
  apiUrl: "http://localhost:3000/api",
};
```

Production - Update src/environments/environment.prod.ts:

```typescript
export const environment = {
  production: true,
  apiUrl: "https://your-api-domain.com/api",
};
```

## API Endpoints

All endpoints prefixed with base URL from environment.ts.

### POST /api/records - Create Child Record

Headers: Content-Type: application/json

Request:

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

Response: 201 Created

```json
{
  "id": "123",
  "child_id": "CH001",
  "name": "John Doe",
  "class_id": "CLASS_5A",
  "school_id": "SCH_001",
  "digital_ocean_info": { "bucket": "child-records", "region": "nyc3" },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

Errors: 400 Invalid data | 409 child_id exists | 500 Server error

---

### GET /api/records - Get All Records

Headers: Content-Type: application/json

Query Params: page, limit, class_id, school_id

Response: 200 OK

```json
[
  {
    "id": "123",
    "child_id": "CH001",
    "name": "John Doe",
    "class_id": "CLASS_5A",
    "school_id": "SCH_001",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### GET /api/records/:id - Get Record by ID

Headers: Content-Type: application/json

Response: 200 OK (same structure as create response)

Errors: 404 Not found

---

### GET /api/records/child/:childId - Get Record by Child ID

Headers: Content-Type: application/json

Response: 200 OK (same structure as create response)

---

### POST /api/records/:id/media - Upload Media

Headers: Content-Type: multipart/form-data

FormData:

- photos - Array of image files (Blob/File)
- videos - Array of video files (Blob/File)
- recordId - Record ID (string)

Example:

```javascript
formData.append("photos", photoBlob1, "photo_0.jpg");
formData.append("videos", videoBlob1, "video_0.mp4");
formData.append("recordId", "123");
```

Response: 200 OK

```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "recordId": "123",
  "uploadedFiles": {
    "photos": [
      { "filename": "photo_0.jpg", "size": 245678, "mimetype": "image/jpeg" }
    ],
    "videos": [
      { "filename": "video_0.mp4", "size": 5245678, "mimetype": "video/mp4" }
    ]
  },
  "digitalOceanUrls": {
    "photos": [
      "https://child-records.nyc3.digitaloceanspaces.com/records/123/photos/photo_0.jpg"
    ],
    "videos": [
      "https://child-records.nyc3.digitaloceanspaces.com/records/123/videos/video_0.mp4"
    ]
  }
}
```

Errors: 400 Invalid format | 404 Record not found | 413 File too large | 500 Upload failed

Note: App tracks progress via HttpEventType.UploadProgress - backend must support progress reporting.

---

## CORS Configuration

```javascript
app.use(
  cors({
    origin: [
      "http://localhost:8100",
      "capacitor://localhost",
      "ionic://localhost",
      "https://your-production-domain.com",
    ],
    credentials: true,
  })
);
```

---

## Digital Ocean Spaces Integration

Environment Variables:

```env
DO_SPACES_KEY=your_access_key
DO_SPACES_SECRET=your_secret_key
DO_SPACES_BUCKET=child-records
DO_SPACES_REGION=nyc3
```

Upload Function (Node.js/AWS SDK):

```javascript
const AWS = require("aws-sdk");
const spacesEndpoint = new AWS.Endpoint(`${region}.digitaloceanspaces.com`);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
});

async function uploadToDigitalOcean(buffer, filename, contentType) {
  const params = {
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: filename,
    Body: buffer,
    ACL: "public-read",
    ContentType: contentType,
  };
  const data = await s3.upload(params).promise();
  return data.Location;
}
```

File Structure: child-records/records/{recordId}/photos/ and videos/

---

## Quick Start

```bash
npm install
ionic serve
```

Update src/environments/environment.ts with your backend API URL.