declare module 'ffmpeg-static' {
  const path: string | null
  export default path
}

declare module 'fluent-ffmpeg' {
  import { Readable } from 'stream'

  interface FfmpegCommand {
    input(input: string | Readable): FfmpegCommand
    inputFormat(format: string): FfmpegCommand
    audioFilters(filter: string): FfmpegCommand
    format(format: string): FfmpegCommand
    on(event: 'error', callback: (err: Error) => void): FfmpegCommand
    on(event: 'end', callback: () => void): FfmpegCommand
    pipe(): Readable
  }

  function ffmpeg(input?: string | Readable): FfmpegCommand
  namespace ffmpeg {
    function setFfmpegPath(path: string): void
  }
  export default ffmpeg
}