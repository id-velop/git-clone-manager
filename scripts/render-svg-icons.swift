import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = root.appendingPathComponent("chrome-extension/icons/icon.svg")
guard let image = NSImage(contentsOf: source) else {
  fatalError("Could not load \(source.path)")
}

for size in [16, 48, 128] {
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else { fatalError("Could not allocate \(size)px bitmap") }

  bitmap.size = NSSize(width: size, height: size)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: size, height: size).fill()
  image.draw(in: NSRect(x: 0, y: 0, width: size, height: size),
             from: .zero,
             operation: .sourceOver,
             fraction: 1)
  NSGraphicsContext.restoreGraphicsState()

  guard let data = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not encode \(size)px PNG")
  }
  let output = root.appendingPathComponent("chrome-extension/icons/icon\(size).png")
  try data.write(to: output)
}
