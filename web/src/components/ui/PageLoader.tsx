"use client";

interface PageLoaderProps {
  message?: string;
  visible: boolean;
}

export function PageLoader({ message = "", visible }: PageLoaderProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <svg
        className="animate-spin h-8 w-8 text-indigo-400"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8z"
        />
      </svg>
      {message && (
        <p className="text-sm text-white font-medium">{message}</p>
      )}
    </div>
  );
}
