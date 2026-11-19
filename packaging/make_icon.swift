import AppKit
import CoreGraphics

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "EELAB-1024.png"
let S = 1024
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255, alpha: a)
}
func rr(_ r: CGRect, _ rad: CGFloat) -> CGPath { CGPath(roundedRect: r, cornerWidth: rad, cornerHeight: rad, transform: nil) }

let body = CGRect(x: 100, y: 100, width: 824, height: 824)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: rgb(0x000000, 0.45))
ctx.addPath(rr(body, 185)); ctx.setFillColor(rgb(0x0f1f3d)); ctx.fillPath()
ctx.restoreGState()
ctx.saveGState()
ctx.addPath(rr(body, 185)); ctx.clip()
let grad = CGGradient(colorsSpace: cs, colors: [rgb(0x1b3566), rgb(0x0a1530)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])

let green = rgb(0x2e8b2e), dkgreen = rgb(0x1c5a1c)
ctx.setLineCap(.round); ctx.setLineJoin(.round)
for (w, c) in [(CGFloat(30), dkgreen), (CGFloat(16), green)] {
    ctx.setStrokeColor(c); ctx.setLineWidth(w)
    ctx.move(to: CGPoint(x: 60, y: 215)); ctx.addLine(to: CGPoint(x: 300, y: 215)); ctx.addLine(to: CGPoint(x: 360, y: 275))
    ctx.addLine(to: CGPoint(x: 664, y: 275)); ctx.addLine(to: CGPoint(x: 724, y: 215)); ctx.addLine(to: CGPoint(x: 964, y: 215))
    ctx.strokePath()
}
for x in [CGFloat(300), 724] {
    ctx.setFillColor(rgb(0xc9a227)); ctx.fillEllipse(in: CGRect(x: x - 26, y: 189, width: 52, height: 52))
    ctx.setFillColor(rgb(0x0a1530)); ctx.fillEllipse(in: CGRect(x: x - 10, y: 205, width: 20, height: 20))
}

let chip = CGRect(x: 232, y: 360, width: 560, height: 420)
ctx.setFillColor(rgb(0xb8bcc4))
for i in 0..<7 {
    let x = chip.minX + 52 + CGFloat(i) * 72
    ctx.fill(CGRect(x: x, y: chip.maxY - 6, width: 36, height: 62))
    ctx.fill(CGRect(x: x, y: chip.minY - 56, width: 36, height: 62))
}
ctx.addPath(rr(chip, 26)); ctx.setFillColor(rgb(0xc9c7a4)); ctx.fillPath()
ctx.addPath(rr(chip.insetBy(dx: 7, dy: 7), 22)); ctx.setStrokeColor(rgb(0x7a1414)); ctx.setLineWidth(14); ctx.strokePath()
ctx.setFillColor(rgb(0x7a1414))
ctx.addArc(center: CGPoint(x: chip.minX + 7, y: chip.midY), radius: 34, startAngle: -.pi / 2, endAngle: .pi / 2, clockwise: false)
ctx.fillPath()

let win = CGRect(x: chip.minX + 70, y: chip.minY + 60, width: chip.width - 140, height: chip.height - 120)
ctx.addPath(rr(win, 18)); ctx.setFillColor(rgb(0x1a0606)); ctx.fillPath()

func seg(_ x: CGFloat, _ y: CGFloat, _ len: CGFloat, _ t: CGFloat, horizontal: Bool) -> CGPath {
    let p = CGMutablePath(), h = t / 2
    if horizontal {
        p.addLines(between: [CGPoint(x: x, y: y), CGPoint(x: x + h, y: y + h), CGPoint(x: x + len - h, y: y + h),
                             CGPoint(x: x + len, y: y), CGPoint(x: x + len - h, y: y - h), CGPoint(x: x + h, y: y - h)])
    } else {
        p.addLines(between: [CGPoint(x: x, y: y), CGPoint(x: x + h, y: y + h), CGPoint(x: x + h, y: y + len - h),
                             CGPoint(x: x, y: y + len), CGPoint(x: x - h, y: y + len - h), CGPoint(x: x - h, y: y + h)])
    }
    p.closeSubpath(); return p
}
func digit(_ ox: CGFloat, _ oy: CGFloat, w: CGFloat, h: CGFloat, on: Set<Character>) {
    let t: CGFloat = 30, g: CGFloat = 5, half = h / 2
    let segs: [(Character, CGPath)] = [
        ("a", seg(ox + g, oy + h, w - 2 * g, t, horizontal: true)),
        ("g", seg(ox + g, oy + half, w - 2 * g, t, horizontal: true)),
        ("d", seg(ox + g, oy, w - 2 * g, t, horizontal: true)),
        ("f", seg(ox, oy + half + g, half - 2 * g, t, horizontal: false)),
        ("e", seg(ox, oy + g, half - 2 * g, t, horizontal: false)),
        ("b", seg(ox + w, oy + half + g, half - 2 * g, t, horizontal: false)),
        ("c", seg(ox + w, oy + g, half - 2 * g, t, horizontal: false)),
    ]
    for (n, p) in segs {
        ctx.addPath(p)
        if on.contains(n) {
            ctx.saveGState(); ctx.setShadow(offset: .zero, blur: 18, color: rgb(0xff2a1a, 0.9))
            ctx.setFillColor(rgb(0xff2a1a)); ctx.fillPath(); ctx.restoreGState()
        } else { ctx.setFillColor(rgb(0x521010)); ctx.fillPath() }
    }
}
let dw: CGFloat = 104, dh: CGFloat = 196
let dy = win.midY - dh / 2
let E: Set<Character> = ["a", "d", "e", "f", "g"]
digit(win.midX - dw - 52, dy, w: dw, h: dh, on: E)
digit(win.midX + 52, dy, w: dw, h: dh, on: E)
ctx.restoreGState()

let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
