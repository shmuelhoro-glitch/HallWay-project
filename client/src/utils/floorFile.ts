// Turns the file the admin chose into the SVG text the server expects.
// - An SVG file is sent as it is.
// - A PNG / JPG (a photo or a scan of the plan) is wrapped inside a small SVG,
//   with a viewBox in the size of the image. That way every floor is an SVG with a viewBox.

// The server accepts up to 5 MB, and a picture grows by about a third when sent as text
export const MAX_FLOOR_FILE_BYTES = 3.5 * 1024 * 1024;

// A problem with the file itself (not with the server) - its message is shown as is
export class FloorFileError extends Error {}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new FloorFileError('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new FloorFileError('This image could not be opened.'));
    image.src = dataUrl;
  });
}

export async function floorFileToSvg(file: File): Promise<string> {
  if (file.size > MAX_FLOOR_FILE_BYTES) {
    throw new FloorFileError('The file is too big. The limit is 3.5 MB.');
  }

  const fileName = file.name.toLowerCase();

  if (file.type === 'image/svg+xml' || fileName.endsWith('.svg')) {
    return file.text();
  }

  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    const dataUrl = await readAsDataUrl(file);
    const { width, height } = await getImageSize(dataUrl);

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
      `<image href="${dataUrl}" width="${width}" height="${height}"/>` +
      '</svg>'
    );
  }

  throw new FloorFileError('Choose an SVG, PNG or JPG file.');
}
