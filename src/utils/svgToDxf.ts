import { parseSVG, makeAbsolute } from "svg-path-parser"

// ---------------------------- TYPES ----------------------------
export type Point = { x: number; y: number }
export type Polyline = Point[]

// ---------------------------- SVG FIX ----------------------------
/**
 * Krita/InkScape иногда ломает SVG, объединяя теги и атрибуты:
 * <svgwidth= → <svg width=
 * <pathd= → <path d=
 * <textid= → <text id=
 * Это фиксирует все такие случаи.
 */
export function fixBrokenSvg(svg: string): string {
  return (
    svg

      // 1) |<tagattr=| → |<tag attr=|
      .replace(/<([a-zA-Z0-9:-]+)(?=[a-zA-Z-]+=)/g, "<$1 ")

      // 2) Между ATTR="..."ATTR2="..." вставить пробел
      .replace(/"([a-zA-Z-]+=)"/g, '" $1"')

      // 3) Убедиться, что d="..." заканчивается перед style=
      .replace(/d="([^"]+)"(?=[a-zA-Z-]+=)/g, `d="$1" `)

      // 4) Исправление объединённых атрибутов: x="12"y="33"
      .replace(/"([a-zA-Z0-9.-]+)"/g, '"$1" ')

      // 5) Удалить лишние пробелы
      .replace(/\s{2,}/g, " ")
  )
}

// ---------------------------- CUBIC INTERPOLATION ----------------------------
function cubicPoint(
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

// ---------------------------- CLEANUP ----------------------------
function cleanup(poly: Polyline, eps = 0.001): Polyline {
  const out: Polyline = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[i + 1]
    if (!b) {
      out.push(a)
      break
    }
    const dx = a.x - b.x
    const dy = a.y - b.y
    if (dx * dx + dy * dy > eps * eps) out.push(a)
  }
  return out
}

// ---------------------------- PATH → POLYLINE ----------------------------
export function svgPathToPolyline(d: string): Polyline {
  const cmds = makeAbsolute(parseSVG(d))
  const pts: Polyline = []

  let last: Point | null = null

  for (const c of cmds) {
    // Move
    if (c.code === "M") {
      last = { x: c.x, y: c.y }
      pts.push(last)
    }

    // Line
    if (c.code === "L") {
      last = { x: c.x, y: c.y }
      pts.push(last)
    }

    // Cubic
    if (c.code === "C" && last) {
      const p0 = last
      const p1 = { x: c.x1, y: c.y1 }
      const p2 = { x: c.x2, y: c.y2 }
      const p3 = { x: c.x, y: c.y }

      for (let t = 0; t <= 1; t += 0.01) {
        pts.push(cubicPoint(p0, p1, p2, p3, t))
      }
      last = p3
    }
  }

  return cleanup(pts)
}

// ---------------------------- POLYLINE → DXF ----------------------------
function polyToDXF(poly: Polyline, layer = "symbols"): string {
  let s = ""

  s += "0\nPOLYLINE\n"
  s += "8\n" + layer + "\n"
  s += "62\n7\n"
  s += "70\n1\n" // closed
  s += "10\n0\n20\n0\n"
  s += "66\n1\n"

  for (const p of poly) {
    s += "0\nVERTEX\n"
    s += "8\n" + layer + "\n"
    s += "10\n" + p.x + "\n"
    s += "20\n" + p.y + "\n"
    s += "70\n0\n"
  }

  s += "0\nSEQEND\n"
  s += "8\n" + layer + "\n"

  return s
}

// ---------------------------- BUILD DXF ----------------------------
export function buildDXF(polylines: Polyline[]): string {
  let dx = ""

  dx += "0\nSECTION\n2\nHEADER\n"
  dx += "9\n$ACADVER\n1\nAC1009\n"
  dx += "9\n$EXTMIN\n10\n0\n20\n0\n"
  dx += "9\n$EXTMAX\n10\n1000\n20\n1000\n"
  dx += "0\nENDSEC\n"

  dx += "0\nSECTION\n2\nENTITIES\n"
  for (const p of polylines) dx += polyToDXF(p)
  dx += "0\nENDSEC\n0\nEOF\n"

  return dx
}

// ---------------------------- MAIN SVG → DXF ----------------------------
export function svgToDxf(svgRaw: string): string {
  const svg = fixBrokenSvg(svgRaw)

  const pathRegex = /<path[^>]* d="([^"]+)"/g
  const result: Polyline[] = []

  let m
  while ((m = pathRegex.exec(svg)) !== null) {
    const d = m[1]
    const poly = svgPathToPolyline(d)
    if (poly.length > 1) result.push(poly)
  }

  return buildDXF(result)
}
