export interface Script {
  id: string
  title: string
  sceneCount: number
  lastEdited: string
}

export interface Scene {
  id: string
  scriptId: string
  heading: string
  title: string
  actionContext: string
  subtext: string
  draft: string
  orderIndex: number
  createdAt: string
  writtenByUser: boolean
}

export interface Character {
  id: string
  scriptId: string
  name: string
  note: string
  orderIndex: number
  createdAt: string
}

export interface CharacterEntry {
  id: string
  characterId: string
  content: string
  source: 'manual' | 'auto'
  createdAt: string
}

export interface ConsistencyIssue {
  character: string
  detail: string
  explanation: string
}
