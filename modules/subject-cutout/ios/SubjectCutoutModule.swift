import CoreImage
import ExpoModulesCore
import Vision

// Subject lift (CLAUDE.md §4): the same Vision request behind Apple's
// press-and-hold "lift subject" — VNGenerateForegroundInstanceMaskRequest,
// iOS 17+. Input: a file URI. Output: a PNG file URI the same size as the
// input with everything but the subject(s) transparent, or nil when Vision
// finds no subject. Android and Expo Go never load this module; the JS
// wrapper hides the feature there.

public class SubjectCutoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SubjectCutout")

    Constant("isAvailable") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    AsyncFunction("liftSubject") { (uri: String) -> String? in
      guard #available(iOS 17.0, *) else {
        return nil
      }
      guard
        let url = URL(string: uri),
        let ciImage = CIImage(contentsOf: url, options: [.applyOrientationProperty: true])
      else {
        throw Exception(name: "LoadFailed", description: "Could not load image at \(uri)")
      }

      let request = VNGenerateForegroundInstanceMaskRequest()
      let handler = VNImageRequestHandler(ciImage: ciImage)
      try handler.perform([request])

      guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
        return nil
      }

      // keep the full frame (not cropped) so the subject stays exactly
      // where it was in the layer — the background just turns transparent
      let maskedBuffer = try observation.generateMaskedImage(
        ofInstances: observation.allInstances,
        from: handler,
        croppedToInstancesExtent: false
      )
      let masked = CIImage(cvPixelBuffer: maskedBuffer)

      let context = CIContext()
      guard
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
        let png = context.pngRepresentation(of: masked, format: .RGBA8, colorSpace: colorSpace)
      else {
        throw Exception(name: "EncodeFailed", description: "Could not encode the masked image")
      }

      let file = FileManager.default.temporaryDirectory
        .appendingPathComponent("cutout-\(UUID().uuidString).png")
      try png.write(to: file)
      return file.absoluteString
    }
  }
}
