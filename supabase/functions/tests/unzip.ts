// Test support: reads a zip with the system Python's zipfile, an independent check of _shared/zip.ts.
/**
 * Reads an archive with Python's zipfile: runs testzip() (every CRC) and returns name → bytes. Throws
 * when Python can't read it.
 */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const script = [
    'import base64, io, json, sys, zipfile',
    'z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))',
    'bad = z.testzip()',
    'assert bad is None, bad',
    'assert all(i.compress_type == zipfile.ZIP_STORED for i in z.infolist())',
    'print(json.dumps({i.filename: base64.b64encode(z.read(i)).decode() for i in z.infolist()}))',
  ].join('\n');
  const child = new Deno.Command('python3', {
    args: ['-I', '-c', script],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'piped',
  })
    .spawn();
  const writer = child.stdin.getWriter();
  await writer.write(bytes);
  await writer.close();
  const out = await child.output();
  if (!out.success) throw new Error(`unzip: ${new TextDecoder().decode(out.stderr)}`);
  const files = JSON.parse(new TextDecoder().decode(out.stdout)) as Record<string, string>;
  return new Map(Object.entries(files).map(([k, v]) => [k, Uint8Array.from(atob(v), (c) => c.charCodeAt(0))]));
}
