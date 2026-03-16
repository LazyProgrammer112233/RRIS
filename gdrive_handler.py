import os
import io
import zipfile
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2 import service_account

class GDriveHandler:
    def __init__(self, credentials_path=None):
        self.creds = None
        if credentials_path and os.path.exists(credentials_path):
            self.creds = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=['https://www.googleapis.com/auth/drive.readonly']
            )
        self.service = build('drive', 'v3', credentials=self.creds)

    def extract_folder_id(self, url):
        """Extracts folder ID from a GDrive URL."""
        import re
        match = re.search(r'folders/([a-zA-Z0-9_-]+)', url)
        return match.group(1) if match else url

    def list_zip_files(self, folder_id):
        """Lists all .zip files in a folder."""
        query = f"'{folder_id}' in parents and mimeType = 'application/zip' and trashed = false"
        results = self.service.files().list(
            q=query, pageSize=1000, fields="nextPageToken, files(id, name)"
        ).execute()
        return results.get('files', [])

    def download_file(self, file_id):
        """Downloads a file to a BytesIO object."""
        request = self.service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        fh.seek(0)
        return fh

class ZipProcessor:
    @staticmethod
    def get_images_from_zip(zip_bytes):
        """Extracts images from a zip file and returns a list of PIL Image objects."""
        from PIL import Image
        images = []
        with zipfile.ZipFile(zip_bytes) as z:
            for name in z.namelist():
                if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    with z.open(name) as f:
                        images.append(Image.open(io.BytesIO(f.read())))
        return images
