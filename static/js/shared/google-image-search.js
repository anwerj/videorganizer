export async function openGoogleImageSearch(pngBlob) {
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": Promise.resolve(pngBlob) }),
        ]);
    } catch (e) {
        console.error("clipboard copy failed", e);
    }
    window.open("https://images.google.com", "_blank");
}
