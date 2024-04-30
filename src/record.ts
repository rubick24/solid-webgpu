export const record = (canvas: HTMLCanvasElement) => {
  let chunks: Blob[] = []
  const canvas_stream = canvas.captureStream(60) // fps
  // Create media recorder from canvas stream

  const media_recorder = new MediaRecorder(canvas_stream, { mimeType: 'video/webm; codecs=vp9' })

  media_recorder.addEventListener('dataavailable', e => chunks.push(e.data))
  // Provide recorded data when recording stops

  return {
    start: () => media_recorder.start(1000),
    stop: async () => {
      media_recorder.stop()

      await new Promise<void>(r => {
        media_recorder.addEventListener('stop', () => r())
      })
      const blob = new Blob(chunks, { type: 'video/webm' })
      chunks = []
      return blob
    }
  }
}
