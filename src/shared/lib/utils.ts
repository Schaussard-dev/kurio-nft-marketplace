import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { TEXT_SIZES } from '@/styles/text-sizes.generated'

// Figma text-style utilities (tokens.generated.css) are font sizes, not colors;
// without this, twMerge would treat `text-body-15` as a color and drop it.

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: [...TEXT_SIZES] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
