import { API_BASE_URL } from '../config';

export interface FileUploadResponse {
  id: string;
  originalName: string;
  url: string;
  contentType: string;
  fileSize: number;
  extension: string;
  storageType: string;
  category: string;
  uploaderId: string;
  uploaderType: string;
  referenceId: string;
  referenceType: string;
  isPublic: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  success: boolean;
}

const uploadFile = async (
  file: File, 
  token: string,
  referenceId?: string, 
  referenceType: string = 'MESSAGE', 
  isPublic: boolean = true
): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (referenceId) formData.append('referenceId', referenceId);
  formData.append('referenceType', referenceType);
  formData.append('isPublic', String(isPublic));

  const response = await fetch(`${API_BASE_URL}/api/v1/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const result: ApiResponse<FileUploadResponse> = await response.json();
  
  if (!result.success && result.code !== 200) {
     throw new Error(result.message || 'Upload failed');
  }

  return result.data;
};

export default {
  uploadFile
};
