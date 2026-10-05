import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { appendUploadFile, type UploadAsset } from './multipart';

export function attachUploadFile(form: FormData, field: string, asset: UploadAsset) {
  const file = Platform.OS === 'web' ? null : new File(asset.uri);
  return appendUploadFile(form, field, {
    ...asset, mimeType: asset.mimeType || file?.type,
  }, Platform.OS, () => file!.bytes());
}
