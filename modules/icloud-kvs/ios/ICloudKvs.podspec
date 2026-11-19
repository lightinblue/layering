Pod::Spec.new do |s|
  s.name           = 'ICloudKvs'
  s.version        = '0.1.0'
  s.summary        = 'NSUbiquitousKeyValueStore bridge for 포개'
  s.description    = 'Login-less iCloud key-value sync for study records and subjects'
  s.author         = 'lightinblue'
  s.homepage       = 'https://github.com/lightinblue/layering'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
