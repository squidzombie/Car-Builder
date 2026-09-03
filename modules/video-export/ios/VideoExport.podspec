Pod::Spec.new do |s|
  s.name           = 'VideoExport'
  s.version        = '1.0.0'
  s.summary        = 'Frame-by-frame H.264 writer for the card tilt loop'
  s.description    = 'AVAssetWriter wrapper: begin(width, height, fps), appendFrame(jpegBase64), finish() -> mp4 file URI.'
  s.author         = 'Card Builder'
  s.homepage       = 'https://cardbuilder.expo.app'
  s.license        = { type: 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
