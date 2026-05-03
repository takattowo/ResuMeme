export async function downloadAsHtml(filename = 'enhanced-cv.html') {
  // Work on a clone so we don't mutate the live page.
  const clone = document.documentElement.cloneNode(true);

  // Inline images as base64 data URLs.
  const liveImages = Array.from(document.images);
  const cloneImages = Array.from(clone.querySelectorAll('img'));
  for (let i = 0; i < cloneImages.length; i++) {
    const liveSrc = liveImages[i] ? liveImages[i].src : cloneImages[i].src;
    if (liveSrc && !liveSrc.startsWith('data:')) {
      try {
        const dataUrl = await imageToDataUrl(liveSrc);
        cloneImages[i].setAttribute('src', dataUrl);
      } catch (e) {
        console.warn('Failed to inline image', liveSrc, e);
      }
    }
  }

  // Inline stylesheets.
  const links = Array.from(clone.querySelectorAll('link[rel="stylesheet"]'));
  for (const link of links) {
    try {
      const css = await fetch(link.href).then((r) => r.text());
      const style = document.createElement('style');
      style.textContent = css;
      link.replaceWith(style);
    } catch (e) {
      console.warn('Failed to inline stylesheet', link.href, e);
    }
  }

  // Strip scripts so the artifact is fully static.
  clone.querySelectorAll('script').forEach((s) => s.remove());

  const html = '<!DOCTYPE html>\n' + clone.outerHTML;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function imageToDataUrl(src) {
  const resp = await fetch(src);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
