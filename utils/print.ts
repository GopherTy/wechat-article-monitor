function waitForFrameLoad(frame: HTMLIFrameElement, timeoutMs: number) {
  if (frame.contentDocument?.readyState === 'complete') {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    const timer = window.setTimeout(resolve, timeoutMs);
    frame.addEventListener(
      'load',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function waitForImages(document: Document, timeoutMs: number) {
  const pendingImages = Array.from(document.images).filter(img => !img.complete);
  if (pendingImages.length === 0) {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    let settled = 0;
    const timer = window.setTimeout(resolve, timeoutMs);
    const done = () => {
      settled += 1;
      if (settled >= pendingImages.length) {
        window.clearTimeout(timer);
        resolve();
      }
    };

    pendingImages.forEach(img => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  });
}

export async function printIframe(frame: HTMLIFrameElement | null, options: { loadTimeoutMs?: number } = {}) {
  if (!frame) return;

  const loadTimeoutMs = options.loadTimeoutMs ?? 3000;
  await waitForFrameLoad(frame, loadTimeoutMs);

  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) return;

  await Promise.race([
    frameDocument.fonts?.ready ?? Promise.resolve(),
    new Promise(resolve => setTimeout(resolve, 1000)),
  ]);
  await waitForImages(frameDocument, loadTimeoutMs);

  frameWindow.focus();
  frameWindow.print();
}
