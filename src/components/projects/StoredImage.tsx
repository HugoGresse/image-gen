import { useStoredImageUrl } from '../../hooks/useStoredImageUrl'

interface StoredImageProps {
  imageId: string | undefined
  alt: string
  className?: string
}

export function StoredImage({ imageId, alt, className = '' }: StoredImageProps) {
  const url = useStoredImageUrl(imageId)
  if (!url) return <div className={`bg-zinc-800 ${className}`} aria-hidden="true" />
  return <img src={url} alt={alt} className={className} />
}
