/** Keep successful downloads alive briefly; failed activations release immediately. */
export function downloadFile(blob: Blob, name: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  let started = false;
  try {
    link.href = url; link.download = name;
    document.body.append(link); link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    started = true;
  } finally {
    link.remove();
    if (!started) URL.revokeObjectURL(url);
  }
}
