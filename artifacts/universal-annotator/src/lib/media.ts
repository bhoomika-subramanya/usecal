/**
 * Utility functions for handling media in the web interface
 */

/**
 * Uploads an image File or Blob to the backend API and returns the Markdown image link.
 */
export async function uploadImageFile(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("http://localhost:3001/api/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  const imgUrl = "http://localhost:3001" + data.url;
  return `\n![image](${imgUrl})\n`;
}

/**
 * Captures a screenshot using the browser's Screen Capture API (getDisplayMedia).
 * Prompts the user to select a window/screen, extracts a frame, uploads it, and returns the Markdown link.
 */
export async function captureWebScreenshot(): Promise<string> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error("Screen capture is not supported in this browser.");
  }

  // 1. Request screen share from the user
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: "window",
    },
    audio: false,
  });

  try {
    // 2. Play the stream in an offscreen video element
    const video = document.createElement("video");
    video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject);
      };
      video.onerror = reject;
    });

    // 3. Draw a frame to a canvas
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 4. Convert to Blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to create blob from canvas"));
      }, "image/png");
    });

    // 5. Upload the blob and return markdown
    return await uploadImageFile(blob);
  } finally {
    // 6. Ensure we stop the screen sharing tracks
    stream.getTracks().forEach((track) => track.stop());
  }
}
