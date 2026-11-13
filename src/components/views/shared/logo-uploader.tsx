'use client'

import { useRef, useState } from 'react'
import { Upload, Trash2, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================================================
// LogoUploader — reusable logo file picker with 100 KB validation.
// ----------------------------------------------------------------------------
// Props:
//   initialDataUrl: the current logo as a data URL (or empty string)
//   onChange: called with the new data URL (or '' when removed)
//   label: text label for the field (default: "Logo")
//   maxSizeKb: max file size in KB (default: 100)
//   hint: optional extra hint text shown under the button
// ============================================================================
export function LogoUploader({
  initialDataUrl = '',
  onChange,
  label = 'Logo',
  maxSizeKb = 100,
  hint,
}: {
  initialDataUrl?: string
  onChange: (dataUrl: string) => void
  label?: string
  maxSizeKb?: number
  hint?: string
}) {
  const [dataUrl, setDataUrl] = useState<string>(initialDataUrl)
  const [error, setError] = useState<string>('')
  const [reading, setReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const maxBytes = maxSizeKb * 1024

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side size check on the raw file
    if (file.size > maxBytes) {
      setError(`File is ${Math.round(file.size / 1024)} KB — maximum is ${maxSizeKb} KB. Please choose a smaller image.`)
      e.target.value = ''
      return
    }

    setReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      // Double-check the encoded (base64) size — encoding inflates by ~33%,
      // so a 75 KB image becomes a ~100 KB data URL. We enforce the limit
      // on the ENCODED size because that's what gets stored in the DB and
      // sent over the wire.
      const base64Part = result.split(',')[1] || ''
      const encodedBytes = Math.ceil(base64Part.length * 0.75)
      if (encodedBytes > maxBytes) {
        setError(`Image is ${Math.round(encodedBytes / 1024)} KB when encoded — maximum is ${maxSizeKb} KB. Try a smaller or more compressed image (e.g. JPG instead of PNG, or 256×256 instead of 1024×1024).`)
        setReading(false)
        return
      }
      setDataUrl(result)
      onChange(result)
      setReading(false)
    }
    reader.onerror = () => {
      setError('Failed to read the file. Please try another image.')
      setReading(false)
    }
    reader.readAsDataURL(file)
  }

  function handleRemove() {
    setDataUrl('')
    setError('')
    onChange('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={reading}
        >
          {reading
            ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Reading…</>
            : <><Upload className="mr-2 h-3.5 w-3.5" /> Choose file</>}
        </Button>

        {dataUrl ? (
          <>
            <img
              src={dataUrl}
              alt="Logo preview"
              className="h-14 w-14 object-contain border rounded bg-white"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
            </Button>
          </>
        ) : (
          <div className="h-14 w-14 border border-dashed rounded flex items-center justify-center text-muted-foreground bg-muted/20">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {hint || `Maximum file size: ${maxSizeKb} KB. PNG, JPG, WebP, or SVG. You can add or change this later.`}
      </p>
    </div>
  )
}

// Minimal Label import to avoid an extra file just for one component
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium">{children}</div>
}
