"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LeadCaptureForm } from "@/components/forms/lead-capture-form";
import { Spinner } from "@/components/ui/spinner";

function FormContent() {
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instanceId") || "demo";
  const theme = searchParams.get("theme") || "light";

  return (
    <div
      className={`min-h-screen p-6 ${
        theme === "dark" ? "bg-gray-900" : "bg-white"
      }`}
    >
      <div className="max-w-md mx-auto">
        <LeadCaptureForm instanceId={instanceId} />
      </div>
    </div>
  );
}

export default function EmbedFormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Spinner size="lg" />
        </div>
      }
    >
      <FormContent />
    </Suspense>
  );
}
