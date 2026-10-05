export type UploadAsset = { uri: string; name: string; mimeType?: string | null; file?: Blob };

// Expo fetch accepts byte-readable file parts, not RN's proprietary { uri } parts.
// Keep metadata on the part: ExpoFile is not a Blob, so its filename argument is ignored.
export async function appendUploadFile(
  form: FormData,
  field: string,
  asset: UploadAsset,
  platform: string,
  readBytes: (uri: string) => Promise<Uint8Array>,
) {
  if (platform === 'web' && asset.file) {
    form.append(field, asset.file, asset.name);
    return;
  }
  // This is the bytes() interface handled by Expo's convertFormDataAsync.
  // Do not use RN's Blob constructor: it cannot wrap ArrayBuffer/typed arrays.
  const part = {
    name: asset.name,
    type: asset.mimeType || 'application/octet-stream',
    bytes: () => readBytes(asset.uri),
  };
  form.append(field, part as unknown as Blob);
}
