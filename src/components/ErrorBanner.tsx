interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, retryDisabled, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-danger sm:flex-row sm:items-center"
    >
      <p className="flex-1 font-medium">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retryDisabled}
            className="min-h-11 rounded-xl bg-danger px-4 font-semibold text-surface disabled:opacity-50"
          >
            Try again
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-xl border border-danger/40 px-4 font-medium"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
