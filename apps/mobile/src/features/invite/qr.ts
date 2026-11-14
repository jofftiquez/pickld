// QR codes for invites (INV-07), made on the phone: the URL never leaves it to be drawn.
import qrcodeGenerator from 'qrcode-generator';

/**
 * An SVG path that draws the dark modules of `text`'s QR code, one unit per module, with `margin` light
 * modules around it. `size` is the side in modules, margin included (the SVG's viewBox).
 */
export function qrPath(text: string, margin: number): { d: string; size: number } {
  // Type 0 picks the smallest version that fits; M recovers from about 15% damage (a cracked screen).
  const qr = qrcodeGenerator(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return { d, size: count + margin * 2 };
}
