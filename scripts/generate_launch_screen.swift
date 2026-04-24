import AppKit
import Foundation

let fm = FileManager.default
let cwd = URL(fileURLWithPath: fm.currentDirectoryPath)
let iconURL = cwd.appendingPathComponent("ios/App/App/Assets.xcassets/AppIcon.appiconset/appstore.png")
let outputURL = cwd.appendingPathComponent("ios/App/App/Assets.xcassets/Splash.imageset/launch-atmosphere.png")

guard let icon = NSImage(contentsOf: iconURL) else {
  fputs("Could not load app icon at \(iconURL.path)\n", stderr)
  exit(1)
}

let canvasSize = NSSize(width: 2732, height: 2732)
let rect = NSRect(origin: .zero, size: canvasSize)
guard let bitmap = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: Int(canvasSize.width),
  pixelsHigh: Int(canvasSize.height),
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
) else {
  fputs("Could not create bitmap context\n", stderr)
  exit(1)
}

bitmap.size = canvasSize
NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
  fputs("Could not create graphics context\n", stderr)
  exit(1)
}
NSGraphicsContext.current = context

let gradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.11, green: 0.39, blue: 0.84, alpha: 1.0),
  NSColor(calibratedRed: 0.09, green: 0.60, blue: 0.86, alpha: 1.0),
  NSColor(calibratedRed: 0.41, green: 0.85, blue: 0.81, alpha: 1.0),
])!
gradient.draw(in: rect, angle: -70)

func drawGlow(center: NSPoint, diameter: CGFloat, color: NSColor, blur: CGFloat) {
  NSGraphicsContext.saveGraphicsState()
  let shadow = NSShadow()
  shadow.shadowColor = color
  shadow.shadowBlurRadius = blur
  shadow.shadowOffset = .zero
  shadow.set()

  color.withAlphaComponent(color.alphaComponent * 0.28).setFill()
  let coreDiameter = diameter * 0.42
  let origin = NSPoint(x: center.x - coreDiameter / 2, y: center.y - coreDiameter / 2)
  NSBezierPath(ovalIn: NSRect(origin: origin, size: NSSize(width: coreDiameter, height: coreDiameter))).fill()
  NSGraphicsContext.restoreGraphicsState()
}

drawGlow(
  center: NSPoint(x: 610, y: 2550),
  diameter: 980,
  color: NSColor(calibratedWhite: 1.0, alpha: 0.28),
  blur: 150
)

drawGlow(
  center: NSPoint(x: 2250, y: 640),
  diameter: 1080,
  color: NSColor(calibratedWhite: 1.0, alpha: 0.14),
  blur: 180
)

let waveColor = NSColor(calibratedWhite: 1.0, alpha: 0.12)
waveColor.setFill()
let wavePath = NSBezierPath()
wavePath.move(to: NSPoint(x: -220, y: 690))
wavePath.curve(to: NSPoint(x: 1210, y: 900),
               controlPoint1: NSPoint(x: 120, y: 980),
               controlPoint2: NSPoint(x: 660, y: 960))
wavePath.curve(to: NSPoint(x: 2950, y: 500),
               controlPoint1: NSPoint(x: 1770, y: 820),
               controlPoint2: NSPoint(x: 2320, y: 660))
wavePath.line(to: NSPoint(x: 2950, y: -200))
wavePath.line(to: NSPoint(x: -220, y: -200))
wavePath.close()
wavePath.fill()

let iconShadow = NSShadow()
iconShadow.shadowColor = NSColor(calibratedRed: 0.04, green: 0.12, blue: 0.29, alpha: 0.18)
iconShadow.shadowBlurRadius = 40
iconShadow.shadowOffset = NSSize(width: 0, height: -20)
iconShadow.set()

let iconSize: CGFloat = 402
let iconRect = NSRect(
  x: (canvasSize.width - iconSize) / 2,
  y: 1414,
  width: iconSize,
  height: iconSize
)

let iconPlate = NSBezierPath(roundedRect: iconRect, xRadius: 88, yRadius: 88)
NSColor(calibratedWhite: 1.0, alpha: 0.30).setFill()
iconPlate.fill()

let innerGlow = NSBezierPath(roundedRect: iconRect.insetBy(dx: 5, dy: 5), xRadius: 92, yRadius: 92)
NSColor(calibratedWhite: 1.0, alpha: 0.72).setStroke()
innerGlow.lineWidth = 2
innerGlow.stroke()

let clippedIconRect = iconRect.insetBy(dx: 18, dy: 18)
let clipPath = NSBezierPath(roundedRect: clippedIconRect, xRadius: 70, yRadius: 70)
NSGraphicsContext.saveGraphicsState()
clipPath.addClip()
icon.draw(in: clippedIconRect)
NSGraphicsContext.restoreGraphicsState()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
paragraph.lineSpacing = 8

let titleAttributes: [NSAttributedString.Key: Any] = [
  .font: NSFont.systemFont(ofSize: 174, weight: .bold),
  .foregroundColor: NSColor(calibratedWhite: 1.0, alpha: 1.0),
  .paragraphStyle: paragraph,
  .kern: -4.6,
]

let subtitleAttributes: [NSAttributedString.Key: Any] = [
  .font: NSFont.systemFont(ofSize: 60, weight: .medium),
  .foregroundColor: NSColor(calibratedWhite: 1.0, alpha: 0.78),
  .paragraphStyle: paragraph,
  .kern: -0.15,
]

let title = NSAttributedString(string: "WearCast", attributes: titleAttributes)
let subtitle = NSAttributedString(string: "Weather-led outfit guidance,\nwithout the guesswork.", attributes: subtitleAttributes)

title.draw(in: NSRect(x: 410, y: 1010, width: 1912, height: 210))
subtitle.draw(in: NSRect(x: 500, y: 850, width: 1732, height: 170))

NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Could not encode PNG\n", stderr)
  exit(1)
}

try png.write(to: outputURL)
print(outputURL.path)
