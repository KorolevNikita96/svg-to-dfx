import { parseSVG, makeAbsolute } from "svg-path-parser"

// ----------------------------------------
// Типы
// ----------------------------------------
export interface Point {
  x: number
  y: number
}

export type Polyline = Point[]

// ----------------------------------------
// Кубическая интерполяция
// ----------------------------------------
function interpolateCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t

  return {
    x:
      mt * mt2 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t * t2 * p3.x,
    y: mt * mt2 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t * t2 * p3.y
  }
}

// ----------------------------------------
// Удаление дублей точек
// ----------------------------------------
function cleanup(poly: Polyline, tolerance = 0.0001): Polyline {
  if (poly.length < 2) return poly

  const out: Polyline = []
  let prev = poly[0]
  out.push(prev)

  for (let i = 1; i < poly.length; i++) {
    const p = poly[i]
    const dx = p.x - prev.x
    const dy = p.y - prev.y

    if (dx * dx + dy * dy > tolerance * tolerance) {
      out.push(p)
      prev = p
    }
  }

  return out
}

// ----------------------------------------
// DXF generator for ONE polyline
// ----------------------------------------
function polyToDXF(poly: Polyline, layer = "symbols"): string {
  let dxf = ""

  dxf += "0\nPOLYLINE\n"
  dxf += "8\n" + layer + "\n"
  dxf += "62\n7\n"
  dxf += "70\n1\n" // закрытый
  dxf += "10\n0\n20\n0\n"
  dxf += "66\n1\n"

  for (const p of poly) {
    dxf += "0\nVERTEX\n"
    dxf += "8\n" + layer + "\n"
    dxf += "10\n" + p.x + "\n"
    dxf += "20\n" + p.y + "\n"
    dxf += "70\n0\n"
  }

  dxf += "0\nSEQEND\n"
  dxf += "8\n" + layer + "\n"

  return dxf
}

// ----------------------------------------
// DXF document wrapper
// ----------------------------------------
function buildDXF(polylines: Polyline[]): string {
  let out = ""

  out += "0\nSECTION\n2\nHEADER\n"
  out += "9\n$ACADVER\n1\nAC1009\n"
  out += "9\n$EXTMIN\n10\n0\n20\n0\n"
  out += "9\n$EXTMAX\n10\n1000\n20\n1000\n"
  out += "0\nENDSEC\n"

  out += "0\nSECTION\n2\nENTITIES\n"
  for (const pl of polylines) {
    out += polyToDXF(pl)
  }
  out += "0\nENDSEC\n0\nEOF\n"

  return out
}

// ----------------------------------------
// SVG path → polyline
// ----------------------------------------
function svgPathToPolyline(d: string): Polyline {
  const cmds = makeAbsolute(parseSVG(d))
  const pts: Polyline = []

  let last: Point | null = null

  for (const c of cmds) {
    if (c.code === "M") {
      last = { x: c.x, y: c.y }
      pts.push(last)
    }

    if (c.code === "L") {
      last = { x: c.x, y: c.y }
      pts.push(last)
    }

    if (c.code === "C" && last) {
      const p0 = last
      const p1 = { x: c.x1, y: c.y1 }
      const p2 = { x: c.x2, y: c.y2 }
      const p3 = { x: c.x, y: c.y }

      for (let t = 0; t <= 1; t += 0.01) {
        pts.push(interpolateCubic(p0, p1, p2, p3, t))
      }

      last = p3
    }
  }

  return cleanup(pts)
}

// ----------------------------------------
// MAIN: SVG → DXF
// ----------------------------------------
export function svgToDxf(svg: string): string {
  const pathRegex = /<path[^>]*d="([^"]+)"/g

  const polylines: Polyline[] = []
  let match: RegExpExecArray | null

  while ((match = pathRegex.exec(svg)) !== null) {
    const d = match[1]
    const poly = svgPathToPolyline(d)

    if (poly.length > 1) {
      polylines.push(poly)
    }
  }

  return buildDXF(polylines)
}
