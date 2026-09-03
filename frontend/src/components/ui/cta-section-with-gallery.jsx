/**
 * cta-section-with-gallery — a staggered text column beside a four-cell
 * offset photo grid.
 *
 * Ported from a TypeScript source. This project is CRA + JavaScript
 * (`components.json` has `tsx: false`), so the prop types became JSDoc and
 * the behaviour is unchanged. Needs `motion` (installed for this).
 *
 * Reduced motion: this file animates opacity and a blur filter, and nothing
 * that moves. Wrap a usage in motion's `<MotionConfig reducedMotion="user">`
 * and transform-based animation is skipped for anyone who asked for less
 * movement, while the fade still runs — which is the behaviour that keeps
 * content from simply never appearing.
 */
"use client"

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const SPRING_TRANSITION_CONFIG = {
  type: "spring",
  stiffness: 100,
  damping: 16,
  mass: 0.75,
  restDelta: 0.005,
}

/** @type {import('motion/react').Variants} */
const filterVariants = {
  hidden: {
    opacity: 0,
    filter: "blur(10px)",
  },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
  },
}

const areaClasses = [
  "col-start-2 col-end-3 row-start-1 row-end-3", // .div1
  "col-start-1 col-end-2 row-start-2 row-end-4", // .div2
  "col-start-1 col-end-2 row-start-4 row-end-6", // .div3
  "col-start-2 col-end-3 row-start-3 row-end-5", // .div4
]

export const ContainerStagger = React.forwardRef(
  /** @param {import('motion/react').HTMLMotionProps<"div">} props */
  ({ transition, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial="hidden"
        whileInView={"visible"}
        viewport={{ once: true }}
        transition={{
          staggerChildren: transition?.staggerChildren ?? 0.2,
          delayChildren: transition?.delayChildren ?? 0.2,
          duration: 0.3,
          ...transition,
        }}
        {...props}
      />
    )
  },
)
ContainerStagger.displayName = "ContainerStagger"

export const ContainerAnimated = React.forwardRef(
  /** @param {import('motion/react').HTMLMotionProps<"div">} props */
  ({ transition, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={filterVariants}
        transition={{
          ...SPRING_TRANSITION_CONFIG,
          duration: 0.3,
          ...transition,
        }}
        {...props}
      />
    )
  },
)
ContainerAnimated.displayName = "ContainerAnimated"

export const GalleryGrid = React.forwardRef(
  /** @param {React.HTMLAttributes<HTMLDivElement>} props */
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "grid grid-cols-2 grid-rows-[50px_150px_50px_150px_50px] gap-4",
          className,
        )}
        {...props}
      />
    )
  },
)
GalleryGrid.displayName = "GalleryGrid"

export const GalleryGridCell = React.forwardRef(
  /** @param {import('motion/react').HTMLMotionProps<"div"> & { index: number }} props */
  ({ className, transition, index, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.3,
          delay: index * 0.2,
          delayChildren: transition?.delayChildren ?? 0.2,
        }}
        className={cn(
          "relative overflow-hidden rounded-xl shadow-xl",
          areaClasses[index],
          className,
        )}
        {...props}
      />
    )
  },
)
GalleryGridCell.displayName = "GalleryGridCell"
