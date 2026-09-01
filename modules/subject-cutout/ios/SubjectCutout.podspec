Pod::Spec.new do |s|
  s.name           = 'SubjectCutout'
  s.version        = '1.0.0'
  s.summary        = 'Foreground subject lift via the Vision framework'
  s.description    = 'Exposes VNGenerateForegroundInstanceMaskRequest (iOS 17+) as liftSubject(uri) for the card builder photo cutout.'
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
