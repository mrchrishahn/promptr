import type { ReactElement } from "react"
import { ResponsiveContainer } from "recharts"

interface ChartContainerProps {
  children: ReactElement
  className?: string
}

export function ChartContainer({
  children,
  className,
}: ChartContainerProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

interface ChartTooltipProps {
  children: ReactElement
  className?: string
}

export function ChartTooltip({
  children,
  className,
}: ChartTooltipProps) {
  return (
    <div
      className={`rounded-lg border bg-background p-2 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

interface ChartTooltipContentProps {
  label?: string
  value?: string | number
  className?: string
}

export function ChartTooltipContent({
  label,
  value,
  className,
}: ChartTooltipContentProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <p className="font-medium text-muted-foreground text-sm">{label}</p>
      )}
      {value && <p className="font-bold text-sm">{value}</p>}
    </div>
  )
} 