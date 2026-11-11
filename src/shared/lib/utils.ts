import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Figma text-style utilities (tokens.generated.css) are font sizes, not colors;
// without this, twMerge would treat `text-body-15` as a color and drop it.
const TEXT_SIZES = [
  'display',
  'display-43',
  'display-32',
  'heading',
  'heading-28',
  'heading-24',
  'title',
  'title-22',
  'title-21',
  'title-20',
  'body-lg',
  'body-lg-18',
  'body-lg-17',
  'body-lg-16',
  'body',
  'body-15',
  'body-14',
  'caption',
  'caption-13',
  'caption-12',
  'tiny',
  'tiny-10',
  'tiny-9',
]

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: TEXT_SIZES }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
