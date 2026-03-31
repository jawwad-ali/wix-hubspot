import Link from "next/link";
import { ArrowRight, ArrowLeftRight, FileText, Shield, Settings } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <ArrowLeftRight className="h-4 w-4" />
            Wix + HubSpot Integration
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bi-Directional Contact Sync
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Automatically sync contacts between your Wix site and HubSpot CRM.
            Capture leads with UTM attribution. Configure field mappings without code.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/embed/form?instanceId=demo"
              className="inline-flex items-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Preview Form
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center mb-4">
              <ArrowLeftRight className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Bi-Directional Sync
            </h3>
            <p className="text-sm text-gray-600">
              Contacts sync in real-time between Wix and HubSpot via webhooks.
              Loop prevention ensures updates don&apos;t ping-pong. Last-write-wins
              conflict resolution handles simultaneous edits.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Lead Capture + UTM
            </h3>
            <p className="text-sm text-gray-600">
              Embeddable forms capture leads with full UTM attribution
              (source, medium, campaign, term, content). Submissions create
              contacts in both Wix and HubSpot automatically.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Configurable Field Mapping
            </h3>
            <p className="text-sm text-gray-600">
              Map any Wix contact field to any HubSpot property. Set sync direction
              per field (one-way or bi-directional). Apply transforms like
              lowercase, uppercase, or trim.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
              <Shield className="h-5 w-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Secure by Design
            </h3>
            <p className="text-sm text-gray-600">
              OAuth 2.0 for HubSpot connection. AES-256-GCM encryption for
              tokens at rest. JWT/HMAC webhook verification. No tokens
              exposed to frontend. Safe structured logging.
            </p>
          </div>
        </div>

        {/* API Plan */}
        <div className="mt-16 bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">API Plan</h2>
          <div className="space-y-6 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                Feature #1 — Bi-Directional Contact Sync
              </h4>
              <ul className="list-disc ml-5 text-gray-600 space-y-1">
                <li>
                  <strong>Wix:</strong> Contacts REST API v4 for CRUD + webhooks
                  (contact.created, contact.updated)
                </li>
                <li>
                  <strong>HubSpot:</strong> CRM Contacts API v3 for CRUD + Properties
                  API for field discovery + Webhook subscriptions for
                  contact.creation and contact.propertyChange
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                Feature #2 — Form & Lead Capture
              </h4>
              <ul className="list-disc ml-5 text-gray-600 space-y-1">
                <li>
                  <strong>Approach:</strong> Custom forms embedded via iframe, submissions
                  routed through our API to both Wix and HubSpot
                </li>
                <li>
                  <strong>Attribution:</strong> UTM params captured from parent page URL
                  via postMessage and mapped to HubSpot contact properties
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Security</h4>
              <ul className="list-disc ml-5 text-gray-600 space-y-1">
                <li>
                  HubSpot OAuth 2.0 authorization code flow with auto token refresh
                </li>
                <li>Wix client credentials auth via APP_ID + APP_SECRET + instanceId</li>
                <li>
                  Scopes: crm.objects.contacts.read, crm.objects.contacts.write
                  (least privilege)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
