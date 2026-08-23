import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import useCalendarLocale from "@/hooks/useCalendarLocale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// NOTE — this file is a shadcn component but is NOT stock: it has been made
// language-aware. Regenerating it from the shadcn CLI will silently drop the
// three props below and every date picker in the app reverts to English
// month names and LTR navigation on the Hebrew site. Six callsites rely on
// this happening automatically; none of them pass `locale` or `dir`.
//
// See hooks/useCalendarLocale for what react-day-picker gets wrong on its
// own and why these three props are needed.
//
// Each is a default, not an override — a caller that passes its own
// `locale`, `dir` or `labels` still wins.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  dir,
  labels,
  ...props
}) {
  const cal = useCalendarLocale();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale ?? cal.locale}
      dir={dir ?? cal.dir}
      labels={{ ...cal.labels, ...labels }}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        // Two separate traps here, both invisible in the markup.
        //
        // `!absolute`: react-day-picker's own stylesheet sets
        // `.rdp-button_reset { position: relative }`, and it is imported
        // (by common/DateField and search/WhenPicker) AFTER Tailwind's
        // utilities — so on any page where one of those happens to be
        // loaded, plain `absolute` loses and the arrows collapse in beside
        // the month name. The same component was laying out two different
        // ways depending on what else the page imported.
        //
        // `start`/`end` rather than `left`/`right`: these are logical
        // properties, so in RTL "previous month" moves to the right where
        // it belongs. Physical sides put the back arrow on the wrong end
        // of a Hebrew calendar.
        nav_button_previous: "!absolute start-1",
        nav_button_next: "!absolute end-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props} />
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
