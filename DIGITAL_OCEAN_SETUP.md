# Digital Ocean Spaces Setup Guide

## Issue Resolution

The presigned URL upload feature requires Digital Ocean Spaces credentials to be configured. Currently, the `.env` file has placeholder values that need to be replaced with your actual credentials.

## Current Status

❌ **Digital Ocean Spaces Not Configured**

The backend `.env` file contains placeholder values:
```env
DO_SPACES_KEY=your_access_key_here
DO_SPACES_SECRET=your_secret_key_here
DO_SPACES_BUCKET=child-records
DO_SPACES_REGION=nyc3
```

## Solution Options

### Option 1: Configure Digital Ocean Spaces (Recommended)

#### Step 1: Create Digital Ocean Spaces Account
1. Go to [DigitalOcean.com](https://www.digitalocean.com/)
2. Sign up or log in to your account
3. Navigate to "Spaces" in the sidebar
4. Create a new Space:
   - Name: `child-records` (or any name you prefer)
   - Region: `NYC3` (or your preferred region)
   - CDN: Enable if desired
   - File Listing: Restrict (recommended for security)

#### Step 2: Generate API Keys
1. Go to API → Spaces Keys
2. Generate a new Spaces access key
3. Copy the Key and Secret

#### Step 3: Update Backend Configuration
Update `backend/.env` with your actual credentials:

```env
# Digital Ocean Spaces Configuration
DO_SPACES_KEY=your_actual_access_key
DO_SPACES_SECRET=your_actual_secret_key
DO_SPACES_BUCKET=child-records
DO_SPACES_REGION=nyc3
```

#### Step 4: Restart Backend
```bash
cd backend
npm start
```

#### Step 5: Test Configuration
```bash
cd backend
node test-presigned-url.js
```

You should see:
```
Testing presigned URL generation...
Bucket: child-records
Region: nyc3

Presigned URL generated successfully!
URL: https://child-records.nyc3.digitaloceanspaces.com/test/photo_test.jpg?signature=...
```

### Option 2: Use Direct Upload (Fallback)

If you don't want to set up Digital Ocean Spaces right now, the app will automatically fall back to the direct upload method. You'll see a warning message but uploads will still work.

**Limitations of Direct Upload:**
- Files are uploaded through the backend server (slower)
- Limited by server bandwidth and resources
- No per-file progress tracking
- Less scalable for multiple users

## Testing the Upload Flow

### With Digital Ocean Configured:
1. Start backend: `cd backend && npm start`
2. Start frontend: `npm start`
3. Navigate to camera capture page
4. Capture photos/videos
5. Click "Upload All"
6. You should see: "Generating upload URLs..." → "Uploading files..." → "Saving records..."

### Without Digital Ocean (Fallback):
1. Same steps as above
2. You'll see a warning: "Presigned URLs not available, using direct upload"
3. Upload will proceed using the legacy direct upload method

## Environment Variables Reference

### Required for Presigned URLs:
```env
DO_SPACES_KEY=your_access_key
DO_SPACES_SECRET=your_secret_key
DO_SPACES_BUCKET=your_bucket_name
DO_SPACES_REGION=your_region
```

### Common Regions:
- `nyc3` - New York 3
- `sfo3` - San Francisco 3
- `ams3` - Amsterdam 3
- `sgp1` - Singapore 1
- `fra1` - Frankfurt 1

## Troubleshooting

### Error: "Digital Ocean Spaces not configured"
- Check that all four DO_SPACES_* variables are set in `.env`
- Restart the backend server after updating `.env`

### Error: "MissingRequiredParameter: Missing required key 'Bucket'"
- The DO_SPACES_BUCKET variable is not set or empty
- Check `.env` file and restart server

### Error: "SignatureDoesNotMatch"
- The DO_SPACES_KEY or DO_SPACES_SECRET is incorrect
- Verify credentials in Digital Ocean dashboard

### Error: "NoSuchBucket"
- The bucket name doesn't exist or is in a different region
- Check bucket name and region in Digital Ocean dashboard

## Benefits of Digital Ocean Spaces

✅ **Performance**: Direct upload to cloud storage  
✅ **Scalability**: No server bandwidth limitations  
✅ **Progress Tracking**: Per-file upload progress  
✅ **Reliability**: Built-in redundancy and CDN  
✅ **Cost-Effective**: Pay only for storage used  

## Security Considerations

- Presigned URLs expire after 1 hour (configurable)
- Files are set to `public-read` for easy access
- Access keys should be kept secure and not committed to version control
- Consider using IAM roles in production environments

## Next Steps

1. **Immediate**: Configure Digital Ocean Spaces credentials
2. **Testing**: Test the presigned URL flow end-to-end
3. **Production**: Set up proper IAM roles and security policies
4. **Monitoring**: Add logging and error tracking
5. **Optimization**: Implement client-side image compression

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Check the backend server logs
3. Verify all environment variables are set correctly
4. Test the presigned URL generation script
5. Ensure Digital Ocean credentials have proper permissions