import { Object3D } from 'core'
import { render } from 'solid-webgpu'

function App() {
  // the skies the limits

  return <intrinsic1 />
}

const scene = new Object3D()
render(() => <App />, scene)

console.log(scene)
