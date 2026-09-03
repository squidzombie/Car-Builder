import AVFoundation
import ExpoModulesCore
import UIKit

// Video export (v1.5 in CLAUDE.md §9): the JS side renders the card at a
// sweep of tilts and hands each frame over as a JPEG (base64); this writes
// them into an H.264 mp4 with AVAssetWriter. One export at a time.

public class VideoExportModule: Module {
  private var writer: AVAssetWriter?
  private var input: AVAssetWriterInput?
  private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var frameIndex: Int64 = 0
  private var fps: Int32 = 30
  private var size = CGSize.zero
  private var outputURL: URL?

  public func definition() -> ModuleDefinition {
    Name("VideoExport")

    Constant("isAvailable") { () -> Bool in
      return true
    }

    AsyncFunction("begin") { (width: Int, height: Int, fps: Int) throws -> Void in
      let url = FileManager.default.temporaryDirectory
        .appendingPathComponent("card-\(UUID().uuidString).mp4")
      let w = try AVAssetWriter(outputURL: url, fileType: .mp4)
      let settings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: 8_000_000,
          AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ],
      ]
      let inp = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
      inp.expectsMediaDataInRealTime = false
      let adp = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: inp,
        sourcePixelBufferAttributes: [
          kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
          kCVPixelBufferWidthKey as String: width,
          kCVPixelBufferHeightKey as String: height,
        ]
      )
      w.add(inp)
      guard w.startWriting() else {
        throw Exception(
          name: "WriterFailed",
          description: w.error?.localizedDescription ?? "startWriting failed"
        )
      }
      w.startSession(atSourceTime: .zero)
      self.writer = w
      self.input = inp
      self.adaptor = adp
      self.frameIndex = 0
      self.fps = Int32(fps)
      self.size = CGSize(width: width, height: height)
      self.outputURL = url
    }

    AsyncFunction("appendFrame") { (jpegBase64: String) throws -> Void in
      guard let inp = self.input, let adp = self.adaptor else {
        throw Exception(name: "NotStarted", description: "Call begin() first")
      }
      guard
        let data = Data(base64Encoded: jpegBase64),
        let image = UIImage(data: data),
        let cg = image.cgImage
      else {
        throw Exception(name: "BadFrame", description: "Could not decode the frame image")
      }
      while !inp.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.004)
      }
      guard let pool = adp.pixelBufferPool else {
        throw Exception(name: "NoPool", description: "Pixel buffer pool unavailable")
      }
      var pb: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
      guard let buffer = pb else {
        throw Exception(name: "NoBuffer", description: "Could not allocate a pixel buffer")
      }
      CVPixelBufferLockBaseAddress(buffer, [])
      let ctx = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: Int(self.size.width),
        height: Int(self.size.height),
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
          | CGBitmapInfo.byteOrder32Little.rawValue
      )
      ctx?.draw(cg, in: CGRect(origin: .zero, size: self.size))
      CVPixelBufferUnlockBaseAddress(buffer, [])
      let time = CMTime(value: self.frameIndex, timescale: self.fps)
      if !adp.append(buffer, withPresentationTime: time) {
        throw Exception(
          name: "AppendFailed",
          description: self.writer?.error?.localizedDescription ?? "append failed"
        )
      }
      self.frameIndex += 1
    }

    AsyncFunction("finish") { () async throws -> String in
      guard let w = self.writer, let inp = self.input, let url = self.outputURL else {
        throw Exception(name: "NotStarted", description: "Call begin() first")
      }
      inp.markAsFinished()
      await w.finishWriting()
      self.writer = nil
      self.input = nil
      self.adaptor = nil
      self.outputURL = nil
      if w.status == .failed {
        throw Exception(
          name: "WriterFailed",
          description: w.error?.localizedDescription ?? "finishWriting failed"
        )
      }
      return url.absoluteString
    }

    AsyncFunction("cancel") { () -> Void in
      self.writer?.cancelWriting()
      self.writer = nil
      self.input = nil
      self.adaptor = nil
      self.outputURL = nil
    }
  }
}
