import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import WebRTC

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {

    // Configure the WebRTC audio session to use Movie Playback mode
    // This prevents microphone access requets when using the patch WebRTC SDK
    configureWebRTCAudioSession()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "WhepSimplePoc",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  private func configureWebRTCAudioSession() {
    let webRTCConfiguration = RTCAudioSessionConfiguration()
    webRTCConfiguration.mode = AVAudioSession.Mode.moviePlayback.rawValue
    webRTCConfiguration.category = AVAudioSession.Category.playback.rawValue
    webRTCConfiguration.categoryOptions = AVAudioSession.CategoryOptions.duckOthers
    RTCAudioSessionConfiguration.setWebRTC(webRTCConfiguration)
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
