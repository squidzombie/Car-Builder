import type { CardDocument } from '../model/types'
import { blankCard } from './blank'
import { portraitCard } from './portrait'
import { fullBodyCard } from './fullBody'
import { actionCard } from './action'
import { retroCard } from './retro'
import { galaxyCard } from './galaxy'

// The v1 template registry (CLAUDE.md §8). Templates are just
// CardDocument factories; the chooser renders each through CardRenderer.

export type Template = {
  id: string
  name: string
  make: (id: string, now?: string) => CardDocument
}

export const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank', make: blankCard },
  { id: 'portrait', name: 'Portrait', make: portraitCard },
  { id: 'full-body', name: 'Full body', make: fullBodyCard },
  { id: 'action', name: 'Action', make: actionCard },
  { id: 'retro', name: 'Retro', make: retroCard },
  { id: 'galaxy', name: 'Galaxy', make: galaxyCard },
]
