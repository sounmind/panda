import { usePandaContext } from '@/src/hooks/usePandaContext'
import { State } from '@/src/hooks/usePlayground'
import { Project } from '@pandacss/parser'
import type { Config } from '@pandacss/types'
import { useMemo } from 'react'

export function usePanda(state: State, config: Config | null) {
  const { code: source, css } = state

  const context = usePandaContext(config)

  const staticArtifacts = useMemo(() => {
    const sheet = context.createSheet()
    context.appendLayerParams(sheet)
    context.appendBaselineCss(sheet)

    const staticSheet = context.createSheet()
    context.appendCssOfType('static', staticSheet)

    const cssArtifacts = [
      { file: 'Tokens', code: sheet.getLayerCss('tokens') },
      { file: 'Reset', code: sheet.getLayerCss('reset') },
      { file: 'Global', code: sheet.getLayerCss('base') },
      { file: 'Static', code: staticSheet.getLayerCss('recipes', 'utilities') },
    ]

    return cssArtifacts
  }, [context])

  return useMemo(() => {
    const project = new Project({
      useInMemoryFileSystem: true,
      parserOptions: context.parserOptions,
      getFiles: () => ['code.tsx'],
      readFile: (file) => (file === 'code.tsx' ? source : ''),
      hooks: context.hooks,
    })

    // Fork to discard any cache from previous runs
    // so the CSS won't grow indefinitely
    const encoder = context.encoder.clone()
    const parserResult = project.parseSourceFile('code.tsx', encoder)
    const sheet = context.createSheet()

    const decoder = context.decoder.clone().collect(encoder)
    try {
      sheet.processDecoder(decoder)
    } catch (error) {
      console.log(error)
    }

    const artifacts = context.getArtifacts() ?? []

    const allJsFiles = artifacts.generated.filter((a) => a.id.endsWith('.js'))
    const previewJs = allJsFiles
      .map((f) => f.content?.replaceAll(/import .*/g, '').replaceAll(/export \* from '(.+?)';/g, ''))
      ?.join('\n')

    const cssArtifacts: CssFileArtifact[] = [
      { file: 'Utilities', code: sheet.getLayerCss('utilities') },
      { file: 'Recipes', code: sheet.getLayerCss('recipes') },
    ].concat(staticArtifacts)

    const previewCss = [css, ...cssArtifacts.map((a) => a.code ?? '')].join('\n')

    const panda = {
      previewCss,
      artifacts,
      previewJs,
      parserResult,
      cssArtifacts,
      context,
    }
    return panda
  }, [source, css, context, staticArtifacts])
}

export interface CssFileArtifact {
  file: string
  code: string | undefined
  dir?: string[] | undefined
}

export type UsePanda = ReturnType<typeof usePanda>
