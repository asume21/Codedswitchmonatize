import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, onClick, ...props }) {
        const isClickable = !!onClick
        return (
          <Toast key={id} {...props}>
            <div
              className={`grid gap-1 flex-1 ${isClickable ? 'cursor-pointer group/clickable' : ''}`}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={isClickable ? () => { onClick(); dismiss(id); } : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); dismiss(id); } } : undefined}
            >
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {isClickable && (
                <span className="text-[10px] uppercase tracking-widest text-cyan-400/60 mt-1 group-hover/clickable:text-cyan-400 transition-colors">
                  Click to open →
                </span>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
