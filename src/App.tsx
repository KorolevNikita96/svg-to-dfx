import { useState } from "react"
import { svgToDxf } from "./utils/svgToDxf"
import "./App.css"

export default function App() {
  const [svgText, setSvgText] = useState("")
  const [log, setLog] = useState("")

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".svg")) {
      setLog("Ошибка: можно загружать только .svg")
      return
    }

    const text = await file.text()

    const normalized = text
      .split("\n")
      .map((l) => l.trim())
      .join("")

    setSvgText(normalized)
    setLog(`Файл ${file.name} загружен и преобразован в текст.`)
  }

  const handleConvert = () => {
    try {
      if (!svgText.trim()) {
        setLog("Ошибка: поле SVG пустое.")
        return
      }

      setLog("Конвертация SVG → DXF...")

      const dxf = svgToDxf(svgText)
      const blob = new Blob([dxf], { type: "application/dxf" })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "converted.dxf"
      a.click()
      URL.revokeObjectURL(url)

      setLog("DXF успешно скачан.")
    } catch (error: unknown) {
      if (error instanceof Error) {
        setLog("Ошибка конвертации: " + error.message)
      } else {
        setLog("Неизвестная ошибка")
      }
    }
  }

  return (
    <div className="app">
      <h2 className="title">SVG → DXF Converter</h2>

      <label className="file-label">
        <input
          type="file"
          accept=".svg"
          onChange={handleFile}
          className="file-input"
        />
        <span className="file-button">Загрузить SVG</span>
      </label>

      <textarea
        value={svgText}
        onChange={(e) => setSvgText(e.target.value)}
        placeholder="<svg> ... </svg>"
        className="svg-area"
      />

      <button className="convert-btn" onClick={handleConvert}>
        Конвертировать в DXF
      </button>

      {log && <div className="log-box">{log}</div>}
    </div>
  )
}
