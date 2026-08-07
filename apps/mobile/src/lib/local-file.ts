/** A local file to upload as multipart form data (camera capture or picker). */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

export function fileFormData(
  field: string,
  file: LocalFile,
  extra?: Record<string, string>,
): FormData {
  const form = new FormData();
  // React Native's FormData accepts this {uri,name,type} shape in place of a
  // Blob — the RN fetch polyfill turns it into a real multipart file part.
  form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) form.append(key, value);
  }
  return form;
}
