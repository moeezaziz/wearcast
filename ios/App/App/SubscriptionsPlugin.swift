import Foundation
import Capacitor
import StoreKit

@objc(SubscriptionsPlugin)
public class SubscriptionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SubscriptionsPlugin"
    public let jsName = "Subscriptions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    private let annualProductId = "wearcast_ai_premium_annual"
    private let monthlyProductId = "wearcast_ai_premium_monthly"

    private var knownProductIds: Set<String> {
        [annualProductId, monthlyProductId]
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        let requestedIds = call.getArray("productIds", String.self) ?? Array(knownProductIds)
        Task {
            do {
                let products = try await Product.products(for: Set(requestedIds))
                let payload = products
                    .sorted { $0.id < $1.id }
                    .map { serializeProduct($0) }
                call.resolve(["products": payload])
            } catch {
                call.reject("Could not load subscription products.", nil, error)
            }
        }
    }

    @objc func getEntitlements(_ call: CAPPluginCall) {
        Task {
            do {
                call.resolve(try await buildEntitlementPayload())
            } catch {
                call.reject("Could not load subscription entitlements.", nil, error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("A productId is required.")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Subscription product unavailable: \(productId)")
                    return
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("Purchase could not be verified.")
                        return
                    }
                    await transaction.finish()
                    var payload = try await buildEntitlementPayload()
                    payload["purchaseState"] = "purchased"
                    call.resolve(payload)
                case .userCancelled:
                    var payload = try await buildEntitlementPayload()
                    payload["purchaseState"] = "cancelled"
                    call.resolve(payload)
                case .pending:
                    var payload = try await buildEntitlementPayload()
                    payload["purchaseState"] = "pending"
                    call.resolve(payload)
                @unknown default:
                    call.reject("The purchase did not complete.")
                }
            } catch {
                call.reject("Could not complete the subscription purchase.", nil, error)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var payload = try await buildEntitlementPayload()
                payload["purchaseState"] = "restored"
                call.resolve(payload)
            } catch {
                call.reject("Could not restore purchases.", nil, error)
            }
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        guard let windowScene = bridge?.viewController?.view.window?.windowScene else {
            call.reject("Could not open subscription management.")
            return
        }

        Task {
            do {
                try await AppStore.showManageSubscriptions(in: windowScene)
                call.resolve()
            } catch {
                call.reject("Could not open subscription management.", nil, error)
            }
        }
    }

    private func buildEntitlementPayload() async throws -> [String: Any] {
        var activeProductIds: [String] = []
        var plan = "free"
        var trialActive = false

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            guard transaction.revocationDate == nil else { continue }
            guard knownProductIds.contains(transaction.productID) else { continue }

            activeProductIds.append(transaction.productID)
            if transaction.productID == annualProductId {
                plan = "annual"
            } else if plan == "free" && transaction.productID == monthlyProductId {
                plan = "monthly"
            }
            if let offer = transaction.offer {
                switch offer.type {
                case .introductory, .promotional:
                    trialActive = true
                default:
                    break
                }
            }
        }

        let productPayload = try await Product.products(for: knownProductIds).map { serializeProduct($0) }
        let hasPremium = !activeProductIds.isEmpty

        return [
            "status": hasPremium ? (trialActive ? "premium_trial" : "premium_active") : "free",
            "plan": plan,
            "trialActive": trialActive,
            "renewalStatus": hasPremium ? "active" : "none",
            "activeProductIds": activeProductIds.sorted(),
            "products": productPayload,
        ]
    }

    private func serializeProduct(_ product: Product) -> [String: Any] {
        let subscriptionPeriod = product.subscription?.subscriptionPeriod
        let offer = product.subscription?.introductoryOffer
        return [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "subscriptionPeriod": subscriptionPeriod.map { formatSubscriptionPeriod($0) } ?? "",
            "introductoryOffer": offer.map { formatIntroductoryOffer($0) } ?? "",
        ]
    }

    private func formatSubscriptionPeriod(_ period: Product.SubscriptionPeriod) -> String {
        let unit: String
        switch period.unit {
        case .day: unit = period.value == 1 ? "day" : "days"
        case .week: unit = period.value == 1 ? "week" : "weeks"
        case .month: unit = period.value == 1 ? "month" : "months"
        case .year: unit = period.value == 1 ? "year" : "years"
        @unknown default: unit = "period"
        }
        return "\(period.value) \(unit)"
    }

    private func formatIntroductoryOffer(_ offer: Product.SubscriptionOffer) -> String {
        let periodText = formatSubscriptionPeriod(offer.period)
        switch offer.paymentMode {
        case .freeTrial:
            return "Includes a free trial for \(periodText)"
        case .payAsYouGo:
            return "Intro offer available for \(periodText)"
        case .payUpFront:
            return "Intro pricing available"
        default:
            return "Introductory offer available"
        }
    }
}
