import { parseSVG, makeAbsolute } from "svg-path-parser"
import * as makerjs from "makerjs"

export function svgToDxf(svgText: string): string {
  const pathRegex = /<path[^>]*d="([^"]+)"[^>]*>/g

  let match
  const models: makerjs.IModel[] = []

  while ((match = pathRegex.exec(svgText)) !== null) {
    const d = match[1]
    let commands = parseSVG(d)
    commands = makeAbsolute(commands)

    const model: makerjs.IModel = { paths: {} }
    let last: { x: number; y: number } | null = null

    commands.forEach((cmd, i) => {
      if (cmd.code === "M") {
        last = { x: cmd.x, y: cmd.y }
      }

      if (cmd.code === "L" && last) {
        const name = `line_${i}`
        model.paths![name] = new makerjs.paths.Line(
          [last.x, last.y],
          [cmd.x, cmd.y]
        )
        last = { x: cmd.x, y: cmd.y }
      }
    })

    models.push(model)
  }

  const combined: makerjs.IModel = { models: {} }
  models.forEach((m, i) => (combined.models!["m" + i] = m))

  return makerjs.exporter.toDXF(combined)
}
