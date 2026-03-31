"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle } from "lucide-react";

interface LeadCaptureFormProps {
  instanceId: string;
}

export function LeadCaptureForm({ instanceId }: LeadCaptureFormProps) {
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    company: "",
    message: "",
  });
  const [utm, setUtm] = useState({
    source: "",
    medium: "",
    campaign: "",
    term: "",
    content: "",
  });
  const [pageUrl, setPageUrl] = useState("");
  const [referrer, setReferrer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Capture UTM params from URL
    const params = new URLSearchParams(window.location.search);
    setUtm({
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      term: params.get("utm_term") || "",
      content: params.get("utm_content") || "",
    });

    setPageUrl(window.location.href);
    setReferrer(document.referrer);

    // Listen for UTM data from parent window (embed script)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "UTM_DATA") {
        setUtm((prev) => ({
          source: event.data.utm_source || prev.source,
          medium: event.data.utm_medium || prev.medium,
          campaign: event.data.utm_campaign || prev.campaign,
          term: event.data.utm_term || prev.term,
          content: event.data.utm_content || prev.content,
        }));
        if (event.data.pageUrl) setPageUrl(event.data.pageUrl);
        if (event.data.referrer) setReferrer(event.data.referrer);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.email) {
      setError("Email is required");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          company: form.company,
          customFields: form.message ? { message: form.message } : undefined,
          utm,
          pageUrl,
          referrer,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to submit form");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900">Thank you!</h3>
        <p className="text-sm text-gray-500 mt-1">
          We&apos;ve received your information and will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            placeholder="John"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            placeholder="Doe"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="john@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone
        </label>
        <Input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+1 (555) 000-0000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company
        </label>
        <Input
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          placeholder="Acme Inc."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="How can we help?"
          rows={3}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Submitting...
          </>
        ) : (
          "Get in Touch"
        )}
      </Button>
    </form>
  );
}
