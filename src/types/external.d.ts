declare module 'ffmpeg-static' {
  const path: string | null
  export default path
}

declare module 'fluent-ffmpeg' {
  import { Readable } from 'stream'
  type FfmpegCommand = any
  function ffmpeg(input?: string | Readable): FfmpegCommand
  namespace ffmpeg {
    let _setFfmpegPath: (path: string) => void
    function setFfmpegPath(path: string): void
  }
  export default ffmpeg
}