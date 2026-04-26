import UIKit
import WebKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {
    private var launchCoverView: UIView?
    private var launchCoverObservation: NSKeyValueObservation?
    private var launchCoverFallbackWorkItem: DispatchWorkItem?
    private var hasDismissedLaunchCover = false

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SubscriptionsPlugin())
        configureLaunchCover()
    }

    deinit {
        launchCoverObservation?.invalidate()
        launchCoverFallbackWorkItem?.cancel()
    }

    private func configureLaunchCover() {
        guard let webView else { return }

        view.backgroundColor = UIColor(red: 240 / 255, green: 247 / 255, blue: 1.0, alpha: 1.0)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

        let cover = UIView(frame: webView.bounds)
        cover.backgroundColor = UIColor(red: 240 / 255, green: 247 / 255, blue: 1.0, alpha: 1.0)
        cover.isUserInteractionEnabled = false
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let splashImageView = UIImageView(frame: cover.bounds)
        splashImageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        splashImageView.contentMode = .scaleAspectFill
        splashImageView.image = UIImage(named: "Splash")
        splashImageView.backgroundColor = cover.backgroundColor
        cover.addSubview(splashImageView)

        webView.addSubview(cover)
        launchCoverView = cover

        launchCoverObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] _, change in
            guard change.newValue == false else { return }
            self?.dismissLaunchCoverIfNeeded()
        }

        let fallback = DispatchWorkItem { [weak self] in
            self?.dismissLaunchCoverIfNeeded()
        }
        launchCoverFallbackWorkItem = fallback
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5, execute: fallback)
    }

    private func dismissLaunchCoverIfNeeded() {
        guard !hasDismissedLaunchCover else { return }
        hasDismissedLaunchCover = true
        launchCoverObservation?.invalidate()
        launchCoverFallbackWorkItem?.cancel()

        guard let cover = launchCoverView else { return }
        UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseOut]) {
            cover.alpha = 0
        } completion: { [weak self] _ in
            cover.removeFromSuperview()
            self?.launchCoverView = nil
        }
    }
}
