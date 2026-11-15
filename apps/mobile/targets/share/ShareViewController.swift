import ImageIO
import UIKit
import UniformTypeIdentifiers

// "Share → Pickld" on a photo (FR-CAP-02). It has no UI and no copy of its own. It copies the original photo
// into the App Group with its EXIF capture time and size, then opens the app's /shared-photo screen. That
// screen picks the slot and day, crops and edits as the gallery does, and explains any failure (the copy
// stays in en.json, AGENTS rule 13). The copied file still has its location: the app copies it into the
// queue and deletes it, and the upload pipeline re-encodes it without metadata (rule 5).
final class ShareViewController: UIViewController {
  private var started = false

  /// `<app>.share` → `<app>`: the host app's bundle id, which is also one of its URL schemes and names its
  /// App Group (`group.<app>`, app.config.ts).
  private var hostBundleId: String {
    let own = Bundle.main.bundleIdentifier ?? ""
    return own.hasSuffix(".share") ? String(own.dropLast(".share".count)) : own
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if started { return }
    started = true
    Task {
      // Without an id the app says the photo couldn't be read.
      let id = try? await handOff()
      openHostApp(id: id)
      extensionContext?.completeRequest(returningItems: nil)
    }
  }

  /// Writes `shared-photos/<id>.<ext>` and `shared-photos/<id>.json` in the App Group and returns the id.
  private func handOff() async throws -> String {
    guard
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.\(hostBundleId)")
    else { throw CocoaError(.fileNoSuchFile) }
    let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
    guard
      let provider = items.flatMap({ $0.attachments ?? [] })
        .first(where: { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) })
    else { throw CocoaError(.fileReadUnknown) }

    let folder = container.appendingPathComponent("shared-photos", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let id = UUID().uuidString.lowercased()

    // The original file, full quality (HEIC from Photos is converted by the app, which has more memory).
    let photo: URL = try await withCheckedThrowingContinuation { continuation in
      _ = provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, error in
        guard let url else {
          continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
          return
        }
        let ext = url.pathExtension.isEmpty ? "jpg" : url.pathExtension.lowercased()
        let copy = folder.appendingPathComponent("\(id).\(ext)")
        do {
          // The provider's file is deleted when this handler returns.
          try FileManager.default.copyItem(at: url, to: copy)
          continuation.resume(returning: copy)
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }

    var manifest: [String: Any] = ["photo": photo.lastPathComponent]
    if let source = CGImageSourceCreateWithURL(photo as CFURL, nil),
      let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
    {
      // Size as displayed: EXIF orientations 5 to 8 turn the picture a quarter.
      let width = props[kCGImagePropertyPixelWidth] as? Int
      let height = props[kCGImagePropertyPixelHeight] as? Int
      let turned = (props[kCGImagePropertyOrientation] as? Int ?? 1) > 4
      manifest["width"] = turned ? height : width
      manifest["height"] = turned ? width : height
      // The capture time only; the app decides the day from it (captureInfo).
      if let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any] {
        manifest["DateTimeOriginal"] = exif[kCGImagePropertyExifDateTimeOriginal] as? String
        manifest["OffsetTimeOriginal"] = exif[kCGImagePropertyExifOffsetTimeOriginal] as? String
      }
    }
    let data = try JSONSerialization.data(withJSONObject: manifest)
    try data.write(to: folder.appendingPathComponent("\(id).json"), options: .atomic)
    return id
  }

  /// Opens `<app>://shared-photo?id=<id>`. Extensions can't call UIApplication.shared, but the app object is
  /// further up the responder chain. The bundle id scheme can't be claimed by another Pickld build.
  private func openHostApp(id: String?) {
    let query = id.map { "?id=\($0)" } ?? ""
    guard let url = URL(string: "\(hostBundleId)://shared-photo\(query)") else { return }
    var responder: UIResponder? = self
    while let current = responder {
      if let application = current as? UIApplication {
        application.open(url)
        return
      }
      responder = current.next
    }
  }
}
